<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuth } from '../composables/useAuth'
import type { AmoUser } from '../types/auth'

const { selectUser, loadAmoUsers } = useAuth()
const userList = ref<AmoUser[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const selecting = ref<number | null>(null)

onMounted(async () => {
  try {
    userList.value = await loadAmoUsers()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Не удалось загрузить список'
  } finally {
    loading.value = false
  }
})

async function onSelect(u: AmoUser) {
  if (selecting.value !== null) return
  selecting.value = u.id
  error.value = null
  try {
    await selectUser(u)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Не удалось отправить код'
    selecting.value = null
  }
}
</script>

<template>
  <main class="screen">
    <h1>Кто ты?</h1>
    <p v-if="loading" class="hint">Загрузка списка...</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <p v-else class="hint">Выбери себя, код придёт на твой email</p>

    <ul v-if="!loading && !error" class="users">
      <li v-for="u in userList" :key="u.id">
        <button class="user-btn" :disabled="selecting !== null" @click="onSelect(u)">
          <div class="avatar">{{ u.name.charAt(0) }}</div>
          <div class="meta">
            <div class="name">{{ u.name }}</div>
            <div class="email">{{ u.email }}</div>
          </div>
          <div v-if="selecting === u.id" class="spinner">…</div>
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
.error { margin: 0 0 16px; color: #ff6464; font-size: 0.85rem; }
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
  transition: background 0.15s, border-color 0.15s, opacity 0.15s;
}
.user-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.25); }
.user-btn:disabled { cursor: not-allowed; opacity: 0.5; }
.avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: #2d6cdf; color: white;
  display: flex; align-items: center; justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}
.meta { flex: 1; min-width: 0; }
.name { font-size: 0.95rem; }
.email { font-size: 0.75rem; opacity: 0.6; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
.spinner { font-size: 1.2rem; opacity: 0.6; }
</style>
