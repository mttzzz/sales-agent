/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DESKTOP_BOOTSTRAP_TOKEN?: string;
  readonly VITE_SALES_AGENT_APP_KEY?: string;
  readonly VITE_SALES_AGENT_WS_HOST?: string;
  readonly VITE_SALES_AGENT_AUTH_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
