import { readFile, writeFile, unlink, rename as fsRename } from "node:fs/promises"
import { resolve, relative } from "node:path"

import type { EasyOpencodeConfig } from "../../config/schema"

/**
 * WorkspaceEdit 적용 결과
 */
export type ApplyResult = {
  success: boolean
  totalEdits: number
  filesModified: string[]
  errors: string[]
  blockedOperations: string[]
}

/**
 * codeAction JSON을 파싱한다.
 */
export function parseCodeActionJson(json: string): any {
  try {
    return JSON.parse(json)
  } catch (e) {
    throw new Error(`Invalid codeAction JSON: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/**
 * WorkspaceEdit를 안전하게 적용한다.
 * - 텍스트 edit(changes/documentChanges 텍스트)만 기본 허용
 * - create/rename/delete는 기본 차단(설정으로만 허용)
 */
export async function applyWorkspaceEditSafely(
  edit: any | null,
  args: {
    projectDir: string
    applyConfig: EasyOpencodeConfig["apply"]
  }
): Promise<ApplyResult> {
  const result: ApplyResult = {
    success: true,
    totalEdits: 0,
    filesModified: [],
    errors: [],
    blockedOperations: [],
  }

  if (!edit) {
    result.success = false
    result.errors.push("No edit provided")
    return result
  }

  // changes: { [uri]: TextEdit[] }
  if (edit.changes && typeof edit.changes === "object") {
    for (const [uri, edits] of Object.entries(edit.changes)) {
      const filePath = filePathFromUri(String(uri))
      const apply = await applyTextEditsToFile(filePath, edits as any[], args.projectDir, args.applyConfig)
      if (apply.success) {
        result.filesModified.push(filePath)
        result.totalEdits += apply.editCount
      } else {
        result.success = false
        result.errors.push(`${filePath}: ${apply.error}`)
      }
    }
  }

  // documentChanges: TextDocumentEdit | CreateFile | RenameFile | DeleteFile
  if (Array.isArray(edit.documentChanges)) {
    for (const change of edit.documentChanges as any[]) {
      if (change?.kind === "create") {
        if (!args.applyConfig.allowCreate) {
          result.success = false
          result.blockedOperations.push(`create ${String(change.uri)}`)
          continue
        }
        // create 허용해도, 밖 경로는 차단할 수 있다.
        const filePath = filePathFromUri(String(change.uri))
        if (!isPathAllowed(filePath, args.projectDir, args.applyConfig.allowOutsideWorkspace)) {
          result.success = false
          result.blockedOperations.push(`create(outside) ${filePath}`)
          continue
        }
        try {
          await writeFile(filePath, "", "utf-8")
          result.filesModified.push(filePath)
        } catch (e) {
          result.success = false
          result.errors.push(`create ${filePath}: ${e instanceof Error ? e.message : String(e)}`)
        }
        continue
      }

      if (change?.kind === "rename") {
        if (!args.applyConfig.allowRename) {
          result.success = false
          result.blockedOperations.push(`rename ${String(change.oldUri)} -> ${String(change.newUri)}`)
          continue
        }

        const oldPath = filePathFromUri(String(change.oldUri))
        const newPath = filePathFromUri(String(change.newUri))

        if (!isPathAllowed(oldPath, args.projectDir, args.applyConfig.allowOutsideWorkspace)) {
          result.success = false
          result.blockedOperations.push(`rename(outside) ${oldPath}`)
          continue
        }
        if (!isPathAllowed(newPath, args.projectDir, args.applyConfig.allowOutsideWorkspace)) {
          result.success = false
          result.blockedOperations.push(`rename(outside) ${newPath}`)
          continue
        }

        try {
          await fsRename(oldPath, newPath)
          result.filesModified.push(newPath)
        } catch (e) {
          result.success = false
          result.errors.push(`rename ${oldPath} -> ${newPath}: ${e instanceof Error ? e.message : String(e)}`)
        }
        continue
      }

      if (change?.kind === "delete") {
        if (!args.applyConfig.allowDelete) {
          result.success = false
          result.blockedOperations.push(`delete ${String(change.uri)}`)
          continue
        }
        const filePath = filePathFromUri(String(change.uri))
        if (!isPathAllowed(filePath, args.projectDir, args.applyConfig.allowOutsideWorkspace)) {
          result.success = false
          result.blockedOperations.push(`delete(outside) ${filePath}`)
          continue
        }
        try {
          await unlink(filePath)
          result.filesModified.push(filePath)
        } catch (e) {
          result.success = false
          result.errors.push(`delete ${filePath}: ${e instanceof Error ? e.message : String(e)}`)
        }
        continue
      }

      // TextDocumentEdit
      if (change?.textDocument?.uri && Array.isArray(change.edits)) {
        const filePath = filePathFromUri(String(change.textDocument.uri))
        const apply = await applyTextEditsToFile(filePath, change.edits, args.projectDir, args.applyConfig)
        if (apply.success) {
          result.filesModified.push(filePath)
          result.totalEdits += apply.editCount
        } else {
          result.success = false
          result.errors.push(`${filePath}: ${apply.error}`)
        }
        continue
      }
    }
  }

  result.filesModified = Array.from(new Set(result.filesModified))
  return result
}

/**
 * 텍스트 edit를 파일에 적용한다.
 * - edit는 뒤에서부터 적용(오프셋 변형 최소화)
 */
async function applyTextEditsToFile(
  filePath: string,
  edits: any[],
  projectDir: string,
  applyConfig: EasyOpencodeConfig["apply"]
): Promise<{ success: boolean; editCount: number; error?: string }> {
  try {
    if (!isPathAllowed(filePath, projectDir, applyConfig.allowOutsideWorkspace)) {
      return { success: false, editCount: 0, error: "Path is outside workspace (blocked)" }
    }

    const content = await readFile(filePath, "utf-8")
    const lines = content.split("\n")

    const sorted = [...edits].sort((a, b) => {
      const la = a.range?.start?.line ?? 0
      const lb = b.range?.start?.line ?? 0
      if (lb !== la) return lb - la
      const ca = a.range?.start?.character ?? 0
      const cb = b.range?.start?.character ?? 0
      return cb - ca
    })

    for (const e of sorted) {
      const startLine = e.range.start.line
      const startChar = e.range.start.character
      const endLine = e.range.end.line
      const endChar = e.range.end.character
      const newText = String(e.newText ?? "")

      if (startLine === endLine) {
        const line = lines[startLine] ?? ""
        lines[startLine] = line.slice(0, startChar) + newText + line.slice(endChar)
        continue
      }

      const first = lines[startLine] ?? ""
      const last = lines[endLine] ?? ""
      const merged = first.slice(0, startChar) + newText + last.slice(endChar)
      lines.splice(startLine, endLine - startLine + 1, ...merged.split("\n"))
    }

    await writeFile(filePath, lines.join("\n"), "utf-8")
    return { success: true, editCount: edits.length }
  } catch (e) {
    return { success: false, editCount: 0, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * file URI를 OS 경로로 변환한다.
 */
function filePathFromUri(uri: string): string {
  const decoded = decodeURI(uri)
  if (decoded.startsWith("file:///")) {
    // Windows 포함: file:///C:/...
    return decoded.replace(/^file:\/\//, "")
  }
  if (decoded.startsWith("file://")) {
    return decoded.replace(/^file:\/\//, "")
  }
  return decoded
}

/**
 * 워크스페이스 밖 경로를 차단한다.
 */
function isPathAllowed(filePath: string, projectDir: string, allowOutside: boolean): boolean {
  if (allowOutside) return true

  const abs = resolve(filePath)
  const base = resolve(projectDir)
  const rel = relative(base, abs)

  // rel이 .. 로 시작하면 밖으로 탈출
  if (rel.startsWith("..") || rel.startsWith("../") || rel.startsWith("..\\")) {
    return false
  }

  return true
}
