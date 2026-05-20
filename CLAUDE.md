# sales-agent — правила проекта

Общие правила (git-дисциплина, тесты, bash-hygiene, Postgres MCP) — в `~/.claude/CLAUDE.md`.
Здесь — только специфика репо.

## Project parameters

| | |
| --- | --- |
| projectName | `sales-agent` |
| stack | Tauri 2 + Vue 3 + TypeScript (desktop client) + Pusher-js → Reverb |
| backend | `octane.pushka.biz` (Laravel) — auth + broadcasting/auth + событие `NewLeadIncoming` |
| ws-broker | `reverb.pushka.biz` (Laravel Reverb), креды в Infisical workspace `reverb.pushka.biz` |
| pipeline | `bun run build` (vue-tsc + vite multi-entry) |
| repro-tool | `gh run watch`, локальный артисан `desktop:lead-arrived` (mogoby) |

## POC stage: blanket push permission

**Это POC-приложение, активная итерация.** Не спрашивать пользователя каждый раз перед `git push origin main` или `git push origin v*` (tag → CI build). Делать сразу:
- После commit → сразу push
- После bump tauri.conf.json + Cargo.toml → tag + push tag → CI build
- После CI success → `gh release edit vX.Y.Z --draft=false --latest` (auto-updater подтянет)

Исключения, где **всё ещё спрашиваем**:
- Любые `force` / `reset --hard` / `branch -D`
- `--no-verify`
- Изменения в `.github/workflows/*` которые могут менять контракт релиза (signing key, endpoints)
- Прод-секреты в Infisical/GH secrets (по умолчанию через `pipe trick` без stdout — но если нужен новый секрет, спросить)

Эта проектная норма перекрывает глобальное правило «Push — только с явного разрешения» **только** для `mttzzz/sales-agent` `main`-ветки и tag-пушей в этом репо.

## Release flow

Каждый релиз — два версионных бампа:
- `src-tauri/tauri.conf.json` → `"version"`
- `src-tauri/Cargo.toml` → `version`

`package.json` остаётся на `0.1.0` (npm version не используется).

После: `git tag -a vX.Y.Z -m "..."` → push → CI билдит macOS aarch64 + Windows x64 → создаёт draft release → `gh release edit vX.Y.Z --draft=false --latest`.

## Env

Build-time `VITE_*` из GH Actions secrets:
- `VITE_DESKTOP_BOOTSTRAP_TOKEN` ← repo secret `DESKTOP_BOOTSTRAP_TOKEN`
- `VITE_SALES_AGENT_APP_KEY` ← repo secret `SALES_AGENT_APP_KEY` (Pusher/Reverb client key, public-by-design — шипится в бинарь)

Локальный dev (если когда-нибудь понадобится `bun run tauri dev`): `.env.local` (gitignored через `*.local` в `.gitignore`) с теми же ключами. `.env.example` — committed-шаблон.

## Backend pieces (octane.pushka.biz)

- Event: `App\Events\Desktop\NewLeadIncoming` → PrivateChannel `amoUser.{id}`, connection `sales-agent`, payload `{lead_id, at}`.
- Artisan (mock trigger): `php artisan desktop:lead-arrived --account=<id|subdomain> --lead=<id>` → бродкаст всем non-DND amoUsers аккаунта. Реальный webhook endpoint отложен до спеки внешней интеграции.
- Auth route: `POST /api/desktop/v1/broadcasting/auth` — sanctum-guarded, подписывает signature ключом `sales-agent` connection.
