# clihub 阶段路线图

本文档把 [SPEC.md](./SPEC.md) 的范围拆成可以逐步交付的阶段。每个阶段都应该是一个可运行、可演示的形态，而不是半成品。

## Phase 0（本次实现）：能跑起来的骨架

**目标**：验证核心闭环——定义 workflow → 发现 workflow → 执行 workflow → 看到结果。不追求数据流、不追求 Agent 契约，先把"用 YAML 描述一条 CLI 调用链并顺序执行"跑通。

**功能范围**：

- `clihub init`：创建 `.clihub/workflows/` 目录。
- `clihub list`：发现并列出项目级 workflow（名称 + 描述）。
- `clihub show <workflow>`：打印 workflow 的输入定义和步骤。
- `clihub run <workflow> [--input k=v]`：
  - 校验必填输入。
  - 检查 `requires.tools` 声明的工具是否存在。
  - 渲染 `{{inputs.x}}` 模板。
  - 顺序执行每个 step，记录 `stdout`/`stderr`/`exitCode`/`durationMs`。
  - 遇到失败即停止（除非 `continueOnError: true`）。
  - 打印人类可读的执行过程。

**明确不做**：`capture`/`select`/`assign` 数据流、`doctor`、`explain`、`--json` 输出、用户级 hub、权限声明。

**预期效果**：能写一个多步骤 workflow（哪怕步骤之间还不能传数据），用 `clihub run` 跑起来，看到每一步是否成功、输出了什么。这一步的价值是把"顺序执行 + 显式声明"这个最小闭环立住。

## Phase 1：数据流打通

**功能范围**：

- `capture` 支持 `format: text | json | lines`，支持简写（`capture: name`）。
- `capture.select` 支持简单字段路径提取。
- `assign` 支持用模板生成中间变量。
- 模板引用扩展到 `{{steps.id.stdout/stderr/exitCode/parsed.path}}`、`{{captures.name}}`、`{{captures.name.path}}`、`{{vars.name}}`。
- `clihub doctor <workflow>`：检查工具、必填输入、目录条件、鉴权状态。

**预期效果**：能写出 SPEC 示例里 `create-pr-summary` 这种真正有"上一步结果喂给下一步"的 workflow，不再需要在 `run` 字符串里手写 `$(...)` 拼接。

## Phase 2：Agent 友好 + 安全模型

**功能范围**：

- `clihub explain <workflow>`：不执行，展示将要运行的命令和 step 间数据依赖。
- `list` / `show` / `doctor` / `run` 支持 `--json` 输出。
- `permissions` 声明（network/filesystem/credentials/destructive）的解析与展示。
- `run` 支持 `--dry-run`。
- 命令执行改为参数化（避免把 capture 出来的任意文本拼进 shell 字符串导致注入）。
- 用户级 hub（`~/.clihub`），同名 workflow 项目级优先。

**预期效果**：达成 SPEC 第 11 节列出的完整 MVP 范围，workflow 可以安全地被 Agent 发现、审查（explain/doctor）、并以结构化方式调用（--json）。

## Phase 3：留给未来（本次不规划实现）

远程/导入 hub、并行 step、更复杂的表达式语言、密钥管理、持久化 run history、retry/resume、图形界面。这些在 SPEC.md 中被显式列为"第一版可以暂缓"。

---

本次提交实现 **Phase 0**。
