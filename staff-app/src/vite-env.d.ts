/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_CUSTOMER_APP_URL?: string
  readonly VITE_VENDOR_DOMAIN?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
