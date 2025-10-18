# Weaver (TimeWeaver)

Time tracking & productivity desktop app built with Angular + Electron + TypeORM (sql.js) + NgRx.

## Tech Stack
- Angular 19 (standalone APIs)
- Electron 38
- NgRx Store/Effects/Entity
- TypeORM (sql.js driver) with migrations (no `synchronize` in prod)
- CQRS-style IPC (generic `cqrs:command` / `cqrs:query` channels)

## Quick Start (Dev)
```
npm install
npm run dev
```
Runs Angular build then launches Electron (`--dev` opens dev tools).

## Building Packages
```
npm run electron:build         # prod build + electron-builder (all configured targets)
npm run package:linux          # AppImage + deb
npm run package:windows        # NSIS installer
```
Artifacts output to `release/`.

## State Management
NgRx feature modules live under `src/app/store/*`. Components dispatch actions and select state; side-effects (API/database) are isolated in Effects classes.

## CQRS IPC
Renderer communicates with main via two generic channels:
- `cqrs:command` { type, payload }
- `cqrs:query` { type, payload }

Handlers reside in `electron/cqrs/commands` and `electron/cqrs/queries` keeping the main process thin.

## Database & Migrations
TypeORM with the `sql.js` driver stores a SQLite DB file (`weaver.db`). At runtime the DB lives in the Electron userData directory; for CLI migration generation we keep a project-root `weaver.db` for diffing.

### Generate a Migration (after entity changes)
```
npm run migration:generate
```
If TypeORM reports "No changes", verify you modified entity decorators and that you rebuilt nothing that compiled away metadata incorrectly.

### Create an Empty Migration Template
```
npm run migration:create
```
Edit the file produced under `electron/migrations/` then run migrations.

### Apply/Revert Locally (project DB)
```
npm run migration:run
npm run migration:revert
```
### Runtime
On app startup `electron/main.ts` calls `dataSource.runMigrations()` automatically against the user’s persisted DB.

### Important Rules
- Do NOT enable `synchronize` in production.
- Never edit an old migration once committed—add a new one.
- Class name + file name must retain the timestamp suffix (`<Name><UnixMillis>`).
- If you change entities and generation finds no changes, try removing the local `weaver.db` to force a fresh diff.

Full details & troubleshooting: see `MIGRATIONS.md`.

## Development Tips
- Use NgRx Effects for all async database operations; keep components lean.
- Prefer adding a new migration for every schema change, even small ones.
- Keep IPC payloads serializable (no class instances) when crossing process boundary.

## License
(Add license info here.)
