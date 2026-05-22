export interface ApiResponse<T> {
  code: number
  msg: string
  data: T
}

export interface Page<T> {
  total: number
  page_size: number
  page_num: number
  data: T[]
  order?: string
  sort?: string
}

export interface DeviceAddressDetail {
  address: string
  desc: string
}

export interface DeviceAddress {
  uplink?: DeviceAddressDetail[]
  downlink?: DeviceAddressDetail[]
}

export interface Device {
  id: number
  device_key: string
  device_name: string
  product_id: number
  product_name?: string
  status?: 'online' | 'offline' | 'unknown' | string
  status_updated_time?: number | null
  address?: DeviceAddress
  description?: string
  created_time?: string
  updated_time?: string
}

export interface DeviceProperty {
  id: number
  persistent: boolean
  store_mode: string
  property_id: number
  key: string
  value?: unknown
  device_id?: number
  device_key?: string
  name: string
  data_type: number
  unit: string
  source_type: number
  expr: string
  type: number
}

export interface DeviceDetail extends Device {
  props: DeviceProperty[]
}

export type TimeSeriesData = Record<string, [number, number][]>

export interface OAuthInfo {
  enabled: boolean
  auth_url: string
  client_id: string
  redirect_uri: string
  response_type: string
  scope: string
}

export interface OAuthToken {
  accessToken: string
  refreshToken: string
  openid: string
  scope: string
  expiresIn: number
  expiresAt: number
}

export interface OAuthUser {
  openid: string
  username: string
  displayName: string
  status: number
  roles: string[]
}
