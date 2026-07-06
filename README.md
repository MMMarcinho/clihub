# clihub

`clihub` 是一个 local-first 的 CLI 工作流中心。

它把稳定的多 CLI 调用链沉淀成命名的、可复用的 workflow：

```bash
cli1 xxx
cli2 xxxx
cli3 xxxxxx
```

变成：

```bash
clihub run <workflow>
```

目标是把有价值的 CLI 编排经验沉淀为项目级或个人级长期资产，而不是散落在临时脚本里。

`clihub` 不只是顺序执行命令，也应该支持捕获上一步 CLI 的输出，经过解析、提取或整理后传给下一步。

初版产品规格见 [SPEC.md](./SPEC.md)，分阶段落地计划见 [ROADMAP.md](./ROADMAP.md)。

## 当前实现状态：Phase 0 + Phase 1 + Phase 2（除用户级 hub）

当前代码实现了：

- 顺序执行 workflow 的最小闭环（模板渲染、必填输入校验、`requires.tools` 检查、`stdout`/`stderr`/`exitCode` 记录、失败即停）。
- 显式数据流：`capture`（`text`/`json`/`lines` + `select` 字段提取）、`assign` 中间变量、`{{steps.*}}`/`{{captures.*}}`/`{{vars.*}}` 模板引用。
- `clihub doctor <workflow>`：检查所需工具和必填输入。
- `clihub explain <workflow>`：不执行，展示 inputs/requires/permissions、每个 step 的命令和 step 间数据依赖图。
- `run --dry-run`：同样不执行，额外把已知的 `--input` 值代入展示。
- `list`/`show`/`doctor`/`run`/`explain` 都支持 `--json`。
- `permissions` 声明（`network`/`filesystem`/`credentials`/`destructive`）的解析与展示。
- 实际执行 `run` 时，模板引用通过环境变量间接传递（而不是把值直接拼进 shell 命令字符串），即使某一步的输出包含引号、`;`、`$(...)`、反引号，也不会被当作额外的 shell 语法执行。

尚未实现用户级 hub（`~/.clihub`，见 ROADMAP.md Phase 3）。

## 安装与构建

```bash
npm install
npm run build
```

## 使用

```bash
# 在项目根目录初始化 .clihub/workflows
node dist/cli.js init

# 列出可用 workflow
node dist/cli.js list

# 查看某个 workflow 的输入和步骤
node dist/cli.js show <workflow>

# 运行 workflow，可重复传入 --input
node dist/cli.js run <workflow> --input key=value

# 运行前体检：检查工具和必填输入
node dist/cli.js doctor <workflow>

# 解释 workflow 会做什么，但不执行
node dist/cli.js explain <workflow>

# 演练：展示将要执行的命令和数据依赖，但不执行
node dist/cli.js run <workflow> --dry-run

# 以上命令都支持 --json（例如喂给 Agent 解析）
node dist/cli.js list --json
node dist/cli.js show <workflow> --json
node dist/cli.js doctor <workflow> --json
node dist/cli.js run <workflow> --json
node dist/cli.js explain <workflow> --json
```

workflow 文件示例（`.clihub/workflows/greet.yaml`）：

```yaml
name: greet
description: Print a greeting.

inputs:
  name:
    description: Who to greet.
    required: true

requires:
  tools:
    - echo

steps:
  - id: hello
    run: echo "Hello, {{inputs.name}}!"
```

```bash
node dist/cli.js run greet --input name=World
```

带数据流的 workflow 示例（`capture` 把上一步的输出解析、提取，喂给下一步）：

```yaml
name: create-pr-summary
description: Collect issue and commits, then assemble a PR body.

steps:
  - id: issue
    run: echo '{"title":"Fix bug","body":"desc"}'
    capture:
      as: issue
      format: json
      select:
        title: title
        body: body

  - id: commits
    run: printf 'commit1\ncommit2\n'
    capture:
      as: commits
      format: lines

  - id: pr-body
    assign:
      prBody: |
        ## Issue
        {{captures.issue.title}}

        ## Changes
        {{captures.commits}}

  - id: summary
    run: echo {{vars.prBody}}
```

```bash
node dist/cli.js run create-pr-summary
```

`permissions` 声明示例（目前只做解析和展示，不做运行时强制沙箱）：

```yaml
permissions:
  network: true
  filesystem:
    read: true
    write: false
  credentials:
    - github
  destructive: false
```
