import { DataSource } from 'typeorm';

import { AdoWorkItem } from '../entities/AdoWorkItem';
import { workItemIdFromTitle } from './parse';

export async function adoWorkItemIdForTitle(dataSource: DataSource, title: string): Promise<number | null> {
  const trimmed = title.trim();

  if (!trimmed)
    return null;

  const repository = dataSource.getRepository(AdoWorkItem);
  const adoId = workItemIdFromTitle(trimmed);

  if (adoId != null) {
    const linked = await repository.findOne({ where: { adoId } });

    if (linked)
      return adoId;
  }

  const matches = await repository.find({ where: { title: trimmed } });

  if (matches.length !== 1)
    return null;

  return matches[0].adoId;
}
