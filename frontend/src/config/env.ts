/**
 * Central environment settings. All import.meta.env reads live here so the
 * required variables are documented in one place.
 */

/** Backend API base URL. Defaults to the dev proxy path. */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || '/api/v1'

/** 'production' | 'staging' | undefined — set per deploy environment. */
export const APP_ENV: string | undefined = import.meta.env.VITE_APP_ENV

/** Support contact shown on locked-account and phase-gate screens. */
export const SUPPORT_EMAIL: string | undefined = import.meta.env.VITE_SUPPORT_EMAIL as string | undefined

/** Anveshan app URLs per environment. */
export const ANVESHAN_URL: string | undefined = import.meta.env.VITE_ANVESHAN_URL
export const ANVESHAN_URL_STAGING: string | undefined = import.meta.env.VITE_ANVESHAN_URL_STAGING

/** True when running the Vite dev server. */
export const IS_DEV: boolean = import.meta.env.DEV
