import {
  activityRanges,
  AdoUser,
  assertReadOnlyRequest,
  ParsedWorkItem,
  PullRequestRef,
  readAdoErrorMessage,
  readConnectionUser,
  readPullRequestCommitDays,
  readRevisions,
  readWorkItemIds,
  readWorkItems,
  SuggestionSpan,
  TRACKED_WORK_ITEM_TYPE_NAMES,
  withAccountsFromUpdates,
  WorkItemRevision
} from './parse';

const API_VERSION = '7.1';
const CONNECTION_DATA_VERSION = '7.1-preview.1';
const PAGE_SIZE = 200;
const MAX_PAGES = 50;
const MAX_ATTEMPTS = 3;
const MAX_RETRY_SECONDS = 15;
const HTTP_REDIRECT = 300;
const HTTP_CLIENT_ERROR = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_TOO_MANY = 429;
const MILLISECONDS_PER_SECOND = 1000;
const WORK_ITEM_FIELDS = [
  'System.Id',
  'System.Title',
  'System.WorkItemType',
  'System.State',
  'System.ChangedDate'
];
const ASSIGNED_WORK_ITEMS_QUERY = [
  'SELECT [System.Id]',
  'FROM WorkItems',
  'WHERE [System.AssignedTo] = @Me',
  `AND [System.WorkItemType] IN (${TRACKED_WORK_ITEM_TYPE_NAMES.map(name => `'${name}'`).join(', ')})`,
  "AND [System.State] <> 'Removed'"
].join(' ');

export class AdoRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdoRequestError';
  }
}

export class AdoClient {
  constructor(
    private readonly organization: string,
    private readonly authorization: string,
    private readonly rejectedMessage: string
  ) {}

  async currentUser(): Promise<AdoUser> {
    const body = await this.sendAdoRequest('GET', '/_apis/connectionData', undefined, CONNECTION_DATA_VERSION);
    const user = readConnectionUser(body);

    if (!user.id)
      throw new AdoRequestError(this.rejectedMessage);

    return user;
  }

  async assignedWorkItems(): Promise<ParsedWorkItem[]> {
    const queried = await this.sendAdoRequest('POST', '/_apis/wit/wiql', { query: ASSIGNED_WORK_ITEMS_QUERY });
    const ids = uniqueIds(readWorkItemIds(queried));
    const items: ParsedWorkItem[] = [];

    for (let index = 0; index < ids.length; index += PAGE_SIZE) {
      const batch = await this.sendAdoRequest('POST', '/_apis/wit/workitemsbatch', {
        ids: ids.slice(index, index + PAGE_SIZE),
        fields: WORK_ITEM_FIELDS,
        errorPolicy: 'omit'
      });

      items.push(...readWorkItems(batch));
    }

    return items;
  }

  async expandedWorkItems(ids: number[]): Promise<ParsedWorkItem[]> {
    const items: ParsedWorkItem[] = [];

    for (let index = 0; index < ids.length; index += PAGE_SIZE) {
      const page = uniqueIds(ids.slice(index, index + PAGE_SIZE));

      if (!page.length)
        continue;

      const linked = await this.sendAdoRequest('POST', '/_apis/wit/workitemsbatch', {
        ids: page,
        $expand: 'relations',
        errorPolicy: 'omit'
      });

      items.push(...readWorkItems(linked));
    }

    return items;
  }

  async workItemRanges(workItemId: number, pullRequests: PullRequestRef[], user: AdoUser, syncDate: string): Promise<SuggestionSpan[]> {
    let skip = 0;
    let currentUser = user;

    const revisions: WorkItemRevision[] = [];

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const body = await this.sendAdoRequest(
        'GET',
        `/_apis/wit/workItems/${workItemId}/updates?$top=${PAGE_SIZE}&$skip=${skip}`
      );

      currentUser = withAccountsFromUpdates(body, currentUser);
      revisions.push(...readRevisions(body, currentUser));

      if (updateCount(body) < PAGE_SIZE)
        break;

      skip += PAGE_SIZE;
    }

    const commitDays = await this.commitDays(pullRequests, currentUser);

    return activityRanges(revisions, syncDate, commitDays);
  }

  private async commitDays(pullRequests: PullRequestRef[], user: AdoUser): Promise<string[]> {
    const days: string[] = [];

    for (const pullRequest of pullRequests) {
      for (const day of await this.commitDaysOnPullRequest(pullRequest, user)) {
        if (!days.includes(day))
          days.push(day);
      }
    }

    return days;
  }

  private async commitDaysOnPullRequest(pullRequest: PullRequestRef, user: AdoUser): Promise<string[]> {
    let continuation = '';

    const days: string[] = [];
    const projectId = encodeURIComponent(pullRequest.projectId);
    const repositoryId = encodeURIComponent(pullRequest.repositoryId);
    const path = `/${projectId}/_apis/git/repositories/${repositoryId}/pullRequests/${pullRequest.pullRequestId}/commits`;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const query = continuation
        ? `${path}?$top=${PAGE_SIZE}&continuationToken=${encodeURIComponent(continuation)}`
        : `${path}?$top=${PAGE_SIZE}`;
      const response = await this.requestResponse('GET', query);

      if (response.status === HTTP_NOT_FOUND) {
        await discardResponseBody(response);
        return days;
      }

      if (!response.ok)
        throw await this.failureForResponse(response);

      const body: unknown = await response.json();

      for (const day of readPullRequestCommitDays(body, user)) {
        if (!days.includes(day))
          days.push(day);
      }

      continuation = response.headers.get('x-ms-continuationtoken') ?? '';

      if (!continuation)
        break;
    }

    return days;
  }

  private async sendAdoRequest(method: 'GET' | 'POST', path: string, payload?: unknown, apiVersion = API_VERSION): Promise<unknown> {
    const response = await this.requestResponse(method, path, payload, apiVersion);

    if (!response.ok)
      throw await this.failureForResponse(response);

    return response.json();
  }

  private async failureForResponse(response: Response): Promise<AdoRequestError> {
    const statusMessage = failureMessageFor(response, this.rejectedMessage);
    const detail = readAdoErrorMessage(await readResponseBody(response));

    if (!detail)
      return new AdoRequestError(statusMessage);

    return new AdoRequestError(`${statusMessage} ${detail}`);
  }

  private async requestResponse(
    method: 'GET' | 'POST',
    path: string,
    payload?: unknown,
    apiVersion = API_VERSION
  ): Promise<Response> {
    assertReadOnlyRequest(method, path);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const response = await this.fetchResponse(method, path, payload, apiVersion);

      if (response.status !== HTTP_TOO_MANY || attempt === MAX_ATTEMPTS)
        return response;

      await waitForRetry(response, attempt);
    }

    throw new AdoRequestError('Azure DevOps could not be read.');
  }

  private async fetchResponse(
    method: 'GET' | 'POST',
    path: string,
    payload?: unknown,
    apiVersion = API_VERSION
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: this.authorization,
      Accept: 'application/json',
      // Without this, Azure DevOps ignores the token and redirects to a browser sign-in page.
      'X-TFS-FedAuthRedirect': 'Suppress'
    };

    if (payload)
      headers['Content-Type'] = 'application/json';

    let response: Response;

    try {
      response = await fetch(this.buildRequestUrl(path, apiVersion), {
        method,
        headers,
        body: payload ? JSON.stringify(payload) : undefined,
        redirect: 'manual'
      });
    } catch {
      throw new Error('Could not reach Azure DevOps.');
    }

    if (signInRejected(response)) {
      await discardResponseBody(response);
      throw new AdoRequestError(this.rejectedMessage);
    }

    return response;
  }

  private buildRequestUrl(path: string, apiVersion: string): string {
    const joiner = path.includes('?') ? '&' : '?';

    return `https://dev.azure.com/${encodeURIComponent(this.organization)}${path}${joiner}api-version=${apiVersion}`;
  }
}

function failureMessageFor(response: Response, rejectedMessage: string): string {
  if (signInRejected(response))
    return rejectedMessage;

  return messageForStatus(response.status);
}

async function discardResponseBody(response: Response): Promise<void> {
  await response.arrayBuffer().catch(() => undefined);
}

function uniqueIds(ids: number[]): number[] {
  return [...new Set(ids)];
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => '');

  if (!text.trim())
    return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function updateCount(body: unknown): number {
  if (Array.isArray(body))
    return body.length;

  const value = (body && typeof body === 'object') ? (body as { value?: unknown }).value : null;

  return Array.isArray(value) ? value.length : 0;
}

function signInRejected(response: Response): boolean {
  return response.status === 0
    || response.type === 'opaqueredirect'
    || response.status === HTTP_UNAUTHORIZED
    || response.status === HTTP_FORBIDDEN
    || (response.status >= HTTP_REDIRECT && response.status < HTTP_CLIENT_ERROR);
}

function messageForStatus(status: number): string {
  if (status === HTTP_NOT_FOUND)
    return 'Azure DevOps organization was not found.';

  if (status === HTTP_TOO_MANY)
    return 'Azure DevOps asked for a short pause. Sync again in a moment.';

  return `Azure DevOps could not be read (HTTP ${status}).`;
}

async function waitForRetry(response: Response, attempt: number): Promise<void> {
  const header = Number(response.headers.get('retry-after'));
  const seconds = Number.isFinite(header) && header > 0 ? header : attempt;

  await discardResponseBody(response);
  await waitForMilliseconds(Math.min(seconds, MAX_RETRY_SECONDS) * MILLISECONDS_PER_SECOND);
}

function waitForMilliseconds(milliseconds: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}
