import type { ApiResponse, Device, DeviceDetail, Page, TimeSeriesData } from './types'
import { API_BASE_URL } from './config'
import { clearAuth, getAccessToken } from './auth'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = getAccessToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: accessToken } : {}),
      ...(init?.headers || {}),
    },
    credentials: 'include',
    ...init,
  })

  if (!response.ok) {
    if (response.status === 401) {
      clearAuth()
      window.dispatchEvent(new CustomEvent('auth-expired'))
    }
    throw new Error(`HTTP ${response.status}`)
  }

  const payload = (await response.json()) as ApiResponse<T>
  if (payload.code !== 0) {
    throw new Error(payload.msg || `API ${payload.code}`)
  }
  return payload.data
}

export function getDeviceList(params: { search?: string; pageNum?: number; pageSize?: number }) {
  const query = new URLSearchParams({
    page_num: String(params.pageNum || 1),
    page_size: String(params.pageSize || 50),
  })
  if (params.search) query.set('search', params.search)
  return request<Page<Device>>(`/device/list?${query.toString()}`)
}

export function getDeviceDetail(id: number) {
  return request<DeviceDetail>(`/device/${id}`)
}

export function getTimeseriesData(body: { device_ids: number[]; property_ids: number[]; begin: number; end: number }) {
  return request<TimeSeriesData>('/data/timeseries', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
