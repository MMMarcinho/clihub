# clihub 阶段路线图

本文档把 [SPEC.md](./SPEC.md) 的范围拆成可以逐步交付的阶段。每个阶段都应该是一个可运行、可演示的形态，而不是半成品。

## Phase 0（已实现）：能跑起来的骨架

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

## Phase 1（已实现）：数据流打通

**功能范围**：

- `capture` 支持 `format: text | json | lines`，支持简写（`capture: name`）。
- `capture.select` 支持简单字段路径提取。
- `assign` 支持用模板生成中间变量，允许 step 只有 `assign` 没有 `run`。
- 模板引用扩展到 `{{steps.id.stdout/stderr/exitCode/parsed.path}}`、`{{captures.name}}`、`{{captures.name.path}}`、`{{vars.name}}`。
- `clihub doctor <workflow>`：检查所需工具是否存在、必填输入是否有默认值。目录条件和鉴权状态检查留给 Phase 2（当前 workflow schema 里还没有声明这两类条件的字段）。

**预期效果**：能写出 SPEC 示例里 `create-pr-summary` 这种真正有"上一步结果喂给下一步"的 workflow，不再需要在 `run` 字符串里手写 `$(...)` 拼接。

**实现说明**：

- `run` 模板渲染时，插值一律经过 shell 单引号转义（`shellQuote`），即使值来自上一步的 `capture`/`assign`，也不会被解释成额外的 shell 语法。`assign` 生成变量时不转义（生成的是纯文本变量），转义只发生在这段文本最终被插入某个 `run` 命令的那一刻。
- `capture.format: json` 解析失败时，该 step 视为失败，工作流按"失败即停"规则终止，不会静默吞掉解析错误。

## Phase 2（已实现）：Agent 友好 + 安全模型

**功能范围**：

- `clihub explain <workflow>`：不执行，展示 workflow 的 inputs/requires/permissions、每个 step 的命令模板（未渲染 `{{steps.*}}`/`{{captures.*}}`/`{{vars.*}}`，因为那些值只有真正执行才知道）、以及 step 间的数据依赖图（通过扫描 `capture.as`/`assign` 的归属 step 反推依赖）。
- `list` / `show` / `doctor` / `run` / `explain` 支持 `--json` 输出。
- `run --dry-run`：复用 explain 的依赖图逻辑，额外把已解析的 `{{inputs.x}}` 代入展示（因为 `run` 场景下 inputs 已知），但同样不渲染 step 间数据引用。
- `permissions` 声明（network/filesystem/credentials/destructive）的解析，并在 `show`/`explain` 中展示。当前只是声明和展示，不做运行时沙箱强制执行（与 SPEC 第一阶段范围一致）。
- 命令执行改为参数化：`run` 步骤实际执行时，模板引用不再被拼接成字面 shell 文本，而是导出成环境变量、在命令里用 `"$VAR"` 引用。Shell 展开环境变量的内容时不会把其中的引号、`;`、`$(...)`、反引号重新解释成语法，从而消除了此前"单引号转义"方案在理论上仍然存在的边缘风险。人类可读的展示命令（`show`/`explain`/`run` 进度输出/`StepResult.command`）仍然保持完整可读，不受影响——"命令必须可检查、不能隐藏魔法"这条设计原则没有被参数化牺牲掉。
- 用户级 hub（`~/.clihub/workflows`）：`clihub init --user` 初始化；`list`/`show`/`explain` 通过 `hub: "project" | "user"` 字段标注 workflow 来源；同名 workflow 项目级优先（用户级同名版本会被过滤掉，不出现在 `list` 里）。

**预期效果**：workflow 可以安全地被 Agent 发现、审查（`explain`/`doctor`）、以结构化方式调用（`--json`），`run` 的实际执行路径不再把上一步任意输出当作 shell 语法解析，且个人常用 workflow 可以放在 `~/.clihub` 里跨项目复用，不与项目级 workflow 冲突。

## Phase 3（部分实现）：留给未来的能力

SPEC.md 中被显式列为"第一版可以暂缓"的能力，按需逐个补：

**已实现**：

- 持久化 run history：SPEC 第 7 节把 `.clihub/runs/<run-id>.json` 预留为存储位置，MVP 阶段只打印 trace、不落盘。现在 `clihub run`（非 `--dry-run`）执行完成后会把完整 trace（workflow、hub、inputs、每个 step 的 `stdout`/`stderr`/`exitCode`/`durationMs`、整体 `success`）写入该路径；新增 `clihub runs [--json]` 列出历史记录（id、workflow、成功与否、开始时间、耗时），对应 SPEC 第 4 节 "Run" 概念里"一次 run 应该能回答"的那组问题。持久化失败（比如没有写权限）只打印警告，不影响 workflow 本身的执行结果和退出码。

**尚未实现**：

- 远程/导入 hub、并行 step、更复杂的表达式语言、密钥管理、retry/resume、图形界面。

---

Phase 0、Phase 1、Phase 2 均已实现；Phase 3 目前实现了持久化 run history。
