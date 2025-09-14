import { DataSource, Between } from 'typeorm';
import { Task } from '../../entities/Task';
import { Command } from '../types';

export const commandHandlers = (ds: DataSource) => ({
  'save-task': async (command: Command) => {
    if (command.type !== 'save-task') throw new Error('Invalid command payload');
    const repo = ds.getRepository(Task);
    const { id, title, description, date, hours } = command.payload;
    if (id) {
      await repo.update(id, { title, description, hours });
      return id;
    } else {
      const task = repo.create({ title, description, date, hours });
      const saved = await repo.save(task);
  return (saved as any).id;
    }
  },
  'delete-task': async (command: Command) => {
    if (command.type !== 'delete-task') throw new Error('Invalid command payload');
    const repo = ds.getRepository(Task);
    await repo.delete(command.payload.id);
    return true;
  }
});
