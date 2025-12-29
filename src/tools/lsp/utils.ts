import { extname, resolve } from "node:path"

/**
 * 파일 경로를 file:// URI로 변환한다.
 * - Windows 드라이브 경로 포함
 */
export function toFileUri(filePath: string): string {
  const abs = resolve(filePath)

  // Windows: C:\path -> /C:/path
  const normalized = abs.replace(/\\/g, "/")
  if (/^[A-Za-z]:\//.test(normalized)) {
    return `file:///${encodeURI(normalized)}`
  }

  return `file://${encodeURI(normalized)}`
}

/**
 * LSP position으로 변환한다.
 * - line은 1-based 입력
 * - character는 0-based 입력
 */
export function toLspPosition(line1: number, character0: number): { line: number; character: number } {
  return {
    line: Math.max(0, line1 - 1),
    character: Math.max(0, character0),
  }
}

/**
 * LSP range로 변환한다.
 */
export function toLspRange(
  startLine1: number,
  startChar0: number,
  endLine1: number,
  endChar0: number
): { start: { line: number; character: number }; end: { line: number; character: number } } {
  return {
    start: toLspPosition(startLine1, startChar0),
    end: toLspPosition(endLine1, endChar0),
  }
}

/**
 * 파일 확장자 기반으로 languageId를 추정한다.
 */
export function detectLanguageId(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  if (ext === ".ts") return "typescript"
  if (ext === ".tsx") return "typescriptreact"
  if (ext === ".js") return "javascript"
  if (ext === ".jsx") return "javascriptreact"
  if (ext === ".py") return "python"
  if (ext === ".go") return "go"
  if (ext === ".rs") return "rust"
  if (ext === ".json") return "json"
  if (ext === ".md") return "markdown"
  return ext.replace(/^\./, "") || "plaintext"
}
