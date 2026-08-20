# mysql-diag-mcp

MySQL 慢查询诊断 MCP server，提供三个工具，支持 **stdio** 与 **streamable-http** 两种 transport。

## 工具

| 工具 | 作用 | 数据来源 |
|---|---|---|
| `list_slow_queries` | 分析慢日志目录，返回 Top N 慢 SQL 报告 | pt-query-digest（不连库） |
| `explain_query` | EXPLAIN FORMAT=JSON 执行计划 | mysql2 直连 |
| `inspect_schema` | 表结构 + 索引 + 数据量 | information_schema |

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `MYSQL_USER` | 是 | 连库用户 |
| `MYSQL_PASSWORD` | 是 | 连库密码 |
| `MYSQL_DATABASE` | 是 | 默认库（可从报告的 `# Databases` 字段覆盖） |
| `MYSQL_SLOW_LOG_DIR` | 是 | 慢日志**目录**（含轮转文件，会自动按时间段挑文件并复制到临时目录分析） |
| `PT_QUERY_DIGEST` | 否 | pt-query-digest 路径，默认 `/usr/local/mysql/bin/pt-query-digest` |
| `MCP_HTTP_HOST` / `MCP_HTTP_PORT` | 否 | 仅 streamable-http 用，默认 `127.0.0.1:8080` |

## 构建

```sh
pnpm install
pnpm build
```

## 运行

### stdio（推荐，给 dsh 用）

```sh
# 作为 dsh 的 mcp-client stdio 子进程，凭据经 env 注入
mysql-diag-mcp-stdio
# 或本地： node dist/stdio.js
```

### streamable-http（独立常驻 / 跨机器）

```sh
cp .env.example .env   # 填好环境变量
pnpm start
# 监听 http://127.0.0.1:8080/mcp（可用 MCP_HTTP_PORT 改端口）
```

## 注意

- **慢日志权限**：进程以当前用户身份读慢日志目录，需有读权限（MySQL 默认 `_mysql:640`）。
- **轮转文件**：`list_slow_queries` 会按时间段（mtime）粗筛 + pt-query-digest `--since/--until` 精确过滤，无需指定单个文件。
