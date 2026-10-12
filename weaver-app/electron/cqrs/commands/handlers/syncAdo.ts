import { DataSource } from 'typeorm';

import { syncAzureDevOps } from '../../../ado/sync';
import { AdoSyncResult } from '../../../ado/sync';
import { SyncAdoCommand } from '../../types';

export function handleSyncAdo(_command: SyncAdoCommand, dataSource: DataSource): Promise<AdoSyncResult> {
  return syncAzureDevOps(dataSource, true);
}
