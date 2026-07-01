# clihub 产品规格

## 1. 项目定位

`clihub` 是一个 local-first 的 CLI 工作流中心。

随着 CLI 工具越来越多，CLI 暴露出来的原子能力也越来越多。它们天然适合给人和 Agent 调用，但复杂目标往往不是一次 CLI 调用就能完成，而是需要把多个 CLI 稳定地串起来：

```bash
cli1 xxx
cli2 xxxx
cli3 xxxxxx
```

如果这条调用链是稳定的、可复用的，它就不应该长期散落在临时 shell、`run.js`、`script.py`、`Makefile` 或 Agent 每次临时生成的计划里。

`clihub` 要做的是把这类稳定调用链沉淀成命名的、可发现的、可解释的、可复用的工作流：

```bash
clihub run <workflow>
```

`clihub` 不替代已有 CLI，而是组织 CLI、编排 CLI，并把有价值的操作经验沉淀成长期资产。

## 2. 目标

- 用统一格式描述由多个 CLI 组成的工作流。
- 让人和 Agent 都能方便地发现、理解、运行和复用工作流。
- 把原本散落在脚本里的 CLI 编排逻辑沉淀为项目级或个人级资产。
- 支持项目级 workflow 和用户级 workflow。
- 显式声明输入、输出、依赖、权限、执行步骤和运行结果。
- 第一阶段保持足够简单，优先成为一个好用的本地开发工具。

## 3. 非目标

- 不重新实现已有 CLI 已经提供的领域能力。
- 不设计一门新的通用编程语言。
- 不把远程工作流服务作为第一阶段核心。
- 不隐藏真实执行的命令。
- 不让 Agent 只能通过猜测理解一个 workflow 会做什么。

## 4. 核心概念

### Tool

Tool 指已有的 CLI 可执行命令，例如：

- `git`
- `gh`
- `aizo`
- `codex`
- `board`
- `yuque`
- 项目内自定义 CLI

`clihub` 应该能在运行 workflow 前检查所需 tool 是否存在。

### Workflow

Workflow 是一个有名字的 CLI 编排单元，用一个或多个 tool 完成一个更高层目标。

Workflow 不只是顺序执行命令，还应该能描述命令之间的数据流：上一步 CLI 的结果可以被捕获、解析、提取、整理，然后作为下一步 CLI 的输入。

一个 workflow 应该包含：

- 稳定名称。
- 人类可读的描述。
- 输入定义。
- 执行步骤。
- 步骤之间的数据传递规则。
- 可选输出定义。
- 可选依赖和权限声明。
- 可追踪的执行日志。

### Result

Result 是每个 step 执行后的结构化结果。

基础 result 至少包含：

- `stdout`：标准输出。
- `stderr`：标准错误。
- `exitCode`：退出码。
- `durationMs`：执行耗时。
- `parsed`：可选，由 `clihub` 根据声明解析后的结构化结果。

后续 step 可以引用前面 step 的 result，例如：

```text
{{steps.issue.stdout}}
{{steps.issue.parsed.title}}
{{steps.issue.exitCode}}
```

### Capture

Capture 是从 result 中提取出来、准备给后续步骤复用的数据。

它解决的是这类问题：

```bash
cli1 xxx
cli2 --value "$(cli1 xxx 的处理结果)"
```

在 `clihub` 中应写成显式的数据流，而不是隐藏在 shell 拼接里。

Capture 可以是原始 stdout，也可以是 JSON 字段、行列表、模板整理后的文本，或者未来更复杂的处理结果。

### Hub

Hub 是 workflow 的集合。

第一阶段至少考虑两类 hub：

- 项目级 hub：存放在当前仓库中。
- 用户级 hub：存放在用户本机目录中。

未来可以扩展：

- 团队级 hub。
- 从 Git 仓库、包管理器或其他来源导入的 hub。

### Context

Context 是 workflow 运行时所处的上下文。

常见上下文包括：

- 当前工作目录。
- Git 仓库根目录。
- 环境变量。
- 项目配置。
- 用户默认配置。
- CLI 鉴权状态。

### Run

Run 是一次 workflow 的具体执行。

一次 run 应该能回答：

- 运行了哪个 workflow？
- 使用了哪些输入？
- 执行了哪些命令？
- 哪一步失败了？
- 产生了什么输出？

## 5. Workflow 定义格式

第一阶段优先使用 YAML。原因是它可读、容易手写、容易 diff，也适合作为项目资产提交到 Git。

示例：

```yaml
name: create-pr-summary
description: Collect issue and git context, then generate a pull request summary.

inputs:
  issue:
    description: GitHub issue number or URL.
    required: true
  base:
    description: Base branch used for commit comparison.
    default: origin/main

requires:
  tools:
    - git
    - gh

steps:
  - id: issue
    run: gh issue view {{inputs.issue}} --json title,body,labels
    capture:
      as: issue
      format: json
      select:
        title: title
        body: body
        labels: labels

  - id: commits
    run: git log --oneline {{inputs.base}}..HEAD
    capture:
      as: commits
      format: text

  - id: pr-body
    assign:
      prBody: |
        ## Issue
        {{captures.issue.title}}

        ## Changes
        {{captures.commits}}

  - id: summary
    run: some-summary-cli --body "{{vars.prBody}}"
    capture: summary

outputs:
  summary:
    from: captures.summary
```

### 必填字段

- `name`
- `description`
- `steps`

### Step 字段

- `id`：稳定的步骤标识。
- `run`：要执行的命令模板。命令步骤需要 `run`，纯 `assign` 步骤可以省略。
- `capture`：可选，将 step result 捕获成可复用数据。
- `assign`：可选，用模板或轻量表达式生成中间变量。
- `cwd`：可选，覆盖该步骤的工作目录。
- `env`：可选，为该步骤注入环境变量。
- `continueOnError`：可选，命令失败后是否继续。

### Capture 字段

`capture` 可以使用简写：

```yaml
capture: commits
```

等价于捕获 stdout 文本：

```yaml
capture:
  as: commits
  format: text
```

也可以显式声明解析和提取逻辑：

```yaml
capture:
  as: issue
  format: json
  select:
    title: title
    body: body
```

第一阶段建议支持的 `format`：

- `text`：保留 stdout 原文。
- `json`：将 stdout 解析为 JSON。
- `lines`：按行切分 stdout。

`select` 用于从解析后的结构中提取字段。第一阶段可以先支持简单路径，不引入复杂表达式语言。

### 数据引用

Workflow 中的模板至少应该能引用：

- `{{inputs.name}}`
- `{{steps.stepId.stdout}}`
- `{{steps.stepId.stderr}}`
- `{{steps.stepId.exitCode}}`
- `{{steps.stepId.parsed.path}}`
- `{{captures.name}}`
- `{{captures.name.path}}`
- `{{vars.name}}`

这样可以把“命令执行”和“结果传递”分开描述，避免把大量逻辑塞进一行 shell。

## 6. CLI 命令面

第一阶段命令：

```bash
clihub init
clihub list
clihub show <workflow>
clihub run <workflow> [--input value]
clihub doctor <workflow>
clihub explain <workflow>
```

### `clihub init`

初始化项目级 clihub 目录。

预期结构：

```text
.clihub/
  workflows/
```

### `clihub list`

列出当前项目和用户级 hub 中可用的 workflow。

### `clihub show <workflow>`

展示 workflow 元信息、输入、依赖、权限和步骤。

### `clihub run <workflow>`

使用具体输入运行 workflow。

预期行为：

- 按名称解析 workflow。
- 校验必填输入。
- 检查依赖 tool。
- 渲染步骤命令模板。
- 按顺序执行步骤。
- 记录每个 step 的 result。
- 按声明解析、提取和保存 capture。
- 渲染 assign 中定义的中间变量。
- 默认遇到失败即停止。
- 打印清晰的执行进度和最终输出。
- 输出或保存 run trace。

### `clihub doctor <workflow>`

检查当前环境是否满足 workflow 运行条件。

检查内容可以包括：

- 所需 CLI 是否存在。
- 必填输入是否已经提供或有默认值。
- 当前目录是否符合 workflow 要求。
- 需要鉴权的 CLI 是否已经登录。

### `clihub explain <workflow>`

解释 workflow 将会做什么，但不执行。

这对 Agent 很重要。Agent 在请求用户授权或运行敏感命令前，应该能先通过 `explain` 理解即将发生的事情。

## 7. 存储结构

项目级存储：

```text
.clihub/
  workflows/
    create-pr-summary.yaml
  runs/
    <run-id>.json
```

用户级存储：

```text
~/.clihub/
  workflows/
  config.yaml
```

MVP 可以先不持久化 run history，只把 trace 打印到 stdout。但目录设计应为后续持久化预留空间。

## 8. Agent 友好契约

每个 workflow 都应该在不执行的情况下被理解。

对 Agent 重要的字段：

- `description`：这个 workflow 解决什么问题。
- `inputs`：需要 Agent 提供哪些值。
- `requires`：需要哪些工具、权限、鉴权或网络访问。
- `steps`：会执行哪些命令。
- `captures` / `assign`：步骤之间如何传递和处理数据。
- `outputs`：会返回什么，或会改变什么。

面向 Agent 的 JSON 接口应该是一等能力：

```bash
clihub list --json
clihub show <workflow> --json
clihub doctor <workflow> --json
clihub run <workflow> --json
```

Agent 不应该只能解析人类可读的终端文本。

## 9. 安全模型

`clihub` 应该让执行行为尽可能显式。

基础安全能力：

- 执行前能展示即将运行的命令。
- 支持 dry-run。
- dry-run 时能展示数据依赖关系，即哪些 step 会消费前面 step 的结果。
- 标记 workflow 是否需要网络、文件写入、凭证或破坏性操作。
- 不静默吞掉命令失败。
- 保留足够日志用于调试。

权限声明示例：

```yaml
permissions:
  network: true
  filesystem:
    read: true
    write: true
  credentials:
    - github
  destructive: false
```

## 10. 配置和解析规则

Workflow 解析顺序：

1. 当前项目的 `.clihub/workflows`。
2. 用户目录的 `~/.clihub/workflows`。
3. 未来支持的 imported hub 或 remote hub。

如果多个 workflow 同名，项目级 workflow 优先。

输入解析顺序：

1. 命令行显式传入。
2. 项目配置。
3. 用户配置。
4. Workflow 默认值。

## 11. MVP 范围

第一版应该支持：

- `clihub init`
- 从 `.clihub/workflows` 发现项目级 workflow。
- YAML workflow 文件。
- 必填输入校验。
- 简单的 `{{inputs.name}}` 模板渲染。
- 顺序执行步骤。
- step result 记录：`stdout`、`stderr`、`exitCode`。
- `capture` 原始 stdout。
- `capture.format` 支持 `text`、`json`、`lines`。
- `capture.select` 支持简单字段路径。
- `assign` 支持基于模板生成中间变量。
- 后续 step 可以引用 `captures` 和 `vars`。
- 依赖 tool 检查。
- `list`、`show`、`doctor`、`run`、`explain`。
- 人类可读输出。
- `list`、`show`、`doctor` 的 JSON 输出。

第一版可以暂缓：

- 远程 hub 安装。
- 复杂表达式语言。
- 通用脚本运行时。
- 并行步骤执行。
- 密钥管理。
- 图形界面。
- 持久化 run history。
- retry/resume。

## 12. 典型场景

### PR 准备

组合 `git`、`gh` 和摘要工具，收集 commits、issue、changed files，并生成 PR 描述。

### 项目初始化

组合包管理器命令、环境检查、配置初始化、本地校验，形成可重复的 setup workflow。

### Agent 任务启动

组合需求读取、仓库上下文收集、记忆召回、分支创建，为 Agent 提供稳定的任务启动流程。

### 发布检查

组合测试、changelog 生成、版本更新、打 tag、发布前检查，形成可解释的 release workflow。

## 13. 设计原则

- 用显式 workflow 定义替代不透明脚本。
- 组合已有 CLI，而不是重写已有能力。
- 优先 local-first，不依赖远程服务。
- 命令必须可检查，避免隐藏魔法。
- 把稳定经验沉淀为资产，减少 Agent 反复临时规划。
- 先保持格式简单，等真实场景推动复杂度增长。
