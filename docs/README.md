# dsh-openpencil-lite 设计

## 主题目标

把 dsh 当前加载的 OpenPencil 插件改造为同仓库维护插件 `dsh-openpencil-lite`：移除手动编辑 `.op` 画布（managed editor 工作台），保留并强化只读预览并接入 `dsh-better-sidebar` 侧边栏供用户预览；让 Agent 不打开 web 即可直接编辑 `.op` JSON 进行设计（无头 apply + 纯 JSON 编辑），形成"Agent 改稿 → 渲染验证 → 侧边栏预览"闭环。

## 当前状态

- 已确认（用户，2026-08-19）：插件命名 `dsh-openpencil-lite`；Agent 设计路径 = 无头 apply + 保留纯 JSON 编辑；改造方向（去编辑器、侧边栏预览）随需求确认。
- 证据已复核：上游插件源码（五工具、editor-host、renderer、presentation-hydration、客户端预览/编辑器模块）、`dsh-better-sidebar` 服务契约（registerTab/registerFileViewer/openTab）、web profile 组合配置、上游仓库根（未提交 `lib/`、无 prepare）。
- 本机实测（2026-08-19）：手写 `.op` JSON 经 `openpencil_render` exact 渲染多帧成功；编辑 JSON 后重渲染出新图；`openpencil_new` 无头建稿并原子落盘成功；缓存已有 149 张渲染、17 份快照。
- 实施状态（2026-08-20 复核修正漂移）：`dsh-openpencil-lite@0.1.0-rc.1` 已以 `github:` fork 钉 ref 形态装入 web profile（路线 A；`--dump-config` 单行无重复、`profiles/node_modules` 实测），预览 tab、SilentRenderObserver、CanvasModal 与本基线一致；本区此前"尚未进入实现"为过期记录。
- 设计审查（2026-08-19）：无头 apply 写回并发机制定为平台 `services.fs` 的 `replaceIfVersion` 守卫写入（取代自管 sha256 防线，与 `openpencil_new` 落盘路径一致）；`dsh-better-sidebar` 版本事实修正为 `^0.13.1`；预览与回放验收的环境前置（test profile 需装入 `dsh-better-sidebar`、历史卡片构造产生）已写入部署文档；侧边栏预览文档补强复用资产清单与 store 写入点约束（无语义变化）。
- 同批确认（用户，2026-08-19）：Agent 引导文案（工具描述 + `openpencil-prototype` skill）提升为与实现同批交付的需求（R-10/AC-10）；Agent 设计闭环在 `需求.md` 场景节改写为显式四步回路；UI 原生视觉对齐采用皮肤级重写（方向 A，R-11/AC-11，决策记录 `decisions/DSR-003-UI原生视觉对齐.md`）。
- 需求确认（用户，2026-08-20）：`.op` 文件查看器提升为正式需求（R-12/AC-12）——只读画布直读形态（客户端 `fsRead` + Web SDK 画布），原"按路径 on-demand 渲染路由"预案取消（决策记录 `decisions/DSR-004-op文件查看器形态.md`）；preview tab 新增"预览 PNG"蒙版按钮（R-13/AC-13，平台 `ImageLightbox`，懒加载降级）。
- 部署事实（2026-08-20 复核）：web 已按路线 A 落地——fork `FengZhiHen1/dsh-openpencil-lite` 钉定 `a79bbd8`（与本仓库子模块 gitlink 同 ref，fork 提交 `lib/` 产物）；`dsh-better-sidebar` 已升级 `^0.14.0`（安装 0.14.0），文档内版本事实已同步；test profile 已装 better-sidebar `^0.13.1`、lite 以 `link:` 直挂 `plugins/dsh-openpencil-lite`。
- 待确认：工具名保留 `openpencil_*` 按推荐执行（web 部署形态已于 2026-08-20 确认为路线 A fork 钉 ref，见本区部署事实）。
- `missing evidence`（详见各技术文档）：daemon 以已存在非空文档启动的 batch 版本行为；`openTab` 折叠展开已经 0.14.0 源码核实、待 GUI 实测确认；跨插件消费 `ctx.betterSidebar` 在本 profile 无先例，端到端接入未实测；"预览 PNG"依赖的 ui-attachment 模块图解析与 better-sidebar `fsRead` 截断阈值待实测。

## 阅读顺序

1. `需求.md`：先确认范围、约束与验收。
2. `technical-details/README.md`：按机制阅读顺序展开技术细节。
3. `decisions/`：需要了解决策理由时阅读。

## 文档地图

| 文档 | 唯一权威范围 |
|---|---|
| `需求.md` | 目标、场景、功能需求、约束、非目标与验收条件 |
| `technical-details/改造范围与标识.md` | 相对上游的删除/保留/新增清单、包/插件/路由/工具标识与历史回放边界 |
| `technical-details/无头apply机制.md` | `openpencil_apply` 工具机制、写回与冲突语义、失败处理 |
| `technical-details/侧边栏预览机制.md` | 侧边栏预览 tab、`.op` 文件查看器与"预览 PNG"蒙版的注册、数据来源、刷新与降级语义 |
| `technical-details/部署形态与验证顺序.md` | 发布形态、web 部署红线、迭代与验收顺序 |
| `decisions/` | 真实重大取舍的备选、评价、后果与重访条件 |
