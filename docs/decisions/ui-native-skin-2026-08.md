# 决策：UI 原生视觉对齐——皮肤级重写（ui-native-skin-2026-08）

## 决策

`dsh-openpencil-lite` 的客户端 UI 复用上游内核（组件结构、状态逻辑、grant 管线），仅以 DSH 原生设计语言做皮肤级重写：颜色全量映射平台 token、圆角与间距按平台梯度归一、控件换用 `dsh-client-ui-primitives` 原子；范围限定渲染卡片内容区、侧边栏预览 tab 外壳与 `CanvasModal` 外框。用户于 2026-08-19 确认。

## 上下文

fork 自上游的客户端已实现 token 化：颜色几乎全部经 `var(--dsw-alias-*)`/`var(--ui-*)` 平台 token 表达（17 种，由 `dsh-client-ui-layout`/`dsh-client-ui-theme`/`dsh-client-ui-primitives` 提供）。非原生残留面已核实：仅 6 个硬编码 hex（状态色）与约 15 处零散圆角值。渲染卡片挂在 `tool.call.toolview` 槽位，外层 chrome 本由平台渲染。需要决定 lite 插件的视觉策略：是否以及多大程度向 DSH 原生设计语言对齐。

## 真实方向与评价

- 方向 A（皮肤级重写）：保留组件结构与内联样式架构，只做 token 映射、圆角/间距归一、少量控件换 primitives 原子（Button/Pill/Tooltip 等）。diff 局部、逻辑零回归风险，视觉即可达"原生感"。
- 方向 B（组件级重写）：用 ui-primitives 重构 FrameGallery 与卡片结构。更彻底但 diff 大；帧选择状态与 hydration 时序都在这些组件内，回归风险高，且无谓扩大与上游的合并分叉。
- 方向 C（不动）：上游已消费 `dsw-alias` token，现状不违和，美化属收益递减。

## 最终决定

采用方向 A。理由：以最小 diff 拿到原生视觉，内核零风险；两条硬边界——不改组件结构与状态逻辑（grant 解析、帧选择、hydration 时序），不样式化 SDK 画布内部（那是被预览的产品本身，非本插件 UI）。执行时机：功能验收全部通过之后单独一步，不与去编辑器重构同批，避免回归定位困难。

## 直接后果

- `requirements.md` 新增 R-11（原生视觉对齐的范围与边界）与 AC-11（无硬编码 hex 可 grep 机判 + 视觉一致性与交互回归检查）。
- `technical-details/deployment.md` 迭代顺序新增视觉对齐步骤（功能验收后、fork 钉 ref 前）。
- 波及文档：本主题 `requirements.md`、`technical-details/deployment.md`、`README.md`（状态区）、本决策。

## 重访条件

- 换皮实施中拿到"皮肤级达不到原生感"的具体证据（如 primitives 原子无法表达某部件）时，再评估是否升级方向 B；
- DSH 平台 token 体系或 `dsh-client-ui-primitives` 发生实质变更时；
- 未来需要从上游合并大规模 UI 变更时，重估换皮 diff 对合并的影响。
