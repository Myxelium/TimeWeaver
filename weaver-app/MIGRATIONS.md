# Database Migrations

This project uses TypeORM migrations (sql.js) instead of `synchronize` to manage schema evolution.

## Files & Layout
- Runtime migrations are located in `electron/migrations/*.ts` (compiled to `.js` in `dist/electron/migrations`).
- CLI DataSource: `electron/data-source.ts` (uses project root `weaver.db` for diffing when generating migrations).
- Electron runtime DataSource is configured inside `electron/main.ts` and points to the user's app data directory.

## Generating a Migration
Run after modifying entity definitions (`electron/entities/*.ts`):

```
npm run migration:generate
```
This inspects current DB (project copy) plus entity metadata and writes a timestamped file like:
`electron/migrations/1736921234567-Auto.ts`.

If you want a blank template:
```
npm run migration:create
```

## Applying Migrations (CLI)
Apply to the project root `weaver.db` (useful for local testing):
```
npm run migration:run
```
Revert last:
```
npm run migration:revert
```

## Applying at Runtime (App Startup)
When the packaged app launches, `electron/main.ts` calls `dataSource.runMigrations()` automatically after establishing the connection (pointing at the user's persisted `weaver.db`).

## Recommended Workflow
1. Stop the dev app if running.
2. Edit or add entity fields.
3. Delete `weaver.db` in project root if you want a clean baseline (optional).
4. Run `npm run migration:generate`.
5. Inspect the generated file; adjust if needed (e.g., add `IF NOT EXISTS`).
6. Commit the migration alongside the entity change.
7. Start dev (`npm run dev`) and the migration will run in userData context.

## Notes
- Avoid editing old migration files—always create a new one to modify schema.
- Ensure class name inside migration matches file name timestamp (TypeORM does this automatically through the generator).
- Keep `synchronize: false` to prevent accidental destructive changes.
- For sql.js, foreign keys require you to manually manage cascading if needed.

## Troubleshooting
**Error: Migration name/class mismatch**: Delete the offending file and regenerate using the script.
**No migrations running**: Ensure compiled JS files exist in `dist/electron/migrations` and that the glob in `main.ts` includes them. Re-run `npm run build:electron`.
