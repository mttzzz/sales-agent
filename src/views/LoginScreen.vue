<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '../composables/useAuth'

const { requestCode } = useAuth()

const account = ref('')
const email = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)

const valid = computed(() =>
  account.value.trim().length > 0 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()),
)

async function onSubmit() {
  if (submitting.value || !valid.value) return
  submitting.value = true
  error.value = null
  const r = await requestCode(account.value, email.value)
  if (!r.ok) error.value = r.error
  submitting.value = false
}
</script>

<template>
  <main class="screen">
    <h1>Sales Agent</h1>
    <p class="hint">Введи поддомен amoCRM и свой рабочий email — код придёт на почту</p>

    <form class="form" @submit.prevent="onSubmit">
      <label>
        <span class="label">amoCRM аккаунт</span>
        <div class="subdomain">
          <input
            v-model="account"
            placeholder="mogoby"
            autocapitalize="none"
            spellcheck="false"
            :disabled="submitting"
            autofocus
          />
          <span class="suffix">.amocrm.ru</span>
        </div>
      </label>

      <label>
        <span class="label">Email</span>
        <input
          v-model="email"
          type="email"
          inputmode="email"
          placeholder="you@company.com"
          autocapitalize="none"
          spellcheck="false"
          :disabled="submitting"
        />
      </label>

      <div v-if="error" class="error">{{ error }}</div>

      <button type="submit" class="primary" :disabled="!valid || submitting">
        {{ submitting ? 'Отправляю код…' : 'Получить код' }}
      </button>
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
h1 { margin: 0 0 4px; font-size: 1.4rem; }
.hint { margin: 0 0 24px; opacity: 0.6; font-size: 0.85rem; }
.form { display: flex; flex-direction: column; gap: 16px; }
label { display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 0.8rem; opacity: 0.7; }
input {
  padding: 10px 12px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.15);
  color: inherit;
  border-radius: 8px;
  font-family: inherit;
  font-size: 1rem;
}
input:focus { outline: none; border-color: #2d6cdf; }
input:disabled { opacity: 0.5; }
.subdomain { display: flex; align-items: center; }
.subdomain input { flex: 1; border-right: none; border-top-right-radius: 0; border-bottom-right-radius: 0; }
.suffix {
  padding: 10px 12px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.15);
  border-left: none;
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
  font-size: 0.85rem;
  opacity: 0.55;
}
.error { color: #ff6464; font-size: 0.85rem; }
.primary {
  padding: 12px;
  background: #2d6cdf;
  border: none; color: white;
  font-size: 1rem; font-weight: 500;
  border-radius: 8px; cursor: pointer;
  margin-top: 8px;
}
.primary:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
