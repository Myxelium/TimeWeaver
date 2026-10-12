import { DataSource, Repository } from 'typeorm';

import { AdoWorkItem } from '../entities/AdoWorkItem';
import { Setting } from '../entities/Setting';
import { azureCliAccessToken } from './azure-cli';
import { AdoClient } from './client';
import {
  AdoUser,
  organizationName,
  suggestionRange,
  todayLocal
} from './parse';

export interface AdoSyncResult {
  ran: boolean;
  itemCount: number;
  error: string | null;
}

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
    const rows = await collectWorkItems(organization, credential, today);

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

    await repository.clear();

    if (rows.length)
      await repository.save(rows);
  });
}

async function collectWorkItems(
  organization: string,
  credential: { authorization: string; rejectedMessage: string },
  syncDate: string
): Promise<AdoWorkItem[]> {
  const client = new AdoClient(organization, credential.authorization, credential.rejectedMessage);

  let user = await client.currentUser();

  const assigned = await client.assignedWorkItems();
  const rows: AdoWorkItem[] = [];

  for (const item of assigned) {
    const active = await client.activeOn(item.adoId, user);

    user = mergeUser(user, active.user);

    if (!active.activeOn)
      continue;

    const lastCommitOn = await client.lastCommitOn(item.pullRequests, user);
    const range = suggestionRange(active.activeOn, lastCommitOn, syncDate);

    rows.push({
      adoId: item.adoId,
      title: item.title,
      activeOn: range.activeOn,
      rangeEnd: range.rangeEnd
    });
  }

  return rows;
}

function mergeUser(current: AdoUser, next: AdoUser): AdoUser {
  const accounts = [...current.accounts];

  for (const account of next.accounts) {
    if (!accounts.some(existing => existing.toLowerCase() === account.toLowerCase()))
      accounts.push(account);
  }

  return {
    id: current.id,
    displayName: current.displayName || next.displayName,
    accounts
  };
}

async function rememberError(settingsRepo: Repository<Setting>, settings: Setting, error: string): Promise<AdoSyncResult> {
  settings.adoLastSyncError = error;
  await settingsRepo.save(settings);

  return { ran: true, itemCount: 0, error };
}
