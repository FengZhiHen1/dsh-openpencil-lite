# DSR-002：Agent 设计路径——无头 apply + 保留纯 JSON 编辑

## 决策

Agent 不打开 web 直接设计 `.op` 采用"无头 apply + 保留纯 JSON 编辑"双路径：新增 `openpencil_apply`（对已有 `.op` 跑 batch_design → 原子写回，`saved:true`），同时保留 Agent 用文件工具直接改 `.op` JSON 的可用纪律。用户于 2026-08-19 确认。

## 上下文

上游 `openpencil_create`/`openpencil_edit` 依赖已打开的活动编辑器，改动只写活画布、`saved` 恒为 `false`，落盘必须用户点 Save，是"Agent 设计"的断点。`.op` 是单文件 JSON、`openpencil_render` 只从磁盘渲染，因此纯 JSON 编辑本身已可工作（本机实测）；`openpencil_new` 已证明临时 daemon 无头跑 batch_design 的现实性。需要决定改造后"改稿"的工具形态。

## 真实方向与评价

- 方向 A（无头 apply + 保留纯 JSON）：新增一个工具覆盖批量改稿语义，批次结果规范化（id 重分配、文档权威化），写回即保存，去掉"用户 Save"断点；纯 JSON 编辑作为零成本逃生通道继续可用。代价：新增一个工具与一次 daemon 启动的开销，需要维护 batch 语法文档。
- 方向 B（仅纯 JSON 编辑）：零新代码，Agent 用 read/write/edit 直接改文件、render 验证；文档固化纪律。代价：无规范化（缺 `editorMeta` 等），id/z 序/文本居中靠模型自律，规模与结构风险自担。
- 方向 C（仅无头 apply）：一律走 batch，产出规范化。代价：放弃手写 JSON 的自由度，且要求无 install 环境也必须依赖 daemon（环境耦合更高）。

## 最终决定

采用方向 A。依据：直接满足"Agent 不打开 web 直接编辑 json op 做设计"，工具化路径降低结构风险，同时保留纯 JSON 的零成本灵活性；无头 daemon 在本机已实测可用，新增成本主要为一次启动开销（建议批量合并）。

## 直接后果

- 新增 `openpencil_apply` 工具（契约与失败语义见 `../technical-details/无头apply机制.md`）。
- 删除 `openpencil_selection`、`openpencil_create`、`openpencil_edit`；单节点改动用 batch 的 `U(nodeId, patchJson)` 或纯 JSON 编辑表达。
- `openpencil_render` 去掉 `editable`/`autoOpen` 编辑器语义；"预览入口"改由侧边栏 tab 承担。
- 波及文档：本主题 `../需求.md`（R-03/R-04 与 AC-02/AC-03/AC-07）、`../technical-details/改造范围与标识.md`、`../technical-details/无头apply机制.md`；`openpencil-prototype` skill 文案待工具集落地后同步。

## 重访条件

- 若本机/部署环境没有可用的 OpenPencil 托管 daemon，且目标用户以规范化为刚性要求时，重访方向 C 或降级"无头 apply 依赖不可用时明确报错 + 纯 JSON 兜底"的语义；
- 若 model 直接写 JSON 的结构错误率显著影响产出，重访是否把 apply 的规范化能力扩展为"保存前强制规范化"。
