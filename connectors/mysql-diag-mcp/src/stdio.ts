import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerTools } from './tools.js'

// stdio 入口：由 dsh 的 mcp-client 以子进程方式 spawn，凭据/路径经 env 注入。
const server = new McpServer({ name: 'mysql-diag-mcp', version: '1.0.0' })
registerTools(server)

const transport = new StdioServerTransport()
await server.connect(transport)
