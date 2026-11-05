const ORGANIZATION_NAME = /^[A-Za-z0-9][A-Za-z0-9-]{0,62}$/;
const ORGANIZATION_URL = /^https:\/\/dev\.azure\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,62})$/i;
const PULL_REQUEST_LINK = /^vstfs:\/\/\/Git\/PullRequestId\/([^/]+)\/([^/]+)\/(\d+)$/i;
const ACTIVE_STATE = 'active';
const HOURS_TOLERANCE = 0.05;

export const TRACKED_WORK_ITEM_TYPE_NAMES = [
  'User Story',
  'Feature',
  'Bug'
];

const TRACKED_WORK_ITEM_TYPES = new Set(TRACKED_WORK_ITEM_TYPE_NAMES.map(name => name.toLowerCase()));
const DONE_STATES = new Set([
  'done',
  'closed',
  'resolved',
  'completed'
]);

export type TimeGap = 'missing' | 'mismatch';

const READ_QUERY_PATHS = new Set(['/_apis/wit/wiql', '/_apis/wit/workitemsbatch']);

export function readAdoErrorMessage(body: unknown): string | null {
  if (typeof body === 'string')
    return plainErrorText(body);

  const record = asRecord(body);
  const direct = readText(record['message']).trim() || readText(record['Message']).trim();

  if (direct)
    return clipErrorText(direct);

  const value = asRecord(record['value']);
  const nested = readText(value['Message']).trim() || readText(value['message']).trim();

  return nested ? clipErrorText(nested) : null;
}

function plainErrorText(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed || trimmed.startsWith('<'))
    return null;

  return clipErrorText(trimmed);
}

function clipErrorText(value: string): string {
  const limit = 300;

  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

export function assertReadOnlyRequest(method: string, path: string): void {
  const route = path.split('?')[0];

  if (method === 'GET')
    return;

  if (method === 'POST' && READ_QUERY_PATHS.has(route))
    return;

  throw new Error('Azure DevOps sync is read-only.');
}

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
  workItemType: string;
  state: string;
  changedOn: string;
  completedWork: number | null;
  pullRequests: PullRequestRef[];
}

export interface SuggestionSpan {
  activeOn: string;
  rangeEnd: string;
}

export interface WorkItemRevision {
  at: string;
  state: string | null;
  assignedToMe: boolean | null;
}

const HASH_ID = /^#(\d+)(?:\s|$)/;

export function workItemIdFromTitle(title: string): number | null {
  const match = HASH_ID.exec(title.trim());

  if (!match)
    return null;

  const id = Number(match[1]);

  return Number.isInteger(id) && id > 0 ? id : null;
}

export function loggingTitle(adoId: number, title: string): string {
  return `#${adoId} ${title.trim()}`;
}

export function workItemPageUrl(organization: string, adoId: number): string {
  return `https://dev.azure.com/${encodeURIComponent(organizationName(organization))}/_workitems/edit/${adoId}`;
}

export function isWorkItemPageUrl(url: string): boolean {
  return /^https:\/\/dev\.azure\.com\/[A-Za-z0-9][A-Za-z0-9-]{0,62}\/_workitems\/edit\/\d+$/i.test(url);
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

export function readRevisions(body: unknown, user: AdoUser): WorkItemRevision[] {
  const updates = Array.isArray(body) ? body : asRecord(body).value;
  const revisions: WorkItemRevision[] = [];

  if (!Array.isArray(updates))
    return revisions;

  for (const update of updates) {
    const entry = asRecord(update);
    const at = revisionInstant(entry);
    const stateChange = readNewValue(entry, 'System.State');
    const assignmentChange = readNewValue(entry, 'System.AssignedTo');
    const state = stateChange.changed ? readText(stateChange.value) : null;
    const assignedToMe = assignmentChange.changed ? identityIsUser(assignmentChange.value, user) : null;

    if (!at || (!state && assignedToMe === null))
      continue;

    revisions.push({ at, state, assignedToMe });
  }

  return revisions;
}

export function activityRanges(revisions: WorkItemRevision[], syncDate: string, commitDays: string[] = []): SuggestionSpan[] {
  const ordered = [...revisions].sort((left, right) => left.at.localeCompare(right.at));
  const spans: SuggestionSpan[] = [];

  let state = '';
  let assignedToMe = true;
  let startedAt = '';

  for (const revision of ordered) {
    if (revision.state !== null)
      state = revision.state;

    if (revision.assignedToMe !== null)
      assignedToMe = revision.assignedToMe;

    const suggesting = state.toLowerCase() === ACTIVE_STATE && assignedToMe;

    if (suggesting && !startedAt)
      startedAt = revision.at;

    if (!suggesting && startedAt) {
      pushSpan(spans, startedAt, localDay(revision.at));
      startedAt = '';
    }
  }

  if (startedAt)
    pushSpan(spans, startedAt, syncDate);

  return clipSpansToCommits(spans, commitDays);
}

function clipSpansToCommits(spans: SuggestionSpan[], commitDays: string[]): SuggestionSpan[] {
  if (!commitDays.length)
    return spans;

  return spans.map(span => {
    let lastCommit = '';

    for (const day of commitDays) {
      if (day >= span.activeOn && day <= span.rangeEnd && day > lastCommit)
        lastCommit = day;
    }

    if (!lastCommit)
      return span;

    return { activeOn: span.activeOn, rangeEnd: lastCommit };
  });
}

export function withAccountsFromUpdates(body: unknown, user: AdoUser): AdoUser {
  const updates = Array.isArray(body) ? body : asRecord(body).value;
  const accounts = [...user.accounts];

  if (!Array.isArray(updates))
    return user;

  for (const update of updates) {
    const revisedBy = asRecord(asRecord(update).revisedBy);
    const uniqueName = readText(revisedBy['uniqueName']);

    if (readText(revisedBy['id']) !== user.id || !uniqueName)
      continue;

    if (!accounts.some(account => sameText(account, uniqueName)))
      accounts.push(uniqueName);
  }

  if (accounts.length === user.accounts.length)
    return user;

  return { id: user.id, displayName: user.displayName, accounts };
}

export function readPullRequestCommitDays(body: unknown, user: AdoUser): string[] {
  const commits = Array.isArray(body) ? body : asRecord(body).value;
  const days: string[] = [];

  if (!Array.isArray(commits))
    return days;

  for (const commit of commits) {
    const entry = asRecord(commit);
    const author = asRecord(entry['author']);
    const committer = asRecord(entry['committer']);
    const matched = matchesUser(author, user) ? author : matchesUser(committer, user) ? committer : null;
    const day = matched ? localDay(readText(matched['date'])) : null;

    if (day && !days.includes(day))
      days.push(day);
  }

  return days;
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

export function isDoneState(state: string): boolean {
  return DONE_STATES.has(state.trim().toLowerCase());
}

export function timeGapFor(state: string, completedWork: number | null, loggedHours: number): TimeGap | null {
  if (!isDoneState(state))
    return null;

  if (completedWork == null || completedWork <= 0)
    return 'missing';

  const logged = Number.isFinite(loggedHours) ? loggedHours : 0;

  if (Math.abs(completedWork - logged) > HOURS_TOLERANCE)
    return 'mismatch';

  return null;
}

export function laterDay(current: string | null, next: string | null): string | null {
  if (!next)
    return current;

  if (!current || next > current)
    return next;

  return current;
}

function pushSpan(spans: SuggestionSpan[], startedAt: string, rangeEnd: string | null): void {
  const activeOn = localDay(startedAt);

  if (!activeOn || !rangeEnd || rangeEnd < activeOn)
    return;

  const previous = spans[spans.length - 1];

  if (previous && activeOn <= previous.rangeEnd) {
    if (rangeEnd > previous.rangeEnd)
      previous.rangeEnd = rangeEnd;

    return;
  }

  spans.push({ activeOn, rangeEnd });
}

function revisionInstant(entry: Record<string, unknown>): string {
  const revised = readText(entry.revisedDate);

  if (revised && !isCurrentRevision(revised))
    return revised;

  const fields = asRecord(entry.fields);
  const changedDate = asRecord(fields['System.ChangedDate']);
  const changedOn = readText(changedDate.newValue);

  if (changedOn && !isCurrentRevision(changedOn))
    return changedOn;

  return '';
}

function isCurrentRevision(value: string): boolean {
  return value.startsWith('9999-');
}

function readNewValue(entry: Record<string, unknown>, fieldName: string): { changed: boolean; value: unknown } {
  const fields = asRecord(entry.fields);

  if (!Object.prototype.hasOwnProperty.call(fields, fieldName))
    return { changed: false, value: undefined };

  const change = fields[fieldName];

  if (!change || typeof change !== 'object' || !Object.prototype.hasOwnProperty.call(change, 'newValue'))
    return { changed: false, value: undefined };

  return { changed: true, value: (change as { newValue: unknown }).newValue };
}

function identityIsUser(value: unknown, user: AdoUser): boolean {
  if (typeof value === 'string')
    return textNamesUser(value, user);

  if (!value || typeof value !== 'object')
    return false;

  const identity = value as Record<string, unknown>;
  const uniqueName = readText(identity.uniqueName);
  const knownAccount = user.accounts.some(account => sameText(account, uniqueName));

  if (uniqueName && knownAccount)
    return true;

  const id = readText(identity.id);

  if (user.id && id)
    return id === user.id;

  return sameText(readText(identity.displayName), user.displayName);
}

function textNamesUser(value: string, user: AdoUser): boolean {
  const namesAccount = user.accounts.some(account => value.toLowerCase().includes(account.trim().toLowerCase()));

  if (namesAccount)
    return true;

  return sameText(value, user.displayName);
}

function readWorkItem(item: unknown): ParsedWorkItem | null {
  const entry = asRecord(item);
  const fields = asRecord(entry.fields);
  const adoId = Number(entry.id ?? fields['System.Id']);
  const title = readText(fields['System.Title']).trim();
  const workItemType = readText(fields['System.WorkItemType']).trim();

  if (!Number.isInteger(adoId) || adoId <= 0 || !title)
    return null;

  if (!TRACKED_WORK_ITEM_TYPES.has(workItemType.toLowerCase()))
    return null;

  return {
    adoId,
    title,
    workItemType,
    state: readText(fields['System.State']).trim(),
    changedOn: readText(fields['System.ChangedDate']).trim(),
    completedWork: readHours(fields['Microsoft.VSTS.Scheduling.CompletedWork']),
    pullRequests: readPullRequests(entry.relations)
  };
}

function readHours(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value))
    return value;

  if (typeof value !== 'string' || !value.trim())
    return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
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
