<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useAuth, loadAuth } from './composables/useAuth'
import { maybeAutoUpdate } from './composables/useUpdater'
import { startWs, stopWs } from './composables/useWs'
import LoginScreen from './views/LoginScreen.vue'
import CodeScreen from './views/CodeScreen.vue'
import MainScreen from './views/MainScreen.vue'

const { state } = useAuth()

onMounted(async () => {
  void maybeAutoUpdate()
  try {
    await loadAuth()
  } catch (e) {
    console.warn('Failed to restore auth state:', e)
  }
})

watch(
  () => [state.token, state.logged_in_user?.id] as const,
  ([token, userId]) => {
    if (token && typeof userId === 'number') {
      void startWs(token, userId)
    } else {
      stopWs()
    }
  },
  { immediate: true },
)
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
