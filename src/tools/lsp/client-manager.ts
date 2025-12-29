import type { EasyOpencodeConfig } from "../../config/schema"
import { extname, resolve } from "node:path"

import { LspClient } from "./lsp-client"

/**
 * LSP 클라이언트 매니저 인터페이스
 */
export type LspClientManager = {
  projectDir: string
  getClientForFile(filePath: string): Promise<LspClient | null>
  describeServers(): string
  formatUnavailableForFile(filePath: string): string
}

type ServerConfig = EasyOpencodeConfig["lsp"]["servers"][number]

/**
 * LSP 클라이언트 매니저를 생성한다.
 * - 서버는 id 단위로 캐시한다.
 */
export function createLspClientManager(config: EasyOpencodeConfig): LspClientManager {
  const clients = new Map<string, LspClient>()

  const serverList = config.lsp.servers

  const projectDir = resolve(process.cwd())

  return {
    projectDir,
    getClientForFile: async (filePath) => {
      const absPath = resolve(filePath)
      const ext = extname(absPath).toLowerCase()

      const server = findServerForExtension(serverList, ext)
      if (!server) return null

      const existing = clients.get(server.id)
      if (existing) {
        return existing
      }

      const client = new LspClient({
        serverId: server.id,
        command: server.command,
        args: server.args ?? [],
        env: server.env,
        projectDir,
      })

      clients.set(server.id, client)
      await client.ensureStarted()
      return client
    },

    describeServers: () => {
      if (serverList.length === 0) {
        return "No LSP servers configured. Add servers in easy-opencode.jsonc." 
      }

      const lines: string[] = []
      for (const s of serverList) {
        const exts = (s.extensions ?? []).join(", ")
        lines.push(`${s.id} - ${s.command} ${(s.args ?? []).join(" ")} (${exts})`)
      }
      return lines.join("\n")
    },

    formatUnavailableForFile: (filePath) => {
      const absPath = resolve(filePath)
      const ext = extname(absPath).toLowerCase()
      const server = findServerForExtension(serverList, ext)
      if (!server) {
        return `LSP unavailable for ${ext || "(no extension)"}: server not configured. Use lsp_servers.`
      }
      return `LSP unavailable for ${ext}: failed to start server "${server.id}". Use lsp_servers.`
    },
  }
}

/**
 * 확장자에 맞는 서버를 찾는다.
 */
function findServerForExtension(servers: ServerConfig[], ext: string): ServerConfig | null {
  for (const s of servers) {
    if ((s.extensions ?? []).map((e) => e.toLowerCase()).includes(ext)) {
      return s
    }
  }
  return null
}
