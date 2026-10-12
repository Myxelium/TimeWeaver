import { DataSource } from 'typeorm';

import { adoWorkItemIdForTitle } from '../../../ado/match-task';
import { Task } from '../../../entities/Task';
import { SaveTaskCommand } from '../../types';

export async function handleSaveTask(command: SaveTaskCommand, dataSource: DataSource): Promise<number> {
  // Type is assumed validated by dispatcher
  const taskRepository = dataSource.getRepository(Task);
  const { id, title, description, date, hours } = command.payload;
  const linkedId = await adoWorkItemIdForTitle(dataSource, title);

  if (id) {
    const existing = await taskRepository.findOne({ where: { id } });
    const titleChanged = existing?.title !== title;
    const adoWorkItemId = linkedId ?? (titleChanged ? null : existing?.adoWorkItemId ?? null);

    await taskRepository.update(id, {
      title,
      description,
      date,
      hours,
      adoWorkItemId
    });

    return id;
  }

  const newTaskEntity = taskRepository.create({
    title,
    description,
    date,
    hours,
    adoWorkItemId: linkedId
  });
  const savedTask: Task = await taskRepository.save(newTaskEntity);

  return savedTask.id;
}
