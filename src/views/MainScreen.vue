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
