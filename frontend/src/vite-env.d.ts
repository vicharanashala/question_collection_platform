/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL for the backend API, e.g. '/api/v1' or
   * 'https://api.annadatha.example/api/v1'. Falls back to '/api/v1' if unset.
   */
  readonly VITE_API_BASE_URL?: string
  /** Deployment environment of this build: 'production', 'staging' or unset for local. */
  readonly VITE_APP_ENV?: string
  /** Anveshan platform URL used by production builds. */
  readonly VITE_ANVESHAN_URL?: string
  /** Anveshan platform URL used by staging and local builds. */
  readonly VITE_ANVESHAN_URL_STAGING?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}