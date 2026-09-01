# dsh-openpencil-lite 技术细节

## 权威范围

本文唯一拥有 `dsh-openpencil-lite` 技术细节的阅读顺序与各机制文档的权威范围。机制事实归 `technical-details/` 各文档，需求与约束归 `requirements.md`，选型理由归 `decisions/`。

## 阅读顺序

1. `refactor-scope.md`：先看相对上游的改造范围与插件标识。
2. `headless-apply.md`：核心新机制——无头 apply 的契约与写回语义。
3. `better-sidebar-preview.md`：侧边栏预览的接入与刷新。
4. `deployment.md`：发布形态与验证顺序。

## 文档地图

| 文档 | 唯一权威范围 |
|---|---|
| `refactor-scope.md` | 相对上游的删除/保留/新增清单、包/插件/路由/工具标识与历史回放边界 |
| `headless-apply.md` | `openpencil_apply` 工具机制、临时 daemon 生命周期、写回与冲突语义、失败处理 |
| `better-sidebar-preview.md` | 侧边栏预览 tab、`.op` 文件查看器与"预览 PNG"蒙版的注册、数据来源、刷新与降级语义 |
| `deployment.md` | 发布形态、web 部署红线、迭代与验收顺序 |
