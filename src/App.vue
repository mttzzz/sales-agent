<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getVersion } from '@tauri-apps/api/app'
import { useAuth, loadAuth } from './composables/useAuth'
import { maybeAutoUpdate, startPeriodicCheck } from './composables/useUpdater'
import LoginScreen from './views/LoginScreen.vue'
import CodeScreen from './views/CodeScreen.vue'
import MainScreen from './views/MainScreen.vue'

const { state } = useAuth()
const version = ref('?')

onMounted(async () => {
  version.value = await getVersion().catch(() => '?')
  await maybeAutoUpdate()
  startPeriodicCheck()
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
  <div class="version-tag">v{{ version }}</div>
</template>

<style>
:root {
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  color: #f6f6f6;
  background-color: #1a1a1a;
}
body { margin: 0; }
* { box-sizing: border-box; }

.version-tag {
  position: fixed;
  right: 10px;
  bottom: 8px;
  font-size: 0.68rem;
  opacity: 0.32;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  pointer-events: none;
  z-index: 100;
}
</style>
