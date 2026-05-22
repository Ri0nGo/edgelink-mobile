# EdgeLink Mobile PWA 实现方案

## 目标

基于 `ui.html` 的视觉与交互参考，以最小、最快方式实现 EdgeLink 移动端 PWA。

核心目标：

- 支持移动端优先，兼容平板。
- 保留 `ui.html` 的卡片式设备列表、筛选、搜索、设备详情、实时属性、历史趋势交互。
- 对接 `D:\MyProjects\edgelink-api` 后端接口。
- 可安装为 PWA，支持桌面图标、离线壳加载、移动端全屏体验。
- 优先交付设备查看能力，不扩展复杂管理功能。

## 技术选型

采用 Vite + Vanilla TypeScript + CSS。

选择理由：

- 当前前端只有 `ui.html`，无现有框架约束。
- Vanilla TS 可以最大程度复用 `ui.html` 结构、样式和交互。
- 不引入 React/Vue 可减少依赖、构建复杂度和迁移成本。
- PWA 通过 `manifest.webmanifest` + `service-worker.js` 手写实现，减少插件依赖。

## 目录结构

```text
edgelink-mobile/
├── docs/
│   └── project.md
├── public/
│   ├── manifest.webmanifest
│   └── sw.js
├── src/
│   ├── api.ts
│   ├── app.ts
│   ├── styles.css
│   └── types.ts
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## UI 实现策略

以 `ui.html` 为参考，不重新设计。

保留以下视觉特征：

- 主色：`#3B82F6`
- 圆角卡片：`14px`
- 移动端最大内容宽度：`480px`
- 平板内容宽度：`720px`
- 卡片阴影、筛选 chip、顶部 header、详情页 sticky 返回栏
- SVG 线性小图表

响应式规则：

- `< 600px`：单列移动端布局，保持 `ui.html` 当前视觉。
- `600px - 1024px`：平板布局，单列居中，最大宽度提升到 `720px`。
- `>= 1024px`：仍按 PWA 管理端壳处理，最大宽度控制在 `960px`。

## PWA 实现

必须实现：

- `manifest.webmanifest`
- `theme_color`
- `background_color`
- `display: standalone`
- `start_url: /`
- service worker 缓存应用壳资源

缓存策略：

- HTML、CSS、JS 使用 Cache First。
- API 请求使用 Network First。
- 离线时显示基础壳和网络错误提示。
- 不长期缓存敏感接口响应。

## 后端接口

后端项目：`D:\MyProjects\edgelink-api`

服务默认地址：

```text
http://127.0.0.1:8082
```

统一前缀：

```text
/api/edgelink
```

统一响应格式：

```json
{
  "code": 0,
  "msg": "success",
  "data": {}
}
```

错误码：

- `0`：成功
- `500`：服务端错误
- `10001`：参数错误

## 需要对接的接口

### 设备列表

```http
GET /api/edgelink/device/list?page_num=1&page_size=20&search=
```

用途：

- 首页设备列表
- 搜索设备名称或 `device_key`
- 统计设备总数、在线数、离线数

### 设备详情

```http
GET /api/edgelink/device/:id
```

用途：

- 详情页基础信息
- 实时属性列表

### 历史趋势

```http
POST /api/edgelink/data/timeseries
Content-Type: application/json

{
  "device_ids": [1],
  "property_ids": [10],
  "begin": 1710000000,
  "end": 1710003600
}
```

返回结构：

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "1:10": [
      [1710000000, 23.5],
      [1710000060, 23.7]
    ]
  }
}
```

## 最小实现范围

第一阶段只实现查看类功能：

- 设备列表
- 搜索
- 在线/离线/全部筛选
- 设备详情
- 实时属性展示
- 历史趋势查询
- PWA 安装
- 移动端和平板响应式适配

暂不实现：

- 创建设备
- 编辑设备
- 删除设备
- 产品管理
- 物模型管理
- OAuth 登录完整流程
- MQTT 实时推送
- 离线数据同步

## 环境变量

采用 Vite 标准环境文件配置接口地址。

开发环境：

```text
# .env.development
VITE_API_BASE_URL=/api/edgelink
```

生产环境：

```text
# .env.production
VITE_API_BASE_URL=http://127.0.0.1:8082/api/edgelink
```

如需使用其他模式，可新增对应的 `.env.<mode>` 文件并通过 `vite --mode <mode>` 或 `vite build --mode <mode>` 加载。

## 设备列表长度适配

设备列表不使用固定 `page_size`。前端会根据当前视口高度和列数计算首屏请求数量：

- 手机和平板单列时按可视高度估算行数。
- 桌面宽屏双列时按两列估算容量。
- 当后端 `total` 大于已加载数量时显示“加载更多”。
- 列表接口返回后，前端会对当前页设备继续请求 `GET /device/:id`，将详情接口返回的 `props` 显示为卡片属性预览。

## 联调命令

后端启动：

```bash
cd D:\MyProjects\edgelink-api
go run main.go -c ./config/config.yaml
```

设备列表：

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8082/api/edgelink/device/list?page_num=1&page_size=10" -Method GET
```

设备详情：

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8082/api/edgelink/device/1" -Method GET
```

历史数据：

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8082/api/edgelink/data/timeseries" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"device_ids":[1],"property_ids":[1],"begin":1710000000,"end":1710003600}'
```

## 当前联调结果

联调时间：2026-05-22

后端启动结果：

- `go run main.go` 可启动 HTTP 服务。
- Redis 连接成功。
- MySQL 连接成功。
- MQTT 连接失败日志出现，但不阻塞 HTTP 接口联调。

接口验证结果：

- `GET /api/edgelink/device/list?page_num=1&page_size=10`：成功，返回 `code: 0`，当前设备总数 `1`。
- `GET /api/edgelink/device/9`：成功，返回 `code: 0`，包含 `props` 实时属性数据。
- `GET /api/edgelink/product/list?page_num=1&page_size=10`：成功，返回 `code: 0`，当前产品总数 `2`。
- `GET /api/edgelink/oauth/info`：成功，返回 `code: 0`，OAuth 配置启用。
- `POST /api/edgelink/data/timeseries`：成功，返回 `code: 0`；最近 1 小时当前返回空对象 `{}`，说明接口可用但该范围内无历史数据。

## 验收标准

- 移动端无横向滚动。
- 平板竖屏/横屏可用，内容宽度合理。
- 设备列表接口成功渲染真实数据。
- 设备详情接口成功渲染属性。
- 历史趋势接口成功展示曲线。
- 后端 `code !== 0` 时前端显示错误提示。
- 应用可安装为 PWA，离线时应用壳可打开。

## 风险与处理

- 后端服务未启动时无法完成真实接口联调：前端显示错误态，并通过联调命令验证服务状态。
- 设备列表接口不返回属性预览：首页只展示设备基础信息，详情页再获取属性。
- 产品协议未在设备详情中直接返回：首期展示默认 `MQTT`。
- OAuth 已存在但首期目标是最小查看功能：预留 token 注入，不阻塞交付。
