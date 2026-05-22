import './styles.css'
import type { ECharts, EChartsCoreOption } from 'echarts/core'
import { getDeviceDetail, getDeviceList, getTimeseriesData } from './api'
import { clearAuth, clearOAuthState, exchangeOAuthCode, fetchOAuthUser, getLastLoginAt, getSavedOAuthState, getStoredToken, getStoredUser, saveAuth, startOAuthLogin } from './auth'
import type { Device, DeviceDetail, DeviceProperty, TimeSeriesData } from './types'

const icons = {
  search: '<svg class="icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>',
  bell: '<svg class="icon" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  device: '<svg class="icon" viewBox="0 0 24 24"><path d="M4 7.5 12 3l8 4.5-8 4.5-8-4.5Z"/><path d="M4 12l8 4.5 8-4.5"/><path d="M4 16.5 12 21l8-4.5"/></svg>',
  deviceActive: '<svg class="icon active-icon" viewBox="0 0 24 24"><path d="M7 4h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"/><path d="M9 10l2 2-2 2M13 14l2-2-2-2" stroke="#fff" stroke-width="2" fill="none"/><path d="M8 1v3M12 1v3M16 1v3M8 23v-3M12 23v-3M16 23v-3"/></svg>',
  back: '<svg class="icon" viewBox="0 0 24 24"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>',
  box: '<svg class="icon" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M12 22V12"/></svg>',
  screen: '<svg class="icon" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>',
  clock: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  pin: '<svg class="icon" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  chart: '<svg class="icon" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  refresh: '<svg class="icon" viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 1-15.5 6.2"/><path d="M3 12A9 9 0 0 1 18.5 5.8"/><polyline points="18 2 18.5 5.8 14.8 6.3"/><polyline points="6 22 5.5 18.2 9.2 17.7"/></svg>',
  user: '<svg class="icon" viewBox="0 0 24 24"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>',
  logout: '<svg class="icon" viewBox="0 0 24 24"><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/><path d="M12 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/></svg>',
}

type Filter = 'all' | 'online' | 'offline' | 'unknown'
type HomeTab = 'devices' | 'profile'

const state: {
  devices: Device[]
  selected?: DeviceDetail
  filter: Filter
  search: string
  loading: boolean
  loadingMore: boolean
  error: string
  total: number
  pageNum: number
  pageSize: number
  propMap: Record<number, DeviceProperty[]>
  propLoadingIds: Set<number>
  historyData?: TimeSeriesData
  customRange?: { begin: number; end: number }
  activeTab: HomeTab
} = {
  devices: [],
  filter: 'all',
  search: '',
  loading: false,
  loadingMore: false,
  error: '',
  total: 0,
  pageNum: 1,
  pageSize: 10,
  propMap: {},
  propLoadingIds: new Set<number>(),
  activeTab: 'devices',
}

const app = document.querySelector<HTMLDivElement>('#app')!
let historyChart: ECharts | undefined
let echartsLoader: Promise<typeof import('./echarts').echarts> | undefined
let rangeDraftBegin: number | undefined
let rangeDraftEnd: number | undefined
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
let realtimePollTimer: number | undefined

async function loadEcharts() {
  if (!echartsLoader) {
    echartsLoader = import('./echarts').then(module => module.echarts)
  }
  return echartsLoader
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] || char))
}

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function formatTime(ts?: number | null) {
  if (!ts) return '—'
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - ts)
  if (diff < 60) return `${diff || 1}秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  return new Date(ts * 1000).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(ts: number) {
  return new Date(ts * 1000).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatFullDateTime(ts?: number | null) {
  if (!ts) return '—'
  const date = new Date(ts * 1000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function getDayStart(date: Date) {
  return Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 1000)
}

function getDayEnd(dayStart: number) {
  return dayStart + 24 * 60 * 60 - 1
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function getMonthTitle(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}年 ${pad(date.getMonth() + 1)}月`
}

function renderCalendarDays() {
  const year = calendarMonth.getFullYear()
  const month = calendarMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leading = firstDay.getDay()
  const selectedBegin = rangeDraftBegin || state.customRange?.begin
  const selectedEnd = rangeDraftEnd || state.customRange?.end
  const rangeBegin = selectedBegin ? getDayStart(new Date(selectedBegin * 1000)) : undefined
  const rangeEnd = selectedEnd ? getDayStart(new Date(selectedEnd * 1000)) : undefined
  const cells: string[] = []

  for (let i = 0; i < leading; i++) cells.push('<span class="calendar-empty"></span>')
  for (let day = 1; day <= daysInMonth; day++) {
    const dayTs = getDayStart(new Date(year, month, day))
    const isStart = dayTs === rangeBegin
    const isEnd = dayTs === rangeEnd
    const inRange = rangeBegin && rangeEnd && dayTs > Math.min(rangeBegin, rangeEnd) && dayTs < Math.max(rangeBegin, rangeEnd)
    cells.push(`<button class="calendar-day ${isStart ? 'start' : ''} ${isEnd ? 'end' : ''} ${inRange ? 'in-range' : ''}" data-day="${dayTs}">${day}</button>`)
  }
  return cells.join('')
}

function normalizeStatus(status?: string) {
  if (status === 'online' || status === 'offline') return status
  return 'unknown'
}

function typeLabel(type: number) {
  if (type === 2) return 'func'
  if (type === 3) return 'event'
  return 'prop'
}

function dataTypeLabel(dataType: number) {
  if (dataType === 1) return 'bool'
  if (dataType === 2) return 'int'
  if (dataType === 3) return 'float'
  return 'unknown'
}

function formatValue(prop: DeviceProperty) {
  if (prop.value === undefined || prop.value === null || prop.value === '') return '—'
  if (typeof prop.value === 'number') return prop.data_type === 2 ? prop.value.toFixed(0) : prop.value.toFixed(1)
  if (typeof prop.value === 'boolean') return prop.value ? 'ON' : 'OFF'
  return String(prop.value)
}

function getDevicePageSize() {
  const columns = window.innerWidth >= 1024 ? 2 : 1
  const availableHeight = Math.max(360, window.innerHeight - 250)
  const rows = Math.ceil(availableHeight / 86) + 2
  return Math.min(60, Math.max(8, rows * columns))
}

function renderShell() {
  app.innerHTML = `
    <div class="app">
      <div class="view active" id="viewList"></div>
      <div class="view" id="viewDetail"></div>
      <nav class="bottom-tabs" id="bottomTabs">
        <button class="bottom-tab active" data-tab="devices">${icons.device}<span>设备</span></button>
        <button class="bottom-tab" data-tab="profile">${icons.user}<span>我的</span></button>
      </nav>
    </div>
  `
  bindBottomTabs()
}

function bindBottomTabs() {
  document.querySelectorAll<HTMLButtonElement>('.bottom-tab').forEach(button => {
    button.addEventListener('click', () => {
      const nextTab: HomeTab = button.dataset.tab === 'profile' ? 'profile' : 'devices'
      if (state.activeTab === nextTab) return
      state.activeTab = nextTab
      stopRealtimePolling()
      disposeHistoryChart()
      document.querySelector<HTMLDivElement>('#viewDetail')!.classList.remove('active', 'detail')
      document.querySelector<HTMLDivElement>('#viewList')!.classList.add('active')
      document.querySelector<HTMLElement>('#bottomTabs')!.style.display = ''
      renderHomeTab()
    })
  })
}

function updateBottomTabs() {
  document.querySelectorAll<HTMLButtonElement>('.bottom-tab').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === state.activeTab)
  })
}

function renderHomeTab() {
  updateBottomTabs()
  if (state.activeTab === 'profile') {
    renderProfile()
    return
  }
  renderList()
}

function renderLogin(error = '') {
  stopRealtimePolling()
  disposeHistoryChart()
  app.innerHTML = `
    <main class="login-page">
      <div class="login-orb orb-one"></div>
      <div class="login-orb orb-two"></div>
      <div class="login-grid-bg"></div>
      <section class="login-hero">
        <div class="login-brand-row">
          <div class="login-mark">E</div>
          <div><h1>EdgeLink</h1><p>IoT Mobile Console</p></div>
        </div>
        <div class="login-copy">
          <span>设备实时监控</span>
          <p>使用统一身份认证登录后，移动端会自动携带授权 token 请求接口。</p>
        </div>
        <div class="login-features">
          <div class="login-feature">${icons.device}<span>设备</span></div>
          <div class="login-feature">${icons.chart}<span>趋势</span></div>
          <div class="login-feature">${icons.refresh}<span>实时</span></div>
        </div>
      </section>
      <section class="login-panel">
        ${error ? `<div class="login-error">${escapeHtml(error)}</div>` : ''}
        <button class="oauth-login-btn" id="oauthLoginBtn">一键登录</button>
        <p class="login-hint">将跳转到 OAuth2 授权页面完成登录</p>
      </section>
    </main>
  `
  document.querySelector<HTMLButtonElement>('#oauthLoginBtn')?.addEventListener('click', async () => {
    const button = document.querySelector<HTMLButtonElement>('#oauthLoginBtn')!
    button.disabled = true
    button.textContent = '正在跳转...'
    try {
      await startOAuthLogin()
    } catch (err) {
      renderLogin(err instanceof Error ? err.message : '登录跳转失败')
    }
  })
}

function renderCallback(message = '正在完成登录...') {
  app.innerHTML = `
    <main class="login-page">
      <section class="login-card">
        <div class="login-spinner"></div>
        <h1>OAuth2 登录</h1>
        <p>${escapeHtml(message)}</p>
      </section>
    </main>
  `
}

async function handleOAuthCallback() {
  renderCallback()
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code') || ''
  const stateParam = params.get('state') || ''
  const savedState = getSavedOAuthState()
  const storedToken = getStoredToken()
  try {
    if (storedToken && (!stateParam || !savedState)) {
      window.history.replaceState(null, '', '/')
      startApp()
      return
    }
    if (!code) throw new Error('OAuth2 回调缺少 code')
    if (!stateParam || !savedState || stateParam !== savedState) throw new Error('OAuth2 state 校验失败，请重新登录')
    const token = await exchangeOAuthCode(code)
    if (!token.accessToken) throw new Error('OAuth2 token 为空')
    const user = await fetchOAuthUser(token.accessToken)
    saveAuth(token, user)
    clearOAuthState()
    window.history.replaceState(null, '', '/')
    startApp()
  } catch (err) {
    if (!storedToken) clearAuth()
    clearOAuthState()
    renderLogin(err instanceof Error ? err.message : '登录失败')
  }
}

function startApp() {
  renderShell()
  state.activeTab = 'devices'
  renderHomeTab()
  loadDevices()
  registerServiceWorker()
}

function renderList() {
  if (state.activeTab !== 'devices') return
  updateBottomTabs()
  const total = state.total || state.devices.length
  const online = state.devices.filter(d => normalizeStatus(d.status) === 'online').length
  const offline = state.devices.filter(d => normalizeStatus(d.status) === 'offline').length
  const filtered = getFilteredDevices()

  const list = document.querySelector<HTMLDivElement>('#viewList')!
  list.innerHTML = `
    ${state.error ? `<div class="error">${escapeHtml(state.error)}</div>` : ''}
    <div class="search-bar">
      <input type="text" placeholder="搜索设备名称或 device_key..." id="searchInput" value="${escapeHtml(state.search)}">
      <button id="searchBtn">${icons.search}</button>
    </div>
    <div class="filter-row">
      <div class="filter-bar">
        ${renderFilter('all', '全部', total)}
        ${renderFilter('online', '在线', online)}
        ${renderFilter('offline', '离线', offline)}
        ${renderFilter('unknown', '未知', state.devices.filter(d => normalizeStatus(d.status) === 'unknown').length)}
      </div>
      <button class="list-refresh-btn" id="listRefreshBtn" aria-label="刷新设备列表">${icons.refresh}</button>
    </div>
    ${state.loading ? '<div class="loading">正在加载设备...</div>' : ''}
    <div id="deviceListBody">
      ${renderDeviceListBody(filtered)}
    </div>
  `

  list.querySelector<HTMLInputElement>('#searchInput')?.addEventListener('input', event => {
    state.search = (event.target as HTMLInputElement).value
    renderDeviceListBodyIntoDom()
  })
  list.querySelector<HTMLButtonElement>('#searchBtn')?.addEventListener('click', loadDevices)
  list.querySelector<HTMLButtonElement>('#listRefreshBtn')?.addEventListener('click', loadDevices)
  list.querySelector<HTMLButtonElement>('#loadMoreBtn')?.addEventListener('click', loadMoreDevices)
  list.querySelectorAll<HTMLButtonElement>('.filter-chip').forEach(button => {
    button.addEventListener('click', () => {
      state.filter = button.dataset.filter as Filter
      renderList()
    })
  })
  list.querySelectorAll<HTMLElement>('.device-card').forEach(card => {
    card.addEventListener('click', () => showDetail(Number(card.dataset.id)))
  })
}

function getFilteredDevices() {
  return state.devices.filter(device => {
    const status = normalizeStatus(device.status)
    if (state.filter !== 'all' && status !== state.filter) return false
    const q = state.search.trim().toLowerCase()
    if (!q) return true
    return `${device.device_name} ${device.device_key} ${device.product_name || ''}`.toLowerCase().includes(q)
  })
}

function renderDeviceListBody(filtered = getFilteredDevices()) {
  return `
    ${!state.loading && filtered.length === 0 ? '<div class="empty">暂无设备数据</div>' : ''}
    <div class="device-grid">
      ${filtered.map(renderDeviceCard).join('')}
    </div>
    ${renderLoadMore(filtered.length)}
  `
}

function renderDeviceListBodyIntoDom() {
  const body = document.querySelector<HTMLDivElement>('#deviceListBody')
  if (!body) return
  body.innerHTML = renderDeviceListBody()
  body.querySelector<HTMLButtonElement>('#loadMoreBtn')?.addEventListener('click', loadMoreDevices)
  body.querySelectorAll<HTMLElement>('.device-card').forEach(card => {
    card.addEventListener('click', () => showDetail(Number(card.dataset.id)))
  })
}

function renderLoadMore(visibleCount: number) {
  if (state.loading || visibleCount === 0 || state.devices.length >= state.total) return ''
  return `<button class="load-more" id="loadMoreBtn" ${state.loadingMore ? 'disabled' : ''}>${state.loadingMore ? '正在加载...' : `加载更多（${state.devices.length}/${state.total}）`}</button>`
}

function renderFilter(filter: Filter, label: string, count: number) {
  return `<button class="filter-chip ${state.filter === filter ? 'active' : ''}" data-filter="${filter}"><span>${label}</span><em>${formatCount(count)}</em></button>`
}

function renderDeviceCard(device: Device) {
  const status = normalizeStatus(device.status)
  const statusColor = status === 'online' ? '#EFF6FF' : status === 'offline' ? '#FEE2E2' : '#F3F4F6'
  const iconColor = status === 'online' ? '#3B82F6' : status === 'offline' ? '#EF4444' : '#9CA3AF'
  const props = state.propMap[device.id] || []
  const propsPreview = props.length
    ? props.slice(0, 3).map(prop => `<span>${escapeHtml(prop.name)}: <em>${escapeHtml(formatValue(prop))}${escapeHtml(prop.unit || '')}</em></span>`).join('')
    : `<span>${state.propLoadingIds.has(device.id) ? '属性加载中...' : '暂无属性数据'}</span>`
  return `
    <div class="device-card" data-id="${device.id}">
      <div class="device-avatar" style="background:${statusColor};color:${iconColor}">${icons.device}</div>
      <div class="device-body">
        <div class="name">${escapeHtml(device.device_name)}</div>
        <div class="meta">device_key: ${escapeHtml(device.device_key)} · ${escapeHtml(device.product_name || '未关联产品')}</div>
        <div class="props-preview">${propsPreview}</div>
      </div>
      <div class="device-tail"><span class="tag ${status}">${status}</span><span class="time">${formatTime(device.status_updated_time)}</span></div>
    </div>
  `
}

function renderProfile() {
  updateBottomTabs()
  const user = getStoredUser()
  const lastLoginAt = getLastLoginAt()
  const displayName = user?.displayName || user?.username || '已登录用户'
  const initials = displayName.slice(0, 1).toUpperCase()
  const list = document.querySelector<HTMLDivElement>('#viewList')!
  list.innerHTML = `
    <section class="profile-page">
      <div class="profile-card">
        <div class="profile-avatar">${escapeHtml(initials)}</div>
        <div class="profile-main">
          <h2>${escapeHtml(displayName)}</h2>
          <p>${escapeHtml(user?.username || user?.openid || 'OAuth2 用户')}</p>
        </div>
      </div>
      <div class="profile-info-card">
        <div><span>OpenID</span><strong>${escapeHtml(user?.openid || '—')}</strong></div>
        <div><span>账号状态</span><strong>${user?.status ?? '—'}</strong></div>
        <div><span>角色</span><strong>${escapeHtml(user?.roles?.join(', ') || '—')}</strong></div>
        <div><span>上次登录时间</span><strong>${lastLoginAt ? new Date(lastLoginAt).toLocaleString('zh-CN') : '—'}</strong></div>
      </div>
      <button class="logout-btn" id="logoutBtn">${icons.logout}<span>退出登录</span></button>
    </section>
  `
  list.querySelector<HTMLButtonElement>('#logoutBtn')?.addEventListener('click', () => {
    clearAuth()
    state.activeTab = 'devices'
    renderLogin()
  })
}

async function hydrateDeviceProps(devices: Device[]) {
  const pendingDevices = devices.filter(device => !state.propMap[device.id] && !state.propLoadingIds.has(device.id))
  if (pendingDevices.length === 0) return

  pendingDevices.forEach(device => state.propLoadingIds.add(device.id))
  renderList()

  const results = await Promise.allSettled(pendingDevices.map(device => getDeviceDetail(device.id)))
  results.forEach((result, index) => {
    const deviceId = pendingDevices[index].id
    state.propLoadingIds.delete(deviceId)
    if (result.status === 'fulfilled') {
      state.propMap[deviceId] = result.value.props || []
    }
  })
  renderList()
}

async function loadDevices() {
  state.loading = true
  state.loadingMore = false
  state.error = ''
  state.pageNum = 1
  state.pageSize = getDevicePageSize()
  renderList()
  try {
    const page = await getDeviceList({ search: state.search, pageNum: state.pageNum, pageSize: state.pageSize })
    state.devices = page.data || []
    state.total = page.total || state.devices.length
    hydrateDeviceProps(state.devices)
  } catch (error) {
    state.error = error instanceof Error ? error.message : '设备列表加载失败'
  } finally {
    state.loading = false
    renderList()
  }
}

async function loadMoreDevices() {
  if (state.loadingMore || state.devices.length >= state.total) return
  state.loadingMore = true
  state.error = ''
  renderList()
  try {
    const nextPage = state.pageNum + 1
    const page = await getDeviceList({ search: state.search, pageNum: nextPage, pageSize: state.pageSize })
    const nextDevices = page.data || []
    state.devices = [...state.devices, ...nextDevices]
    state.total = page.total || state.total
    state.pageNum = nextPage
    hydrateDeviceProps(nextDevices)
  } catch (error) {
    state.error = error instanceof Error ? error.message : '加载更多设备失败'
  } finally {
    state.loadingMore = false
    renderList()
  }
}

async function showDetail(id: number) {
  stopRealtimePolling()
  const viewList = document.querySelector<HTMLDivElement>('#viewList')!
  const viewDetail = document.querySelector<HTMLDivElement>('#viewDetail')!
  viewList.classList.remove('active')
  viewDetail.classList.add('active', 'detail')
  document.querySelector<HTMLElement>('#bottomTabs')!.style.display = 'none'
  viewDetail.innerHTML = '<div class="loading">正在加载设备详情...</div>'

  try {
    state.selected = await getDeviceDetail(id)
    renderDetail()
    startRealtimePolling(id)
    window.setTimeout(() => queryHistory(), 0)
  } catch (error) {
    viewDetail.innerHTML = `<div class="detail-header"><button class="back-btn" id="backBtn">${icons.back}</button><div class="detail-title"><h2>加载失败</h2><p>${escapeHtml(error instanceof Error ? error.message : '设备详情加载失败')}</p></div></div>`
    document.querySelector<HTMLButtonElement>('#backBtn')?.addEventListener('click', showList)
  }
}

function showList() {
  stopRealtimePolling()
  disposeHistoryChart()
  state.activeTab = 'devices'
  document.querySelector<HTMLDivElement>('#viewDetail')!.classList.remove('active', 'detail')
  document.querySelector<HTMLDivElement>('#viewList')!.classList.add('active')
  document.querySelector<HTMLElement>('#bottomTabs')!.style.display = ''
  renderHomeTab()
}

function stopRealtimePolling() {
  if (realtimePollTimer !== undefined) {
    window.clearInterval(realtimePollTimer)
    realtimePollTimer = undefined
  }
}

function startRealtimePolling(deviceId: number) {
  realtimePollTimer = window.setInterval(async () => {
    const viewDetail = document.querySelector<HTMLDivElement>('#viewDetail')
    if (!viewDetail?.classList.contains('active')) return
    try {
      const detail = await getDeviceDetail(deviceId)
      if (!state.selected || state.selected.id !== deviceId) return
      state.selected = detail
      state.propMap[deviceId] = detail.props || []
      updateRealtimeSection(detail.props || [])
      updateDetailStatus(detail)
    } catch (error) {
      console.warn('realtime polling failed', error)
    }
  }, 3000)
}

function renderRealtimeSection(props: DeviceProperty[]) {
  return props.length ? `<div class="prop-summary-card" style="--prop-cols:${Math.min(props.length, 4)}">${props.map(renderPropCard).join('')}</div>` : '<div class="empty">暂无属性数据</div>'
}

function updateRealtimeSection(props: DeviceProperty[]) {
  const realtime = document.querySelector<HTMLDivElement>('#realtimeProps')
  if (realtime) realtime.innerHTML = renderRealtimeSection(props)
}

function updateDetailStatus(device: DeviceDetail) {
  const status = normalizeStatus(device.status)
  const statusEl = document.querySelector<HTMLElement>('#detailStatus')
  const lastTimeEl = document.querySelector<HTMLElement>('#detailLastTime')
  if (statusEl) {
    statusEl.className = `tag ${status}`
    statusEl.textContent = status
  }
  if (lastTimeEl) lastTimeEl.textContent = formatFullDateTime(device.status_updated_time)
}

function disposeHistoryChart() {
  historyChart?.dispose()
  historyChart = undefined
}

function renderDetail() {
  const device = state.selected
  if (!device) return
  const status = normalizeStatus(device.status)
  const props = device.props || []
  const viewDetail = document.querySelector<HTMLDivElement>('#viewDetail')!
  viewDetail.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" id="backBtn">${icons.back}</button>
      <div class="detail-title"><h2>${escapeHtml(device.device_name)}</h2><p>device_key: ${escapeHtml(device.device_key)}</p></div>
      <span id="detailStatus" class="tag ${status}">${status}</span>
    </div>
    <div class="info-banner">
      <span class="bitem info-protocol">${icons.screen}<strong>MQTT</strong></span>
      <span class="bitem info-product">${icons.box}<strong>${escapeHtml(device.product_name || '—')}</strong></span>
      <span class="bitem info-time">${icons.clock}<strong id="detailLastTime">${formatFullDateTime(device.status_updated_time)}</strong></span>
    </div>
    <div class="time-query-bar">
      <div class="tq-row">
        <select id="timeRangeSelect">
          <option value="30">最近 30 分钟</option>
          <option value="60" selected>最近 1 小时</option>
          <option value="120">最近 2 小时</option>
          <option value="360">最近 6 小时</option>
          <option value="720">最近 12 小时</option>
          <option value="1440">最近 1 天</option>
          <option value="4320">最近 3 天</option>
          <option value="10080">最近 7 天</option>
        </select>
        <button class="range-open-btn" id="rangeOpenBtn" type="button">
          <span>自定义</span>
        </button>
      </div>
      <div id="queryRange" class="tq-hint"></div>
    </div>
    <div class="range-sheet" id="rangeSheet" aria-hidden="true">
      <div class="range-mask" id="rangeMask"></div>
      <div class="range-panel" role="dialog" aria-modal="true" aria-label="选择时间范围">
        <div class="range-handle"></div>
        <div class="range-head">
          <div><h3>选择日期范围</h3><p>第一次点击开始日期，第二次点击结束日期</p></div>
          <button class="range-close" id="rangeCloseBtn" aria-label="关闭">×</button>
        </div>
        <div class="calendar-head">
          <button id="calendarPrevBtn" type="button">‹</button>
          <strong id="calendarTitle">${getMonthTitle(calendarMonth)}</strong>
          <button id="calendarNextBtn" type="button">›</button>
        </div>
        <div class="calendar-week"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
        <div class="calendar-grid" id="calendarGrid">${renderCalendarDays()}</div>
        <div class="range-picked" id="rangePickedText">${state.customRange ? `${formatDate(state.customRange.begin)} ～ ${formatDate(state.customRange.end)}` : '请选择开始日期'}</div>
        <div class="range-error" id="rangeError"></div>
        <button class="range-confirm" id="rangeConfirmBtn">确认并查询</button>
      </div>
    </div>
    <div class="section-title">实时数据</div>
    <div id="realtimeProps">${renderRealtimeSection(props)}</div>
    <div class="section-title section-title-row"><span>历史趋势</span><button class="history-refresh-btn" id="historyRefreshBtn" aria-label="刷新历史趋势">${icons.refresh}</button></div>
    <div class="chart-card" id="chartCard"><div class="placeholder">${icons.chart}<br>点击查询查看趋势</div></div>
  `

  viewDetail.querySelector<HTMLButtonElement>('#backBtn')?.addEventListener('click', showList)
  viewDetail.querySelector<HTMLButtonElement>('#historyRefreshBtn')?.addEventListener('click', queryHistory)
  viewDetail.querySelector<HTMLSelectElement>('#timeRangeSelect')?.addEventListener('change', () => {
    state.customRange = undefined
    queryHistory()
  })
  bindRangePicker()
}

function bindRangePicker() {
  const sheet = document.querySelector<HTMLDivElement>('#rangeSheet')
  const openBtn = document.querySelector<HTMLButtonElement>('#rangeOpenBtn')
  const closeBtn = document.querySelector<HTMLButtonElement>('#rangeCloseBtn')
  const mask = document.querySelector<HTMLDivElement>('#rangeMask')
  const confirmBtn = document.querySelector<HTMLButtonElement>('#rangeConfirmBtn')
  const errorEl = document.querySelector<HTMLDivElement>('#rangeError')
  const pickedText = document.querySelector<HTMLDivElement>('#rangePickedText')
  if (!sheet || !openBtn || !confirmBtn || !errorEl || !pickedText) return

  const bindCalendarDays = () => {
    document.querySelectorAll<HTMLButtonElement>('.calendar-day').forEach(button => {
      button.addEventListener('click', () => {
        const day = Number(button.dataset.day)
        if (!rangeDraftBegin || (rangeDraftBegin && rangeDraftEnd)) {
          rangeDraftBegin = day
          rangeDraftEnd = undefined
          pickedText.textContent = `开始：${formatDate(day)}，请选择结束日期`
        } else {
          rangeDraftEnd = day
          if (rangeDraftEnd < rangeDraftBegin) [rangeDraftBegin, rangeDraftEnd] = [rangeDraftEnd, rangeDraftBegin]
          pickedText.textContent = `${formatDate(rangeDraftBegin)} ～ ${formatDate(rangeDraftEnd)}`
        }
        errorEl.textContent = ''
        const grid = document.querySelector<HTMLDivElement>('#calendarGrid')
        if (grid) grid.innerHTML = renderCalendarDays()
        bindCalendarDays()
      })
    })
  }

  const open = () => {
    rangeDraftBegin = state.customRange?.begin
    rangeDraftEnd = state.customRange?.end ? getDayStart(new Date(state.customRange.end * 1000)) : undefined
    calendarMonth = state.customRange?.begin ? new Date(new Date(state.customRange.begin * 1000).getFullYear(), new Date(state.customRange.begin * 1000).getMonth(), 1) : calendarMonth
    const title = document.querySelector<HTMLElement>('#calendarTitle')
    const grid = document.querySelector<HTMLDivElement>('#calendarGrid')
    if (title) title.textContent = getMonthTitle(calendarMonth)
    if (grid) grid.innerHTML = renderCalendarDays()
    pickedText.textContent = state.customRange ? `${formatDate(state.customRange.begin)} ～ ${formatDate(state.customRange.end)}` : '请选择开始日期'
    sheet.classList.add('active')
    sheet.setAttribute('aria-hidden', 'false')
    bindCalendarDays()
  }
  const close = () => {
    sheet.classList.remove('active')
    sheet.setAttribute('aria-hidden', 'true')
    errorEl.textContent = ''
  }

  openBtn.addEventListener('click', open)
  closeBtn?.addEventListener('click', close)
  mask?.addEventListener('click', close)
  document.querySelector<HTMLButtonElement>('#calendarPrevBtn')?.addEventListener('click', () => {
    calendarMonth = addMonths(calendarMonth, -1)
    document.querySelector<HTMLElement>('#calendarTitle')!.textContent = getMonthTitle(calendarMonth)
    document.querySelector<HTMLDivElement>('#calendarGrid')!.innerHTML = renderCalendarDays()
    bindCalendarDays()
  })
  document.querySelector<HTMLButtonElement>('#calendarNextBtn')?.addEventListener('click', () => {
    calendarMonth = addMonths(calendarMonth, 1)
    document.querySelector<HTMLElement>('#calendarTitle')!.textContent = getMonthTitle(calendarMonth)
    document.querySelector<HTMLDivElement>('#calendarGrid')!.innerHTML = renderCalendarDays()
    bindCalendarDays()
  })
  confirmBtn.addEventListener('click', () => {
    if (!rangeDraftBegin || !rangeDraftEnd) {
      errorEl.textContent = '请点击两次，选择开始日期和结束日期'
      return
    }
    const begin = Math.min(rangeDraftBegin, rangeDraftEnd)
    const end = getDayEnd(Math.max(rangeDraftBegin, rangeDraftEnd))
    if (end - begin > 7 * 24 * 60 * 60) {
      errorEl.textContent = '自定义时间范围不能超过 7 天'
      return
    }
    state.customRange = { begin, end }
    close()
    queryHistory()
  })
}

function renderPropCard(prop: DeviceProperty) {
  const label = typeLabel(prop.type)
  const value = formatValue(prop)
  return `
    <div class="prop-card ${label}">
      <div class="prop-name">${escapeHtml(prop.name)}</div>
      <div class="prop-value"><span class="val">${escapeHtml(value)}</span>${prop.unit ? `<span class="unit">${escapeHtml(prop.unit)}</span>` : ''}</div>
      <div class="prop-key">${escapeHtml(prop.key)} · ${dataTypeLabel(prop.data_type)}</div>
    </div>
  `
}

async function queryHistory() {
  const device = state.selected
  if (!device) return
  const chartCard = document.querySelector<HTMLDivElement>('#chartCard')!
  const minutes = Number(document.querySelector<HTMLSelectElement>('#timeRangeSelect')!.value)
  const end = state.customRange?.end || Math.floor(Date.now() / 1000)
  const begin = state.customRange?.begin || end - minutes * 60
  const propertyIds = (device.props || []).filter(prop => prop.data_type === 2 || prop.data_type === 3).slice(0, 4).map(prop => prop.property_id)

  document.querySelector<HTMLDivElement>('#queryRange')!.textContent = `${new Date(begin * 1000).toLocaleString('zh-CN')} ～ ${new Date(end * 1000).toLocaleString('zh-CN')}`
  if (propertyIds.length === 0) {
    chartCard.innerHTML = '<div class="placeholder">没有可查询趋势的数值属性</div>'
    return
  }

  chartCard.innerHTML = '<div class="loading">正在查询历史趋势...</div>'
  try {
    const data = await getTimeseriesData({ device_ids: [device.id], property_ids: propertyIds, begin, end })
    state.historyData = data
    chartCard.innerHTML = renderHistoryChart(data, device)
    await mountHistoryChart(data, device)
  } catch (error) {
    chartCard.innerHTML = `<div class="error">${escapeHtml(error instanceof Error ? error.message : '历史趋势查询失败')}</div>`
  }
}

function renderHistoryChart(data: TimeSeriesData, device: DeviceDetail) {
  const entries = Object.entries(data).filter(([, points]) => points.length > 0)
  if (entries.length === 0) return '<div class="placeholder">当前时间范围内暂无历史数据</div>'

  const seriesNames = entries.map(([key]) => getSeriesName(key, device))
  return `
    <div id="historyChart" class="history-chart" aria-label="历史趋势图"></div>
    <div class="history-tip">可左右滑动缩放区间，点击图例隐藏或显示曲线</div>
    <div class="history-series-summary">${seriesNames.map(name => `<span>${escapeHtml(name)}</span>`).join('')}</div>
  `
}

function getSeriesName(key: string, device: DeviceDetail) {
  const propertyId = Number(key.split(':')[1])
  const prop = device.props.find(item => item.property_id === propertyId)
  return prop?.name || key
}

async function mountHistoryChart(data: TimeSeriesData, device: DeviceDetail) {
  const chartEl = document.querySelector<HTMLDivElement>('#historyChart')
  if (!chartEl) return

  disposeHistoryChart()
  const echarts = await loadEcharts()
  if (!document.body.contains(chartEl)) return

  const colors = ['#2563EB', '#16A34A', '#EA580C', '#7C3AED']
  const series = Object.entries(data)
    .filter(([, points]) => points.length > 0)
    .map(([key, points], index) => ({
      name: getSeriesName(key, device),
      type: 'line',
      smooth: true,
      showSymbol: false,
      symbol: 'circle',
      symbolSize: 7,
      lineStyle: { width: 1.5, color: colors[index % colors.length] },
      itemStyle: { color: colors[index % colors.length] },
      emphasis: { focus: 'series', lineStyle: { width: 2 } },
      data: [...points].sort((a, b) => a[0] - b[0]).map(([ts, value]) => [ts * 1000, value]),
    }))

  historyChart = echarts.init(chartEl, undefined, { renderer: 'canvas' })
  const option: EChartsCoreOption = {
    color: colors,
    animationDuration: 250,
    grid: { top: 48, right: 8, bottom: 28, left: 6, containLabel: true },
    legend: {
      type: 'scroll',
      top: 0,
      left: 4,
      right: 4,
      itemWidth: 14,
      itemHeight: 8,
      icon: 'roundRect',
      textStyle: { color: '#374151', fontSize: 12, fontWeight: 600 },
      pageIconColor: '#3B82F6',
      pageTextStyle: { color: '#6B7280' },
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      axisPointer: { type: 'line', lineStyle: { color: '#93C5FD', width: 1.5 } },
      valueFormatter: (value: unknown) => typeof value === 'number' ? Number(value).toFixed(2) : String(value),
    },
    xAxis: {
      type: 'time',
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisTick: { show: false },
      axisLabel: { color: '#9CA3AF', fontSize: 10, hideOverlap: true, formatter: '{HH}:{mm}' },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: '#9CA3AF', fontSize: 10, margin: 4 },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
    },
    dataZoom: [
      { type: 'inside', throttle: 50, zoomOnMouseWheel: false, moveOnMouseMove: true, moveOnMouseWheel: true },
    ],
    series,
  }
  historyChart.setOption(option)
  window.setTimeout(() => historyChart?.resize(), 0)
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  if (import.meta.env.DEV) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => registration.unregister())
      })
      caches.keys().then(keys => {
        keys.filter(key => key.startsWith('edgelink-mobile')).forEach(key => caches.delete(key))
      })
    })
    return
  }

  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined))
}

window.addEventListener('resize', () => historyChart?.resize())
window.addEventListener('auth-expired', () => renderLogin('登录已过期，请重新登录'))

if (window.location.pathname === '/oauth/callback') {
  handleOAuthCallback()
} else if (getStoredToken()) {
  startApp()
} else {
  renderLogin()
}
