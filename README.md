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

初版产品规格见 [SPEC.md](./SPEC.md)。
