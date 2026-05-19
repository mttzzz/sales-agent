# Sales Agent

Desktop-приложение для менеджеров по продажам — уведомления о новых заявках.

Текущий статус: **Phase 0 — bootstrap.** Приложение собирается, открывается, ничего больше не делает. Логика (auth, WS, overlay) — следующие фазы; см. `docs/superpowers/specs/2026-05-19-sales-agent-design.md`.

## Установка

Последний релиз: https://github.com/mttzzz/sales-agent/releases/latest

### macOS (Apple Silicon, M-серии)

1. Скачать `Sales.Agent_X.Y.Z_aarch64.dmg`.
2. Открыть .dmg, перетащить `Sales Agent.app` в `/Applications`.
3. Первый запуск — macOS заблокирует unsigned-приложение. Снять карантин:
   ```sh
   xattr -dr com.apple.quarantine "/Applications/Sales Agent.app"
   ```
   Альтернатива через UI: в Finder ПКМ по приложению → Open → Open в диалоге.

Intel Mac (`x86_64-apple-darwin`) не собирается. См. [спеку §2](docs/superpowers/specs/2026-05-19-sales-agent-design.md) — менеджеры на M-серии.

### Windows (x64)

1. Скачать `Sales.Agent_X.Y.Z_x64-setup.exe` (или `_x64_en-US.msi`).
2. Запустить. SmartScreen может предупредить про unsigned — "More info" → "Run anyway".

## Стек

- Tauri 2 (Rust core) + Vue 3 + Vite (TypeScript)
- CI: GitHub Actions matrix (`macos-14` arm64, `windows-latest` x64); `tauri-apps/tauri-action@v0` создаёт draft Release по тегу `v*`

## Документация

- Дизайн системы: [`docs/superpowers/specs/2026-05-19-sales-agent-design.md`](docs/superpowers/specs/2026-05-19-sales-agent-design.md)
- Планы по фазам: [`docs/superpowers/plans/`](docs/superpowers/plans/)
