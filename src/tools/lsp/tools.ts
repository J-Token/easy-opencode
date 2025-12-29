import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import type { EasyOpencodeConfig } from "../../config/schema"

import {
  type LspClientManager,
  createLspClientManager,
} from "./client-manager"
import {
  formatDiagnostics,
  formatLocations,
  formatHover,
  formatDocumentSymbols,
  formatWorkspaceSymbols,
  formatCodeActionsList,
  formatApplyResult,
} from "./format"
import {
  applyWorkspaceEditSafely,
  parseCodeActionJson,
} from "./workspace-edit"

/**
 * LSP 도구(11개)를 생성한다.
 */
export function createLspTools(config: EasyOpencodeConfig): Record<string, ToolDefinition> {
  const manager = createLspClientManager(config)

  return {
    lsp_hover: createHoverTool(manager, config),
    lsp_goto_definition: createGotoDefinitionTool(manager, config),
    lsp_find_references: createFindReferencesTool(manager, config),
    lsp_document_symbols: createDocumentSymbolsTool(manager, config),
    lsp_workspace_symbols: createWorkspaceSymbolsTool(manager, config),
    lsp_diagnostics: createDiagnosticsTool(manager, config),
    lsp_servers: createServersTool(manager, config),
    lsp_prepare_rename: createPrepareRenameTool(manager, config),
    lsp_rename: createRenameTool(manager, config),
    lsp_code_actions: createCodeActionsTool(manager, config),
    lsp_code_action_resolve: createCodeActionResolveTool(manager, config),
  }
}

/**
 * hover tool
 */
function createHoverTool(manager: LspClientManager, config: EasyOpencodeConfig): ToolDefinition {
  return tool({
    description:
      "현재 위치의 심볼에 대한 타입/문서(hover) 정보를 가져옵니다. " +
      "입력 기준: line은 1-based, character는 0-based 입니다.",
    args: {
      filePath: tool.schema.string(),
      line: tool.schema.number().min(1).describe("1-based"),
      character: tool.schema.number().min(0).describe("0-based"),
    },
    execute: async (args) => {
      try {
        const client = await manager.getClientForFile(args.filePath)
        if (!client) {
          return manager.formatUnavailableForFile(args.filePath)
        }
        const hover = await client.hover(args.filePath, args.line, args.character)
        return capOutput(formatHover(hover), config.limits.maxOutputBytes)
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}

/**
 * definition tool
 */
function createGotoDefinitionTool(manager: LspClientManager, config: EasyOpencodeConfig): ToolDefinition {
  return tool({
    description:
      "현재 위치의 심볼 정의(선언) 위치로 이동하기 위한 위치 목록을 반환합니다. " +
      "입력 기준: line은 1-based, character는 0-based 입니다. " +
      "출력 위치는 path:line:col(1-based) 형식입니다.",
    args: {
      filePath: tool.schema.string(),
      line: tool.schema.number().min(1).describe("1-based"),
      character: tool.schema.number().min(0).describe("0-based"),
    },
    execute: async (args) => {
      try {
        const client = await manager.getClientForFile(args.filePath)
        if (!client) return manager.formatUnavailableForFile(args.filePath)

        const loc = await client.definition(args.filePath, args.line, args.character)
        return capOutput(formatLocations(loc), config.limits.maxOutputBytes)
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}

/**
 * references tool
 */
function createFindReferencesTool(manager: LspClientManager, config: EasyOpencodeConfig): ToolDefinition {
  return tool({
    description:
      "워크스페이스 전체에서 해당 심볼의 참조(사용처)를 모두 찾습니다. " +
      "includeDeclaration로 선언부 포함 여부를 제어할 수 있습니다. " +
      "입력 기준: line은 1-based, character는 0-based 입니다.",
    args: {
      filePath: tool.schema.string(),
      line: tool.schema.number().min(1).describe("1-based"),
      character: tool.schema.number().min(0).describe("0-based"),
      includeDeclaration: tool.schema.boolean().optional().describe("Include the declaration itself"),
    },
    execute: async (args) => {
      try {
        const client = await manager.getClientForFile(args.filePath)
        if (!client) return manager.formatUnavailableForFile(args.filePath)

        const refs = await client.references(args.filePath, args.line, args.character, args.includeDeclaration ?? true)
        const text = formatLocations(refs, { limit: config.limits.maxReferences })
        return capOutput(text, config.limits.maxOutputBytes)
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}

/**
 * document symbols tool
 */
function createDocumentSymbolsTool(manager: LspClientManager, config: EasyOpencodeConfig): ToolDefinition {
  return tool({
    description:
      "파일 안의 심볼(클래스/함수/변수 등) 목록을 계층 구조로 요약해 반환합니다. " +
      "파일 구조를 빠르게 파악할 때 사용합니다.",
    args: {
      filePath: tool.schema.string(),
    },
    execute: async (args) => {
      try {
        const client = await manager.getClientForFile(args.filePath)
        if (!client) return manager.formatUnavailableForFile(args.filePath)

        const symbols = await client.documentSymbols(args.filePath)
        const text = formatDocumentSymbols(symbols, { limit: config.limits.maxSymbols })
        return capOutput(text, config.limits.maxOutputBytes)
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}

/**
 * workspace symbols tool
 */
function createWorkspaceSymbolsTool(manager: LspClientManager, config: EasyOpencodeConfig): ToolDefinition {
  return tool({
    description:
      "워크스페이스 전체에서 이름으로 심볼을 검색합니다(대부분 fuzzy 매칭). " +
      "입력의 filePath는 서버 선택/초기화를 위해 사용됩니다.",
    args: {
      filePath: tool.schema.string(),
      query: tool.schema.string().describe("Symbol name (fuzzy match)"),
      limit: tool.schema.number().optional().describe("Max results"),
    },
    execute: async (args) => {
      try {
        const client = await manager.getClientForFile(args.filePath)
        if (!client) return manager.formatUnavailableForFile(args.filePath)

        const symbols = await client.workspaceSymbols(args.query)
        const limit = Math.min(args.limit ?? config.limits.maxSymbols, config.limits.maxSymbols)
        const text = formatWorkspaceSymbols(symbols, { limit })
        return capOutput(text, config.limits.maxOutputBytes)
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}

/**
 * diagnostics tool
 */
function createDiagnosticsTool(manager: LspClientManager, config: EasyOpencodeConfig): ToolDefinition {
  return tool({
    description:
      "해당 파일에 대한 LSP 진단(에러/경고/힌트)을 가져옵니다. " +
      "severity로 필터링할 수 있습니다.",
    args: {
      filePath: tool.schema.string(),
      severity: tool.schema.enum(["error", "warning", "information", "hint", "all"]).optional(),
    },
    execute: async (args) => {
      try {
        const client = await manager.getClientForFile(args.filePath)
        if (!client) return manager.formatUnavailableForFile(args.filePath)

        const diags = await client.diagnostics(args.filePath)
        const text = formatDiagnostics(diags, {
          severity: args.severity,
          limit: config.limits.maxDiagnostics,
        })
        return capOutput(text, config.limits.maxOutputBytes)
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}

/**
 * servers tool
 */
function createServersTool(manager: LspClientManager, config: EasyOpencodeConfig): ToolDefinition {
  return tool({
    description:
      "현재 설정된 LSP 서버 목록과 상태를 요약해 보여줍니다. " +
      "서버가 안 붙을 때(설정/설치/경로) 점검용으로 사용합니다.",
    args: {},
    execute: async () => {
      try {
        return capOutput(manager.describeServers(), config.limits.maxOutputBytes)
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}

/**
 * prepare rename tool
 */
function createPrepareRenameTool(manager: LspClientManager, config: EasyOpencodeConfig): ToolDefinition {
  return tool({
    description:
      "해당 위치에서 rename이 가능한지 사전 검증합니다. " +
      "입력 기준: line은 1-based, character는 0-based 입니다.",
    args: {
      filePath: tool.schema.string(),
      line: tool.schema.number().min(1).describe("1-based"),
      character: tool.schema.number().min(0).describe("0-based"),
    },
    execute: async (args) => {
      try {
        const client = await manager.getClientForFile(args.filePath)
        if (!client) return manager.formatUnavailableForFile(args.filePath)

        const result = await client.prepareRename(args.filePath, args.line, args.character)
        return capOutput(result ?? "Cannot rename at this position", config.limits.maxOutputBytes)
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}

/**
 * rename tool (즉시 적용)
 */
function createRenameTool(manager: LspClientManager, config: EasyOpencodeConfig): ToolDefinition {
  return tool({
    description:
      "심볼 이름을 워크스페이스 전체에서 변경하고, 변경사항을 즉시 파일에 적용합니다(실제 파일 변경). " +
      "입력 기준: line은 1-based, character는 0-based 입니다.",
    args: {
      filePath: tool.schema.string(),
      line: tool.schema.number().min(1).describe("1-based"),
      character: tool.schema.number().min(0).describe("0-based"),
      newName: tool.schema.string().describe("New symbol name"),
    },
    execute: async (args) => {
      try {
        const client = await manager.getClientForFile(args.filePath)
        if (!client) return manager.formatUnavailableForFile(args.filePath)

        const edit = await client.rename(args.filePath, args.line, args.character, args.newName)
        const apply = await applyWorkspaceEditSafely(edit, {
          projectDir: manager.projectDir,
          applyConfig: config.apply,
        })
        return capOutput(formatApplyResult(apply), config.limits.maxOutputBytes)
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}

/**
 * code actions list tool
 */
function createCodeActionsTool(manager: LspClientManager, config: EasyOpencodeConfig): ToolDefinition {
  return tool({
    description:
      "선택한 범위에서 가능한 code action(quickfix/refactor/source 등) 목록을 가져옵니다. " +
      "범위 입력: startLine/endLine은 1-based, startCharacter/endCharacter는 0-based 입니다.",
    args: {
      filePath: tool.schema.string(),
      startLine: tool.schema.number().min(1).describe("1-based"),
      startCharacter: tool.schema.number().min(0).describe("0-based"),
      endLine: tool.schema.number().min(1).describe("1-based"),
      endCharacter: tool.schema.number().min(0).describe("0-based"),
      kind: tool.schema
        .enum([
          "quickfix",
          "refactor",
          "refactor.extract",
          "refactor.inline",
          "refactor.rewrite",
          "source",
          "source.organizeImports",
          "source.fixAll",
        ])
        .optional(),
    },
    execute: async (args) => {
      try {
        const client = await manager.getClientForFile(args.filePath)
        if (!client) return manager.formatUnavailableForFile(args.filePath)

        const actions = await client.codeActions({
          filePath: args.filePath,
          startLine: args.startLine,
          startCharacter: args.startCharacter,
          endLine: args.endLine,
          endCharacter: args.endCharacter,
          only: args.kind ? [args.kind] : undefined,
        })

        return capOutput(formatCodeActionsList(actions), config.limits.maxOutputBytes)
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}

/**
 * code action resolve tool (즉시 적용)
 */
function createCodeActionResolveTool(manager: LspClientManager, config: EasyOpencodeConfig): ToolDefinition {
  return tool({
    description:
      "lsp_code_actions가 반환한 code action을 resolve한 뒤, 편집을 즉시 적용합니다(실제 파일 변경). " +
      "codeAction 인자는 lsp_code_actions 출력에서 복사한 JSON 문자열을 그대로 전달해야 합니다.",
    args: {
      filePath: tool.schema.string(),
      codeAction: tool.schema.string().describe("Code action JSON from lsp_code_actions"),
    },
    execute: async (args) => {
      try {
        const client = await manager.getClientForFile(args.filePath)
        if (!client) return manager.formatUnavailableForFile(args.filePath)

        const action = parseCodeActionJson(args.codeAction)
        const resolved = await client.resolveCodeAction(action)

        const edit = resolved?.edit ?? null
        const apply = await applyWorkspaceEditSafely(edit, {
          projectDir: manager.projectDir,
          applyConfig: config.apply,
        })

        return capOutput(formatApplyResult(apply), config.limits.maxOutputBytes)
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}

/**
 * 출력이 너무 길면 잘라서 반환한다.
 */
function capOutput(text: string, maxBytes: number): string {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(text)
  if (bytes.length <= maxBytes) return text
  const truncated = bytes.slice(0, maxBytes)
  const decoder = new TextDecoder()
  return decoder.decode(truncated) + "\n\n(truncated)"
}
