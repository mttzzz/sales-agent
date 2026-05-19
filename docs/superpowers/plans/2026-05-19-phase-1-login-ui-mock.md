# Phase 1 — Login UI (mock, no backend) Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Реализовать UI-флоу логина в desktop-приложении без подключения к octane: список юзеров из захардкоженного JSON → выбор → ввод любого 6-значного кода → main screen с "Hello, {name}" + кнопкой Logout. Состояние persistent через `@tauri-apps/plugin-store`. По выходу — обратно на login screen.

**Architecture:** State-machine на 3 экрана (`login → code → main`), хранится в реактивном `useAuth()` composable, синхронизируется с tauri-store. App.vue по `authState.phase` рендерит нужный view. Никаких HTTP-запросов; код «валиден» если 6 цифр (для POC).

**Tech Stack:** Vue 3 (TS, Composition API), `@tauri-apps/plugin-store` (Rust crate `tauri-plugin-store`), Tauri 2 capabilities.

---

## File Structure

| File | Status | Purpose |
|---|---|---|
| `src/types/auth.ts` | create | `AmoUser`, `AuthPhase`, `AuthState` interfaces |
| `src/data/mock-users.json` | create | 4 fake AmoUser records (id, name, email, avatar_url) |
| `src/composables/useAuth.ts` | create | Reactive auth state + load/save via tauri-store |
| `src/views/LoginScreen.vue` | create | List of users, click to select |
| `src/views/CodeScreen.vue` | create | 6-digit input, button "Войти" |
| `src/views/MainScreen.vue` | create | Welcome + Logout |
| `src/App.vue` | modify | State-machine router (phase → view) |
| `package.json` | modify | Add `@tauri-apps/plugin-store` |
| `src-tauri/Cargo.toml` | modify | Add `tauri-plugin-store` |
| `src-tauri/src/lib.rs` | modify | Register `tauri_plugin_store::Builder` |
| `src-tauri/capabilities/default.json` | modify | Grant store permissions |
| `src-tauri/tauri.conf.json` | modify | Window 480×640 (больше под список) |

---

## Pre-flight checks

- [ ] **P1:** Working tree clean: `cd ~/projects/sales-agent && git status` → "nothing to commit, working tree clean".
- [ ] **P2:** On main: `git branch --show-current` → "main".
- [ ] **P3:** Latest CI for v0.1.1 was green (from Phase 0).

---

## Task 1: Install dependencies (frontend + Rust)

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock` (created by cargo on first build; just ensure committed)

- [ ] **Step 1: Add frontend plugin**

Run:
```bash
cd ~/projects/sales-agent && bun add @tauri-apps/plugin-store@^2
```

Expected: `package.json` gains `"@tauri-apps/plugin-store": "^2..."`, `bun.lock` updated.

- [ ] **Step 2: Add Rust plugin**

Edit `src-tauri/Cargo.toml`. Find the `[dependencies]` block and append a line:

```toml
tauri-plugin-store = "2"
```

The block becomes (preserve other lines):
```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
tauri-plugin-store = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 3: Verify edits**

Run:
```bash
grep '"@tauri-apps/plugin-store"' ~/projects/sales-agent/package.json && \
  grep '^tauri-plugin-store' ~/projects/sales-agent/src-tauri/Cargo.toml
```
Expected: both lines printed.

- [ ] **Step 4: Commit**

Run:
```bash
cd ~/projects/sales-agent && \
  bash ~/.claude/scripts/commit-files.sh \
    "feat(deps): add tauri-plugin-store (frontend + rust)" \
    package.json bun.lock src-tauri/Cargo.toml
```
Expected: `[commit:files] Закоммичено 3 файл(ов).`

---

## Task 2: Mock user data + types

**Files:**
- Create: `src/types/auth.ts`
- Create: `src/data/mock-users.json`

- [ ] **Step 1: Create `src/types/auth.ts`** with exactly:

```ts
export interface AmoUser {
  id: number
  name: string
  email: string
  avatar_url: string | null
}

export type AuthPhase = 'login' | 'code' | 'main'

export interface AuthState {
  phase: AuthPhase
  selected_user: AmoUser | null
  /** При phase='main' хранит того же selected_user — для удобства потребителей. */
  logged_in_user: AmoUser | null
}
```

- [ ] **Step 2: Create `src/data/mock-users.json`** with exactly:

```json
[
  { "id": 1, "name": "Анна Иванова", "email": "anna@mogoby.example", "avatar_url": null },
  { "id": 2, "name": "Борис Петров", "email": "boris@mogoby.example", "avatar_url": null },
  { "id": 3, "name": "Виктория Сидорова", "email": "vika@mogoby.example", "avatar_url": null },
  { "id": 4, "name": "Григорий Орлов", "email": "grisha@mogoby.example", "avatar_url": null }
]
```

- [ ] **Step 3: Commit**

```bash
cd ~/projects/sales-agent && \
  bash ~/.claude/scripts/commit-files.sh \
    "feat(auth): types + mock user list" \
    src/types/auth.ts src/data/mock-users.json
```

---

## Task 3: useAuth composable

**Files:**
- Create: `src/composables/useAuth.ts`

- [ ] **Step 1: Write `src/composables/useAuth.ts`**

```ts
import { reactive, readonly } from 'vue'
import { load, type Store } from '@tauri-apps/plugin-store'
import type { AmoUser, AuthState } from '../types/auth'

const STORE_FILE = 'auth.json'
const STORE_KEY = 'state'

const state = reactive<AuthState>({
  phase: 'login',
  selected_user: null,
  logged_in_user: null,
})

let storePromise: Promise<Store> | null = null

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(STORE_FILE, { autoSave: false })
  }
  return storePromise
}

async function persist(): Promise<void> {
  const store = await getStore()
  await store.set(STORE_KEY, JSON.parse(JSON.stringify(state)))
  await store.save()
}

export async function loadAuth(): Promise<void> {
  const store = await getStore()
  const saved = await store.get<AuthState>(STORE_KEY)
  if (saved) {
    state.phase = saved.phase
    state.selected_user = saved.selected_user
    state.logged_in_user = saved.logged_in_user
  }
}

export function selectUser(user: AmoUser): void {
  state.selected_user = user
  state.phase = 'code'
  void persist()
}

export function verifyCode(code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false
  if (!state.selected_user) return false
  state.logged_in_user = state.selected_user
  state.phase = 'main'
  void persist()
  return true
}

export function logout(): void {
  state.phase = 'login'
  state.selected_user = null
  state.logged_in_user = null
  void persist()
}

export function backToLogin(): void {
  state.phase = 'login'
  state.selected_user = null
  void persist()
}

export function useAuth() {
  return {
    state: readonly(state),
    selectUser,
    verifyCode,
    logout,
    backToLogin,
  }
}
```

Why this shape:
- `reactive` + `readonly` exposed: внешние компоненты могут только мутировать через actions, не напрямую state.
- `getStore()` ленивый — Tauri-plugin-store не доступен до mount Vue-приложения.
- Регулярка `^\d{6}$` — единственная валидация (POC).

- [ ] **Step 2: Commit**

```bash
cd ~/projects/sales-agent && \
  bash ~/.claude/scripts/commit-files.sh \
    "feat(auth): useAuth composable with tauri-store persistence" \
    src/composables/useAuth.ts
```

---

## Task 4: LoginScreen.vue

**Files:**
- Create: `src/views/LoginScreen.vue`

- [ ] **Step 1: Write file**

```vue
<script setup lang="ts">
import { useAuth } from '../composables/useAuth'
import users from '../data/mock-users.json'
import type { AmoUser } from '../types/auth'

const { selectUser } = useAuth()
const userList = users as AmoUser[]
</script>

<template>
  <main class="screen">
    <h1>Кто ты?</h1>
    <p class="hint">Выбери себя из списка менеджеров mogoby</p>
    <ul class="users">
      <li v-for="u in userList" :key="u.id">
        <button class="user-btn" @click="selectUser(u)">
          <div class="avatar">{{ u.name.charAt(0) }}</div>
          <div class="meta">
            <div class="name">{{ u.name }}</div>
            <div class="email">{{ u.email }}</div>
          </div>
        </button>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.screen {
  padding: 24px;
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
}
h1 { margin: 0 0 4px; font-size: 1.4rem; }
.hint { margin: 0 0 16px; opacity: 0.6; font-size: 0.85rem; }
.users { list-style: none; margin: 0; padding: 0; flex: 1; overflow-y: auto; }
.users li { margin-bottom: 8px; }
.user-btn {
  display: flex; gap: 12px; align-items: center;
  width: 100%; padding: 10px 12px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  color: inherit;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background 0.15s, border-color 0.15s;
}
.user-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.25); }
.avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: #2d6cdf; color: white;
  display: flex; align-items: center; justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}
.name { font-size: 0.95rem; }
.email { font-size: 0.75rem; opacity: 0.6; }
</style>
```

- [ ] **Step 2: Commit**

```bash
cd ~/projects/sales-agent && \
  bash ~/.claude/scripts/commit-files.sh \
    "feat(auth): LoginScreen with user list" \
    src/views/LoginScreen.vue
```

---

## Task 5: CodeScreen.vue

**Files:**
- Create: `src/views/CodeScreen.vue`

- [ ] **Step 1: Write file**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '../composables/useAuth'

const { state, verifyCode, backToLogin } = useAuth()
const code = ref('')
const error = ref<string | null>(null)
const valid = computed(() => /^\d{6}$/.test(code.value))

function onSubmit() {
  if (!verifyCode(code.value)) {
    error.value = 'Код должен быть 6 цифр'
    return
  }
  error.value = null
}

function onCancel() {
  code.value = ''
  error.value = null
  backToLogin()
}
</script>

<template>
  <main class="screen">
    <h1>Введи код</h1>
    <p class="hint">
      <strong>{{ state.selected_user?.name }}</strong>
      <br />
      <span class="muted">{{ state.selected_user?.email }}</span>
    </p>
    <p class="poc-note">POC: любые 6 цифр подойдут</p>
    <form class="code-form" @submit.prevent="onSubmit">
      <input
        v-model="code"
        inputmode="numeric"
        pattern="[0-9]*"
        maxlength="6"
        placeholder="000000"
        autofocus
      />
      <div v-if="error" class="error">{{ error }}</div>
      <button type="submit" class="primary" :disabled="!valid">Войти</button>
      <button type="button" class="link" @click="onCancel">← Назад</button>
    </form>
  </main>
</template>

<style scoped>
.screen {
  padding: 24px;
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
}
h1 { margin: 0 0 12px; font-size: 1.4rem; }
.hint { margin: 0 0 4px; }
.muted { opacity: 0.55; font-size: 0.8rem; }
.poc-note { margin: 4px 0 24px; opacity: 0.4; font-size: 0.75rem; font-style: italic; }
.code-form { display: flex; flex-direction: column; gap: 12px; }
input {
  font-size: 2rem;
  letter-spacing: 0.4em;
  text-align: center;
  padding: 12px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.15);
  color: inherit;
  border-radius: 8px;
  font-family: ui-monospace, monospace;
}
input:focus { outline: none; border-color: #2d6cdf; }
.error { color: #ff6464; font-size: 0.85rem; }
.primary {
  padding: 10px;
  background: #2d6cdf;
  border: none; color: white;
  font-size: 1rem; font-weight: 500;
  border-radius: 8px; cursor: pointer;
}
.primary:disabled { opacity: 0.4; cursor: not-allowed; }
.link {
  background: none; border: none; color: inherit;
  opacity: 0.6; cursor: pointer; padding: 8px;
  font-family: inherit;
}
.link:hover { opacity: 1; }
</style>
```

- [ ] **Step 2: Commit**

```bash
cd ~/projects/sales-agent && \
  bash ~/.claude/scripts/commit-files.sh \
    "feat(auth): CodeScreen with 6-digit input" \
    src/views/CodeScreen.vue
```

---

## Task 6: MainScreen.vue

**Files:**
- Create: `src/views/MainScreen.vue`

- [ ] **Step 1: Write file**

```vue
<script setup lang="ts">
import { useAuth } from '../composables/useAuth'

const { state, logout } = useAuth()
</script>

<template>
  <main class="screen">
    <div class="header">
      <div class="avatar">{{ state.logged_in_user?.name?.charAt(0) }}</div>
      <div class="meta">
        <div class="name">{{ state.logged_in_user?.name }}</div>
        <div class="email">{{ state.logged_in_user?.email }}</div>
      </div>
    </div>

    <div class="status">
      <div class="dot connected" />
      <span>Готов к приёму заявок (mock)</span>
    </div>

    <div class="poc-note">POC Phase 1 — WS/уведомления подключаются в следующих фазах</div>

    <button class="logout" @click="logout">Выйти</button>
  </main>
</template>

<style scoped>
.screen {
  padding: 24px;
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
}
.header { display: flex; gap: 12px; align-items: center; margin-bottom: 24px; }
.avatar {
  width: 48px; height: 48px; border-radius: 50%;
  background: #2d6cdf; color: white;
  display: flex; align-items: center; justify-content: center;
  font-weight: 600; font-size: 1.2rem;
}
.name { font-size: 1.05rem; font-weight: 500; }
.email { font-size: 0.8rem; opacity: 0.55; }
.status {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  background: rgba(78, 181, 110, 0.1);
  border: 1px solid rgba(78, 181, 110, 0.3);
  border-radius: 8px;
  margin-bottom: 12px;
}
.dot { width: 8px; height: 8px; border-radius: 50%; }
.dot.connected { background: #4eb56e; box-shadow: 0 0 8px #4eb56e; }
.poc-note {
  opacity: 0.4; font-size: 0.75rem; font-style: italic;
  margin-bottom: auto;
}
.logout {
  margin-top: 24px;
  padding: 10px; background: none;
  border: 1px solid rgba(255,255,255,0.2);
  color: inherit; border-radius: 8px;
  cursor: pointer; font-family: inherit;
}
.logout:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.4); }
</style>
```

- [ ] **Step 2: Commit**

```bash
cd ~/projects/sales-agent && \
  bash ~/.claude/scripts/commit-files.sh \
    "feat(auth): MainScreen with logout" \
    src/views/MainScreen.vue
```

---

## Task 7: Wire App.vue state machine + register Rust plugin + capabilities

**Files:**
- Modify: `src/App.vue`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src-tauri/tauri.conf.json` (window size)

- [ ] **Step 1: Replace `src/App.vue`** with:

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuth, loadAuth } from './composables/useAuth'
import LoginScreen from './views/LoginScreen.vue'
import CodeScreen from './views/CodeScreen.vue'
import MainScreen from './views/MainScreen.vue'

const { state } = useAuth()

onMounted(async () => {
  try {
    await loadAuth()
  } catch (e) {
    console.warn('Failed to restore auth state:', e)
  }
})
</script>

<template>
  <LoginScreen v-if="state.phase === 'login'" />
  <CodeScreen v-else-if="state.phase === 'code'" />
  <MainScreen v-else />
</template>

<style>
:root {
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  color: #f6f6f6;
  background-color: #1a1a1a;
}
body { margin: 0; }
* { box-sizing: border-box; }
</style>
```

- [ ] **Step 2: Edit `src-tauri/src/lib.rs`**

Find the `pub fn run()` function. Currently looks like:
```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Add the store plugin AFTER opener:
```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

(The `greet` handler stays — it's an unused scaffold function, leave it; cleanup is non-essential here.)

- [ ] **Step 3: Edit `src-tauri/capabilities/default.json`** to grant store permission.

Read current content:
```bash
cat ~/projects/sales-agent/src-tauri/capabilities/default.json
```

Typical default looks like:
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default"
  ]
}
```

Add `"store:default"` to the permissions array. After edit:
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "store:default"
  ]
}
```

If the file structure differs from the typical default — preserve all existing keys, only modify `permissions`.

- [ ] **Step 4: Bump window size in `src-tauri/tauri.conf.json`**

Find the `"windows"` entry and change `"height": 320` → `"height": 640` (нужно место для списка юзеров).

```json
{
  "title": "Sales Agent",
  "width": 480,
  "height": 640,
  "resizable": true
}
```

- [ ] **Step 5: Validate JSON files**

Run:
```bash
python3 -c "import json; json.load(open('$HOME/projects/sales-agent/src-tauri/capabilities/default.json'))" && echo "capabilities OK" && \
python3 -c "import json; json.load(open('$HOME/projects/sales-agent/src-tauri/tauri.conf.json'))" && echo "tauri.conf OK"
```
Expected: both lines OK.

- [ ] **Step 6: Commit**

```bash
cd ~/projects/sales-agent && \
  bash ~/.claude/scripts/commit-files.sh \
    "feat(auth): wire App state machine + register store plugin + capabilities" \
    src/App.vue src-tauri/src/lib.rs src-tauri/capabilities/default.json src-tauri/tauri.conf.json
```

---

## Task 8: Push, bump version, tag v0.2.0, monitor CI

**Files:**
- Modify: `src-tauri/Cargo.toml` (version 0.1.1 → 0.2.0)
- Modify: `src-tauri/tauri.conf.json` (version 0.1.1 → 0.2.0)

- [ ] **Step 1: Bump versions**

```bash
cd ~/projects/sales-agent && \
  sed -i 's/^version = "0.1.1"/version = "0.2.0"/' src-tauri/Cargo.toml && \
  sed -i 's/"version": "0.1.1"/"version": "0.2.0"/' src-tauri/tauri.conf.json && \
  grep -E '("version"|^version)' src-tauri/Cargo.toml src-tauri/tauri.conf.json
```
Expected output shows both `0.2.0`.

- [ ] **Step 2: Commit version bump**

```bash
cd ~/projects/sales-agent && \
  bash ~/.claude/scripts/commit-files.sh \
    "chore: bump to 0.2.0 for Phase 1 release" \
    src-tauri/Cargo.toml src-tauri/tauri.conf.json
```

- [ ] **Step 3: Push and tag**

```bash
cd ~/projects/sales-agent && \
  git push origin main && \
  git tag -a v0.2.0 -m "Phase 1: login UI (mock, no backend)" && \
  git push origin v0.2.0
```

- [ ] **Step 4: Get run id**

```bash
sleep 4 && cd ~/projects/sales-agent && \
  gh run list --workflow=build.yml --limit=1 --json databaseId,headBranch --jq '{run_id: .[0].databaseId, ref: .[0].headBranch}'
```
Expected: run_id is a numeric, ref is `v0.2.0`.

- [ ] **Step 5: Monitor build to completion**

Use the same heartbeat-monitor pattern from Phase 0. Wait for `RUN_DONE conclusion=success`. If failure → inspect logs of failed job, fix, recommit, retag with v0.2.1.

- [ ] **Step 6: Publish release**

```bash
cd ~/projects/sales-agent && gh release edit v0.2.0 --draft=false
```

Expected: GH returns release URL.

- [ ] **Step 7: Print download URL for Mac**

```bash
cd ~/projects/sales-agent && \
  gh release view v0.2.0 --json assets --jq '.assets[] | select(.name | endswith("aarch64.dmg")) | "MAC INSTALL: \(.url)"'
```

---

## Self-review checklist

- [ ] **Spec coverage**: Phase 1 from spec §12 = "Auth UI без бэка: список AmoUser захардкожен JSON-файл, выбираешь → 'вошёл'". Plan covers: list (LoginScreen) → select → code entry → 'logged-in' main view → logout. Persistence via tauri-store added (small extra — needed so app remembers state between launches, не painful overbuild).
- [ ] **Placeholder scan**: no TODO/TBD.
- [ ] **Type consistency**: `AmoUser`, `AuthPhase`, `AuthState`, `AuthState.phase` used identically across files.

---

## Definition of Done (Phase 1)

1. Tag `v0.2.0` published with mac arm64 .dmg + win .exe/.msi.
2. На Mac: установить .dmg, открыть → видишь экран "Кто ты?" со списком из 4 юзеров.
3. Клик по юзеру → экран "Введи код" с placeholder "000000".
4. Ввести `123456` → клик "Войти" → экран "Готов к приёму заявок (mock)" с именем юзера.
5. Закрыть приложение и открыть снова → сразу показывается main screen (state persisted).
6. Кликнуть "Выйти" → возврат к экрану "Кто ты?".
