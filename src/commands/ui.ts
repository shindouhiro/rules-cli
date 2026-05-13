import type { ServerResponse } from 'node:http'
import { Buffer } from 'node:buffer'
import { exec } from 'node:child_process'
import { existsSync, lstatSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import consola from 'consola'
import pc from 'picocolors'
import { applyRulesByNames } from '~/commands/apply'
import { createCommand } from '~/commands/create'
import { AGENTS, resolveAgentPath } from '~/core/agents'
import { downloadCursorDirectoryRule } from '~/core/cursor-directory'
import { removeRuleFromSingleFileAgent } from '~/core/linker'
import { downloadRule } from '~/core/remote'
import { scanStoreRules } from '~/core/scanner'
import { getGlobalStoreDir } from '~/core/store'
import { printSection } from '~/core/ui'

export interface UiOptions {
  port?: number
}

function openBrowser(url: string) {
  const platform = process.platform
  if (platform === 'win32')
    exec(`start ${url}`)
  else if (platform === 'darwin')
    exec(`open ${url}`)
  else exec(`xdg-open ${url}`)
}

function getUiDistDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), 'ui')
}

function getContentType(filePath: string): string {
  const ext = extname(filePath)
  if (ext === '.html')
    return 'text/html; charset=utf-8'
  if (ext === '.js')
    return 'text/javascript; charset=utf-8'
  if (ext === '.css')
    return 'text/css; charset=utf-8'
  if (ext === '.json')
    return 'application/json; charset=utf-8'
  if (ext === '.svg')
    return 'image/svg+xml'
  if (ext === '.png')
    return 'image/png'
  if (ext === '.ico')
    return 'image/x-icon'
  if (ext === '.woff2')
    return 'font/woff2'
  return 'application/octet-stream'
}

function serveUiAsset(pathname: string, res: ServerResponse): boolean {
  const uiDir = getUiDistDir()
  const requestPath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1))
  const normalizedPath = normalize(requestPath)
  const filePath = join(uiDir, normalizedPath)

  if (!filePath.startsWith(`${uiDir}${sep}`) && filePath !== join(uiDir, 'index.html'))
    return false

  if (!existsSync(filePath) || !statSync(filePath).isFile())
    return false

  res.writeHead(200, { 'Content-Type': getContentType(filePath) })
  res.end(readFileSync(filePath))
  return true
}

// 提取当前项目中已经生效应用的所有规则
function getAppliedRules(cwd: string) {
  const result: any[] = []
  for (const scope of ['project', 'global'] as const) {
    const isGlobal = scope === 'global'
    for (const agent of AGENTS) {
      if (agent.rulesType === 'directory') {
        const baseDir = resolveAgentPath(agent, { global: isGlobal, cwd })
        if (!existsSync(baseDir))
          continue
        const entries = readdirSync(baseDir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.isFile() || entry.isSymbolicLink()) {
            const ruleName = entry.name.replace(/\.[^.]+$/, '')
            const fullPath = join(baseDir, entry.name)
            const isLink = lstatSync(fullPath).isSymbolicLink()
            result.push({
              name: ruleName,
              agentId: agent.id,
              agentName: agent.name,
              scope,
              type: 'directory',
              mode: isLink ? 'symlink' : 'file',
              path: fullPath,
            })
          }
        }
      }
      else {
        const targetPath = resolveAgentPath(agent, { global: isGlobal, cwd })
        if (!existsSync(targetPath))
          continue
        const content = readFileSync(targetPath, 'utf-8')
        const markerStart = agent.injectMarkerStart || '<!-- rules-cli:start -->'
        if (!content.includes(markerStart))
          continue
        const ruleNames = [...content.matchAll(/<!-- rule: (.+?) -->/g)].map(m => m[1])
        for (const name of ruleNames) {
          result.push({
            name,
            agentId: agent.id,
            agentName: agent.name,
            scope,
            type: 'single-file',
            mode: 'injected',
            path: targetPath,
          })
        }
      }
    }
  }
  return result
}

// 丰富本地规则对象，携带完整文件物理路径、作用域标识与原始内容以便前端进行无缝编辑
function getEnrichedStoreRules(cwd: string) {
  const rules = scanStoreRules({ cwd })
  const globalStoreDir = getGlobalStoreDir()
  return rules.map((r) => {
    let rawContent = ''
    try {
      if (r.path && existsSync(r.path)) {
        rawContent = readFileSync(r.path, 'utf-8')
      }
    }
    catch {}
    const isGlobal = r.path ? r.path.includes(globalStoreDir) : false
    return {
      ...r,
      rawContent,
      isGlobal,
    }
  })
}

export async function uiCommand(options: UiOptions): Promise<void> {
  const port = options.port || 3000
  const cwd = process.cwd()
  printSection('启动 Web 控制台')

  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url || '/', `http://localhost:${port}`)
    const pathname = url.pathname

    const jsonResponse = (data: any, statusCode = 200) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(data))
    }

    // API 中枢路由
    if (pathname.startsWith('/api/')) {
      try {
        if (req.method === 'GET' && pathname === '/api/data') {
          const rules = getEnrichedStoreRules(cwd)
          const applied = getAppliedRules(cwd)
          return jsonResponse({ success: true, data: { rules, agents: AGENTS, applied } })
        }

        const getBody = async () => {
          const buffers = []
          for await (const chunk of req) {
            buffers.push(chunk)
          }
          return JSON.parse(Buffer.concat(buffers).toString())
        }

        if (req.method === 'POST' && pathname === '/api/apply') {
          const body = await getBody()
          const { ruleNames, agents, global, force } = body
          await applyRulesByNames(ruleNames, {
            agent: agents && agents.length > 0 ? agents.join(',') : undefined,
            global: !!global,
            project: !global,
            force: force !== false,
          })
          return jsonResponse({ success: true, message: '分发同步执行完成' })
        }

        if (req.method === 'POST' && pathname === '/api/remove') {
          const body = await getBody()
          const { name, agentId, scope, type, path } = body
          const isGlobal = scope === 'global'
          const agent = AGENTS.find(a => a.id === agentId)

          if (!agent) {
            return jsonResponse({ success: false, message: '未找到对应智能体通道配置' })
          }

          if (type === 'directory') {
            if (existsSync(path)) {
              unlinkSync(path)
            }
          }
          else {
            const result = removeRuleFromSingleFileAgent(name, agent, { global: isGlobal, cwd })
            if (!result.success) {
              return jsonResponse({ success: false, message: result.error || '卸载执行失败' })
            }
          }
          return jsonResponse({ success: true, message: `已成功解除映射绑定` })
        }

        // 高级特性：持久化更新写入本地 rule.md
        if (req.method === 'POST' && pathname === '/api/update-store-rule') {
          const body = await getBody()
          const { path, content } = body
          if (!path || !existsSync(path)) {
            return jsonResponse({ success: false, message: '目标模板文件路径无效或不存在' })
          }
          writeFileSync(path, content || '', 'utf-8')
          return jsonResponse({ success: true, message: '源码更新回写磁盘完毕' })
        }

        // 高级特性：彻底销毁本地规则库目录
        if (req.method === 'POST' && pathname === '/api/delete-store-rule') {
          const body = await getBody()
          const { path } = body
          if (!path || !existsSync(path)) {
            return jsonResponse({ success: false, message: '无法定位待销毁源文件目录' })
          }
          const ruleFolder = dirname(path)
          rmSync(ruleFolder, { recursive: true, force: true })
          return jsonResponse({ success: true, message: '规则库模板从磁盘彻底移除' })
        }

        if (req.method === 'POST' && pathname === '/api/create') {
          const body = await getBody()
          const { name, global } = body
          await createCommand(name, { global: !!global })
          return jsonResponse({ success: true, message: `规则基础结构建立成功` })
        }

        if (req.method === 'POST' && pathname === '/api/install') {
          const body = await getBody()
          const { name, source, cursor, global } = body
          const storeOptions = { global: !!global, cwd }

          if (cursor || source === 'cursor.directory') {
            await downloadCursorDirectoryRule(name, storeOptions)
          }
          else {
            await downloadRule({ repo: source }, name, storeOptions)
          }
          return jsonResponse({ success: true, message: `已成功同步下发至库` })
        }

        res.writeHead(404)
        return jsonResponse({ success: false, message: '请求接口不存在' })
      }
      catch (err: any) {
        res.writeHead(500)
        return jsonResponse({ success: false, message: err.message || String(err) })
      }
    }

    // 提供经过构建后的独立 SPA 静态组件资源服务
    if (req.method === 'GET' && serveUiAsset(pathname, res)) {
      return
    }

    // 如果找不到静态资产，抛出极佳体验的开发者提示页
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`
      <!DOCTYPE html>
      <html class="dark">
      <body style="background:#0f172a;color:#cbd5e1;padding:50px;font-family:sans-serif;line-height:1.6;">
        <div style="max-w:600px;margin:0 auto;background:#1e293b;padding:30px;border-radius:12px;border:1px solid #334155;">
          <h2 style="color:#f8fafc;margin-top:0;">⚠️ 未发现经过编译的前端 UI 静态资源</h2>
          <p>当前后台控制台尝试从目录加载编译产物失败：<code style="color:#38bdf8;">dist/ui/</code></p>
          <hr style="border:0;border-top:1px solid #334155;margin:20px 0;">
          <h3 style="color:#f8fafc;margin-bottom:8px;">开发者解决方案指南</h3>
          <p style="margin-top:0;font-size:14px;">请在项目根终端中执行以下构建指令联动输出纯净的 SPA 前端模块产物：</p>
          <pre style="background:#0f172a;padding:12px;border-radius:6px;color:#e2e8f0;">pnpm build</pre>
          <p style="font-size:12px;color:#94a3b8;">执行完毕后刷新页面即可体验原生极致沉浸控制台。</p>
        </div>
      </body>
      </html>
    `)
  })

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      consola.error(`端口 ${port} 已被占用，请使用 --port 指定其他可用端口。`)
      process.exit(1)
    }
    else {
      consola.error(err)
    }
  })

  server.listen(port, () => {
    const targetUrl = `http://localhost:${port}`
    consola.success(`Web Dashboard 已成功运行于 ${pc.cyan(targetUrl)}`)
    consola.info('自动为您在默认浏览器中打开控制台进行图形交互操作...')
    consola.info(`按 ${pc.yellow('Ctrl+C')} 停止服务退出。`)
    openBrowser(targetUrl)
  })
}
