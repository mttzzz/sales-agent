<script setup lang="ts">
import { useAuth } from '../composables/useAuth'

const { state, logout } = useAuth()
</script>

<template>
  <main class="screen">
    <header class="brand">
      <div class="brand-mark">SA</div>
      <div class="brand-title">Sales Agent</div>
    </header>

    <section class="user-card">
      <div class="avatar">{{ state.logged_in_user?.name?.charAt(0) }}</div>
      <div class="meta">
        <div class="name">{{ state.logged_in_user?.name }}</div>
        <div class="email">{{ state.logged_in_user?.email }}</div>
        <div class="account">{{ state.account?.subdomain }}.amocrm.ru</div>
      </div>
    </section>

    <div class="status">
      <div class="dot connected" />
      <span>Готов к приёму заявок</span>
    </div>

    <p class="poc-note">POC Phase 1–3 · уведомления подключаются в следующих фазах</p>

    <button class="logout" @click="logout">Выйти</button>
  </main>
</template>

<style scoped>
.screen {
  padding: 28px;
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
}
.brand-mark {
  width: 32px; height: 32px;
  border-radius: 8px;
  background: #2d6cdf;
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 0.85rem;
}
.brand-title { font-size: 1rem; font-weight: 600; opacity: 0.85; }

.user-card {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  margin-bottom: 16px;
}
.avatar {
  width: 52px; height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2d6cdf, #5a86e8);
  color: white;
  display: grid;
  place-items: center;
  font-weight: 600;
  font-size: 1.3rem;
  flex-shrink: 0;
}
.meta { min-width: 0; }
.name { font-size: 1.02rem; font-weight: 500; }
.email { font-size: 0.8rem; opacity: 0.6; margin-top: 2px; }
.account { font-size: 0.78rem; opacity: 0.45; margin-top: 4px; font-family: ui-monospace, monospace; }

.status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(78, 181, 110, 0.08);
  border: 1px solid rgba(78, 181, 110, 0.25);
  border-radius: 10px;
  margin-bottom: 14px;
  font-size: 0.9rem;
}
.dot { width: 9px; height: 9px; border-radius: 50%; }
.dot.connected { background: #4eb56e; box-shadow: 0 0 10px #4eb56e; }

.poc-note {
  opacity: 0.4;
  font-size: 0.78rem;
  line-height: 1.5;
  margin: 0 0 auto;
}

.logout {
  margin-top: 20px;
  padding: 11px;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: inherit;
  border-radius: 10px;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.92rem;
  transition: background 0.15s, border-color 0.15s;
}
.logout:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.35);
}
</style>
