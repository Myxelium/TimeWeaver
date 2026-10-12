import {
  activityRanges,
  AdoUser,
  ParsedWorkItem,
  PullRequestRef,
  readConnectionUser,
  readPullRequestCommitDays,
  readPullRequestsById,
  readRevisions,
  readWorkItemIds,
  readWorkItems,
  SuggestionSpan,
  withAccountsFromUpdates,
  WorkItemRevision
} from './parse';

const API_VERSION = '7.1';
const CONNECTION_DATA_VERSION = '7.1-preview.1';
const PAGE_SIZE = 200;
const MAX_PAGES = 50;
const HTTP_REDIRECT = 300;
const HTTP_CLIENT_ERROR = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const ASSIGNED_STORIES_QUERY = [
  'SELECT [System.Id]',
  'FROM WorkItems',
  'WHERE [System.AssignedTo] = @Me',
  "AND [System.WorkItemType] IN ('User Story', 'Feature')",
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
    const queried = await this.sendAdoRequest('POST', '/_apis/wit/wiql', { query: ASSIGNED_STORIES_QUERY });
    const ids = readWorkItemIds(queried);
    const items: ParsedWorkItem[] = [];

    for (let index = 0; index < ids.length; index += PAGE_SIZE) {
      const idsInPage = ids.slice(index, index + PAGE_SIZE);
      const batch = await this.sendAdoRequest('POST', '/_apis/wit/workitemsbatch', {
        ids: idsInPage,
        fields: [
          'System.Id',
          'System.Title',
          'System.WorkItemType'
        ],
        errorPolicy: 'omit'
      });
      const linked = await this.sendAdoRequest('POST', '/_apis/wit/workitemsbatch', {
        ids: idsInPage,
        $expand: 'relations',
        errorPolicy: 'omit'
      });
      const pullRequests = readPullRequestsById(linked);

      for (const item of readWorkItems(batch)) {
        item.pullRequests = pullRequests.get(item.adoId) ?? [];
        items.push(item);
      }
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

      if (!response.ok) {
        await discardResponseBody(response);
        throw new AdoRequestError(failureMessageFor(response, this.rejectedMessage));
      }

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

    if (!response.ok) {
      await discardResponseBody(response);
      throw new AdoRequestError(failureMessageFor(response, this.rejectedMessage));
    }

    return response.json();
  }

  private async requestResponse(
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

  return `Azure DevOps could not be read (HTTP ${status}).`;
}
