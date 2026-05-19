# Phase 0 — Repo & CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Поднять публичный GitHub-репо `mttzzz/sales-agent`, запушить Tauri 2 + Vue 3 скаффолд, настроить GitHub Actions cross-platform build matrix → по тегу `v*` получаем GitHub Release с установочными бандлами для macOS arm64, macOS Intel, Windows x64. Подписи / auto-update — НЕ в этой фазе (это Phase 9).

**Architecture:** Один workflow `.github/workflows/build.yml` с matrix-стратегией (3 runner'а: `macos-14` arm64, `macos-13` Intel, `windows-latest`). На push тега `v*` → `tauri-apps/tauri-action@v0` собирает бандлы, создаёт draft GitHub Release и аппендит к нему .dmg / .msi / .nsis.exe. На `workflow_dispatch` (без тега) → бандлы аттачатся к workflow run через `actions/upload-artifact@v4` (для smoke-теста pipeline до релиза).

**Tech Stack:** Tauri 2, Vue 3 (TS), Vite, Bun, GitHub Actions, `tauri-apps/tauri-action@v0`, `dtolnay/rust-toolchain@stable`, `swatinem/rust-cache@v2`.

---

## File Structure

| File | Status | Purpose |
|---|---|---|
| `src-tauri/Cargo.toml` | modify | Установить `description`, `authors`. Версия `0.1.0` остаётся как у скаффолда. |
| `src-tauri/tauri.conf.json` | already-edited | `productName: "Sales Agent"`, `identifier: "com.mttzzzz.sales-agent"`, окно 480×320 — уже сделано в скаффолд-фазе |
| `.github/workflows/build.yml` | create | Build matrix |
| Все scaffold-файлы (38 штук) | commit | Tauri 2 + Vue 3 каркас, уже в working tree |

Все остальные файлы (frontend `src/`, scaffold `src-tauri/src/`, иконки) — без модификаций в Phase 0.

---

## Pre-flight checks (do before Task 1)

- [ ] **P1: Verify repo is git-initialized with spec already committed**

Run: `cd ~/projects/sales-agent && git log --oneline -5`
Expected output (точные хеши могут отличаться):
```
3eaea12 docs(spec): lock in open-question answers
556fffd docs(spec): initial sales-agent design
```

- [ ] **P2: Verify gh CLI authenticated**

Run: `gh auth status 2>&1 | grep "Logged in"`
Expected: `✓ Logged in to github.com account mttzzz ...`

- [ ] **P3: Verify GitHub repo `mttzzz/sales-agent` does NOT yet exist (avoid collision)**

Run: `gh repo view mttzzz/sales-agent 2>&1 | head -1`
Expected: `GraphQL: Could not resolve to a Repository ...` (errors out — good)
If output shows the repo exists → STOP and ask user whether to delete or use existing.

---

## Task 1: Polish scaffold metadata

**Files:**
- Modify: `~/projects/sales-agent/src-tauri/Cargo.toml`

Скаффолд оставил `description = "A Tauri App"` и `authors = ["you"]` — поправим до коммита, чтобы не светить заглушки в crates-метаданных.

- [ ] **Step 1: Read current Cargo.toml**

Run: `cat ~/projects/sales-agent/src-tauri/Cargo.toml | head -8`
Expected to contain:
```
description = "A Tauri App"
authors = ["you"]
```

- [ ] **Step 2: Edit Cargo.toml**

Replace these two lines in `src-tauri/Cargo.toml`:

Before:
```toml
description = "A Tauri App"
authors = ["you"]
```

After:
```toml
description = "Sales Agent — desktop notification client for sales managers"
authors = ["mttzzz <taborrnd@gmail.com>"]
```

- [ ] **Step 3: Verify edit**

Run: `grep -E '^(description|authors)' ~/projects/sales-agent/src-tauri/Cargo.toml`
Expected:
```
description = "Sales Agent — desktop notification client for sales managers"
authors = ["mttzzz <taborrnd@gmail.com>"]
```

(No commit yet — Task 2 commits scaffold including this change as one initial code commit.)

---

## Task 2: Commit scaffold to git

**Files:**
- Add: 38 untracked scaffold files (Vue/TS sources, Cargo.toml, tauri.conf.json, icons, `.gitignore` files)

В репо уже есть два коммита `docs(spec)*`. Сейчас добавляем код скаффолда как третий коммит. Используем `commit-files.sh` с явным списком из `git ls-files --others --exclude-standard` — не делаем `git add .` / `-A` по правилу из `~/.claude/CLAUDE.md`.

- [ ] **Step 1: List files that will be committed**

Run: `cd ~/projects/sales-agent && git ls-files --others --exclude-standard | sort`
Expected ~38 lines including:
```
.gitignore
.vscode/extensions.json
README.md
bun.lock
index.html
package.json
public/tauri.svg
public/vite.svg
src-tauri/.gitignore
src-tauri/Cargo.toml
src-tauri/build.rs
src-tauri/capabilities/default.json
src-tauri/icons/...
src-tauri/src/lib.rs
src-tauri/src/main.rs
src-tauri/tauri.conf.json
src/App.vue
src/assets/vue.svg
src/main.ts
src/vite-env.d.ts
tsconfig.json
tsconfig.node.json
vite.config.ts
```
NOT включает: `node_modules/`, `dist/`, `src-tauri/target/`, `src-tauri/gen/schemas/` (отфильтрованы scaffold .gitignore'ами).

- [ ] **Step 2: Commit via explicit-file-commits**

Run (одной строкой; xargs передаёт каждое имя файла отдельным аргументом):
```bash
cd ~/projects/sales-agent && \
  git ls-files --others --exclude-standard | \
  xargs bash ~/.claude/scripts/commit-files.sh "chore: scaffold tauri 2 + vue 3"
```

Expected output:
```
[main XXXXXXX] chore: scaffold tauri 2 + vue 3
 38 files changed, NNNN insertions(+)
 ...
[commit:files] Закоммичено 38 файл(ов).
```

- [ ] **Step 3: Verify clean working tree**

Run: `cd ~/projects/sales-agent && git status`
Expected: `nothing to commit, working tree clean`

- [ ] **Step 4: Verify commit log**

Run: `git log --oneline -5`
Expected:
```
XXXXXXX chore: scaffold tauri 2 + vue 3
3eaea12 docs(spec): lock in open-question answers
556fffd docs(spec): initial sales-agent design
```

---

## Task 3: Create public GitHub repo and push

**Files:** none (only remote setup)

- [ ] **Step 1: Create repo on GitHub and push current `main`**

Run:
```bash
cd ~/projects/sales-agent && \
  gh repo create mttzzz/sales-agent \
    --public \
    --source . \
    --remote origin \
    --push \
    --description "Sales Agent — desktop notification client for sales managers (Tauri 2 + Vue 3)"
```

Expected output:
```
✓ Created repository mttzzz/sales-agent on GitHub
  https://github.com/mttzzz/sales-agent
✓ Added remote git@github.com:mttzzz/sales-agent.git
✓ Pushed commits to git@github.com:mttzzz/sales-agent.git
```

- [ ] **Step 2: Verify on GitHub**

Run:
```bash
gh repo view mttzzz/sales-agent --json url,visibility,defaultBranchRef
```
Expected (single-line JSON):
```json
{"defaultBranchRef":{"name":"main"},"url":"https://github.com/mttzzz/sales-agent","visibility":"PUBLIC"}
```

- [ ] **Step 3: Verify all commits pushed**

Run: `git log origin/main --oneline -5`
Expected (same three commits as in Task 2 Step 4):
```
XXXXXXX chore: scaffold tauri 2 + vue 3
3eaea12 docs(spec): lock in open-question answers
556fffd docs(spec): initial sales-agent design
```

---

## Task 4: Write GH Actions build workflow

**Files:**
- Create: `~/projects/sales-agent/.github/workflows/build.yml`

- [ ] **Step 1: Create workflow directory**

Run: `mkdir -p ~/projects/sales-agent/.github/workflows && ls ~/projects/sales-agent/.github/workflows/`
Expected: empty directory listing.

- [ ] **Step 2: Write `build.yml`**

Create `~/projects/sales-agent/.github/workflows/build.yml` with exactly this content:

```yaml
name: build

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-14
            target: aarch64-apple-darwin
          - platform: macos-13
            target: x86_64-apple-darwin
          - platform: windows-latest
            target: x86_64-pc-windows-msvc
    runs-on: ${{ matrix.platform }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Setup Rust toolchain
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: './src-tauri -> target'

      - name: Install frontend dependencies
        run: bun install

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ startsWith(github.ref, 'refs/tags/') && github.ref_name || '' }}
          releaseName: 'Sales Agent ${{ github.ref_name }}'
          releaseBody: 'Бандлы установки для macOS и Windows. Установить — см. README.'
          releaseDraft: true
          prerelease: false
          args: --target ${{ matrix.target }}

      - name: Upload artifacts (non-tag runs)
        if: ${{ !startsWith(github.ref, 'refs/tags/') }}
        uses: actions/upload-artifact@v4
        with:
          name: sales-agent-${{ matrix.target }}
          if-no-files-found: error
          path: |
            src-tauri/target/${{ matrix.target }}/release/bundle/**/*.dmg
            src-tauri/target/${{ matrix.target }}/release/bundle/**/*.msi
            src-tauri/target/${{ matrix.target }}/release/bundle/**/*.exe
            src-tauri/target/${{ matrix.target }}/release/bundle/**/*.app.tar.gz
```

Why these choices:
- `macos-14` (arm64) + `macos-13` (Intel): явные версии вместо `macos-latest`, чтобы билд не сломался при ротации `latest` GitHub'ом.
- `releaseDraft: true`: 3 параллельных job'а конкурентно ассертят release; tauri-action идемпотентно дозаписывает в draft. Ты вручную «Publish» в GH UI после ревью артефактов.
- `tagName: ${{ ... || '' }}`: при `workflow_dispatch` без тега → пустая строка → tauri-action только собирает, релиз не трогает; артефакты идут в upload-artifact.
- `if-no-files-found: error`: если бандл не сгенерился — workflow падает, а не молча отдаёт пустой artifact.

- [ ] **Step 3: Verify YAML is syntactically valid**

Run:
```bash
bunx --bun yaml-lint ~/projects/sales-agent/.github/workflows/build.yml 2>&1 || \
  bun add -g yaml-lint && yaml-lint ~/projects/sales-agent/.github/workflows/build.yml
```

If `yaml-lint` not installable, fallback:
```bash
python3 -c "import yaml; yaml.safe_load(open('$HOME/projects/sales-agent/.github/workflows/build.yml'))" && echo "yaml OK"
```
Expected: `yaml OK` (or yaml-lint reports no errors).

- [ ] **Step 4: Commit workflow**

Run:
```bash
cd ~/projects/sales-agent && \
  bash ~/.claude/scripts/commit-files.sh \
    "ci: cross-platform build matrix (macos arm64 + intel + win64)" \
    .github/workflows/build.yml
```
Expected: `[commit:files] Закоммичено 1 файл(ов).`

- [ ] **Step 5: Push and verify GH sees the workflow**

Run:
```bash
git push origin main && \
  sleep 3 && \
  gh workflow list
```
Expected output ends with a row like:
```
build  active  NNNNNNN
```

---

## Task 5: Tag v0.1.0 and watch CI

**Files:** none (git-only)

- [ ] **Step 1: Verify version in `tauri.conf.json` and `Cargo.toml` matches the tag we're about to push**

Run:
```bash
grep -E '"version"' ~/projects/sales-agent/src-tauri/tauri.conf.json
grep -E '^version' ~/projects/sales-agent/src-tauri/Cargo.toml
```
Expected:
```
  "version": "0.1.0",
version = "0.1.0"
```
Если несовпадает — поправь обе до `0.1.0` (это просто `Edit` файлов), сделай отдельный коммит `chore: bump version to 0.1.0` через `commit-files.sh`, push, и ТОЛЬКО ПОТОМ переходи к шагу 2.

- [ ] **Step 2: Create annotated tag**

Run:
```bash
cd ~/projects/sales-agent && \
  git tag -a v0.1.0 -m "Phase 0: first cross-platform CI build" && \
  git push origin v0.1.0
```
Expected:
```
To github.com:mttzzz/sales-agent.git
 * [new tag]         v0.1.0 -> v0.1.0
```

- [ ] **Step 3: Watch the workflow run**

Run:
```bash
# Wait 5s for GH to register the tag push, then list runs
sleep 5 && gh run list --workflow=build.yml --limit=3
```
Expected: one row with status `queued` or `in_progress`, тригер `push`, ref `v0.1.0`.

Then start streaming logs of the latest run:
```bash
gh run watch $(gh run list --workflow=build.yml --limit=1 --json databaseId --jq '.[0].databaseId')
```
Expected (после 8-15 минут — первый прогон без cache): все 3 матрицы (`macos-14`, `macos-13`, `windows-latest`) завершаются ✓.

Если падает на каком-то этапе:
- **`bun install` fail** → проверь что в репо запушен `bun.lock` (есть в `git ls-files`).
- **`cargo build` fail на mac** → попробуй пересобрать сразу — иногда транзиентный сетевой сбой при тяге crates. Если стабильно падает на конкретной крате — открой issue и пинг меня.
- **tauri-action fail с "Resource not accessible"** → проверь `permissions.contents: write` в workflow (должно быть).
- **macOS bundle fail with "code signing"** → не должно случиться: мы не подписываем. Если случилось, что-то наследуется из dev-конфига — проверь `tauri.conf.json` `bundle.macOS` (должно быть пусто/дефолт).

- [ ] **Step 4: Verify all 3 matrix legs succeeded**

Run:
```bash
gh run list --workflow=build.yml --limit=1 --json conclusion,event,headBranch
```
Expected: `"conclusion":"success"`.

---

## Task 6: Verify Release artifacts and install on Mac

**Files:** none (manual verification)

- [ ] **Step 1: List artifacts attached to the draft release**

Run:
```bash
gh release view v0.1.0 --json assets --jq '.assets[].name'
```
Expected: 4-6 файлов из набора (точные имена зависят от Tauri-bundling, версии будут содержать `0.1.0`):
```
Sales Agent_0.1.0_aarch64.dmg
Sales Agent_0.1.0_aarch64.app.tar.gz
Sales Agent_0.1.0_x64.dmg
Sales Agent_0.1.0_x64.app.tar.gz
Sales Agent_0.1.0_x64-setup.exe
Sales Agent_0.1.0_x64_en-US.msi
```

Если меньше 4 файлов — какой-то matrix-leg не доехал до release. Проверь `gh run view --log` неудавшегося job'а.

- [ ] **Step 2: Получить публичную ссылку на скачивание Mac arm64 .dmg**

Поскольку release пока в draft, прямой URL виден только в GH UI или через API. Получить:
```bash
gh release view v0.1.0 --json assets --jq '.assets[] | select(.name | endswith("aarch64.dmg")) | .url'
```
Expected: URL вида `https://github.com/mttzzz/sales-agent/releases/download/v0.1.0/Sales%20Agent_0.1.0_aarch64.dmg` (он будет работать только пока пользователь залогинен в GH или после публикации релиза).

- [ ] **Step 3: Publish the draft release (только если все артефакты на месте)**

Run:
```bash
gh release edit v0.1.0 --draft=false
```
Expected:
```
https://github.com/mttzzz/sales-agent/releases/tag/v0.1.0
```

- [ ] **Step 4 (manual, на пользовательском Mac): Скачать и установить**

Пользователь на своём Mac:
1. Скачать `.dmg` (если M-series — `aarch64`, если Intel — `x64`) с https://github.com/mttzzz/sales-agent/releases/tag/v0.1.0
2. Открыть .dmg → перетащить `Sales Agent.app` в `/Applications`
3. **Первый запуск** (приложение НЕподписано, Gatekeeper заблокирует):
   - macOS покажет "Sales Agent is damaged and can't be opened" или "cannot be opened because the developer cannot be verified"
   - Bypass: в терминале — `xattr -dr com.apple.quarantine /Applications/Sales\ Agent.app`
   - Или: Finder → правый клик по `Sales Agent.app` → Open → Open в диалоге
4. Должно открыться окно 480×320 с текстом "Sales Agent / POC — пустое окно / v0.1.0"

Acceptance: окно открывается → Phase 0 done.

- [ ] **Step 5: Записать gotcha в README**

Создай файл `~/projects/sales-agent/README.md` (если уже есть от Tauri scaffold — перезапиши) с минимальной инструкцией для будущих менеджеров:

```markdown
# Sales Agent

Desktop-приложение для менеджеров по продажам — уведомления о новых заявках.

## Установка

Скачать последний релиз: https://github.com/mttzzz/sales-agent/releases/latest

### macOS

1. Скачать `.dmg` (M-series → `aarch64`, Intel → `x64`).
2. Открыть .dmg, перетащить `Sales Agent.app` в `/Applications`.
3. **Первый запуск**: macOS заблокирует unsigned app. Bypass через терминал:
   ```
   xattr -dr com.apple.quarantine /Applications/Sales\ Agent.app
   ```
   Или: правый клик по приложению в Finder → Open → Open в диалоге.

### Windows

1. Скачать `.msi` или `-setup.exe`.
2. Запустить, установить.
3. Windows SmartScreen может предупредить (unsigned) → "More info" → "Run anyway".

## Документация

- Дизайн: [`docs/superpowers/specs/2026-05-19-sales-agent-design.md`](docs/superpowers/specs/2026-05-19-sales-agent-design.md)
- Планы фаз: `docs/superpowers/plans/`
```

Commit:
```bash
cd ~/projects/sales-agent && \
  bash ~/.claude/scripts/commit-files.sh \
    "docs: README with install instructions for unsigned bundles" \
    README.md && \
  git push origin main
```

---

## Self-review (after completing all tasks)

- [ ] **Spec coverage**: Phase 0 = строка 0 в §12 спеки («Repo + GH Actions для macOS (arm64) + Windows (x64) builds → tag → release artefacts + `latest.json`»). `latest.json` — это Phase 9 (`tauri-plugin-updater`), не Phase 0. Спека правильно разделяет это; план соответствует.
- [ ] **Placeholder scan**: ни одной `TODO` / `TBD` строки в плане. Все команды конкретны.
- [ ] **Type consistency**: имена workflow `build`, файл `build.yml`, identifier `com.mttzzzz.sales-agent`, productName `Sales Agent`, version `0.1.0` — единое употребление везде.

---

## Out of scope for Phase 0 (явное напоминание)

- ❌ Tauri updater plugin / Ed25519 keypair / `latest.json` — Phase 9
- ❌ Auth UI / OTP / Sanctum — Phase 1+
- ❌ Octane backend / migrations — Phase 2+
- ❌ WS-подключение к Reverb — Phase 4
- ❌ Always-on-top overlay — Phase 5
- ❌ Code-signing / notarization macOS — потенциально позже (требует Apple Developer $99/year)
- ❌ Auto-launch on OS boot — позже через `tauri-plugin-autostart`
- ❌ Sentry интеграция в Rust/JS — Phase 10

---

## Definition of Done (Phase 0)

1. Репо `mttzzz/sales-agent` создан, public, default branch `main`.
2. В репо есть commits в порядке: `docs(spec): initial sales-agent design` → `docs(spec): lock in open-question answers` → `chore: scaffold tauri 2 + vue 3` → `ci: cross-platform build matrix (macos arm64 + intel + win64)` → `docs: README with install instructions for unsigned bundles`.
3. Workflow `build` отрабатывает на push тега `v0.1.0`, все 3 matrix-leg-а зелёные.
4. GitHub Release `v0.1.0` published, содержит минимум: `.dmg` arm64, `.dmg` x64, `.exe` (или `.msi`) Win64.
5. Пользователь скачал и запустил `.dmg` на своём Mac — окно открывается.
