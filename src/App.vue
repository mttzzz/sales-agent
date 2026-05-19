<script setup lang="ts">
import { getVersion } from "@tauri-apps/api/app";
import { ref, onMounted } from "vue";

const version = ref("");

onMounted(async () => {
  version.value = await getVersion();
});
</script>

<template>
  <main class="container">
    <h1>Sales Agent</h1>
    <p class="status">POC — пустое окно</p>
    <p class="version">v{{ version }}</p>
  </main>
</template>

<style scoped>
.container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
}
.status {
  opacity: 0.7;
}
.version {
  opacity: 0.4;
  font-size: 0.85rem;
}
</style>

<style>
:root {
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  color: #f6f6f6;
  background-color: #1a1a1a;
}
body {
  margin: 0;
}
</style>
