import { parse } from "jsonc-parser"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { homedir } from "node:os"

import { easyOpencodeConfigSchema, type EasyOpencodeConfig } from "./schema"
import { deepMerge } from "../shared/deep-merge"

/**
 * JSONC 파일을 안전하게 읽는다.
 * - 파일이 없으면 null
 * - 파싱 실패 시 null
 */
async function readJsoncFile(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(filePath, "utf-8")
    const data = parse(raw)
    if (!data || typeof data !== "object") return null
    return data as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * 플러그인 설정을 로드한다.
 * - 유저 설정을 base로 하고, 프로젝트 설정이 override 한다.
 */
export async function loadEasyOpencodeConfig(projectDir: string): Promise<EasyOpencodeConfig> {
  const userPath = join(homedir(), ".config", "opencode", "easy-opencode.jsonc")
  const projectPath = join(projectDir, ".opencode", "easy-opencode.jsonc")

  const userConfig = (await readJsoncFile(userPath)) ?? {}
  const projectConfig = (await readJsoncFile(projectPath)) ?? {}

  const merged = deepMerge(userConfig, projectConfig)
  return easyOpencodeConfigSchema.parse(merged)
}
