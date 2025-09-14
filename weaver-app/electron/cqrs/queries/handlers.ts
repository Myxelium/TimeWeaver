import { DataSource, Between } from "typeorm";
import { Task } from "../../entities/Task";
import { Query, DaySummaryDTO } from "../types";
import { format, startOfMonth, endOfMonth } from "date-fns";

export const queryHandlers = (dataSource: DataSource) => ({
	"get-tasks-by-date": async (query: Query) => {
		if (query.type !== "get-tasks-by-date")
			throw new Error("Invalid query payload");

		const taskRepository = dataSource.getRepository(Task);
        
		return taskRepository.find({
			where: { date: query.payload.date },
			order: { created_at: "DESC" },
		});
	},
	"get-tasks-by-month": async (query: Query) => {
		if (query.type !== "get-tasks-by-month")
			throw new Error("Invalid query payload");

		const { year, month } = query.payload;
		const startDate = format(
			startOfMonth(new Date(year, month - 1)),
			"yyyy-MM-dd"
		);
		const endDate = format(
			endOfMonth(new Date(year, month - 1)),
			"yyyy-MM-dd"
		);
		const taskRepository = dataSource.getRepository(Task);

		const summaryData = await taskRepository
			.createQueryBuilder("task")
			.select("task.date", "date")
			.addSelect("SUM(task.hours)", "total_hours")
			.addSelect("COUNT(*)", "task_count")
			.where("task.date >= :startDate AND task.date <= :endDate", {
				startDate,
				endDate,
			})
			.groupBy("task.date")
			.orderBy("task.date")
			.getRawMany();

		const allTasks = await taskRepository.find({
			where: { date: Between(startDate, endDate) },
			order: { date: "ASC", created_at: "DESC" },
		});
		const tasksByDate: Record<string, Task[]> = {};
		allTasks.forEach((t) => {
			tasksByDate[t.date] = tasksByDate[t.date] || [];
			tasksByDate[t.date].push(t);
		});

		return summaryData.map((s) => ({
			date: s.date,
			total_hours: parseFloat(s.total_hours) || 0,
			task_count: parseInt(s.task_count) || 0,
			tasks: tasksByDate[s.date] || [],
		})) as DaySummaryDTO[];
	},
	"get-monthly-summary": async (query: Query) => {
		if (query.type !== "get-monthly-summary")
			throw new Error("Invalid query payload");
		const { year, month } = query.payload;
		const startDate = format(
			startOfMonth(new Date(year, month - 1)),
			"yyyy-MM-dd"
		);
		const endDate = format(
			endOfMonth(new Date(year, month - 1)),
			"yyyy-MM-dd"
		);
		const taskRepository = dataSource.getRepository(Task);
		const result: any = await taskRepository
			.createQueryBuilder("task")
			.select("SUM(task.hours)", "total_hours")
			.where("task.date >= :startDate AND task.date <= :endDate", {
				startDate,
				endDate,
			})
			.getRawOne();
		return parseFloat(result?.total_hours) || 0;
	},
	"get-all-tasks": async () => {
		const taskRepository = dataSource.getRepository(Task);
		return taskRepository.find({
			order: { date: "DESC", created_at: "DESC" },
		});
	},
	"export-csv": async (
		query: Query,
		saveCsv: (defaultName: string, content: string) => Promise<boolean>
	) => {
		if (query.type !== "export-csv")
			throw new Error("Invalid query payload");
		const { year, month } = query.payload;
		const startDate = format(
			startOfMonth(new Date(year, month - 1)),
			"yyyy-MM-dd"
		);
		const endDate = format(
			endOfMonth(new Date(year, month - 1)),
			"yyyy-MM-dd"
		);
		const taskRepository = dataSource.getRepository(Task);
		const tasks = await taskRepository.find({
			where: { date: Between(startDate, endDate) },
			order: { date: "ASC", created_at: "ASC" },
		});
		const header = "Date,Title,Description,Hours,Created At\n";
		const body = tasks
			.map(
				(t) =>
					`"${t.date}","${t.title}","${t.description || ""}","${
						t.hours
					}","${t.created_at}"`
			)
			.join("\n");
		return saveCsv(
			`weaver-report-${year}-${month.toString().padStart(2, "0")}.csv`,
			header + body
		);
	},
});
