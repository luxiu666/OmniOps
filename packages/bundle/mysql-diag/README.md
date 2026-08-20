# dsh-mysql-diag

MySQL 慢查询诊断 bundle：让 dsh 获得「慢查询分析」skill，并自动拉起 `mysql-diag-mcp`（stdio）。

## 提供什么

- **skill** `mysql-slow-query-analysis`：慢 SQL 排查方法论（找 Top SQL → EXPLAIN → 表结构/索引 → 归因 → 建议）。
- **MCP 工具**（`mcp__mysql_diag__*`）：
  - `list_slow_queries` —— 用 pt-query-digest 分析慢日志目录，返回 Top N 报告；
  - `explain_query` —— EXPLAIN FORMAT=JSON 执行计划；
  - `inspect_schema` —— 表结构 + 索引 + 数据量。

## 前置条件

1. 安装 MCP server（提供 `mysql-diag-mcp-stdio` 可执行文件）：
   ```sh
   npm install -g mysql-diag-mcp
   # 或本地：
   cd connectors/mysql-diag-mcp && pnpm install && pnpm build && npm link
   ```

2. 准备慢日志目录（`MYSQL_SLOW_LOG_DIR`）与连库凭据（`MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DATABASE`）。启动 dsh 时带上这些环境变量即可，bundle 会把它们透传给 MCP server 子进程。

## 安装 bundle

方式一（推荐，装到某个 profile）：
```sh
dsh plugin --profile web add @deepseek-ai/dsh-mysql-diag
```

方式二（手动加到 profile 的 `package.json`）：
```jsonc
{
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-mysql-diag"]
    }
  }
}
```

## 使用

带上环境变量启动 dsh，然后在首页选「数据库 → MySQL → 慢查询分析」：

```sh
MYSQL_USER=xxx MYSQL_PASSWORD=xxx MYSQL_DATABASE=omniops \
MYSQL_SLOW_LOG_DIR=/usr/local/mysql/data \
dsh --profile web
```

输入：
> 帮我分析 127.0.0.1:3306 的慢查询，时间段：2026-08-19 10:00:00 到 2026-08-19 23:00:00

## 注意

- **skill 目录解析**：bundle 里 `skill-filesystem` 的 `customSkillDirs` 用 `createRequire` 按包名解析本 bundle 的 `skills/` 目录。若你的安装方式（如全局 link）导致解析失败，可自行在 profile 的 `cordis.patch.yml` 里覆盖 `skill-filesystem.config.customSkillDirs`，指向 bundle 内 `skills/` 的绝对路径。
- **慢日志权限**：MCP server 以 dsh 的启动用户身份读慢日志目录，需保证该用户对慢日志目录/文件有读权限（MySQL 默认 `_mysql:640` 需授权）。
- **pt-query-digest**：需预先安装（路径可用 `PT_QUERY_DIGEST` 覆盖，默认 `/usr/local/mysql/bin/pt-query-digest`）。
