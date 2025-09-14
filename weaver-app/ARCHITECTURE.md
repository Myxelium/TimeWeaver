# TimeWeaver Architecture

## Overview
Refactored to apply clear separation of concerns:
- Electron Main: CQRS (Commands vs Queries) via unified IPC channels `cqrs:command` and `cqrs:query`.
- Renderer (Angular): State management with NgRx (store, actions, reducers, effects, selectors) replacing custom StateService logic.
- Persistence: TypeORM with explicit migrations (synchronize disabled) using SQL.js (in-process SQLite compiled to WASM) stored in Electron userData.

## CQRS in Electron
Commands mutate state:
- save-task (create/update)
- delete-task

Queries read state:
- get-tasks-by-date
- get-tasks-by-month (returns per-day grouped tasks + aggregates)
- get-monthly-summary
- get-all-tasks
- export-csv (treated as a query returning side-effect success)

Handlers live in `electron/cqrs/commands` and `electron/cqrs/queries` and are registered generically in `electron/main.ts`.

## IPC Contract
Renderer sends a structured object:
```
{ type: 'get-tasks-by-date', payload: { date: '2025-09-14' } }
```
Through `window.electronAPI.query()` or `command()`; preload ensures context isolation.

## NgRx Store
Feature: `tasks` (file set under `src/app/store/tasks/*`).
State slices: currentDate, selectedMonth, todayTasks, monthlyData, allTasks, monthlySummary, isLoading, error.
Effects trigger database (CQRS) calls and dispatch success/failure actions; mutation success triggers refresh of dependent queries.

## Migrations
Stored in `electron/migrations`. Initial migration creates tables and a trigger for updated_at. On startup after DataSource init: `runMigrations()` executes pending migrations. `synchronize` disabled to protect schema.

## Transitional Cleanup
`StateService` now unused by components and can be safely removed after verifying no remaining imports.

## Future Improvements
- Add validation (zod or custom) for command/query payloads.
- Add domain services for complex logic (e.g., auto distribute hours) invoked via dedicated commands.
- Implement time entry granularity (TimeEntry entity currently unused in UI) with separate NgRx feature.
- Add unit tests for reducers, effects, and CQRS handlers.
- Introduce centralized error channel and toast notifications.

## Development Flow
1. Add/modify entity.
2. Generate a new migration (manual file) describing change.
3. Implement command/query or extend existing.
4. Update NgRx actions/effects calling DatabaseService.
5. Adjust UI with selectors only; never call IPC directly from components.

