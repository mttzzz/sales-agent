# Phase 4 — Real-time new-lead notifications

**Дата:** 2026-05-20
**Зависит от:** Phase 3 (WS handshake + auth ready, sales-agent v0.9.0 published).

## Goal

Новая заявка («новый клиент») приходит в систему → все non-DND `amoUser`-ы аккаунта мгновенно видят native OS-нотификацию + бэйдж в Sales Agent. Trigger — отдельный вебхук с `deal_id + account_id` (внешний, сейчас мокаем артисан-командой).

## Architecture

```
[mock: artisan desktop:lead-arrived --account=X --lead=Y]
         │
         ▼ (future: POST /api/desktop/v1/internal/new-lead from external system)
   App\Listeners\NewLeadDispatcher
         │
         ▼  для каждого amoUser в account где DesktopDevice.dnd_on=false:
   broadcast(new NewLeadIncoming($amoUserId, $leadId))
         │
         ▼  PrivateChannel('amoUser.{id}'), connection 'sales-agent'
   reverb.pushka.biz
         │
         ▼ wss frame: event=NewLeadIncoming, data={lead_id, at}
   sales-agent useWs.ts → onNewLead callback
         │
         ▼
   tauri-plugin-notification.sendNotification + badge count в UI
```

## Open questions (resolved)

- **Trigger source:** отдельный вебхук с `lead_id`. Real integration — позже. Сейчас mock через artisan-команду.
- **Audience:** все `amoUser`-ы аккаунта, у которых есть `desktop_devices` запись с `dnd_on = false`. Сервер фильтрует — не отправляем event muted-клиентам.
- **UI:** native OS notification (Win toast / macOS NotificationCenter) + счётчик в окне приложения. Inbox/история — out of scope для Phase 4 (только текущая сессия).

## Tasks

### Octane (backend)

**P4-O1: Event class `App\Events\Desktop\NewLeadIncoming`**
- `ShouldBroadcast`, PrivateChannel(`amoUser.{$amoUserId}`), `broadcastAs() = 'NewLeadIncoming'`, `broadcastConnections() = ['sales-agent']`
- Payload: `lead_id` (int), `at` (ISO-8601 string)
- File: `app/Events/Desktop/NewLeadIncoming.php`

**P4-O2: Artisan command `desktop:lead-arrived`**
- Args: `--account=<account_id|subdomain>`, `--lead=<lead_id>`
- Resolves Account (by id или subdomain), iterates `$account->amoUsers`, для каждого проверяет `DesktopDevice::where('amo_user_id', $u->id)->where('dnd_on', false)->exists()` → `broadcast(new NewLeadIncoming(...))`
- Output: список amoUsers получивших event + список muted (skipped)
- File: `app/Console/Commands/Desktop/LeadArrivedCommand.php`

**P4-O3: Unit tests**
- `NewLeadIncomingTest`: `broadcastOn()` returns right channel, `broadcastAs()`, `broadcastConnections()`, `broadcastWith()`
- `LeadArrivedCommandTest`: создаёт account + 2 amoUsers (один DND, один нет), запускает команду, ассерт что event улетел только non-DND. Использует `Event::fake([NewLeadIncoming::class])`.
- File: `tests/Unit/Desktop/NewLeadIncomingTest.php`, `tests/Unit/Desktop/LeadArrivedCommandTest.php`

**P4-O4 (optional, defer):** Webhook endpoint `POST /api/desktop/v1/internal/new-lead`
- Bearer-token guarded (`DESKTOP_INTERNAL_WEBHOOK_TOKEN` from infisical)
- Body: `{ account_id|subdomain, lead_id }`
- Логика та же что и в команде, но HTTP-driven
- Отложен пока нет конкретной внешней интеграции

### Sales-agent (frontend)

**P4-S1: Rust dep `tauri-plugin-notification`**
- `cargo add tauri-plugin-notification` в `src-tauri/Cargo.toml`
- `app.handle().plugin(tauri_plugin_notification::init())` в `src-tauri/src/lib.rs`
- Capability: `desktop-capability.json` → разрешить `notification:default` (или `notification:allow-notify`)

**P4-S2: Frontend dep `@tauri-apps/plugin-notification`**
- `bun add @tauri-apps/plugin-notification`

**P4-S3: useWs.ts — подписка на NewLeadIncoming**
- Добавить bind:
  ```ts
  channel.bind('NewLeadIncoming', (data: { lead_id: number; at: string }) => {
    void onNewLead(data)
  })
  ```
- Экспортить reactive `newLeadsCount` (ref<number>) и `latestLead` (ref<{ lead_id, at } | null>)

**P4-S4: useNotifications composable**
- `requestPermission()` — проверка/запрос permission через plugin
- `notifyNewLead(leadId, at)` — `sendNotification({ title: 'Новая заявка', body: `Сделка #${leadId}` })`
- Permission запрашивается один раз при первом WS-event'е

**P4-S5: MainScreen.vue — badge counter**
- Маленький бэйдж рядом с WS-статусом: `0 заявок` / `1 заявка` / `N заявок`
- Кнопка/клик-action не требуется (Phase 4 не включает inbox)

**P4-S6: e2e smoke test**
- Локально: `php artisan desktop:lead-arrived --account=mogoby --lead=12345`
- В sales-agent должен прилететь event, появиться native notification, бэйдж += 1

### Release (v0.10.0)

**P4-R1: bump + tag**
- `package.json` + `src-tauri/tauri.conf.json` → `0.10.0`
- `src-tauri/Cargo.toml` → `0.10.0`
- Создать tag `v0.10.0`, push → CI build
- v0.10.0 содержит:
  - GG-фикс (`9303735`, уже на main)
  - Phase 4 client (notification plugin + event subscription + badge)

**P4-R2: publish release**
- После CI build → `gh release edit v0.10.0 --draft=false --latest`
- На моей машине авто-апдейтер подтянет в ≤30 мин

## Out of scope (Phase 5+)

- Inbox/история заявок (persistent storage в Tauri store)
- Клик-by нотификации → открывает amoCRM lead в браузере
- Push с типом «новый incoming-message» (только leads сейчас)
- Реальный webhook endpoint (P4-O4) — добавлю когда придёт integration spec
- WS-driven app-update trigger (`AppReleased` event) — отдельная небольшая фича, не Phase 4

## Risks

- **Permission denial** на macOS/Windows: пользователь может отказать в OS-нотификациях. Тогда показываем только in-app badge.
- **Прод нагрузка**: для аккаунтов с >100 amoUsers команда делает N broadcast'ов в цикле — для mogoby ~50 пользователей это копейки, для крупных аккаунтов потенциально надо batch'ить. Сейчас acceptable.
- **WS reconnect**: если sales-agent disconnect'нулся в момент броадкаста — event теряется. Pusher protocol не имеет message-replay. Acceptable для notifications (не для критичных событий).
