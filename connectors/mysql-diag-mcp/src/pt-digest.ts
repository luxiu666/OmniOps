import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readdir, stat, mkdir, copyFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { tmpdir } from 'node:os'

const execFileAsync = promisify(execFile)

// 默认值只是兜底，实际以环境变量 / 工具入参为准（可配置，不写死）
const DEFAULT_PT_QUERY_DIGEST = '/usr/local/mysql/bin/pt-query-digest'

export interface SlowQueryInput {
  /** 慢日志目录（含轮转文件），默认取环境变量 MYSQL_SLOW_LOG_DIR */
  slowLogDir?: string
  ptQueryDigest?: string
  since?: string
  until?: string
  limit?: number
}

/** 列出目录里的慢日志文件（含轮转 *.log / *slow.log*），按 mtime 降序。 */
async function listSlowLogFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const names = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((n) => /slow\.log/i.test(n) || /\.log/i.test(n))
  const files = await Promise.all(
    names.map(async (n) => ({ path: join(dir, n), mtime: (await stat(join(dir, n))).mtimeMs })),
  )
  files.sort((a, b) => b.mtime - a.mtime)
  return files.map((f) => f.path)
}

/** 把选中的慢日志文件复制到临时工作目录，返回该目录路径。 */
async function copyToWorkDir(files: string[]): Promise<string> {
  const workDir = join(tmpdir(), `mysql-diag-${process.pid}-${Date.now()}`)
  await mkdir(workDir, { recursive: true })
  await Promise.all(files.map((f) => copyFile(f, join(workDir, basename(f)))))
  return workDir
}

/** 用 pt-query-digest 分析慢日志目录，返回聚合报告文本。所有路径可配置。 */
export async function runPtQueryDigest(input: SlowQueryInput): Promise<string> {
  const bin = input.ptQueryDigest ?? process.env.PT_QUERY_DIGEST ?? DEFAULT_PT_QUERY_DIGEST
  const dir = input.slowLogDir ?? process.env.MYSQL_SLOW_LOG_DIR
  if (!dir) {
    throw new Error('未指定慢日志目录：请通过 slowLogDir 入参或 MYSQL_SLOW_LOG_DIR 环境变量提供')
  }

  // 1) 找目录里的慢日志文件
  const allFiles = await listSlowLogFiles(dir)
  if (allFiles.length === 0) {
    throw new Error(`慢日志目录 ${dir} 下没找到慢日志文件（*.log / *slow.log*）`)
  }

  // 2) 按时间段粗筛：mtime 早于 since 的文件不可能含该时段事件，跳过（精确过滤交给 pt-query-digest --since/--until）
  let files = allFiles
  if (input.since) {
    const sinceMs = Date.parse(input.since.replace(' ', 'T'))
    if (!Number.isNaN(sinceMs)) {
      const metas = await Promise.all(allFiles.map(async (f) => ({ f, m: (await stat(f)).mtimeMs })))
      const candidate = metas.filter((x) => x.m >= sinceMs).map((x) => x.f)
      files = candidate.length > 0 ? candidate : [allFiles[0]]
    }
  }

  // 3) 复制到临时工作目录（不在原目录分析，也不动原文件）
  const workDir = await copyToWorkDir(files)

  // 4) 跑 pt-query-digest（多文件 + --since/--until 精确过滤）
  const args: string[] = []
  if (input.since) args.push('--since', input.since)
  if (input.until) args.push('--until', input.until)
  args.push('--limit', String(input.limit ?? 3))
  args.push(...files.map((f) => join(workDir, basename(f))))

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
