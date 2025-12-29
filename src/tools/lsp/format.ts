import type {
  Hover,
  Location,
  LocationLink,
  Definition,
  DocumentSymbol,
  SymbolInformation,
  DocumentDiagnosticReport,
  Diagnostic,
  CodeAction,
  Command,
  WorkspaceSymbol,
} from "vscode-languageserver-protocol"

import { resolve } from "node:path"

/**
 * hover 결과를 사람이 읽기 쉬운 텍스트로 만든다.
 */
export function formatHover(hover: Hover | null): string {
  if (!hover) return "No hover information"

  const contents: unknown = hover.contents as any

  if (typeof contents === "string") return contents

  // MarkupContent
  if (contents && typeof contents === "object" && "value" in (contents as any)) {
    const v = (contents as any).value
    return typeof v === "string" ? v : JSON.stringify(contents)
  }

  // MarkedString[] 또는 MarkedString
  if (Array.isArray(contents)) {
    return contents
      .map((c) => {
        if (typeof c === "string") return c
        if (c && typeof c === "object" && "value" in (c as any)) return String((c as any).value)
        return JSON.stringify(c)
      })
      .join("\n")
  }

  return JSON.stringify(contents)
}

/**
 * Location/LocationLink/Definition을 path:line:col 형식으로 만든다.
 */
export function formatLocations(
  def: Definition | Location[] | Location | LocationLink[] | null,
  opts?: { limit?: number }
): string {
  if (!def) return "No location"

  const list = Array.isArray(def) ? def : [def]

  const lines: string[] = []
  const limit = opts?.limit
  const total = list.length
  const items = typeof limit === "number" ? list.slice(0, limit) : list

  if (typeof limit === "number" && total > limit) {
    lines.push(`Found ${total} location(s) (showing first ${limit}):`)
  }

  for (const item of items as any[]) {
    const loc: Location | null = item?.targetUri
      ? {
          uri: item.targetUri,
          range: item.targetRange,
        }
      : item

    if (!loc?.uri || !loc.range) continue

    const filePath = filePathFromUri(loc.uri)
    const line = loc.range.start.line + 1
    const col = loc.range.start.character + 1
    lines.push(`${filePath}:${line}:${col}`)
  }

  return lines.length > 0 ? lines.join("\n") : "No location"
}

/**
 * document symbols를 간단 텍스트로 만든다.
 */
export function formatDocumentSymbols(
  symbols: Array<DocumentSymbol | SymbolInformation> | null,
  opts?: { limit?: number }
): string {
  if (!symbols || symbols.length === 0) return "No symbols"

  const limit = opts?.limit
  const total = symbols.length
  const list = typeof limit === "number" ? symbols.slice(0, limit) : symbols

  const lines: string[] = []
  if (typeof limit === "number" && total > limit) {
    lines.push(`Found ${total} symbol(s) (showing first ${limit}):`)
  }

  for (const s of list as any[]) {
    if (s?.location) {
      const filePath = filePathFromUri(s.location.uri)
      const line = s.location.range.start.line + 1
      const col = s.location.range.start.character + 1
      lines.push(`${s.name} - ${filePath}:${line}:${col}`)
      continue
    }

    if (s?.range) {
      const line = s.range.start.line + 1
      lines.push(`${s.name} - line ${line}`)
      continue
    }
  }

  return lines.join("\n")
}

/**
 * workspace symbols를 간단 텍스트로 만든다.
 */
export function formatWorkspaceSymbols(symbols: WorkspaceSymbol[] | SymbolInformation[] | null, opts?: { limit?: number }): string {
  if (!symbols || symbols.length === 0) return "No symbols"

  const limit = opts?.limit
  const total = symbols.length
  const list = typeof limit === "number" ? symbols.slice(0, limit) : symbols

  const lines: string[] = []
  if (typeof limit === "number" && total > limit) {
    lines.push(`Found ${total} symbol(s) (showing first ${limit}):`)
  }

  for (const s of list as any[]) {
    const loc = s.location
    if (!loc) continue
    const filePath = filePathFromUri(loc.uri)
    const line = loc.range.start.line + 1
    const col = loc.range.start.character + 1
    lines.push(`${s.name} - ${filePath}:${line}:${col}`)
  }

  return lines.join("\n")
}

/**
 * diagnostics를 텍스트로 만든다.
 */
export function formatDiagnostics(
  report: DocumentDiagnosticReport | null,
  opts: { severity?: "error" | "warning" | "information" | "hint" | "all"; limit: number }
): string {
  if (!report || !(report as any).items) return "No diagnostics"

  let items: Diagnostic[] = (report as any).items

  if (opts.severity && opts.severity !== "all") {
    const map: Record<string, number> = { error: 1, warning: 2, information: 3, hint: 4 }
    const target = map[opts.severity]
    items = items.filter((d) => d.severity === target)
  }

  if (items.length === 0) return "No diagnostics"

  const total = items.length
  const limited = items.slice(0, opts.limit)

  const lines: string[] = []
  if (total > opts.limit) {
    lines.push(`Found ${total} diagnostic(s) (showing first ${opts.limit}):`)
  }

  for (const d of limited) {
    const sev = formatSeverity(d.severity)
    const line = d.range.start.line + 1
    const col = d.range.start.character + 1
    lines.push(`${sev} at ${line}:${col}: ${d.message}`)
  }

  return lines.join("\n")
}

/**
 * code actions를 리스트 텍스트로 만든다.
 */
export function formatCodeActionsList(actions: Array<CodeAction | Command> | null): string {
  if (!actions || actions.length === 0) return "No code actions available"

  const lines: string[] = []
  for (let i = 0; i < actions.length; i++) {
    const a: any = actions[i]
    const kind = a.kind ? a.kind : (a.command ? "command" : "action")
    const title = a.title ?? a.command?.title ?? "(no title)"
    lines.push(`${i + 1}. [${kind}] ${title}`)
  }

  return lines.join("\n")
}

/**
 * 적용 결과를 텍스트로 만든다.
 */
export function formatApplyResult(result: {
  success: boolean
  totalEdits: number
  filesModified: string[]
  errors: string[]
  blockedOperations: string[]
}): string {
  const lines: string[] = []

  if (result.blockedOperations.length > 0) {
    lines.push("Blocked operations:")
    for (const op of result.blockedOperations) lines.push(`  - ${op}`)
  }

  if (result.success) {
    lines.push(`Applied ${result.totalEdits} edit(s) to ${result.filesModified.length} file(s):`)
    for (const f of result.filesModified) lines.push(`  - ${f}`)
    return lines.join("\n")
  }

  lines.push("Failed to apply some changes:")
  for (const e of result.errors) lines.push(`  Error: ${e}`)
  if (result.filesModified.length > 0) {
    lines.push(`Successfully modified: ${result.filesModified.join(", ")}`)
  }
  return lines.join("\n")
}

/**
 * severity 숫자를 문자열로 변환한다.
 */
function formatSeverity(sev?: number): string {
  const map: Record<number, string> = { 1: "error", 2: "warning", 3: "information", 4: "hint" }
  return sev ? map[sev] ?? `unknown(${sev})` : "unknown"
}

/**
 * file URI를 OS 경로로 변환한다.
 */
function filePathFromUri(uri: string): string {
  try {
    // file:///C:/... 또는 file:///Users/... 형태 대응
    const decoded = decodeURI(uri)
    if (decoded.startsWith("file:///")) {
      return decoded.replace(/^file:\/\//, "")
    }
    if (decoded.startsWith("file://")) {
      return decoded.replace(/^file:\/\//, "")
    }
    return decoded
  } catch {
    return uri
  }
}
