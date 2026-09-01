# 决策：`.op` 文件查看器形态——只读画布直读（op-file-viewer-canvas-2026-08）

## 决策

`.op` 文件查看器（better-sidebar `registerFileViewer`，`exts: ['op']`）采用只读画布直读：客户端经 `fsRead` 拿到 `.op` JSON 文本，直接喂 Web SDK 画布内联渲染整稿，支持拖动平移、缩放与适应窗口；不提供 PNG 帧轨，设计基线中"按路径 on-demand 渲染 → 签名 PNG 授权"的预案取消。用户于 2026-08-20 确认。

## 上下文

设计基线把 `.op` 文件查看器列为延期增强，预案是 host 新增"按路径 on-demand 渲染"小路由，查看器展示渲染 PNG。用户提出正式需求时明确要求"和 op 原生的画布类似，不是分开的帧图，而是一整个画布，通过拖动和放大、缩小预览"。事实核查：`FileViewerDescriptor` 的 `fsRead` 策略可把文件文本直接送入查看器组件；已实现 `CanvasModal` 证明 SDK `createViewer({ doc: string | Uint8Array })` 接受内存文档文本；viewer 资产是固定路由、不按渲染签名——画布直读零渲染依赖成立。

## 真实方向与评价

- 方向 A（画布直读，`fsRead` + SDK）：零 daemon、零渲染路由、打开即看，交互与 OpenPencil 原生画布一致；代价是查看器内无 PNG 产物（无帧轨、无下载 PNG），且 `fsRead` 大文件截断会败坏 JSON（按错误态处理）。
- 方向 B（按路径渲染路由）：与 preview tab 同构（帧轨 + PNG），但每次打开文件起一次渲染 daemon、有秒级延迟、exact 精度依赖本机 OpenPencil 安装，且新增一条带授权面的 host 路由。
- 方向 C（A+B 同批）：功能最全，但把延期项全部前置，违背"只做请求功能"。

## 最终决定

方向 A。理由：直接命中用户表述的画布诉求，机制最小（复用固定资产路由 + `fsRead`），无渲染依赖与延迟；PNG 诉求已由 preview tab 与"预览 PNG"蒙版按钮（R-13）覆盖。

## 直接后果

- `requirements.md` 新增 R-12/AC-12，非目标增补"文件查看器不提供 PNG 帧轨与按路径 on-demand 渲染"。
- `technical-details/better-sidebar-preview.md` 的"可选增强（延期确认）"改写为正式机制节；`refactor-scope.md` 新增清单登记查看器与蒙版按钮、取消渲染路由预案；`deployment.md` 迭代顺序新增对应验收步骤。
- host 侧新增一个只读 viewer-grant 通道（返回固定资产 URL 三元组），无渲染、无签名。
- 波及文档：本主题 `requirements.md`、`technical-details/better-sidebar-preview.md`、`technical-details/refactor-scope.md`、`technical-details/deployment.md`、`README.md`（状态区）、本决策。

## 重访条件

- 用户提出"查看器内也要 PNG 帧/下载 PNG"或需要 sha256 快照溯源时，重估方向 B；
- `fsRead` 截断阈值实测过小（常见 `.op` 超阈值）时，重估数据路径（`custom` load 或 host 路由）。
