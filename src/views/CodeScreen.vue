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
