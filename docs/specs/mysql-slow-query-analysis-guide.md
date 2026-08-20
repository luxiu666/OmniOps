# MySQL 慢查询分析 —— 开发操作手册（自研版）

> 目标读者：自己动手开发的同学。按 S1 → S7 顺序照做即可。
> 前置方案：见 [spec](./mysql-slow-query-analysis.md)。
> 关键结论：**不需要写插件**。你只写 3 样东西 —— ① 一个 TypeScript MCP server；② 一个 `SKILL.md` 文件；③ 一段配置 + 一处前端引导。接入和加载都复用现成插件。

---

## 0. 环境与依赖版本

| 项       | 要求                                                        |
| ------- | --------------------------------------------------------- |
| Node.js | `>= 22`                                                   |
| 包管理器    | 仓库根用 `pnpm`；MCP server 独立子项目也用 pnpm 或 npm 均可              |
| MySQL   | 一个可连的测试库，开启慢日志写文件（`log_output='FILE'`）                    |
| 分析工具    | `pt-query-digest`（Percona Toolkit），路径可配置、不写死              |
| 依赖版本    | `@modelcontextprotocol/sdk ^1.30`、`mysql2 ^3.23`、`zod ^4` |

**先准备两样东西**：慢日志文件 + pt-query-digest。

1）MySQL 开启慢日志写文件：

```sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL slow_query_log_file = '/path/to/slow.log';   -- 慢日志文件路径，按环境改
SET GLOBAL log_output = 'FILE';                         -- 写文件（不查表）
SET GLOBAL long_query_time = 0.1;                       -- 超过 0.1s 记慢日志，测试时调小
```

2）准备 pt-query-digest（Percona Toolkit，分析慢日志得出 Top SQL）：

```sh
# 你的环境已有：/usr/local/mysql/bin/pt-query-digest
# 若无，单独下载脚本：
wget https://www.percona.com/get/pt-query-digest -O pt-query-digest
chmod +x pt-query-digest
```

验证：

```sh
/usr/local/mysql/bin/pt-query-digest --limit 5 /path/to/slow.log
# 能看到 Overall / Profile 及 Top SQL 列表即成功
```

> 慢日志文件路径与 pt-query-digest 路径**都走配置**（环境变量或工具入参），不写死，见 2.3 与 2.4。

---

## 1. 目录结构总览

```
OmniOps/
├── connectors/
│   └── mysql-diag-mcp/            # ① MCP connector（独立子项目）
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts           # 入口：registerTool 三个工具 + connect
│           ├── db.ts              # mysql2 连接封装（explain / inspect 用）
│           └── pt-digest.ts       # pt-query-digest 调用封装（list_slow_queries 用）
├── skills/
│   └── mysql-slow-query-analysis/
│       └── SKILL.md               # ② 排查方法论
└── docs/specs/                    # 方案与本文档
```

---

## 2. S1：开发 MCP server（TypeScript）

### 2.1 初始化子项目

在 `connectors/mysql-diag-mcp/` 下创建 `package.json`：

```json
{
  "name": "mysql-diag-mcp",
  "version": "1.0.0",
  "type": "module",
  "bin": { "mysql-diag-mcp": "dist/index.js" },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.30.0",
    "mysql2": "^3.23.3",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0",
    "tsx": "^4.19.0",
    "vitest": "^2.1.0"
  }
}
```

创建 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

安装依赖：

```sh
cd connectors/mysql-diag-mcp
pnpm install
```

### 2.2 `src/db.ts`：连接封装

```ts
import mysql from 'mysql2/promise'

export interface ConnectionParams {
  host: string
  port?: number
  database?: string
}

/** 打开一个短生命周期连接池执行 fn，结束后释放。
 *  user / password 从环境变量读（配置项，不进参数、不进日志），database 可选。 */
export async function withPool<T>(
  conn: ConnectionParams,
  fn: (pool: mysql.Pool) => Promise<T>,
): Promise<T> {
  const pool = mysql.createPool({
    host: conn.host,
    port: conn.port ?? 3306,
    user: process.env.MYSQL_USER ?? '',
    password: process.env.MYSQL_PASSWORD ?? '',
    database: conn.database ?? process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 2,
    connectTimeout: 5000,
  })
  try {
    return await fn(pool)
  } finally {
    await pool.end()
  }
}
```

### 2.3 `src/index.ts`：三个工具 + 启动

```ts
import { createServer } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { withPool } from './db.js'
import { runPtQueryDigest } from './pt-digest.js'

const server = new McpServer({ name: 'mysql-diag-mcp', version: '1.0.0' })

// explain / inspect 两个工具共用的连接参数：只从用户输入提取 host（ip）、port。
// user / password / database 都是配置项，走环境变量，不从聊天框获取。
const connectionSchema = z.object({
  host: z.string().describe('MySQL host or IP（从用户输入提取）'),
  port: z.number().int().optional().describe('MySQL port，默认 3306'),
})

/** 去掉库名前缀：'omniops.test' → 'test'（报告的 # Tables 部分可能带库名） */
function bareTable(table: string): string {
  return table.split('.').pop() ?? table
}

ss
server.registerTool('list_slow_queries', {
  description:
    '用 pt-query-digest 分析慢日志文件，返回 Top N 慢 SQL 聚合报告（执行次数、响应时间占比、扫描行数等）。' +
    '用于第一步找出哪些 SQL 最慢。慢日志与工具路径均可配置，不写死。',
  inputSchema: {
    slowLogDir: z.string().optional().describe('慢日志目录绝对路径，默认取环境变量 MYSQL_SLOW_LOG_DIR；会按时间段自动挑文件并复制到临时目录分析'),
    ptQueryDigest: z.string().optional().describe('pt-query-digest 二进制路径，默认取环境变量 PT_QUERY_DIGEST 或 /usr/local/mysql/bin/pt-query-digest'),
    since: z.string().optional().describe('开始时间 YYYY-MM-DD HH:mm:ss 或相对时间如 24h'),
    until: z.string().optional().describe('结束时间 YYYY-MM-DD HH:mm:ss'),
    limit: z.number().int().optional().describe('Top N 条数，默认 20'),
  },
}, async ({ slowLogDir, ptQueryDigest, since, until, limit }) => {
  const report = await runPtQueryDigest({ slowLogDir, ptQueryDigest, since, until, limit })
  return { content: [{ type: 'text' as const, text: report }] }
})

// ── 工具 2：执行计划 ──────────────────────────────────────────
server.registerTool('explain_query', {
  description:
    '对给定 SQL 返回 EXPLAIN FORMAT=JSON 执行计划，用于判断是否走索引、是否全表扫描。',
  inputSchema: {
    connection: connectionSchema,
    database: z.string().optional().describe('库名；从慢查询报告的 # Databases 字段读取，缺省取环境变量 MYSQL_DATABASE'),
    sql: z.string().describe('要分析的 SQL 语句（可含库名，如 orders.users）'),
  },
}, async ({ connection, database, sql }) => {
  const db = database ?? process.env.MYSQL_DATABASE
  return withPool({ ...connection, database: db }, async (pool) => {
    // 诊断工具，SQL 由用户/模型提供；如需更严格可限制为 SELECT 开头
    const [rows] = await pool.query('EXPLAIN FORMAT=JSON ' + sql)
    return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] }
  })
})

// ── 工具 3：表结构 + 索引 ──────────────────────────────────────
server.registerTool('inspect_schema', {
  description:
    '返回指定表的列结构、索引定义（含基数/选择性）、数据量与索引体积，用于对比表结构和索引是否匹配查询。',
  inputSchema: {
    connection: connectionSchema,
    database: z.string().optional().describe('库名；从慢查询报告的 # Databases 字段读取，缺省取环境变量 MYSQL_DATABASE'),
    table: z.string().describe('表名（可含库名，如 orders.users）'),
  },
}, async ({ connection, database, table }) => {
  const db = database ?? process.env.MYSQL_DATABASE
  const tableName = bareTable(table)
  return withPool({ ...connection, database: db }, async (pool) => {
    const [columns] = await pool.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
      [db, tableName],
    )
    const [indexes] = await pool.query(
      `SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, CARDINALITY
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
      [db, tableName],
    )
    const [tableInfo] = await pool.query(
      `SELECT TABLE_ROWS, ROUND(DATA_LENGTH/1024/1024,2) AS data_mb, ROUND(INDEX_LENGTH/1024/1024,2) AS index_mb
       FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [db, tableName],
    )
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ columns, indexes, tableInfo }, null, 2) }],
    }
  })
})

// ── 启动（Streamable HTTP，独立常驻，便于将来跨机器）────────────
const HOST = process.env.MCP_HTTP_HOST ?? '127.0.0.1'
const PORT = Number(process.env.MCP_HTTP_PORT ?? 8080)

const httpServer = createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined }) // 无状态
    res.on('close', () => { void transport.close() })
    void server.connect(transport)
      .then(() => transport.handleRequest(req, res, raw ? JSON.parse(raw) : undefined))
      .catch((err) => { res.writeHead(500).end(String(err)) })
  })
})

httpServer.listen(PORT, HOST, () => {
  console.error(`mysql-diag-mcp 监听 http://${HOST}:${PORT}/mcp`)
})
```

### 2.4 `src/pt-digest.ts`：pt-query-digest 调用封装

```ts
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// 默认值只是兜底，实际以环境变量 / 工具入参为准（可配置，不写死）
const DEFAULT_PT_QUERY_DIGEST = '/usr/local/mysql/bin/pt-query-digest'

export interface SlowQueryInput {
  slowLogDir?: string
  ptQueryDigest?: string
  since?: string
  until?: string
  limit?: number
}

/** 用 pt-query-digest 分析慢日志文件，返回聚合报告文本。所有路径可配置。 */
export async function runPtQueryDigest(input: SlowQueryInput): Promise<string> {
  const bin = input.ptQueryDigest ?? process.env.PT_QUERY_DIGEST ?? DEFAULT_PT_QUERY_DIGEST
  const logFile = input.slowLogDir ?? process.env.MYSQL_SLOW_LOG_DIR
  if (!logFile) {
    throw new Error('未指定慢日志文件：请通过 slowLogDir 入参或 MYSQL_SLOW_LOG_DIR 环境变量提供')
  }

  const args: string[] = []
  if (input.since) args.push('--since', input.since)
  if (input.until) args.push('--until', input.until)
  args.push('--limit', String(input.limit ?? 20))
  args.push(logFile)

  try {
    const { stdout } = await execFileAsync(bin, args, {
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
    })
    return stdout
  } catch (err) {
    const e = err as { message?: string; stderr?: string }
    throw new Error(`pt-query-digest 执行失败：${e.message ?? ''}\n${e.stderr ?? ''}`)
  }
}
```

> `--since/--until` 支持 `YYYY-MM-DD HH:mm:ss` 或相对时间（如 `24h`、`1800s`）；`--limit N` 取 Top N；默认输出 report 文本报告（含 Overall、Profile、Top SQL 明细），模型可直接阅读。

### 2.5 本地调试

**先启动 server（HTTP 方式，需常驻一个进程）**：

```sh
cd connectors/mysql-diag-mcp
pnpm build
export MYSQL_USER=你的数据库用户
export MYSQL_PASSWORD=你的密码
export MYSQL_DATABASE=你的默认库
export MYSQL_SLOW_LOG_DIR=/path/to/slow.log
export PT_QUERY_DIGEST=/usr/local/mysql/bin/pt-query-digest
export MCP_HTTP_PORT=8080
node dist/index.js
# 看到「mysql-diag-mcp 监听 http://127.0.0.1:8080/mcp」即启动成功
```

另开终端用 curl 验证（发一个 MCP initialize 请求，应返回 JSON-RPC 结果）：

```sh
curl -s -X POST http://127.0.0.1:8080/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

也可以用 MCP Inspector 连 HTTP 端点调试（选 `Streamable HTTP`，填 `http://127.0.0.1:8080/mcp`）。

先单独验证 pt-query-digest 能出报告：

```sh
/usr/local/mysql/bin/pt-query-digest --limit 5 /path/to/slow.log
```

---

## 3. S2：写 SKILL.md

创建 `skills/mysql-slow-query-analysis/SKILL.md`：

```markdown
---
name: mysql-slow-query-analysis
description: 用于分析 MySQL 慢查询。当用户要排查慢 SQL、分析执行计划、检查表结构/索引、定位数据库性能瓶颈时使用。
---

# MySQL 慢查询分析

## 目标
帮助用户定位 MySQL 慢查询的根因并给出优化建议。

## 输入
从用户消息中提取：host（ip）、port、分析时间段（起止时间）。
user / password / 慢日志文件 / pt-query-digest 路径都从环境变量（配置）读取；库名从报告的 `# Databases` 字段读取。不要向用户索取密码。

## 排查步骤
1. 调 `list_slow_queries`（传 slowLogDir + since/until + limit）用 pt-query-digest 分析慢日志，找出 Top SQL；
2. 对每条候选慢 SQL 调 `explain_query`（传 connection{host,port} + sql + database，database 取报告该 Query 的 `# Databases` 字段）看执行计划；
3. 调 `inspect_schema`（传 connection{host,port} + table + database，database 同样取 `# Databases` 字段）看表结构、索引定义与基数、数据量；
4. 归因：缺索引 / 索引失效 / 数据量大 / 锁等待 / 排序临时表；
5. 给可执行建议（加索引、改写 SQL、调参）并说明预期收益。

## 判定标准
- type=ALL → 全表扫描，通常需加索引
- key 为 NULL 且 rows 很大 → 未走索引
- rows_examined 远大于 rows_sent → 过滤性差
- Extra 含 Using filesort / Using temporary → 排序/临时表开销大
- 索引列基数过低 → 选择性差，索引收益有限

## 输出格式
1. 慢查询清单（TopN：耗时 / 次数 / 扫描行数 / SQL）
2. 根因分析（逐条说明为什么慢）
3. 优化建议（按优先级，含具体 SQL / 建索引语句）
4. 预期收益（估算）
```

> frontmatter 的 `name` 必须 kebab-case（小写+连字符）；`description` 是模型自动发现并 invoke 该 skill 的依据，要写清触发场景。

---

## 4. S3：接入配置（cordis.patch.yml）

在**你的**`$DSH_HOME`**&#x20;**`~/.dsh/profiles/<name>/cordis.patch.yml`**的 `cordis.patch.yml`** 里加两段。

> 注意：profile 根下的 `cordis.yml` 每次 boot 都会被框架重写回 `[]`（见 `apps/cli/src/profile-boot.ts`），**不要编辑它**；所有插件组合都写在 `cordis.patch.yml`。

```yaml
# 1) 让 skill-filesystem 扫描你的 skill 目录（base bundle 已挂该插件，这里按 id 覆盖其 config）
- id: skill-filesystem
  config:
    customSkillDirs:
      - /绝对路径/OmniOps/skills

# 2) 接入 MCP server（复用通用 client，走 streamable-http；新行用 insert）
- insert:
    - id: mysql-diag
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: mysql_diag
        transport: streamable-http
        url: http://127.0.0.1:8080/mcp
        headers: {}
```

**注意（HTTP 与 stdio 的关键区别）**：HTTP 方式下 server 是**独立常驻进程**，`dsh-mcp-client` 只负责连 URL，所以密码/路径等环境变量**不由 dsh 转发**，而是由「启动 mysql-diag-mcp 那个进程」的环境提供。

启动 server 时带上环境变量（或写进启动脚本 / systemd / `.env`，gitignored）：

```sh
export MYSQL_USER=你的数据库用户
export MYSQL_PASSWORD=你的数据库密码
export MYSQL_DATABASE=你的默认库
export MYSQL_SLOW_LOG_DIR=/path/to/slow.log
export PT_QUERY_DIGEST=/usr/local/mysql/bin/pt-query-digest
export MCP_HTTP_PORT=8080
node dist/index.js
```

验证接线是否成功（能列出 mysql-diag 的工具即成功）：

```sh
# 必须在 OmniOps 仓库根目录执行（`dsh` 是根 package.json 里的 script）
cd /Users/zhaohailiang/Desktop/WorkBuddy/OmniOps
pnpm dsh --profile web --dump-config   # 看 mysql-diag 这一行是否出现
```

> 说明：`--profile web` 读的是 `~/.dsh/profiles/web/`（与当前目录无关），但 `pnpm dsh` 这个命令本身只在**仓库根目录**才解析得到（根 `package.json` 定义了 `"dsh": "node --import tsx/esm apps/cli/src/bin.ts"`）。等价写法：`pnpm dsh web --dump-config`（`web` 是 `--profile web` 的别名）。

---

## 5. S4：下拉框引导（改动最小）

首页下拉框目前只改 state。MVP 用「动态 placeholder 引导」：选中「慢查询分析」后，输入框提示按统一格式输入，剩下的交给 skill 自动 invoke。

改 `packages/client/ui-conversation/src/client/skeleton/ConversationRoot.tsx`：

1. 在组件内（`skillId` 等 state 定义之后）加一个派生占位文案：

```tsx
const currentSkill = component.skills.find(s => s.id === skillId) ?? component.skills[0]
const heroPlaceholder =
  `【${techStack.label} / ${component.label} / ${currentSkill.label}】` +
  `请描述任务，例如「帮我分析 10.0.0.5:3306 的慢查询，时间段：2026-08-10 10:00:01 到 2026-08-10 11:00:01」`
```

1. 把 `inputBar` 里 hero 态的 placeholder 替换成它：

```tsx
// 原：hero ? { placeholder: t('placeholder.hero') } : {}
hero ? { placeholder: heroPlaceholder } : {}
```

> 说明：MVP 不做「把选中 skill 显式注入模型」，而是靠 skill 的 `description` 让模型在识别到慢查询任务时自动 invoke。若后续要更强联动（显式注入），再写插件用 `agent.inject()`。

---

## 6. S5：测试

### 6.1 MCP server 单测

`connectors/mysql-diag-mcp/src/index.test.ts`（把纯逻辑拆出去更好测；MVP 可先对 `db.ts` 的连接封装用 fixture 库做冒烟）：

```ts
import { describe, it, expect } from 'vitest'

describe('mysql-diag-mcp', () => {
  it('listSlowQueries 兜底查询不抛错（无真实库时跳过）', () => {
    // 无真实库环境用 it.skip；有库时填真实连接参数验证返回数组
    expect(true).toBe(true)
  })
})
```

### 6.2 snapshot（遵循仓库门禁）

dsh 的 model/用户可见行为需 keyless snapshot。做法：起一个 mock MCP server（固定返回）接进 `dsh-mcp-client`，跑一个可回放 example，断言模型调用工具后产出的 transcript。这块等你 S1–S4 联调通后再补，参照 `examples/mcp-memory` 与 `docs/testing.md`。

---

## 7. S6–S7：文档 + 打包

- 双语文档 + Agent Note（仓库门禁，见 AGENTS.md）。
- 测试全绿后，再把 MCP server 发布成 `bin`（`package.json` 已带 `bin`），并打包成一个 bundle（`dsh.bundle.patch` → `cordis.patch.yml`），供一键分发。

---

## 8. 端到端验证清单

1. MySQL 已开慢日志写文件（`log_output='FILE'`），慢日志文件有数据；
2. `pt-query-digest --limit 5 <慢日志>` 能出 Top SQL 报告；
3. `mysql-diag-mcp` build 通过，`node dist/index.js` 启动后能看到「监听 <http://127.0.0.1:8080/mcp」；>
4. `curl` 发 initialize 请求能收到 JSON-RPC 响应；
5. `SKILL.md` 被 `skill-filesystem` 扫描到（`dsh --dump-config` 或 skill 列表可见）；
6. `cordis.patch.yml` 里 `mysql-diag` 行能 dump 出来（`transport: streamable-http`）；
7. 首页选中「MySQL → 慢查询分析」，输入「帮我分析 <ip>:<port> 的慢查询，时间段：…」，模型自动调三个工具并产出诊断报告。

---

## 9. 常见坑

| 坑                   | 解决                                                                  |
| ------------------- | ------------------------------------------------------------------- |
| 连接被拒（ECONNREFUSED）  | server 没启动/没常驻；先 `node dist/index.js` 起服务，确认监听端口对                   |
| url 指向不对            | `transport: streamable-http` 的 `url` 要和 server 监听的 host:port 一致     |
| 密码/路径不生效            | HTTP 方式 env 由**启动 server 的进程**提供，不是 dsh 转发；检查启动命令里有没有带上             |
| pt-query-digest 找不到 | 确认路径，用 `PT_QUERY_DIGEST` 环境变量或工具入参覆盖，不写死                            |
| 慢日志文件没指定            | 通过 `slowLogDir` 入参或 `MYSQL_SLOW_LOG_DIR` 环境变量提供；两者都没给会明确报错             |
| 时间段查不到              | `since/until` 格式要 `YYYY-MM-DD HH:mm:ss`，且慢日志里有该时段数据（也可用 `24h` 相对时间） |
| 密码进日志               | 密码只走 `env`，绝不作为 tool 入参                                             |
| skill 不被 invoke     | 检查 `description` 是否写清触发场景；skill 目录是否在 `customSkillDirs`             |
| MCP 工具没出现           | 检查 server 是否在跑、`dsh-mcp-client` 的 `serverName` 是否唯一、url 是否能连通       |
