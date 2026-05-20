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
    <header class="brand">
      <div class="brand-mark">SA</div>
      <div class="brand-title">Sales Agent</div>
    </header>

    <h1>Авторизация</h1>
    <p class="sub">
      Введите поддомен amoCRM и email,<br />под которым Вы входите в amoCRM.
    </p>

    <form class="form" @submit.prevent="onSubmit">
      <div class="field">
        <label for="account">Поддомен amoCRM</label>
        <div class="input-wrap" :class="{ 'is-disabled': submitting }">
          <input
            id="account"
            v-model="account"
            placeholder="mogoby"
            autocapitalize="none"
            spellcheck="false"
            :disabled="submitting"
            autofocus
          />
          <span class="suffix">.amocrm.ru</span>
        </div>
      </div>

      <div class="field">
        <label for="email">Email</label>
        <div class="input-wrap" :class="{ 'is-disabled': submitting }">
          <input
            id="email"
            v-model="email"
            type="email"
            inputmode="email"
            placeholder="you@company.com"
            autocapitalize="none"
            spellcheck="false"
            :disabled="submitting"
          />
        </div>
      </div>

      <div v-if="error" class="error">{{ error }}</div>

      <button type="submit" class="primary" :disabled="!valid || submitting">
        {{ submitting ? 'Отправка кода…' : 'Получить код' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.screen {
  padding: 28px 28px 24px;
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 28px;
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
  letter-spacing: 0.02em;
}
.brand-title {
  font-size: 1rem;
  font-weight: 600;
  opacity: 0.85;
}

h1 {
  margin: 0 0 6px;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.sub {
  margin: 0 0 24px;
  opacity: 0.62;
  font-size: 0.9rem;
  line-height: 1.45;
}

.form { display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; }
label {
  font-size: 0.78rem;
  font-weight: 500;
  opacity: 0.72;
  letter-spacing: 0.01em;
}

.input-wrap {
  display: flex;
  align-items: stretch;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}
.input-wrap:focus-within {
  border-color: #2d6cdf;
  background: rgba(45, 108, 223, 0.06);
  box-shadow: 0 0 0 3px rgba(45, 108, 223, 0.18);
}
.input-wrap.is-disabled { opacity: 0.55; }

.input-wrap input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.95rem;
  padding: 11px 12px;
  outline: none;
}
.input-wrap input::placeholder { opacity: 0.35; }
.input-wrap .suffix {
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 0.88rem;
  opacity: 0.48;
  background: rgba(255, 255, 255, 0.02);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
}

.error {
  color: #ff7575;
  font-size: 0.85rem;
  padding: 4px 2px 0;
}

.primary {
  margin-top: 8px;
  padding: 12px;
  background: #2d6cdf;
  border: none;
  color: white;
  font-size: 0.95rem;
  font-weight: 500;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}
.primary:hover:not(:disabled) { background: #356fe3; }
.primary:active:not(:disabled) { background: #265bb8; }
.primary:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
