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

  let settings = await settingsRepo.findOne({ where: { id: 1 } });

  if (!settings)
    settings = await settingsRepo.save(settingsRepo.create({ id: 1 }));

  if (!settings.adoSyncEnabled)
    return { ran: false, itemCount: 0, error: null };

  const today = todayLocal();
  const organizationInput = settings.adoOrganization?.trim() ?? '';
  const pat = settings.adoPat?.trim() ?? '';
  const authMethod = settings.adoAuthMethod === 'azure-cli' ? 'azure-cli' : 'pat';
  const signedIn = authMethod === 'azure-cli' || !!pat;

  if (!organizationInput || !signedIn) {
    if (!force)
      return { ran: false, itemCount: 0, error: null };

    const message = authMethod === 'azure-cli'
      ? 'Add an Azure DevOps organization in Settings.'
      : 'Add an Azure DevOps organization and a read-only token in Settings.';

    return rememberError(settingsRepo, settings, message);
  }

  if (!force && (attemptedOn === today || settings.adoLastSyncOn === today))
    return { ran: false, itemCount: 0, error: null };

  if (!force)
    attemptedOn = today;

  let organization: string;

  try {
    organization = organizationName(organizationInput);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Enter an Azure DevOps organization name.';

    return rememberError(settingsRepo, settings, message);
  }

  try {
    const accessToken = authMethod === 'azure-cli' ? await azureCliAccessToken() : '';
    const credential = authMethod === 'azure-cli'
      ? {
        authorization: `Bearer ${accessToken}`,
        rejectedMessage: 'Azure CLI sign-in was rejected. Run az login in a terminal, then sync again.'
      }
      : {
        authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
        rejectedMessage: 'Azure DevOps rejected the token. Use an organization-scoped token with only Work Items (Read) and Code (Read).'
      };
    const rows = await collectWorkItems(organization, credential, today);

    await dataSource.transaction(async manager => {
      await manager.getRepository(AdoWorkItem).clear();

      if (rows.length)
        await manager.getRepository(AdoWorkItem).save(rows);
    });

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
