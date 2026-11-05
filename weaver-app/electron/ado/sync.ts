import { DataSource, Repository } from 'typeorm';

import { AdoWorkItem } from '../entities/AdoWorkItem';
import { Setting } from '../entities/Setting';
import { azureCliAccessToken } from './azure-cli';
import { AdoClient } from './client';
import {
  AdoUser,
  isDoneState,
  organizationName,
  ParsedWorkItem,
  PullRequestRef,
  todayLocal
} from './parse';

export interface AdoSyncResult {
  ran: boolean;
  itemCount: number;
  error: string | null;
}

const SYNC_CONCURRENCY = 8;
const DELETE_CHUNK = 400;

let inFlight: Promise<AdoSyncResult> | null = null;
let attemptedOn = '';

export function syncAzureDevOps(dataSource: DataSource, force: boolean): Promise<AdoSyncResult> {
  if (inFlight)
    return inFlight;

  inFlight = runSync(dataSource, force).finally(() => {
    inFlight = null;
  });

  return inFlight;
}

async function runSync(dataSource: DataSource, force: boolean): Promise<AdoSyncResult> {
  const settingsRepo = dataSource.getRepository(Setting);
  const settings = await loadSettingsRow(settingsRepo);
  const today = todayLocal();
  const organizationInput = settings.adoOrganization?.trim() ?? '';
  const pat = settings.adoPat?.trim() ?? '';
  const authMethod = settings.adoAuthMethod === 'azure-cli' ? 'azure-cli' : 'pat';
  const blocked = blockedSync(settings, force, today, organizationInput, authMethod, pat);

  if (blocked?.kind === 'remember')
    return rememberError(settingsRepo, settings, blocked.message);

  if (blocked?.kind === 'done')
    return blocked.result;

  if (!force)
    attemptedOn = today;

  const organization = readOrganizationName(organizationInput);

  if (typeof organization !== 'string')
    return rememberError(settingsRepo, settings, organization.message);

  try {
    const credential = await credentialFor(authMethod, pat);
    const existingRows = await dataSource.getRepository(AdoWorkItem).find();
    const existing = new Map(existingRows.map(row => [row.adoId, row]));
    const rows = await collectWorkItems(organization, credential, today, existing);

    await replaceWorkItems(dataSource, rows);

    settings.adoOrganization = organization;
    settings.adoLastSyncOn = today;
    settings.adoLastSyncError = null;
    await settingsRepo.save(settings);

    return { ran: true, itemCount: rows.length, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Azure DevOps could not be read.';

    return rememberError(settingsRepo, settings, message);
  }
}

async function loadSettingsRow(settingsRepo: Repository<Setting>): Promise<Setting> {
  const existing = await settingsRepo.findOne({ where: { id: 1 } });

  if (existing)
    return existing;

  return settingsRepo.save(settingsRepo.create({ id: 1 }));
}

function blockedSync(
  settings: Setting,
  force: boolean,
  today: string,
  organizationInput: string,
  authMethod: 'azure-cli' | 'pat',
  pat: string
): { kind: 'remember'; message: string } | { kind: 'done'; result: AdoSyncResult } | null {
  const signedIn = authMethod === 'azure-cli' || !!pat;

  if (!settings.adoSyncEnabled)
    return { kind: 'done', result: { ran: false, itemCount: 0, error: null } };

  if (!organizationInput || !signedIn) {
    if (!force)
      return { kind: 'done', result: { ran: false, itemCount: 0, error: null } };

    const message = authMethod === 'azure-cli'
      ? 'Add an Azure DevOps organization in Settings.'
      : 'Add an Azure DevOps organization and a read-only token in Settings.';

    return { kind: 'remember', message };
  }

  if (!force && (attemptedOn === today || settings.adoLastSyncOn === today))
    return { kind: 'done', result: { ran: false, itemCount: 0, error: null } };

  return null;
}

function readOrganizationName(organizationInput: string): string | { message: string } {
  try {
    return organizationName(organizationInput);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Enter an Azure DevOps organization name.';

    return { message };
  }
}

async function credentialFor(authMethod: 'azure-cli' | 'pat', pat: string): Promise<{ authorization: string; rejectedMessage: string }> {
  if (authMethod === 'azure-cli') {
    const accessToken = await azureCliAccessToken();

    return {
      authorization: `Bearer ${accessToken}`,
      rejectedMessage: 'Azure CLI sign-in was rejected. Run az login in a terminal, then sync again.'
    };
  }

  const encoded = Buffer.from(`:${pat}`).toString('base64');

  return {
    authorization: `Basic ${encoded}`,
    rejectedMessage: 'Azure DevOps rejected the token. Use an organization-scoped token with only Work Items (Read) and Code (Read).'
  };
}

async function replaceWorkItems(dataSource: DataSource, rows: AdoWorkItem[]): Promise<void> {
  await dataSource.transaction(async manager => {
    const repository = manager.getRepository(AdoWorkItem);
    const keep = new Set(rows.map(row => row.adoId));
    const existing = await repository.find({ select: { adoId: true } });
    const stale = existing.flatMap(item => keep.has(item.adoId) ? [] : [item.adoId]);

    if (rows.length)
      await repository.save(rows);

    for (let index = 0; index < stale.length; index += DELETE_CHUNK)
      await repository.delete(stale.slice(index, index + DELETE_CHUNK));
  });
}

async function collectWorkItems(
  organization: string,
  credential: { authorization: string; rejectedMessage: string },
  syncDate: string,
  existing: Map<number, AdoWorkItem>
): Promise<AdoWorkItem[]> {
  const client = new AdoClient(organization, credential.authorization, credential.rejectedMessage);
  const user = await client.currentUser();
  const assigned = await client.assignedWorkItems();
  const needsHistory = assigned.filter(item => !canReuse(existing.get(item.adoId), item.changedOn));
  const pullRequests = await client.pullRequestsFor(needsHistory.map(item => item.adoId));
  const built = await mapWithLimit(assigned, SYNC_CONCURRENCY, item =>
    buildWorkItem(client, item, existing.get(item.adoId), pullRequests.get(item.adoId) ?? [], user, syncDate)
  );

  return built.flatMap(row => row ? [row] : []);
}

function canReuse(stored: AdoWorkItem | undefined, changedOn: string): boolean {
  return !!stored?.changedOn && !!changedOn && stored.changedOn === changedOn;
}

async function buildWorkItem(
  client: AdoClient,
  item: ParsedWorkItem,
  stored: AdoWorkItem | undefined,
  pullRequests: PullRequestRef[],
  user: AdoUser,
  syncDate: string
): Promise<AdoWorkItem | null> {
  if (canReuse(stored, item.changedOn) && stored)
    return copyWorkItem(stored);

  const ranges = await client.workItemRanges(item.adoId, pullRequests, user, syncDate);

  if (!ranges.length && !isDoneState(item.state))
    return null;

  const latest = ranges[ranges.length - 1];

  return {
    adoId: item.adoId,
    title: item.title,
    activeOn: latest?.activeOn ?? null,
    rangeEnd: latest?.rangeEnd ?? null,
    ranges: ranges.length ? JSON.stringify(ranges) : null,
    workItemType: item.workItemType,
    state: item.state,
    completedWork: item.completedWork,
    changedOn: item.changedOn || null
  };
}

function copyWorkItem(item: AdoWorkItem): AdoWorkItem {
  return {
    adoId: item.adoId,
    title: item.title,
    activeOn: item.activeOn,
    rangeEnd: item.rangeEnd,
    ranges: item.ranges,
    workItemType: item.workItemType,
    state: item.state,
    completedWork: item.completedWork,
    changedOn: item.changedOn
  };
}

async function mapWithLimit<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);

  let next = 0;

  async function processQueuedItem(): Promise<void> {
    while (next < items.length) {
      const index = next;

      next += 1;
      results[index] = await mapper(items[index]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => processQueuedItem());

  await Promise.all(workers);

  return results;
}

async function rememberError(settingsRepo: Repository<Setting>, settings: Setting, error: string): Promise<AdoSyncResult> {
  settings.adoLastSyncError = error;
  await settingsRepo.save(settings);

  return { ran: true, itemCount: 0, error };
}
