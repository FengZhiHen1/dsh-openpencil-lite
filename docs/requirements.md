# dsh-openpencil-lite 需求

## 权威范围

本文唯一拥有 `dsh-openpencil-lite` 的目标、用户、场景、功能范围、需求约束、非目标与验收语义。技术机制归 `technical-details/`，选型理由归 `decisions/`。本文不指定实现模块、语言或目录。

## 结论先行

- 目标：把 dsh 当前加载的 OpenPencil 插件改造为"无头设计 + 侧边栏预览"形态——移除手动编辑 `.op` 画布（managed editor 工作台），保留并强化只读预览，接入 `dsh-better-sidebar` 侧边栏供用户预览；让 Agent 不打开 web 即可直接编辑 `.op` JSON 进行设计，形成"Agent 改稿 → 渲染验证 → 侧边栏预览"闭环。
- 已确认（用户，2026-08-19）：插件命名 `dsh-openpencil-lite`（避免与 `@zseven-w/dsh-openpencil` 重复）；Agent 设计路径采用"无头 apply + 保留纯 JSON 编辑"。
- 事实支撑：本机已实测手写 `.op` JSON 经 `openpencil_render` 以 exact 精度渲染多帧成功；编辑 JSON 后重渲染出新图；`openpencil_new` 无头建稿并原子落盘成功；`dsh-better-sidebar` 已装于 web profile 且暴露侧边栏注册服务。
- 已确认（用户，2026-08-20）：`.op` 文件查看器提升为正式需求（R-12）——只读画布直读形态，原"按路径 on-demand 渲染路由"预案取消；preview tab 新增"预览 PNG"蒙版按钮（R-13）；web 最终部署形态定为路线 A（fork 钉 ref，已落地）。
- 待确认：工具名保留 `openpencil_*` 按推荐执行。
- 下一重点：先读范围与约束，再读验收条件。

## 背景与问题

当前加载的第三方插件 `@zseven-w/dsh-openpencil` 注册五个模型可见工具：`openpencil_render`、`openpencil_selection`、`openpencil_new`、`openpencil_create`、`openpencil_edit`。其中 `openpencil_create`/`openpencil_edit` 必须存在一个已打开的侧边栏编辑器（否则报 "No active OpenPencil editor"），且改动只写活画布、`saved` 恒为 `false`，最终落盘依赖用户在 GUI 侧边栏手动点击 Save。手动编辑画布（layers、属性、绘制、undo/redo 的托管编辑器工作台）对本仓库的实际使用是多余的，用户不了解也不需要它。

同一事实下存在一个已验证的出口：`.op` 是单文件 JSON，`openpencil_render` 只从磁盘渲染，因此 Agent 用普通文件工具直接读写 `.op` JSON 即可设计，渲染负责验证；`openpencil_new` 已具备无头 daemon 跑 `batch_design` 并原子落盘的能力。`dsh-better-sidebar` 已在 web profile 挂载并暴露 `ctx.betterSidebar` 注册服务，可承载插件预览。改造就是把这三个可用事实收敛为一个精简插件。

## 用户与场景

- 主要用户：本机 DSH Web GUI 用户，以及驱动设计工作的 Agent。
- Agent 设计闭环（主场景）：Agent 全程不打开 web，按以下回路工作——
  1. 建稿：`openpencil_new` 以 batch 操作创建 `.op` 并直接落盘（`saved:true`）。
  2. 改稿：批量结构化修改走 `openpencil_apply`（原子写回、冲突拒绝）；零星小改可用普通文件工具直接改 `.op` JSON。
  3. 验证：`openpencil_render` 从磁盘渲染出图，Agent 看图发现结构与视觉问题，回到第 2 步迭代。
  4. 交付：磁盘文件即最终事实，不存在任何"保存"动作。
- 预览场景（零 Agent 动作）：渲染 settle 后 better-sidebar 的 `openpencil:preview` tab 自动聚焦并刷新；**消息流内不再渲染行内卡片**，预览统一出现在侧边栏——缩略图轨、放大主预览、"预览 PNG"蒙版看单帧原图、打开只读交互画布、下载 PNG。
- 文件浏览场景（零 Agent 动作）：用户在 sider 资源管理器点击任意 `.op` 文件，查看器以一整张只读交互画布直接打开整稿，拖动平移、缩放、适应窗口浏览；该路径不经渲染管线，与会话渲染预览互不依赖。
- 协作场景：Agent 全自动改稿并落盘，用户只预览与给反馈，不再承担"手点 Save"。

## 范围与功能需求

- R-01 命名与标识：以 `dsh-openpencil-lite` 作为 npm 包名与插件 loader id 交付，与 `@zseven-w/dsh-openpencil` 的包名、`dsh-openpencil` loader id 全部区分。验收：同一 profile 中 `dsh-openpencil-lite` 只出现一行，无 `duplicate loader entry id`。
- R-02 去编辑器：不注册托管编辑器工作台（host 编辑器会话、launch/save/refresh/close/selection/recovery、客户端编辑器 UI）；`openpencil_render` 不再输出 editor grant 与"在侧边栏编辑"入口。验收：任何渲染结果都不出现编辑入口，`EDITOR_*` 路由不再挂载。
- R-03 无头设计：提供 `openpencil_apply`（对已有 `.op` 文件执行 batch_design → 原子写回，`saved:true`）；`openpencil_new` 保留无头建稿。验收：无任何编辑器打开时，Agent 可建稿并可批量改稿且文件立即落盘。
- R-04 纯 JSON 编辑：Agent 可用普通文件工具直接读写 `.op` JSON，并经 `openpencil_render` 验证。验收：手工编辑文件后重新渲染得到新图且帧数与基线可核对。
- R-05 预览渲染：`openpencil_render` 渲染磁盘 `.op` 为 PNG（优先 OpenPencil exact，降级 Jian runtime-preview，带 `fidelity` 标记），返回多帧与内容寻址快照；**客户端不在消息流内渲染行内卡片**（工具调用行照常出现，卡片 UI 隐藏），预览统一走侧边栏 tab（R-06）。验收：渲染结果含 `frames`、`document.sha256`、`renderer`/`fidelity`。
- R-06 侧边栏预览：客户端注册 `dsh-better-sidebar` 预览 tab（`openpencil:preview`，`single: true`），渲染 settle 后自动打开/聚焦并刷新该 tab；tab 展示缩略图轨、主预览与只读画布入口。验收：侧边栏出现且唯一一个 `openpencil:preview`，Agent 连续重渲染后 tab 显示新图。
- R-07 历史回放：旧会话 `openpencil_render`/`design_render` 工具调用在消息流中**不再回放行内 PNG**；其挂载时由静默观察器恢复浏览器侧 grant（含嵌套 hydration）并写入侧边栏最近渲染，打开旧会话时 `openpencil:preview` tab 反映该会话最近一次渲染。验收：打开旧会话无行内 PNG 卡片、无报错，侧边栏预览可用。
- R-08 卸载清理：插件卸载后路由、槽位与进程资源消失；不删除 `.op` 源文件与渲染/快照缓存。验收：移除插件行后 DSH 正常启动，源文件与缓存原样保留。
- R-09 依赖降级：对 `dsh-better-sidebar` 的依赖在缺失或被禁用时静默降级——不注册 `openpencil:preview` tab、不调用 `openTab`，行内亦无卡片，插件本身无报错继续可用。验收：关闭 better-sidebar 后插件装载无报错。
- R-10 引导文案同批交付：工具描述与 `openpencil-prototype` skill 随实现同批更新——与最终工具集一致（无 `openpencil_create`/`openpencil_edit`/`openpencil_selection` 残留），并教会 Agent 三点引导：本轮修改尽量合并为单个 batch（每次 apply 冷启动一个 daemon）、按规模选择 apply 或纯 JSON 路径、每轮改稿后渲染看图自查。验收：AC-10。
- R-11 原生视觉对齐（皮肤级）：侧边栏预览 tab 外壳与 `CanvasModal` 外框以 DSH 原生设计语言重写（行内渲染卡片已随 R-05 隐藏，不在本项范围）——颜色全部映射平台 token（`--dsw-alias-*`/`--ui-*`，消除硬编码 hex），圆角与间距按平台梯度归一，按钮/徽标/提示控件换用 `dsh-client-ui-primitives` 原子。边界：不改组件结构与状态逻辑（grant 解析、帧选择、hydration 时序保持原样）；不样式化 SDK 画布内部（那是被预览的产品本身，非本插件 UI）。验收：AC-11。
- R-12 `.op` 文件查看器（画布预览）：注册 better-sidebar 文件查看器（`exts: ['op']`），sider 资源管理器点击任意 `.op` 文件即在查看器内以一整张只读交互画布直接预览设计，支持拖动平移、缩放与适应窗口；数据路径为客户端直读文件文本 + Web SDK 画布，不经渲染管线、不起渲染 daemon、不新增按路径渲染路由；非法或截断的 `.op` 以查看器内错误态呈现，不白屏。验收：AC-12。
- R-13 预览 PNG 蒙版按钮：`openpencil:preview` tab 动作行新增"预览 PNG"按钮，以平台原生蒙版图片预览展示当前选中帧原图，关闭交互沿用原生行为；仅作用于该 tab，不接管 sider 内置 image 查看器；蒙版模块不可解析时按钮隐藏、其余功能不受影响。验收：AC-13。

## 约束

- C-01 web profile 部署红线：稳定 profile 只接受已发布 npm 包或 `github:` 钉定 ref 依赖，禁止 `link:`/`file:` 源码直挂；`dsh-openpencil-lite` 的 web 部署形态必须满足（发布形态细节归部署技术文档）。
- C-02 唯一标识：插件 loader id、npm 包名、路由前缀均不与上游 `@zseven-w/dsh-openpencil` 重复。
- C-03 只读渲染事实：`openpencil_render` 只从磁盘文件渲染，不维护内存画布状态。
- C-04 无头写回语义：无头 apply 写入必须原子生效；写回前源文件被外部改动时必须拒绝覆盖并报冲突（并发校验的具体机制归技术文档）。
- C-05 回放兼容边界：保留 legacy `design_render` 别名与 presentation-hydration 的只读回放，不破坏既有会话。

## 非目标

- 不提供 OpenPencil 原生完整编辑器能力（图层、属性、绘制、组件、交互编排）。
- 不做所见即所得的手工绘制。
- 不修改 `dsh-better-sidebar` 本体，只通过其公开服务接入。
- 不接入外部图片生成服务。
- `.op` 文件查看器不提供 PNG 帧轨与按路径 on-demand 渲染。
- 不接管 sider 资源管理器既有图片查看（`.png` 等由 better-sidebar 内置 image 查看器负责）。
- 不维护上游 npm 发布版本；改造以本仓库 fork/发布形态自持。
- 不实现多用户、远端权限或审计。

## 验收条件

- AC-01 标识验证：`--dump-config` 只含一行 `dsh-openpencil-lite`，无遗留 `dsh-openpencil` 行。
- AC-02 无头闭环验证：未打开任何编辑器时，Agent 依次执行 `openpencil_new` → `openpencil_apply`（多操作批次）→ `openpencil_render` 全部成功，且每步文件均落盘（sha256 变化）。
- AC-03 冲突验证：apply 执行期间源文件被外部改动，返回冲突错误且不覆盖。
- AC-04 预览验证：better-sidebar 出现唯一 `openpencil:preview` tab，连续渲染两次显示新图且不出现重复 tab。
- AC-05 回放验证：构造一条旧 `design_render`/`openpencil_render` 历史卡片，新客户端消息流**不出现行内 PNG 卡片**、无报错，且打开该会话时侧边栏 `openpencil:preview` tab 反映其最近一次渲染。
- AC-06 卸载验证：移除插件后 `EDITOR_*` 等路由消失、DSH 正常启动、`.op` 源与缓存不动。
- AC-07 纯 JSON 验证：仅用文件工具修改 `.op` 后 `openpencil_render` 得到新图（与渲染协议的帧数、目测一致）。
- AC-08 降级验证：禁用 `dsh-better-sidebar` 后，插件装载无报错、无预览通道亦无行内卡片。
- AC-09 装载态去编辑器验证：插件装载状态下，路由枚举不含 `EDITOR_*`；任意 `openpencil_render` 结果的 presentationMeta 不含 editor grant，UI 不出现"在侧边栏编辑"入口。
- AC-10 引导验证：`openpencil-prototype` skill 与工具描述中无已删除工具的指引；以新会话按 skill 指引执行一遍"建稿 → 批量改稿 → 渲染"闭环，Agent 无额外提示即以批次形式提交修改、并在渲染后发生基于图像的修正迭代。
- AC-11 视觉验证：fork 客户端样式无硬编码 hex 颜色（可 grep 机判）；预览 tab 与只读画布外框在当前主题下与 DSH 原生视觉一致（消息流内已无渲染卡片，故该项不再覆盖行内卡片），无错位、对比度或留白异常；帧切换、只读画布、下载等交互行为一致。
- AC-12 文件查看器验证：资源管理器点击合法 `.op` → 查看器打开并以只读画布渲染整稿，拖动/缩放/适应窗口可用；点击非法或截断的 `.op` → 查看器内错误态说明、不白屏。
- AC-13 蒙版预览验证：preview tab 点击"预览 PNG" → 蒙版层展示当前选中帧原图，Escape、点击蒙版与关闭按钮均可关闭；切帧后再次打开显示新帧；蒙版模块缺失时按钮隐藏且其余功能正常。

## missing evidence 与延期项

- `missing evidence`：OpenPencil 托管 daemon 以"已存在非空文档"作为启动文件时，`batch_design` 的前后版本号递增与权威文档读取行为未实测（`openpencil_new` 的实测仅覆盖空文档启动）；daemon 进程级串行上限未测。
- `missing evidence`：`dsh-client-ui-attachment` 经客户端模块图 graph-row 分支解析的端到端行为（rc.8 roster 有 `ui-attachment` 行、shell 冻结模块表 seed 词不含该包，产物已核实，GUI 实测待做）；better-sidebar `fsRead` 的大文件截断阈值（截断即 `.op` JSON 解析失败，查看器按错误态处理）。
- 假设：本机 OpenPencil 安装（`openpencil-desktop.exe` 位于 PATH）持续可用，是无头 apply 与 exact 渲染的前提；非本机/无安装环境按部署技术文档的降级语义处理。
