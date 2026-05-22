import { API_BASE_URL, OAUTH2_KEY } from './config'
import type { ApiResponse, OAuthInfo, OAuthToken, OAuthUser } from './types'

const TOKEN_STORAGE_KEY = 'edgelink.oauth.token'
const USER_STORAGE_KEY = 'edgelink.oauth.user'
const STATE_STORAGE_KEY = 'edgelink.oauth.state'
const LAST_LOGIN_STORAGE_KEY = 'edgelink.oauth.last_login_at'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readJson<T>(key: string): T | undefined {
  const raw = window.localStorage.getItem(key)
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as T
  } catch {
    window.localStorage.removeItem(key)
    return undefined
  }
}

async function oauthRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const payload = (await response.json()) as ApiResponse<T>
  if (payload.code !== 0) throw new Error(payload.msg || `API ${payload.code}`)
  return payload.data
}

function normalizeToken(payload: unknown): OAuthToken {
  const item = isRecord(payload) ? payload : {}
  const expiresIn = Number(item.expires_in || 0)
  return {
    accessToken: String(item.access_token || ''),
    refreshToken: String(item.refresh_token || ''),
    openid: String(item.openid || ''),
    scope: String(item.scope || ''),
    expiresIn,
    expiresAt: Date.now() + Math.max(expiresIn - 60, 0) * 1000,
  }
}

function normalizeUser(payload: unknown): OAuthUser {
  const item = isRecord(payload) ? payload : {}
  return {
    openid: String(item.openid || ''),
    username: String(item.username || ''),
    displayName: String(item.display_name || item.username || ''),
    status: Number(item.status || 0),
    roles: Array.isArray(item.roles) ? item.roles.map(String) : [],
  }
}

export function createOAuthState() {
  const bytes = new Uint8Array(16)
  window.crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function saveOAuthState(state: string) {
  window.localStorage.setItem(STATE_STORAGE_KEY, state)
}

export function getSavedOAuthState() {
  return window.localStorage.getItem(STATE_STORAGE_KEY) || ''
}

export function clearOAuthState() {
  window.localStorage.removeItem(STATE_STORAGE_KEY)
}

export function getStoredToken() {
  const token = readJson<OAuthToken>(TOKEN_STORAGE_KEY)
  if (!token?.accessToken) return undefined
  if (token.expiresAt > 0 && Date.now() >= token.expiresAt) {
    clearAuth()
    return undefined
  }
  return token
}

export function getAccessToken() {
  return getStoredToken()?.accessToken || ''
}

export function getStoredUser() {
  return readJson<OAuthUser>(USER_STORAGE_KEY)
}

export function getLastLoginAt() {
  return Number(window.localStorage.getItem(LAST_LOGIN_STORAGE_KEY) || 0)
}

export function saveAuth(token: OAuthToken, user?: OAuthUser) {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token))
  window.localStorage.setItem(LAST_LOGIN_STORAGE_KEY, String(Date.now()))
  if (user) window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
}

export function clearAuth() {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY)
  window.localStorage.removeItem(USER_STORAGE_KEY)
  window.localStorage.removeItem(LAST_LOGIN_STORAGE_KEY)
}

export async function fetchOAuthInfo(state: string) {
  return oauthRequest<OAuthInfo>(`/oauth/info?oauth2_key=${encodeURIComponent(OAUTH2_KEY)}&state=${encodeURIComponent(state)}`)
}

export async function exchangeOAuthCode(code: string) {
  return normalizeToken(await oauthRequest<unknown>('/oauth/token', {
    method: 'POST',
    body: JSON.stringify({ oauth2_key: OAUTH2_KEY, code }),
  }))
}

export async function fetchOAuthUser(accessToken: string) {
  return normalizeUser(await oauthRequest<unknown>(`/oauth/userinfo?oauth2_key=${encodeURIComponent(OAUTH2_KEY)}&access_token=${encodeURIComponent(accessToken)}`))
}

export async function startOAuthLogin() {
  const state = createOAuthState()
  saveOAuthState(state)
  const info = await fetchOAuthInfo(state)
  if (!info.enabled || !info.auth_url) throw new Error('OAuth2 登录未启用')
  window.location.assign(info.auth_url)
}
