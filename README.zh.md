# OmniOps

[English](README.md) | 中文

**OmniOps** 是公司级的 AIOps 智能运维平台，专注于全技术栈的问题快速诊断。

它基于开源的 [DeepSeek Harness](https://deepseek.com) 智能体框架构建——该框架采用**一切皆插件**的架构，由 [Cordis](https://github.com/cordiverse/cordis) 驱动——并在其之上扩展为一套运维诊断工具集。其「技术栈 → 组件 → 诊断技能」三级联动的诊断范围，覆盖数据库死锁、大 Key 检测、GPU 显存/利用率、掉卡检测等场景，帮助工程师快速定位并解决故障。

## 开发者预览

OmniOps 目前处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

---

## MySQL 慢查询诊断：快速启动

> 说明如何从源码把「MySQL 慢查询分析」功能跑起来，供 `git clone` 之后照做。

该功能由**两个独立组件**组成，缺一不可：

| 组件 | 位置 | 是什么 |
|---|---|---|
| MCP server | `connectors/mysql-diag-mcp/` | 独立 Node 进程，负责调 pt-query-digest / EXPLAIN / 查表结构 |
| skill + 配置 | `skills/mysql-slow-query-analysis/` | 慢 SQL 排查方法论，以及让 dsh 认识它的配置 |

### 前置条件

- **Node.js** `^22.19.0` 或 `>=24.0.0`（见根 `package.json` 的 `engines`）
- **pnpm**（项目用 `pnpm@11.x`）
- **MySQL** 数据库（诊断目标），且已开启慢查询日志
- **pt-query-digest**（Percona Toolkit，默认路径 `/usr/local/mysql/bin/pt-query-digest`，可用环境变量覆盖）

### 启动步骤

#### 1. clone 并装依赖

```sh
git clone https://github.com/luxiu666/OmniOps.git
cd OmniOps
pnpm install
```

#### 2. 起 MCP server（⚠️ 独立进程，不是 `pnpm dsh` 自带的）

这是**最容易漏掉的一步**：`pnpm dsh web` 只会启动 Web UI，**不会**启动慢查询诊断服务，必须单独起。

```sh
cd connectors/mysql-diag-mcp
pnpm install                    # 该子项目不在根 workspaces 里，需单独装依赖
cp .env.example .env            # 复制模板
# 编辑 .env，填入真实值（.env 已被 gitignore，不会提交）
pnpm build                      # tsc 编译出 dist/
pnpm start                      # 起 streamable-http server
```

`.env` 六个变量：

```env
MYSQL_USER=你的数据库用户
MYSQL_PASSWORD=你的密码
MYSQL_DATABASE=你的默认库
MYSQL_SLOW_LOG_DIR=/usr/local/mysql/data          # 慢日志「目录」（不是单个文件）
PT_QUERY_DIGEST=/usr/local/mysql/bin/pt-query-digest
MCP_HTTP_PORT=8080
```

看到 `mysql-diag-mcp 监听 http://127.0.0.1:8080/mcp` 即启动成功。

> **慢日志目录权限**：MySQL 默认用 `_mysql` 用户、640 权限创建慢日志，普通用户读不了（会报 `EACCES` / `Permission denied`）。需授权一次：
> ```sh
> sudo chmod 644 /usr/local/mysql/data/*-slow.log*
> ```
> `MYSQL_SLOW_LOG_DIR` 指向的是**目录**，server 会按时间段自动挑选其中的慢日志文件复制到临时目录分析，不写死文件名、不动原目录。

#### 3. 配置 dsh，让它认识这个功能（⚠️ 需手动做）

这一步说白了就是「告诉 dsh 去哪找这个功能」。dsh 是插件化的，默认不认识慢查询分析，你得在它的配置文件里登记两件事——**① 分析方法（skill）放在哪个目录，② 后台服务（MCP server）连哪个地址**。因为一键安装包（bundle）还没发到 npm，没法自动完成，所以要手动写一次。

先让 dsh 生成 profile（跑一次即可，看到界面后退出）：

```sh
cd /Users/你/OmniOps        # 回到仓库根目录
pnpm dsh web
# 看到 Web UI 后 Ctrl+C 退出
```

然后编辑 `~/.dsh/profiles/web/cordis.patch.yml`（不存在就新建），写入以下两段，**把 `<你的clone路径>` 换成实际路径**：

```yaml
# 1) 重新启用 skill-filesystem 并指向本仓库的 skills 目录
#    （web profile 默认会 disable 掉 host 的 skill-filesystem，必须加 disabled: false）
- id: skill-filesystem
  disabled: false
  config:
    customSkillDirs:
      - <你的clone路径>/OmniOps/skills

# 2) 接入 mysql-diag MCP server（streamable-http）
- insert:
    - id: mysql-diag
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: mysql_diag
        transport: streamable-http
        url: http://127.0.0.1:8080/mcp
        headers: {}
```

> ⚠️ `url` 里的端口必须和 `.env` 里的 `MCP_HTTP_PORT` 一致（默认都写 8080）。

#### 4. 启动 dsh 并验证

保持第 2 步的 MCP server 在跑，另开终端：

```sh
cd /Users/你/OmniOps
pnpm dsh web
```

验证配置是否生效（能列出 `mysql-diag` 这一行即成功）：

```sh
pnpm dsh web --dump-config | grep -A5 "id: mysql-diag"
```

### 使用

1. 打开 Web UI（默认 `http://127.0.0.1:3080`）；
2. 首页下拉选 **数据库 → MySQL → 慢查询分析**；
3. 输入任务，例如：

> 帮我分析 127.0.0.1:3306 的慢查询，时间段：2026-08-19 10:00:00 到 2026-08-19 23:00:00

模型会自动 invoke `mysql-slow-query-analysis` skill，依次调用 `list_slow_queries`（慢日志分析）→ `explain_query`（执行计划）→ `inspect_schema`（表结构/索引），最后给出诊断报告。**不需要在对话里提供数据库密码**——密码在 MCP server 进程的 `.env` 里。

### 常见问题

| 现象 | 原因 | 解决 |
|---|---|---|
| 模型没调工具，反而用 Bash 跑 `mysql`/`pt-query-digest` 还问密码 | skill 或 MCP 工具没注册 | 确认第 3 步 `cordis.patch.yml` 写对、`pnpm dsh` 重启过 |
| `pt-query-digest 执行失败 … DBD::mysql` | 慢日志文件不可读（640 `_mysql`） | `sudo chmod 644` 慢日志文件 |
| `Access denied for user ...` | server 的 `.env` 凭据不对 | 核对 `MYSQL_USER/PASSWORD/DATABASE` |
| dump-config 里 `skill-filesystem` 是 `disabled: true` | 漏了 `disabled: false` | 按第 3 步补上 |

### 参考文档

- 完整开发指南：[docs/specs/mysql-slow-query-analysis-guide.md](docs/specs/mysql-slow-query-analysis-guide.md)
- 设计说明：[docs/specs/mysql-slow-query-analysis.md](docs/specs/mysql-slow-query-analysis.md)
- MCP server 说明：[connectors/mysql-diag-mcp/README.md](connectors/mysql-diag-mcp/README.md)
- bundle 包：[packages/bundle/mysql-diag/](packages/bundle/mysql-diag/)
