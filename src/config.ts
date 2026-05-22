export const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8082/api/edgelink'
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '')
export const OAUTH2_KEY = import.meta.env.VITE_OAUTH2_KEY || 'edgelink-mobile'
