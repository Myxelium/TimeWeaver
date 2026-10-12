import { DataSource } from 'typeorm';

import { AdoWorkItem } from '../entities/AdoWorkItem';

const PREFIXED_WORK_ITEM = /^#(\d+)\s+\S/;

export async function adoWorkItemIdForTitle(dataSource: DataSource, title: string): Promise<number | null> {
  const trimmed = title.trim();

  if (!trimmed)
    return null;

  const prefixed = PREFIXED_WORK_ITEM.exec(trimmed);
  const repository = dataSource.getRepository(AdoWorkItem);

  if (prefixed) {
    const adoId = Number(prefixed[1]);
    const linked = await repository.findOne({ where: { adoId } });

    if (linked)
      return adoId;
  }

  const matches = await repository.find({ where: { title: trimmed } });

  if (matches.length !== 1)
    return null;

  return matches[0].adoId;
}
