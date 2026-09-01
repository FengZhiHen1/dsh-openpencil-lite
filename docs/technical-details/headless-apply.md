# dsh-openpencil-lite 无头 apply 机制

## 权威范围

本文唯一拥有 `openpencil_apply` 工具的需求追溯、输入输出契约、临时 daemon 生命周期、写回与冲突语义及失败处理。标识与删除清单归 `refactor-scope.md`，需求归 `requirements.md`。

## 结论先行

`openpencil_apply` 让 Agent 在没有打开任何编辑器的情况下，对一个**已存在**的 `.op` 文件执行交易性 `batch_design` 并把结果原子写回原路径（`saved:true`），消除上游"改画布必须用户点 Save"的断点。它复用 `openpencil_new` 已有的临时 daemon 机制，仅把"启动空稿"改为"载入现有文件"；写回经 DSH 文件系统能力的 `replaceIfVersion` 守卫写入完成，源文件在批次期间被外部改动即冲突拒绝。

## 现状证据

- `openpencil_new` 已在生产路径实现：临时 daemon（`--serve-web --managed --port 0 --file <临时空稿>`）→ MCP `batch_design` → 读取权威文档 → 经 `services.fs.writeText(..., { kind: 'createIfAbsent' }, ..., sandboxPolicy)` 落盘并 `services.observe`；沙箱 read-only 模式直接拒绝写入。本机实测成功（2026-08-19）。
- `@deepseek-ai/dsh-fs` 的 `writeText` 支持 `{ kind: 'replaceIfVersion', version }` 守卫写入：版本不匹配以 `FS_STALE_VERSION` 拒绝且不产生任何写入——平台已具备写回所需的乐观并发语义，本设计直接消费，不自造第二套防线。
- 上游 `openpencil_edit` 的乐观哈希防线（启动时读取源 sha256，mutation 前比对，外部改动即报错）证明同一冲突语义在编辑器路径已存在；无头路径的对应语义由平台 `replaceIfVersion` 承担。
- `.op` 单文件 JSON 是唯一事实源；`openpencil_render` 只从磁盘渲染，可作为写回后的验证手段。

## 输入输出契约

输入（与 `openpencil_new` 对齐，差异为"目标必须已存在"）：

```text
path: string            # .op 路径（工作区相对或绝对），必须已存在且解析后以 .op 结尾
operations: string      # 换行分隔 batch_design 程序（I/U/D/M/C/R/G）
pageId?: string         # 缺省使用文档活动页
canvasWidth?: number    # post-process 画布宽度提示
postProcess?: boolean   # 是否运行 OpenPencil post-processing
```

输出（模型可见结果）：

```text
path, filename, bytes, sha256   # 写回后文件事实
applied: true, saved: true      # 无头语义：Agent 即保存者
nodeCount: number               # 变更后节点数
result: { results, nodeCount有则含 }   # daemon 的批量结果透传
note                            # 已写回；引导：建议 openpencil_render 看图验证，后续修改尽量合并为单批次再 apply
```

单节点改动用 batch 的 `U(nodeId, patchJson)` 表达；`openpencil_selection`/`openpencil_edit` 已删除，其需求由"纯 JSON 编辑"或上述 U 操作覆盖。

## 引导职责

工具描述与 `note` 承担两条 Agent 引导：本轮修改尽量合并为一个 batch（每次 apply 冷启动一个 daemon，零碎单操作批次会放大延迟）；每轮改稿后以 `openpencil_render` 看图自查。"apply 还是纯 JSON"的完整路径选择引导归 `openpencil-prototype` skill 文案，随实现同批更新（requirements R-10）。

## 执行流程

1. 解析路径并断言为已存在的常规 `.op`；沙箱 read-only 模式直接报错（与 `openpencil_new` 一致）；目标必须解析到本地工作区内的主机路径。
2. 经 `services.fs` 观察源文件（`stat` + `observe`），记录当前版本 `V0`；同时记录 `源哈希 = sha256(源字节)` 作为输出事实。
3. 在临时目录写入源文件副本（非原地启动 daemon，避免 daemon 覆盖源文件）。
4. 启动临时 daemon（`--file 副本`），等待握手与就绪。
5. 记录 `beforeVersion`，调用 MCP `batch_design`，记录 `afterVersion`；`afterVersion <= beforeVersion` 视为应用失败。
6. 读取 daemon 的权威文档 JSON 与版本。
7. 经 `services.fs.writeText(目标, 权威文档 JSON, { kind: 'replaceIfVersion', version: V0 }, sandboxPolicy)` 写回：返回 `FS_STALE_VERSION` 即源文件在批次期间被外部改动 → 冲突错误，不产生任何写入；成功后 `services.observe` 写后版本，并据写回内容计算输出 sha256。
8. 结束子进程并清理临时目录；任一步失败均不留下半写文件。

## 保持的不变量

- 写回原子且内容寻址可校验（输出 sha256 与写回字节一致）。
- 写回只经 DSH 文件系统能力完成：沙箱策略（read-only 拒绝）与文件观察（`observe`）和 Agent 普通文件工具一致，不在平台之外另开写入通道。
- 源文件在批次执行期间被外部改动时绝不覆盖（平台 `replaceIfVersion` 拒绝优先）。
- 每次 apply 一个独立临时 daemon，结束后必须停止并清理，不残留子进程。

## 失败语义

| 失败面 | 行为 |
|---|---|
| daemon 二进制不可用 | `openpencil_apply` 报明确错误（环境依赖缺失），不写文件 |
| 沙箱 read-only / 目标不可写 | 与 `openpencil_new` 一致的明确错误，不写文件 |
| 目标不在本地工作区 | 报明确错误（本地 daemon 无法访问该路径），不写文件 |
| `batch_design` 部分/全部失败 | 返回错误，无任何写回 |
| 版本号未递增 | 返回"报告成功但未产生文档变更"错误 |
| 源文件外部改动 | `replaceIfVersion` 返回 `FS_STALE_VERSION` → 冲突错误（含提示：先重读文件再决定），不写回 |
| 写回途中中断 | 平台写回原子生效，旧文件不变；临时副本与 daemon 被清理 |
| 超时/取消 | 停止子进程并清理临时目录 |

## 验证方式

- 验收对应 requirements `AC-02`（无头闭环：new → apply 多操作 → render 文件均落盘）与 `AC-03`（apply 期间外部改动 → 冲突不覆盖）。
- `missing evidence`：daemon 以"已存在非空文档"启动时 `batch_design` 的前后版本递增与权威文档读取行为未实测，实现后先补一条空/非空文档双路径验证。
