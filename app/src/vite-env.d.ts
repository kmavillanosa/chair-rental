/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_DOCS_URL?: string
  readonly VITE_STAFF_APP_URL?: string
  readonly VITE_VENDOR_LOGIN_URL?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
