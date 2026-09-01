# dsh-openpencil-lite 侧边栏预览机制

## 权威范围

本文唯一拥有 `dsh-openpencil-lite` 侧边栏预览的接入机制：预览 tab 与 `.op` 文件查看器的注册点、数据来源、刷新语义、组件形态与降级行为，以及"预览 PNG"蒙版机制。需求归 `requirements.md`，渲染管线与 grants 事实归 `refactor-scope.md`。

## 结论先行

`dsh-better-sidebar` 已在 web profile 挂载并暴露 `ctx.betterSidebar` 服务（`registerTab` / `registerFileViewer` / `openTab`）。`dsh-openpencil-lite` 客户端注册一个 `openpencil:preview` 单例 tab，每次 `openpencil_render` settle 后把最新渲染授权写入会话内 store 并 `openTab` 聚焦该 tab；tab 复用现有 FrameGallery 与只读 Web SDK 画布，实现"预览随 Agent 重渲染实时更新"。

`.op` 文件查看器（2026-08-20 用户确认，取代原"按路径 on-demand 渲染"预案）：注册 `FileViewerDescriptor`（`exts: ['op']`，`fetchStrategy: 'fsRead'`），客户端直读文件文本喂 Web SDK 只读画布，内联预览整稿，不经渲染管线。preview tab 动作行新增"预览 PNG"按钮（同批确认）：以平台 `ImageLightbox` 蒙版展示当前帧原图，懒加载降级。

## 现状事实

- `dsh-better-sidebar@0.14.0`（web profile 依赖 `^0.14.0`）客户端服务契约：`registerTab(TabDescriptor)` 返回 disposer；`TabDescriptor.single: true` 表示同类型单实例；`openTab({type, path})` 聚焦同类型已有 tab，且 seed 含 `path`/`url` 时在面板折叠下自动展开（0.14.0 源码已核实，GUI 行为待实测确认）。外部插件以 peer 依赖形式声明并 `inject: ['betterSidebar']` 接入——契约注释明确支持该模式，但本 profile 尚无跨插件消费 `ctx.betterSidebar` 的先例，端到端接入未实测（`missing evidence`）。
- fork 客户端资产：`SilentRenderObserver`（行内卡片隐藏后的静默观察器，消息流内渲染 null）、缩略图轨（FrameGallery）、只读 Web SDK 画布（CanvasModal）与 presentation-hydration 恢复管线，均为可复用资产。
- 每次 `openpencil_render` 的 presentationMeta 携带 image/frames/document/viewer 的签名 grants；本机 viewer 资产与 exact 渲染可用。
- `FileViewerDescriptor` 契约（0.14.0 源码核实）：`exts`/`priority`（内置 code 兜底查看器为 -100，默认 0 即可压过）/`fetchStrategy`/`component`；`fsRead` 经 `/sidebar/api fs.read` 把文件文本送入组件 `content`，大文件截断以 `truncated` 标记（阈值未实测，`missing evidence`）。
- viewer 资产是固定路由（`ViewerAssetController.viewerGrant`：`/_dsh/dsh-openpencil-lite/viewer-assets/<revision>/…`，启动期哈希校验的不可变清单），不按渲染签名——文件查看器可直接复用；已实现 `CanvasModal` 证明 SDK `createViewer({ doc: string | Uint8Array })` 接受内存文档文本，画布预览不需要渲染产物。
- 平台原生蒙版图片预览为 `@deepseek-ai/dsh-client-ui-attachment` 的 `ImageLightbox`（props：`{ src, alt, labels: { dialog, close }, onClose }`；body portal + 蒙版，Escape/点蒙版/关闭按钮关闭，卸载还原焦点）。rc.8 roster 含 `ui-attachment` 行（`dsh-web-app` bundle patch），但 shell 冻结模块表 seed 词不含该包（rc.8 前端产物核实）——第三方 bundle 经客户端模块图 graph-row 分支解析，端到端实测待做（`missing evidence`）。

## 数据来源与刷新

- host 侧新增内容：预览 tab 无（`.op` 文件查看器的只读 viewer-grant 通道见下文专节）。渲染授权仍由 `openpencil_render` 的 presentationMeta 产出（`RenderAccessController` 签名 grants，既有资产原样复用）。
- 写入点约束（复用红线）：store 写入发生在 fork 内修改的 `SilentRenderObserver` 本体（消息流内已不渲染卡片，原 `DesignRenderView` 的 settle 逻辑原样迁移到该静默观察器）——settle 状态与解析后的 grant（`embeddedGrant ?? hydrated`，解析管线为既有 `grantOf` / `presentationHydrationRequestOf` / `requestPresentationGrant`）都是它的内部状态，外层包装组件看不到。禁止在外层 wrapper 重跑 hydration 来喂 store，那会制造解析管线的第二份实现。
- 客户端维护按会话的"最近渲染"store：键为 sessionId，值为最近一次成功渲染的 `{ path, grants }`；文件 sha256 直接取 `grants.document.sha256`，不另存第二份。
- `SilentRenderObserver` settle 成功时写入该 store，并调用 `ctx.betterSidebar.openTab({ type:'openpencil:preview', path })`。
- tab 组件经 `useSyncExternalStore` 订阅 store（与 better-sidebar 注册表的快照订阅范式一致）；Agent 每次重渲染产生新 grant 时 store 更新、tab 内容刷新；`single: true` 保证不产生重复 tab。

## 组件形态

复用原则：tab 是既有资产的拼装壳，不为预览新造渲染部件。

- 缩略图轨＋主预览＋帧切换：复用 fork 内既有 `FrameGallery` 组件。
- 只读画布入口：复用 `CanvasModal`（只读 Web SDK 画布）及其 `claimCanvas` 单例管理。
- 元信息行：renderer · fidelity、帧数与 `document.sha256` 均直接读自 store 中的 grant 字段，无新数据通道。
- 动作：下载 PNG / 下载源 `.op` 直接复用 grant 既有字段（每帧 `downloadUrl`、文档 `documentDownloadUrl`），无需新增 host 路由；"打开源文件"经既有 `onOpenFile` 通道。
- 文案与主题：locale/theme 复用 fork 内 `HostSynced*` 模式（`subscribeLocale` / `subscribeTheme` + `useSyncExternalStore`），tab 不自带文案体系。
- 空状态：该会话尚无渲染结果时显示引导文案（提示 Agent 先 `openpencil_render`）。
- 历史回放：tab 只反映当前会话的最近渲染；旧 `openpencil_render`/`design_render` 调用在消息流内**不再回放行内卡片**，其挂载时由 `SilentRenderObserver` 恢复 grant（含嵌套 hydration）并写入 store——打开旧会话时侧边栏反映该会话最近一次渲染，二者互不依赖。

## `.op` 文件查看器

- 注册描述符：`id: 'openpencil:op'`、`exts: ['op']`、`fetchStrategy: 'fsRead'`、`priority` 取默认（0，压过内置 code 兜底的 -100）；组件自 `props.content` 取 `.op` JSON 文本，`props.path` 供标题与错误诊断。
- 数据路径：`content` → `sdk.createViewer({ canvas, doc: content, wasmUrl, canvasKitBaseUrl })`。viewer 资产 URL 经 host 新增的一个只读 grant 通道提供（返回 `ViewerAssetController.viewerGrant` 的固定 URL 三元组；无渲染、无签名、无新授权面——资产路由本身已是启动期校验的固定公开前缀）。
- 组件形态：自 `CanvasModal` 抽取内联只读画布（`sizeCanvasForDisplay`、拖拽平移、缩放/适应窗口工具条），去掉 modal 外壳与关闭语义；页面级单例沿用 `claimCanvas`（打开新画布关闭旧画布）。不为查看器新造渲染部件。
- 刷新：tab 生命周期与文件内容装载归 better-sidebar 查看器宿主；文件外部变更后的重载行为依其宿主语义（0.14.0 未核实，`missing evidence`），本插件不自建 watcher。

## "预览 PNG"蒙版按钮

- preview tab 动作行新增"预览 PNG"按钮：以当前选中帧 `previewUrl` 为 `src` 打开 `ImageLightbox`；`labels` 由插件自带 locale copy 供给（沿用 `HostSynced*` 文案模式）；切帧后再打开显示新帧。
- 加载与降级：必须懒加载（动态 import + catch）——静态 require 在模块不可解析时会在物化期抛出并拖垮整个插件加载；解析失败时隐藏按钮，tab 其余功能不变。
- 边界：不接管 better-sidebar 内置 image 查看器；`CanvasModal` 错误回退的"打开 PNG 预览"外链维持原样。

## 降级与失败语义

| 条件 | 行为 |
|---|---|
| `dsh-better-sidebar` 未装或被禁用 | 跳过 tab 注册与 `openTab` 调用；消息流内也无行内卡片，插件无报错（无预览通道） |
| 用户在设置中禁用 `openpencil:preview` tab 类型 | `openTab` 静默拒绝（仅 console.warn）；消息流内也无行内卡片 |
| viewer 资产缺失 | tab 内只显示 PNG，不提供只读画布入口 |
| presentation-hydration 失败 | 该调用不进入侧边栏 store（无可见回退），预览不可强求 |
| 会话切换 | store 按 sessionId 隔离，不串台 |
| `.op` 文件 JSON 非法或 `fsRead` 内容截断 | 查看器内错误态说明（含路径与原因），不白屏 |
| viewer 资产缺失或 grant 通道不可用 | 文件查看器呈错误态（交互画布不可用）；preview tab 语义不变（仍不暴露画布入口） |
| `dsh-client-ui-attachment` 不可解析 | 隐藏"预览 PNG"按钮，其余功能不变 |

## 依赖约束

- 客户端新增 peer 依赖 `dsh-better-sidebar`（与 web profile 现有 `^0.14.0` 对齐）；`inject` 清单增加 `betterSidebar`。
- 客户端新增 external 依赖 `@deepseek-ai/dsh-client-ui-attachment`（懒加载；版本随运行时 roster，rc.8 为 0.1.0-rc.8）。
- 不修改 `dsh-better-sidebar` 本体，仅消费其公开服务。
