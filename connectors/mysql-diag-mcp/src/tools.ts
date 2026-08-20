import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { withPool } from './db.js'
import { runPtQueryDigest } from './pt-digest.js'

const connectionSchema = z.object({
  host: z.string().describe('MySQL host or IP'),
  port: z.number().int().describe('MySQL port, usually 3306'),
})

/** 注册 mysql-diag 的三个诊断工具（stdio / streamable-http 两个入口共用）。 */
export function registerTools(server: McpServer): void {
  // ── 工具 1：慢日志分析（pt-query-digest，不连库）──────────────────
  server.registerTool('list_slow_queries', {
    description:
      '用 pt-query-digest 分析慢日志目录，返回 Top N 慢 SQL 聚合报告（执行次数、响应时间占比、扫描行数等）。' +
      '用于第一步找出哪些 SQL 最慢。慢日志目录与工具路径均可配置，不写死。',
    inputSchema: {
      slowLogDir: z.string().optional().describe('慢日志目录绝对路径，默认取环境变量 MYSQL_SLOW_LOG_DIR；会按时间段自动挑文件并复制到临时目录分析'),
      ptQueryDigest: z.string().optional().describe('pt-query-digest 二进制路径，默认取环境变量 PT_QUERY_DIGEST 或 /usr/local/mysql/bin/pt-query-digest'),
      since: z.string().optional().describe('开始时间 YYYY-MM-DD HH:mm:ss 或相对时间如 24h'),
      until: z.string().optional().describe('结束时间 YYYY-MM-DD HH:mm:ss'),
      limit: z.number().int().optional().describe('Top N 条数，默认 3'),
    },
  }, async ({ slowLogDir, ptQueryDigest, since, until, limit }) => {
    const report = await runPtQueryDigest({ slowLogDir, ptQueryDigest, since, until, limit })
    return { content: [{ type: 'text' as const, text: report }] }
  })

  // ── 工具 2：执行计划 ──────────────────────────────────────────
  server.registerTool('explain_query', {
    description: '对给定 SQL 返回 EXPLAIN FORMAT=JSON 执行计划，用于判断是否走索引、是否全表扫描。',
    inputSchema: {
      connection: connectionSchema,
      database: z.string().optional().describe('库名；从慢查询报告的 # Databases 字段读取，缺省取环境变量 MYSQL_DATABASE'),
      sql: z.string().describe('要分析的 SQL 语句（可含库名，如 orders.users）'),
    },
  }, async ({ connection, database, sql }) => {
    const db = database ?? process.env.MYSQL_DATABASE
    if (!db) {
      throw new Error('Missing database: provide "database" input or set MYSQL_DATABASE env var')
    }
    return withPool({ ...connection, database: db }, async (pool) => {
      // 诊断工具，SQL 由用户/模型提供；如需更严格可限制为 SELECT 开头
      const [rows] = await pool.query('EXPLAIN FORMAT=JSON ' + sql)
      return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] }
    })
  })

  // ── 工具 3：表结构 + 索引 ──────────────────────────────────────
  server.registerTool('inspect_schema', {
    description: '返回指定表的列结构、索引定义（含基数/选择性）、数据量与索引体积，用于对比表结构和索引是否匹配查询。',
    inputSchema: {
      connection: connectionSchema,
      database: z.string().optional().describe('库名；从慢查询报告的 # Databases 字段读取，缺省取环境变量 MYSQL_DATABASE'),
      table: z.string().describe('表名（可含库名，如 orders.users）'),
    },
  }, async ({ connection, database, table }) => {
    const db = database ?? process.env.MYSQL_DATABASE
    const tableName = table
    if (!db) {
      throw new Error('Missing database: provide "database" input or set MYSQL_DATABASE env var')
    }

    let columns: unknown
    let indexes: unknown
    let tableInfo: unknown

    await withPool({ ...connection, database: db }, async (pool) => {
      const [cols] = await pool.query(
        `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, COLUMN_COMMENT
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
        [db, tableName],
      )
      const [idxs] = await pool.query(
        `SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, CARDINALITY
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
        [db, tableName],
      )
      const [tbl] = await pool.query(
        `SELECT TABLE_ROWS, ROUND(DATA_LENGTH/1024/1024,2) AS data_mb, ROUND(INDEX_LENGTH/1024/1024,2) AS index_mb
         FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [db, tableName],
      )
      columns = cols
      indexes = idxs
      tableInfo = tbl
    })

    return { content: [{ type: 'text' as const, text: JSON.stringify({ columns, indexes, tableInfo }, null, 2) }] }
  })
}
