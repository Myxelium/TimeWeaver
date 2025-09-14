import { DataSource } from "typeorm";
import { Task } from "../../entities/Task";
import { Command } from "../types";

export const commandHandlers = (dataSource: DataSource) => ({
	"save-task": async (command: Command) => {
		if (command.type !== "save-task")
			throw new Error("Invalid command payload");

		const taskRepository = dataSource.getRepository(Task);
		const { id, title, description, date, hours } = command.payload;

		if (id) {
			await taskRepository.update(id, { title, description, hours });
			return id;
		} else {
			const task = taskRepository.create({
				title,
				description,
				date,
				hours,
			});

			const saved = await taskRepository.save(task);
			return (saved as any).id;
		}
	},
	"delete-task": async (command: Command) => {
		if (command.type !== "delete-task")
			throw new Error("Invalid command payload");
        
		const taskRepository = dataSource.getRepository(Task);
		await taskRepository.delete(command.payload.id);
		return true;
	},
});
