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

export interface AdoStateChange {
  revisedDate: string;
  active: boolean;
}

export interface ActiveWindow {
  activeOn: string | null;
  inactiveOn: string | null;
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
  const user = asRecord(asRecord(body).authenticatedUser);

  return {
    id: readText(user.id),
    displayName: readText(user.providerDisplayName),
    accounts: accountsFrom(user.properties)
  };
}

export function readWorkItemIds(body: unknown): number[] {
  const items = asRecord(body).workItems;

  if (!Array.isArray(items))
    return [];

  const ids: number[] = [];

  for (const item of items) {
    const id = Number(asRecord(item).id);

    if (Number.isInteger(id) && id > 0)
      ids.push(id);
  }

  return ids;
}

export function readPullRequestsById(body: unknown): Map<number, PullRequestRef[]> {
  const items = Array.isArray(body) ? body : asRecord(body).value;
  const pullRequestsById = new Map<number, PullRequestRef[]>();

  if (!Array.isArray(items))
    return pullRequestsById;

  for (const item of items) {
    const entry = asRecord(item);
    const adoId = Number(entry.id);

    if (!Number.isInteger(adoId) || adoId <= 0)
      continue;

    pullRequestsById.set(adoId, readPullRequests(entry.relations));
  }

  return pullRequestsById;
}

export function readWorkItems(body: unknown): ParsedWorkItem[] {
  const items = Array.isArray(body) ? body : asRecord(body).value;

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

export function readActiveOn(body: unknown, user: AdoUser): ActiveWindow & { changes: AdoStateChange[]; user: AdoUser } {
  const updates = Array.isArray(body) ? body : asRecord(body).value;
  const changes: AdoStateChange[] = [];

  let displayName = user.displayName;

  const accounts = [...user.accounts];

  if (!Array.isArray(updates))
    return { activeOn: null, inactiveOn: null, changes, user: { ...user, accounts } };

  for (const update of updates) {
    const entry = asRecord(update);
    const revisedBy = asRecord(entry.revisedBy);

    if (!sameIdentity(revisedBy, user))
      continue;

    const uniqueName = readText(revisedBy.uniqueName);

    if (uniqueName && !accounts.some(account => sameText(account, uniqueName)))
      accounts.push(uniqueName);

    if (!displayName)
      displayName = readText(revisedBy.displayName);

    const change = readStateChange(entry);

    if (change)
      changes.push(change);
  }

  return {
    ...activeWindow(changes),
    changes,
    user: { id: user.id, displayName, accounts }
  };
}

export function activeWindow(changes: AdoStateChange[]): ActiveWindow {
  let activeIso = '';

  for (const change of changes) {
    if (change.active && change.revisedDate > activeIso)
      activeIso = change.revisedDate;
  }

  if (!activeIso)
    return { activeOn: null, inactiveOn: null };

  let inactiveIso = '';

  for (const change of changes) {
    const leftActive = !change.active && change.revisedDate > activeIso;
    const earlier = !inactiveIso || change.revisedDate < inactiveIso;

    if (leftActive && earlier)
      inactiveIso = change.revisedDate;
  }

  return {
    activeOn: localDay(activeIso),
    inactiveOn: inactiveIso ? localDay(inactiveIso) : null
  };
}

export function readPullRequestCommits(body: unknown, user: AdoUser): string | null {
  const commits = Array.isArray(body) ? body : asRecord(body).value;

  let latestIso = '';

  if (!Array.isArray(commits))
    return null;

  for (const commit of commits) {
    const entry = asRecord(commit);
    const author = asRecord(entry.author);
    const committer = asRecord(entry.committer);
    const matched = matchesUser(author, user) ? author : matchesUser(committer, user) ? committer : null;

    if (!matched)
      continue;

    const date = readText(matched.date);

    if (date > latestIso)
      latestIso = date;
  }

  return latestIso ? localDay(latestIso) : null;
}

export function suggestionRange(
  activeOn: string | null,
  lastCommitOn: string | null,
  syncDate: string,
  inactiveOn: string | null = null
): { activeOn: string | null; rangeEnd: string | null } {
  if (!activeOn)
    return { activeOn: null, rangeEnd: null };

  let rangeEnd = syncDate;

  if (lastCommitOn && lastCommitOn >= activeOn)
    rangeEnd = lastCommitOn;

  if (inactiveOn && inactiveOn >= activeOn && inactiveOn < rangeEnd)
    rangeEnd = inactiveOn;

  return { activeOn, rangeEnd };
}

export function laterDay(current: string | null, next: string | null): string | null {
  if (!next)
    return current;

  if (!current || next > current)
    return next;

  return current;
}

function readStateChange(entry: Record<string, unknown>): AdoStateChange | null {
  const state = asRecord(asRecord(entry.fields)['System.State']);
  const newState = readText(state.newValue);
  const revisedDate = readText(entry.revisedDate);

  if (!newState || !revisedDate)
    return null;

  return {
    revisedDate,
    active: newState.toLowerCase() === ACTIVE_STATE
  };
}

function readWorkItem(item: unknown): ParsedWorkItem | null {
  const entry = asRecord(item);
  const fields = asRecord(entry.fields);
  const adoId = Number(entry.id ?? fields['System.Id']);
  const title = readText(fields['System.Title']).trim();
  const type = readText(fields['System.WorkItemType']).toLowerCase();

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
    const entry = asRecord(relation);
    const attributes = asRecord(entry.attributes);

    if (entry.rel !== 'ArtifactLink' || attributes.name !== 'Pull Request')
      continue;

    const pullRequest = readPullRequestUrl(readText(entry.url));

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
  const account = asRecord(properties).Account;

  if (typeof account === 'string' && account.trim())
    return [account.trim()];

  const value = readText(asRecord(account).$value).trim();

  return value ? [value] : [];
}

function sameIdentity(revisedBy: Record<string, unknown>, user: AdoUser): boolean {
  return readText(revisedBy['id']) === user.id && user.id.length > 0;
}

function matchesUser(person: Record<string, unknown>, user: AdoUser): boolean {
  const email = readText(person['email']);
  const knownAccount = user.accounts.some(account => sameText(account, email));

  if (user.accounts.length > 0)
    return knownAccount;

  return sameText(readText(person['name']), user.displayName);
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

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object')
    return value as Record<string, unknown>;

  return {};
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
