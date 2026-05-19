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
