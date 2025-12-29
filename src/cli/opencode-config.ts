import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { homedir } from "node:os"
import { parse, modify, applyEdits } from "jsonc-parser"

/**
 * OpenCode 설정 파일 경로를 찾는다.
 * - jsonc가 있으면 jsonc 우선
 */
export function resolveOpenCodeConfigPath(): { path: string; format: "json" | "jsonc" } {
  const baseDir = join(homedir(), ".config", "opencode")
  const jsoncPath = join(baseDir, "opencode.jsonc")
  const jsonPath = join(baseDir, "opencode.json")

  if (existsSync(jsoncPath)) {
    return { path: jsoncPath, format: "jsonc" }
  }

  return { path: jsonPath, format: "json" }
}

/**
 * OpenCode 설정을 읽는다.
 */
export async function readOpenCodeConfig(path: string): Promise<{ raw: string; data: any }> {
  const raw = await readFile(path, "utf-8")
  const data = parse(raw)
  return { raw, data }
}

/**
 * OpenCode 설정을 백업한다.
 */
export async function backupOpenCodeConfig(path: string): Promise<string> {
  const ts = formatTimestamp(new Date())
  const backupPath = `${path}.bak.${ts}`
  await copyFile(path, backupPath)
  return backupPath
}

/**
 * OpenCode 설정 파일이 없으면 생성한다.
 */
export async function ensureOpenCodeConfigExists(path: string): Promise<void> {
  if (existsSync(path)) return

  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, "{}\n", "utf-8")
}

/**
 * providerId 단위로 provider 값을 설정한다.
 * - json/jsonc 모두 지원
 * - 다른 영역은 최대한 건드리지 않는다.
 */
export async function writeProviderId(
  args: {
    path: string
    raw: string
    providerId: string
    providerValue: unknown
  }
): Promise<{ updatedRaw: string }> {
  const edits = modify(args.raw, ["provider", args.providerId], args.providerValue, {
    formattingOptions: {
      insertSpaces: true,
      tabSize: 2,
      eol: detectEol(args.raw),
    },
  })

  const updatedRaw = applyEdits(args.raw, edits)
  await writeFile(args.path, updatedRaw, "utf-8")

  return { updatedRaw }
}

/**
 * 개행 문자를 감지한다.
 */
function detectEol(raw: string): string {
  return raw.includes("\r\n") ? "\r\n" : "\n"
}

/**
 * 백업 파일명에 사용할 타임스탬프를 만든다.
 */
function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const hh = pad(date.getHours())
  const mm = pad(date.getMinutes())
  const ss = pad(date.getSeconds())
  return `${y}${m}${d}-${hh}${mm}${ss}`
}
