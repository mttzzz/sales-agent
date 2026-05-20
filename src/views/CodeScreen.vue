<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '../composables/useAuth'

const { state, verifyCode, backToLogin } = useAuth()
const code = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)
const valid = computed(() => /^\d{6}$/.test(code.value))

async function onSubmit() {
  if (submitting.value || !valid.value) return
  submitting.value = true
  error.value = null
  const result = await verifyCode(code.value)
  if (!result.ok) {
    error.value = result.error
  }
  submitting.value = false
}

async function onCancel() {
  code.value = ''
  error.value = null
  await backToLogin()
}
</script>

<template>
  <main class="screen">
    <header class="brand">
      <div class="brand-mark">SA</div>
      <div class="brand-title">Sales Agent</div>
    </header>

    <h1>Подтверждение</h1>
    <p class="sub">
      Код отправлен на<br />
      <strong>{{ state.pending_email }}</strong>
      <span class="muted">— аккаунт {{ state.pending_account }}.amocrm.ru</span>
    </p>

    <form class="form" autocomplete="off" @submit.prevent="onSubmit">
      <div class="field">
        <label for="code">6-значный код из письма</label>
        <input
          id="code"
          v-model="code"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="6"
          name="otp-code"
          autocomplete="one-time-code"
          autocorrect="off"
          spellcheck="false"
          placeholder="000000"
          autofocus
          :disabled="submitting"
          class="code-input"
        />
      </div>

      <div v-if="error" class="error">{{ error }}</div>

      <button type="submit" class="primary" :disabled="!valid || submitting">
        {{ submitting ? 'Проверяю…' : 'Войти' }}
      </button>
      <button type="button" class="link" :disabled="submitting" @click="onCancel">
        ← Изменить email
      </button>
    </form>
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
}
.brand-title { font-size: 1rem; font-weight: 600; opacity: 0.85; }

h1 {
  margin: 0 0 6px;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.sub {
  margin: 0 0 28px;
  opacity: 0.7;
  font-size: 0.9rem;
  line-height: 1.55;
}
.sub strong { opacity: 1; }
.muted { opacity: 0.55; font-size: 0.82rem; display: inline-block; margin-top: 2px; }

.form { display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; }
label {
  font-size: 0.78rem;
  font-weight: 500;
  opacity: 0.72;
  letter-spacing: 0.01em;
}

.code-input {
  font-size: 1.9rem;
  letter-spacing: 0.5em;
  text-align: center;
  padding: 14px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: inherit;
  border-radius: 10px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  text-indent: 0.5em;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.code-input::placeholder { opacity: 0.25; }
.code-input:focus {
  outline: none;
  border-color: #2d6cdf;
  background: rgba(45, 108, 223, 0.06);
  box-shadow: 0 0 0 3px rgba(45, 108, 223, 0.18);
}
.code-input:disabled { opacity: 0.5; }
.code-input:-webkit-autofill,
.code-input:-webkit-autofill:hover,
.code-input:-webkit-autofill:focus,
.code-input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 100px rgba(255, 255, 255, 0.04) inset !important;
  -webkit-text-fill-color: #f6f6f6 !important;
  caret-color: #f6f6f6;
  transition: background-color 5000s ease-in-out 0s;
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
}
.primary:hover:not(:disabled) { background: #356fe3; }
.primary:disabled { opacity: 0.4; cursor: not-allowed; }

.link {
  background: none;
  border: none;
  color: inherit;
  opacity: 0.6;
  cursor: pointer;
  padding: 6px;
  font-family: inherit;
  font-size: 0.85rem;
  align-self: center;
}
.link:hover:not(:disabled) { opacity: 1; }
.link:disabled { opacity: 0.3; cursor: not-allowed; }
</style>
