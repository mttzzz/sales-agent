# Sales Agent — design spec

Date: 2026-05-19
Status: draft → for user review

## 1. Goal

Десктоп-приложение для менеджеров по продажам. Получает push-уведомление о новой клиентской заявке из amoCRM, показывает always-on-top окно с 30-секундным countdown'ом и двумя кнопками (Принять / Отказаться). Первый принявший забирает заявку — у остальных окно автоматически закрывается. Поддерживает DND-режим, авто-обновление, перезапуск без действий пользователя.

Сценарий POC = единственный amoCRM-аккаунт `mogoby`. Дата-модель и эндпоинты с самого начала проектируются мульти-account, но UI этого не показывает.

## 2. Non-goals

- Логика обработки заявок, которые никто не принял за 30s — это вне scope десктоп-системы; octane может перемещать lead по воронке amoCRM, но это не часть этого приложения.
- Аналитика принятий / отказов / SLA — позже, не POC.
- Multi-account UI (выбор amo-аккаунта при логине) — схема готова, UI хардкодит mogoby.
- Полноценный auth с паролями — для POC хватает email-OTP (см. §6).
- Linux desktop сборка — POC только macOS + Windows (Mac первый).
- Голосовые звонки / встроенный CRM-функционал — приложение только маршрутизирует.

## 3. Glossary

| Термин | Смысл |
|---|---|
| AmoUser | Существующая в `octane` модель пользователя amoCRM (один на каждого менеджера в каждом аккаунте amo) |
| Account | amoCRM-аккаунт (для POC `mogoby`) |
| Device | Установленный экземпляр sales-agent у конкретного AmoUser-а; один AmoUser может иметь несколько Device на разных машинах |
| Offer | Конкретное предложение заявки конкретному набору менеджеров, с 30s expiry |
| DND | Do Not Disturb — toggle, при котором Device не получает новых Offer |

## 4. Architecture

```
┌──────────────────┐   webhook  ┌──────────────────────────┐  broadcast  ┌────────────────────────┐
│    amoCRM        │ ─────────▶ │   octane.pushka.biz      │ ──────────▶ │  reverb.pushka.biz     │
│  (mogoby)        │            │   (Laravel + Octane)     │             │  (pure WS infra)       │
│  pipeline-stage  │            │   - REST API             │             │                        │
│      hook        │            │   - amoCRM-clients       │             └────────────┬───────────┘
└──────────────────┘            │   - Offer state machine  │                          │
                                │   - DB (Postgres)        │                          │ wss://
                                └──────────┬───────────────┘                          │ private-amoUser.{id}
                                           │                                          │
                                           │ REST (Sanctum bearer)                    │
                                           │                                          │
                                           ▼                                          ▼
                                ┌──────────────────────────────────────────────────────────┐
                                │              sales-agent (desktop)                       │
                                │     Tauri 2 (Rust core) + Vue 3 + Vite (TS)             │
                                │     ┌──────────────────────────────────────────────┐    │
                                │     │ Login screen → OTP screen → Tray (running)   │    │
                                │     │ Tray menu: DND toggle / Logout / Quit        │    │
                                │     │ On Offer event: spawn always-on-top window   │    │
                                │     │ Auto-update on launch + periodically (idle)  │    │
                                │     └──────────────────────────────────────────────┘    │
                                └──────────────────────────────────────────────────────────┘
                                                          │
                                                          │ on "Принять"
                                                          ▼
                                              открывает в браузере
                                              https://mogoby.amocrm.ru/leads/detail/{id}
```

Сам Reverb остаётся pure WS — никакой бизнес-логики в `reverb.pushka.biz`. Octane генерирует события через стандартный `broadcast()` → Pusher-совместимый HTTP API Reverb.

## 5. Data model (octane)

Новые таблицы (миграции в octane):

### `desktop_devices`
| col | type | notes |
|---|---|---|
| id | bigint pk | |
| amo_user_id | bigint FK→amo_users | |
| account_id | bigint FK→accounts | denormalized для быстрого выборки |
| token_hash | string(64) unique | SHA-256 от Sanctum-токена; полный токен только у клиента |
| device_label | string nullable | "MacBook Pro Сергея" — для UX в админке |
| dnd_on | boolean default false | |
| last_seen_at | timestamp nullable | обновляется при WS reconnect и при REST-запросах |
| created_at, updated_at | | |

### `email_otps`
| col | type | notes |
|---|---|---|
| id | bigint pk | |
| amo_user_id | bigint FK | |
| code_hash | string(64) | HMAC-SHA256(code, app_key) |
| expires_at | timestamp | now + 10min |
| consumed_at | timestamp nullable | |
| attempts | smallint default 0 | макс 5 |
| ip | inet nullable | для rate-limit аналитики |
| created_at | | |

Rate limit: не больше 1 активного неконсюмленного OTP на amo_user за 60s (request-code returns 429 если есть).

### `offers`
| col | type | notes |
|---|---|---|
| id | bigint pk | |
| account_id | bigint FK | |
| amo_lead_id | bigint | id сделки в amoCRM |
| lead_url | string | precomputed `https://{account_subdomain}.amocrm.ru/leads/detail/{id}` |
| label | string nullable | "Заявка с сайта" / источник; для POC показываем "Новая заявка" |
| status | enum('pending','accepted','expired') default 'pending' | |
| expires_at | timestamp | now + 30s |
| accepted_by_amo_user_id | bigint FK nullable | |
| accepted_at | timestamp nullable | |
| created_at | | |

### `offer_recipients`
| col | type | notes |
|---|---|---|
| offer_id | bigint FK | |
| amo_user_id | bigint FK | |
| device_id | bigint FK | конкретный device которому отправили (для аналитики мульти-device) |
| sent_at | timestamp | |
| declined_at | timestamp nullable | |
| | | PK(offer_id, device_id) |

## 6. REST API (octane)

Base URL: `https://octane.pushka.biz/api/desktop/v1`

| Method | Path | Auth | Body / Response |
|---|---|---|---|
| GET | `/accounts/{account}/amo-users` | none | `[{ id, name, email, avatar_url }]` — фильтр account=mogoby |
| POST | `/auth/request-code` | none | `{ amo_user_id }` → 204 (или 429) |
| POST | `/auth/verify-code` | none | `{ amo_user_id, code, device_label? }` → `{ token, amo_user, dnd_on, account: { id, slug } }` |
| POST | `/auth/logout` | bearer | 204; удаляет device record |
| POST | `/dnd` | bearer | `{ on: bool }` → `{ dnd_on }` |
| GET | `/me` | bearer | `{ amo_user, dnd_on, account }` — для re-hydration при старте |
| POST | `/offers/{id}/accept` | bearer | → 200 `{ lead_url }` если выиграл; 409 если уже принят кем-то |
| POST | `/offers/{id}/decline` | bearer | → 204; idempotent |
| POST | `/webhooks/amo/{account}/lead` | shared secret в URL/header | внутренний приёмник из amoCRM; создаёт Offer и broadcasts |
| POST | `/broadcasting/auth` | bearer | стандарт Reverb / Pusher channel auth |

Sanctum-токены — long-lived (без TTL), invalidated только через logout / админ-revoke в Nova.

OTP-rate-limit (server-side): не больше 5 `request-code` для одного amo_user_id за час (returns 429). Не больше 5 ошибок ввода кода за TTL OTP (потом OTP помечается expired).

## 7. WS protocol

Reverb (Pusher-compatible). Sales-agent держит одно WS-соединение, подписан на один private channel.

**Channel**: `private-amoUser.{amo_user_id}`

Auth: стандартный `POST /broadcasting/auth` с `socket_id`, `channel_name`, `Authorization: Bearer <token>`. Гейт в `routes/channels.php`:

```php
Broadcast::channel('amoUser.{id}', function ($user, $id) {
    return $user instanceof AmoUser && (int) $user->id === (int) $id;
});
```

(`$user` берётся из Sanctum-guard, который мы прикручиваем к broadcasting/auth.)

**События** (все с `.` prefix чтобы байпасить Laravel namespace):

| Event | Payload | Когда |
|---|---|---|
| `OfferOffered` | `{ offer_id, label, expires_at }` | при создании Offer для этого получателя |
| `OfferTaken` | `{ offer_id }` | когда кто-то другой принял этот Offer |
| `OfferExpired` | `{ offer_id }` | таймаут 30s или все declined |
| `DndChanged` | `{ dnd_on }` | sync между несколькими device того же AmoUser |

Все события идут на per-recipient channel; broadcast в octane делается циклом по `offer_recipients`.

## 8. Flows

### 8.1 Authentication (first launch / re-login)

```
Desktop                            Octane
   │                                  │
   │── GET /accounts/mogoby/amo-users ─▶│
   │◀── [{id,name,email,avatar}, ...]  │
   │                                  │
   │ [user picks self]                │
   │                                  │
   │── POST /auth/request-code ───────▶│
   │       { amo_user_id }             │  generate 6-digit code, hash, store
   │◀── 204                            │  send email via Laravel Mail
   │                                  │
   │ [user types code]                 │
   │                                  │
   │── POST /auth/verify-code ────────▶│
   │       { amo_user_id, code, device_label } │  compare HMAC, mark consumed
   │◀── { token, amo_user, dnd_on,    │  create desktop_device row
   │      account }                    │
   │                                  │
   │ [store token in tauri-plugin-store + restart-safe] │
   │                                  │
   │── WS connect wss://reverb.../app/{key} ─────────────▶│
   │── subscribe private-amoUser.{id} (auth via /broadcasting/auth) ─▶│
   │◀── subscription_succeeded        │
```

Кодовая капча отсутствует; защита от перебора — rate-limit + max-attempts.

### 8.2 New lead notification

```
amoCRM        octane                                  reverb     desktop(A)  desktop(B)
  │             │                                       │            │            │
  │── webhook ─▶│                                       │            │            │
  │             │ INSERT offer (pending, expires=+30s)  │            │            │
  │             │ SELECT eligible devices               │            │            │
  │             │   (account, dnd_on=false,             │            │            │
  │             │    last_seen_at > now - 5min)         │            │            │
  │             │ INSERT offer_recipients (A, B)        │            │            │
  │             │── broadcast OfferOffered ────────────▶│            │            │
  │             │   on private-amoUser.A                │── push ────▶│            │
  │             │   on private-amoUser.B                │── push ──────────────────▶│
  │             │                                       │  [show overlay]  [show overlay]
  │             │                                       │  countdown:30    countdown:30
  │             │                                       │            │            │
  │             │                                       │            │            │
  │             │  schedule timeout-job at expires_at   │            │            │
  │             │                                       │            │            │
  │             │◀── POST /offers/{id}/accept ───────────────────────┤            │
  │             │   [SELECT ... FOR UPDATE; if status=pending then UPDATE]      │
  │             │── 200 { lead_url } ─────────────────────────────────▶│         │
  │             │                                       │ [open browser tab]    │
  │             │── broadcast OfferTaken ─────────────▶│            │            │
  │             │   on private-amoUser.B               │            │── push ───▶│
  │             │                                       │            │ [close overlay]
  │             │                                       │            │            │
```

**Атомарность accept**: `UPDATE offers SET status='accepted', accepted_by_amo_user_id=?, accepted_at=now() WHERE id=? AND status='pending' RETURNING ...`. Если 0 rows affected — 409.

**Sources of truth для таймера**: серверный `expires_at`. Клиент считает оставшееся = `expires_at - now()` + 1 раз в секунду tick для UI. Расхождение часов — игнорируется, серверный `OfferExpired` всё равно прилетит и закроет окно.

**Decline-семантика**: client → POST /offers/{id}/decline → server SET declined_at. Если ВСЕ recipients этого Offer-а declined и accepted_by NULL → server переводит offer в `expired` и broadcasts `OfferExpired`. Иначе остальные продолжают видеть countdown.

**Eligibility-фильтр для recipients**: 
- `desktop_devices.dnd_on = false`
- `desktop_devices.last_seen_at > now() - INTERVAL '5 min'` (online-эвристика — если device offline > 5min, не шлём, чтобы не плодить «мёртвые» recipients)
- `desktop_devices.account_id = offer.account_id`

### 8.3 DND toggle

```
Desktop (tray menu: "DND: on" click)
   │
   │── POST /dnd { on: true } ─────────────▶ octane
   │◀── 200 { dnd_on: true }                  UPDATE desktop_devices SET dnd_on=true
   │
   │  [if currently showing offer overlay → close it locally; recipient row остаётся (для аналитики)]
   │
   │  broadcast DndChanged → other devices того же AmoUser-а:
   │── push on private-amoUser.{id} ───────▶ desktop' (другой device)
   │  [update tray label]
```

DND локально persisted в tauri-store + sync через `/me` при старте.

### 8.4 Auto-update

Tauri 2 + `tauri-plugin-updater` (Ed25519 signed bundles).

**Endpoint**: `https://github.com/mttzzz/sales-agent/releases/latest/download/latest.json`

Файл `latest.json` (генерится в GH Actions, прикрепляется к каждому release):

```json
{
  "version": "0.4.2",
  "notes": "Bugfix: ...",
  "pub_date": "2026-05-19T12:00:00Z",
  "platforms": {
    "darwin-aarch64": { "signature": "...", "url": "https://github.com/.../sales-agent-0.4.2-aarch64.app.tar.gz" },
    "darwin-x86_64":  { "signature": "...", "url": "..." },
    "windows-x86_64": { "signature": "...", "url": "https://github.com/.../sales-agent-0.4.2-x64-setup.nsis.zip" }
  }
}
```

**Стратегия проверки**:
1. На launch (до показа login screen): check → если есть update, скачать и `relaunch()` сразу. Это <10s, user видит splash.
2. В runtime: `setInterval(60min)` → check; если есть update И нет активного overlay-окна → download, потом `relaunch()`. Если активный offer есть — откладываем до его завершения.
3. Если несколько проверок подряд показывают update готов, но overlay всё это время открыт → откладываем максимум 24h, потом форсим (edge case).

**Подпись**: keypair генерится один раз через `tauri signer generate`. Public key прошит в `tauri.conf.json → plugins.updater.pubkey`. Private key — secret `TAURI_SIGNING_PRIVATE_KEY` в GH Actions.

**Manifest hosting**: GitHub Releases (public repo). Если потребуется приватность — proxy-endpoint на octane (вне scope POC).

## 9. Security & trust model

### POC trust model (документированный долг)
- Sanctum-токен в `tauri-plugin-store` лежит в обычном файле (на macOS — `~/Library/Application Support/com.mttzzzz.sales-agent/`). Кража токена даёт полный доступ к аккаунту менеджера.
- На POC это приемлемо: внутреннее приложение, машины менеджеров под контролем.

### Меры всё равно
- Email-OTP проверяет владение email-ом (привязанным к amoCRM-пользователю)
- Все REST под HTTPS
- Webhook `/webhooks/amo/{account}/lead` защищён shared-secret в header (`X-Amo-Webhook-Secret`), который ставим в amoCRM-настройках webhook'а
- Rate-limit на /request-code и /verify-code
- Reverb private channels не подпустят к чужому каналу (`/broadcasting/auth` гейт)
- Updater bundles подписаны Ed25519, public key в коде — невозможно подменить апдейт без приватного ключа

### Прод-roadmap (вне POC, документация для будущего)
- Перейти на `tauri-plugin-stronghold` для шифрованного хранения токена в OS keychain
- Refresh-token rotation
- Опционально: device-binding (TPM/Secure Enclave) — для критичных deploy'ев

## 10. Error handling

| Сценарий | Поведение |
|---|---|
| WS disconnect | exponential backoff (1s → 2s → 4s ... cap 30s); tray icon → 🔴; при reconnect — `GET /me` для sync + resubscribe |
| Sanctum token expired/revoked | при 401 от API → wipe token → переход на login screen |
| Accept race lost (409) | toast «Заявку забрал другой менеджер» → close overlay |
| Decline → server 500 | retry 3 раза с backoff, потом silent fail (offer всё равно закроется по timeout) |
| Webhook от amoCRM упал | amoCRM ретраит сам (стандарт); octane idempotent по `amo_lead_id` (UNIQUE с partial index `WHERE status='pending'` чтобы не дублировать активные) |
| Auto-update signature mismatch | Tauri updater сам отклоняет, log → Sentry |
| OTP-email не дошёл | пользователь может request-code снова через 60s; UI показывает таймер |
| User закрыл overlay через alt+F4 / cmd+w во время оффера | трактуется как decline (auto-POST /decline + закрыть) |

## 11. Testing strategy

### Backend (octane)
- **Unit (composer test → phpunit Unit)**: 
  - Offer state machine: pending → accepted, pending → expired, double-accept → 409
  - Eligibility-filter: dnd_on / last_seen_at / account_id
  - OTP: hash сравнение, attempts ≤ 5, expiry, rate-limit
  - Decline-all-then-expire transition
- **Feature** (если поднимем `tests/Feature/`): 
  - `/auth/request-code` → /verify-code happy path
  - `/offers/{id}/accept` race (concurrent requests, only one wins) — через Postgres `pg_advisory_lock` или просто `SELECT ... FOR UPDATE`
  - Webhook 200/422 (bad payload, dup lead)

### Desktop (sales-agent)
- **Unit (Rust)**: 
  - WS-protocol decoder (Pusher frames → Offer events)
  - Reconnect-state machine
- **UI (Vue / vitest)**: 
  - Countdown-tick + dismiss-on-OfferTaken/Expired
  - DND toggle persistence
- **E2E (manual для POC)**: 
  - 2 desktop-инстанса на одной машине (под разными AmoUser ID; для POC ок — feature-flag DEV_PROFILE)
  - curl trigger webhook → оба видят overlay → accept на инстансе A → инстанс B видит dismiss

Tauri integration tests — позже, для POC manual.

## 12. POC phasing

Спека описывает целевое состояние. POC разбит на инкрементальные шаги, каждый — testable:

| Phase | Что | Acceptance |
|---|---|---|
| **0** | Repo + GH Actions для macOS (arm64) + Windows (x64) builds | tag → release artefacts + `latest.json` |
| **1** | Auth UI без бэка: список AmoUser захардкожен JSON-файл, выбираешь → "вошёл" | окно с именем выбранного юзера + tray-icon |
| **2** | Backend на octane: миграции, /accounts/.../amo-users, /auth/request-code (mailtrap), /auth/verify-code, /me | curl-flow проходит, токен выдаётся |
| **3** | Desktop ↔ octane auth wire-up: реальный список + OTP-вход → токен в store | реальный login на mogoby |
| **4** | WS-подключение к Reverb (private-channel + sanctum-auth) | tray показывает 🟢 connected; manual broadcast → console.log в desktop |
| **5** | Offer-overlay window (always-on-top, countdown, accept/decline кнопки) | manual broadcast OfferOffered → окно открывается; кнопки шлют POST |
| **6** | Webhook + Offer state machine на octane | curl webhook → реальный offer создаётся + broadcasts → окно открывается |
| **7** | Multi-recipient race: 2 desktop'а, accept-on-one → close-on-other | проверка glaзami |
| **8** | DND toggle в tray | toggle → нет offer events; OS-restart preserves |
| **9** | Auto-update: GH Actions подписывает bundles + публикует `latest.json`; updater plugin в app | release v0.0.2 → запущенный app сам обновляется до v0.0.2 |
| **10** | Hardening: error handling из §10, Sentry для desktop+octane | прод-ready |

Каждый phase = отдельный план (writing-plans) и отдельный merge в `main`.

## 13. Tech-stack decisions (recorded)

| Решение | Альтернатива | Почему так |
|---|---|---|
| Tauri 2 vs Electron | | Bundle ~5MB vs ~120MB; native системный tray и always-on-top; secure store через Rust |
| Vue 3 vs React/Svelte | | Существующая экспертиза пользователя (Nuxt/Vue стек везде) |
| Reverb vs Pusher.com/Soketi | | Уже развёрнут reverb.pushka.biz, без внешних зависимостей и платежей |
| Per-user private channel vs shared+filter | | Сервер один источник истины кто видит оффер; нет client-side dropped events |
| Server timer authority | | Избегаем clock-drift между клиентами; всё равно нужен server timeout-watcher |
| Email-OTP vs пароли | | Нет hash management; используем существующий email amoCRM-пользователя |
| Sanctum vs Passport/JWT | | Простота, уже стандарт Laravel; не нужны OAuth-flow'ы |
| GitHub Releases для updates | proxy на octane | Простота; для POC public-OK; код приложения не содержит секретов |

## 14. Open questions for user before implementation plan

(если что-то спорно — поднять до start; иначе пропускаем)

- [ ] Подтвердить: репо `mttzzz/sales-agent` будет **public** (для GitHub Releases auto-update) или **private** (тогда нужен proxy)
- [ ] Подтвердить: показывать в overlay только "Новая заявка" + countdown без источника? Или показывать pipeline-source ("Сайт" / "Звонок") как мотивационный сигнал, не PII?
- [ ] Подтвердить: один AmoUser может одновременно иметь активные device-токены на нескольких машинах (multi-device)? Сейчас спека позволяет — каждый Offer уходит на ВСЕ его devices, accept с одного дисмиссит остальные.
- [ ] Подтвердить: после "Принять" мы открываем amoCRM-ссылку в браузере по умолчанию (через `tauri-plugin-opener`) — не возникнет проблем с тем что у менеджера может быть несколько браузеров / профилей?

Если ответы стандартные ("да / да / да / да") — никаких блокеров, идём писать план.
