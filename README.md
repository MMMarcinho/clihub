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

## 安装与构建

```bash
npm install
npm run build
```

## 使用

```bash
# 在项目根目录初始化 .clihub/workflows
node dist/cli.js init

# 初始化用户级 hub（~/.clihub/workflows），跨项目复用个人 workflow
node dist/cli.js init --user

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

# 列出历史执行记录
node dist/cli.js runs

# 以上命令都支持 --json（例如喂给 Agent 解析）
node dist/cli.js list --json
node dist/cli.js show <workflow> --json
node dist/cli.js doctor <workflow> --json
node dist/cli.js run <workflow> --json
node dist/cli.js explain <workflow> --json
node dist/cli.js runs --json
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

带并行执行的 workflow 示例（一个 step 用 `parallel:` 声明一组并发执行的子 step，之后的 step 可以引用任意一个子 step 产生的 capture）：

```yaml
name: parallel-fetch
description: Fetch two things concurrently, then combine.

steps:
  - id: fetch
    parallel:
      - id: fetch-a
        run: curl -s https://example.com/a
        capture: a
      - id: fetch-b
        run: curl -s https://example.com/b
        capture: b

  - id: combine
    run: echo {{captures.a}}-{{captures.b}}
```

```bash
node dist/cli.js run parallel-fetch
```

注意：`parallel` 只支持一层嵌套（子 step 不能再有自己的 `parallel`），组内子 step 之间不能互相引用彼此的结果——它们没有确定的执行顺序，互相引用会在运行时报错而不是读到不确定的值。

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

## 项目级 hub 与用户级 hub

`clihub` 同时支持两类 workflow 来源：

- 项目级：`.clihub/workflows`（提交到仓库，团队共享）。
- 用户级：`~/.clihub/workflows`（跨项目复用个人 workflow，用 `clihub init --user` 创建）。

`list`/`show`/`explain` 会在结果里标注每个 workflow 来自哪个 hub（`hub: "project" | "user"`）。如果两边有同名 workflow，项目级优先，用户级的同名版本不会出现在解析结果里。

## Run history

每次 `clihub run`（`--dry-run` 除外）执行完成后，会把完整的执行记录写入 `.clihub/runs/<run-id>.json`：workflow 名称、使用的 inputs、每个 step 的 `stdout`/`stderr`/`exitCode`/`durationMs`，以及整体是否成功。用 `clihub runs` 查看历史记录列表，或直接打开对应的 JSON 文件看完整细节。
