/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL for the backend API, e.g. '/api/v1' or
   * 'https://api.annadatha.example/api/v1'. Falls back to '/api/v1' if unset.
   */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}