import { createServer } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { registerTools } from './tools.js'

const server = new McpServer({ name: 'mysql-diag-mcp', version: '1.0.0' })
registerTools(server)

// ── 启动（Streamable HTTP，独立常驻，便于跨机器）────────────
const HOST = process.env.MCP_HTTP_HOST ?? '127.0.0.1'
const PORT = Number(process.env.MCP_HTTP_PORT ?? 8080)

const httpServer = createServer((req, res) => {
  // stateless 模式不支持 SSE 流（GET /mcp）；返回 405，与 SDK 官方 stateless 示例一致
  if (req.method === 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null }))
    return
  }
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    // 请求日志：判断客户端有没有连上、tools/list 有没有发来
    console.error('[mcp]', req.method, req.url, raw ? raw.slice(0, 200) : '(empty)')
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
