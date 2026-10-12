const ORGANIZATION_NAME = /^[A-Za-z0-9][A-Za-z0-9-]{0,62}$/;
const ORGANIZATION_URL = /^https:\/\/dev\.azure\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,62})$/i;
const PULL_REQUEST_LINK = /^vstfs:\/\/\/Git\/PullRequestId\/([^/]+)\/([^/]+)\/(\d+)$/i;
const ACTIVE_STATE = 'active';

export interface AdoUser {
  id: string;
  displayName: string;
  accounts: string[];
}

export interface PullRequestRef {
  projectId: string;
  repositoryId: string;
  pullRequestId: number;
}

export interface ParsedWorkItem {
  adoId: number;
  title: string;
  pullRequests: PullRequestRef[];
}

export function loggingTitle(adoId: number, title: string): string {
  return `#${adoId} ${title.trim()}`;
}

export function organizationName(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  const fromUrl = ORGANIZATION_URL.exec(trimmed);
  const name = fromUrl ? fromUrl[1] : trimmed;

  if (!ORGANIZATION_NAME.test(name))
    throw new Error('Enter an Azure DevOps organization name.');

  return name;
}

export function localDay(isoTimestamp: string): string | null {
  const parsed = new Date(isoTimestamp);

  if (Number.isNaN(parsed.getTime()))
    return null;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function todayLocal(now = new Date()): string {
  return localDay(now.toISOString()) ?? '';
}

export function readConnectionUser(body: unknown): AdoUser {
  const user = record(record(body).authenticatedUser);

  return {
    id: text(user.id),
    displayName: text(user.providerDisplayName),
    accounts: accountsFrom(user.properties)
  };
}

export function readWorkItemIds(body: unknown): number[] {
  const items = record(body).workItems;

  if (!Array.isArray(items))
    return [];

  const ids: number[] = [];

  for (const item of items) {
    const id = Number(record(item).id);

    if (Number.isInteger(id) && id > 0)
      ids.push(id);
  }

  return ids;
}

export function readPullRequestsById(body: unknown): Map<number, PullRequestRef[]> {
  const items = Array.isArray(body) ? body : record(body).value;
  const pullRequestsById = new Map<number, PullRequestRef[]>();

  if (!Array.isArray(items))
    return pullRequestsById;

  for (const item of items) {
    const entry = record(item);
    const adoId = Number(entry.id);

    if (!Number.isInteger(adoId) || adoId <= 0)
      continue;

    pullRequestsById.set(adoId, readPullRequests(entry.relations));
  }

  return pullRequestsById;
}

export function readWorkItems(body: unknown): ParsedWorkItem[] {
  const items = Array.isArray(body) ? body : record(body).value;

  if (!Array.isArray(items))
    return [];

  const parsed: ParsedWorkItem[] = [];

  for (const item of items) {
    const workItem = readWorkItem(item);

    if (workItem)
      parsed.push(workItem);
  }

  return parsed;
}

export function readActiveOn(body: unknown, user: AdoUser): { activeOn: string | null; user: AdoUser } {
  const updates = Array.isArray(body) ? body : record(body).value;

  let latestIso = '';
  let displayName = user.displayName;

  const accounts = [...user.accounts];

  if (!Array.isArray(updates))
    return { activeOn: null, user: { ...user, accounts } };

  for (const update of updates) {
    const entry = record(update);
    const revisedBy = record(entry.revisedBy);

    if (!sameIdentity(revisedBy, user))
      continue;

    const uniqueName = text(revisedBy.uniqueName);

    if (uniqueName && !accounts.some(account => sameText(account, uniqueName)))
      accounts.push(uniqueName);

    if (!displayName)
      displayName = text(revisedBy.displayName);

    const state = record(record(entry.fields)['System.State']);

    if (text(state.newValue).toLowerCase() !== ACTIVE_STATE)
      continue;

    const revisedDate = text(entry.revisedDate);

    if (revisedDate > latestIso)
      latestIso = revisedDate;
  }

  return {
    activeOn: latestIso ? localDay(latestIso) : null,
    user: { id: user.id, displayName, accounts }
  };
}

export function readPullRequestCommits(body: unknown, user: AdoUser): string | null {
  const commits = Array.isArray(body) ? body : record(body).value;

  let latestIso = '';

  if (!Array.isArray(commits))
    return null;

  for (const commit of commits) {
    const entry = record(commit);
    const author = record(entry.author);
    const committer = record(entry.committer);
    const matched = matchesUser(author, user) ? author : matchesUser(committer, user) ? committer : null;

    if (!matched)
      continue;

    const date = text(matched.date);

    if (date > latestIso)
      latestIso = date;
  }

  return latestIso ? localDay(latestIso) : null;
}

export function suggestionRange(
  activeOn: string | null,
  lastCommitOn: string | null,
  syncDate: string
): { activeOn: string | null; rangeEnd: string | null } {
  if (!activeOn)
    return { activeOn: null, rangeEnd: null };

  if (!lastCommitOn || lastCommitOn < activeOn)
    return { activeOn, rangeEnd: syncDate };

  return { activeOn, rangeEnd: lastCommitOn };
}

export function laterDay(current: string | null, next: string | null): string | null {
  if (!next)
    return current;

  if (!current || next > current)
    return next;

  return current;
}

function readWorkItem(item: unknown): ParsedWorkItem | null {
  const entry = record(item);
  const fields = record(entry.fields);
  const adoId = Number(entry.id ?? fields['System.Id']);
  const title = text(fields['System.Title']).trim();
  const type = text(fields['System.WorkItemType']).toLowerCase();

  if (!Number.isInteger(adoId) || adoId <= 0 || !title)
    return null;

  if (type !== 'user story' && type !== 'feature')
    return null;

  return {
    adoId,
    title,
    pullRequests: readPullRequests(entry.relations)
  };
}

function readPullRequests(relations: unknown): PullRequestRef[] {
  if (!Array.isArray(relations))
    return [];

  const pullRequests: PullRequestRef[] = [];

  for (const relation of relations) {
    const entry = record(relation);
    const attributes = record(entry.attributes);

    if (entry.rel !== 'ArtifactLink' || attributes.name !== 'Pull Request')
      continue;

    const pullRequest = readPullRequestUrl(text(entry.url));

    if (pullRequest)
      pullRequests.push(pullRequest);
  }

  return pullRequests;
}

function readPullRequestUrl(url: string): PullRequestRef | null {
  const decoded = decodePullRequestUrl(url);
  const match = PULL_REQUEST_LINK.exec(decoded);

  if (!match)
    return null;

  return {
    projectId: match[1],
    repositoryId: match[2],
    pullRequestId: Number(match[3])
  };
}

function accountsFrom(properties: unknown): string[] {
  const account = record(properties).Account;

  if (typeof account === 'string' && account.trim())
    return [account.trim()];

  const value = text(record(account).$value).trim();

  return value ? [value] : [];
}

function sameIdentity(revisedBy: Record<string, unknown>, user: AdoUser): boolean {
  return text(revisedBy['id']) === user.id && user.id.length > 0;
}

function matchesUser(person: Record<string, unknown>, user: AdoUser): boolean {
  const email = text(person['email']);
  const knownAccount = user.accounts.some(account => sameText(account, email));

  if (user.accounts.length > 0)
    return knownAccount;

  return sameText(text(person['name']), user.displayName);
}

function sameText(left: string, right: string): boolean {
  const normalizedLeft = left.trim().toLowerCase();
  const normalizedRight = right.trim().toLowerCase();

  return normalizedLeft.length > 0 && normalizedLeft === normalizedRight;
}

function decodePullRequestUrl(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

function record(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object')
    return value as Record<string, unknown>;

  return {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
