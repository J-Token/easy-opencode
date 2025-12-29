import { spawn } from "node:child_process"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

/**
 * AST-grep 검색 실행 결과(간소화)
 */
export type AstGrepSearchResult = {
  matches: Array<{ file: string; line: number; col: number; preview?: string }>
}

/**
 * AST-grep 치환 실행 결과(간소화)
 */
export type AstGrepReplaceResult = {
  replacements: number
  files: string[]
}

type CommonArgs = {
  preferNapi: boolean
  pattern: string
  lang: string
  paths?: string[]
  globs?: string[]
  timeoutMs: number
}

type SearchArgs = CommonArgs & {
  context?: number
}

type ReplaceArgs = CommonArgs & {
  rewrite: string
  apply: boolean
}

/**
 * AST-grep 검색을 실행한다.
 * - NAPI 우선
 * - 실패하면 CLI fallback
 */
export async function runAstGrepSearch(args: SearchArgs): Promise<AstGrepSearchResult> {
  if (args.preferNapi) {
    try {
      return await runViaNapiSearch(args)
    } catch {
      // NAPI 실패 시 CLI로 fallback
    }
  }

  return await runViaCliSearch(args)
}

/**
 * AST-grep 치환을 실행한다.
 * - NAPI 우선
 * - 실패하면 CLI fallback
 */
export async function runAstGrepReplace(args: ReplaceArgs): Promise<AstGrepReplaceResult> {
  if (args.preferNapi) {
    try {
      return await runViaNapiReplace(args)
    } catch {
      // NAPI 실패 시 CLI로 fallback
    }
  }

  return await runViaCliReplace(args)
}

/**
 * NAPI로 검색한다.
 */
async function runViaNapiSearch(args: SearchArgs): Promise<AstGrepSearchResult> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const napi = require("@ast-grep/napi")

  const roots = args.paths && args.paths.length > 0 ? args.paths : ["."]

  const matches: AstGrepSearchResult["matches"] = []

  for (const root of roots) {
    // @ast-grep/napi의 API는 버전에 따라 다를 수 있어 최소 동작만 사용한다.
    // - 실패 시 위에서 CLI로 fallback 한다.
    const project = await napi.loadProject(root)
    const result = await project.find({
      rule: {
        language: args.lang,
        pattern: args.pattern,
      },
    })

    for (const m of result.matches ?? []) {
      const file = m.filePath ?? m.path ?? ""
      const range = m.range ?? m.node?.range
      const start = range?.start
      const line = typeof start?.line === "number" ? start.line + 1 : 1
      const col = typeof start?.column === "number" ? start.column + 1 : 1
      matches.push({ file, line, col })
    }
  }

  return { matches }
}

/**
 * NAPI로 치환한다.
 */
async function runViaNapiReplace(args: ReplaceArgs): Promise<AstGrepReplaceResult> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const napi = require("@ast-grep/napi")

  const roots = args.paths && args.paths.length > 0 ? args.paths : ["."]
  let replacements = 0
  const files = new Set<string>()

  for (const root of roots) {
    const project = await napi.loadProject(root)
    const result = await project.find({
      rule: {
        language: args.lang,
        pattern: args.pattern,
      },
    })

    for (const m of result.matches ?? []) {
      if (!args.apply) {
        replacements += 1
        if (m.filePath) files.add(m.filePath)
        continue
      }

      const filePath: string | undefined = m.filePath
      if (!filePath) continue

      const original = await readFile(filePath, "utf-8")
      // 보수적으로 전체 파일 rewrite는 하지 않고, CLI fallback을 권장한다.
      // NAPI API가 안정적이지 않을 수 있어 apply는 최소 구현으로 제한한다.
      // eslint-disable-next-line no-useless-escape
      const replaced = original.replace(new RegExp(escapeRegExp(args.pattern), "g"), args.rewrite)
      if (replaced !== original) {
        replacements += 1
        files.add(filePath)
        await Bun.write(filePath, replaced)
      }
    }
  }

  return { replacements, files: Array.from(files) }
}

/**
 * CLI로 검색한다.
 */
async function runViaCliSearch(args: SearchArgs): Promise<AstGrepSearchResult> {
  const sgBin = await resolveAstGrepCli()

  const roots = args.paths && args.paths.length > 0 ? args.paths : ["."]
  const cliArgs: string[] = ["scan", "--json", "--lang", args.lang, "--pattern", args.pattern]

  if (args.globs && args.globs.length > 0) {
    for (const g of args.globs) {
      cliArgs.push("--globs", g)
    }
  }

  if (typeof args.context === "number") {
    cliArgs.push("--context", String(args.context))
  }

  cliArgs.push(...roots)

  const stdout = await runCommandJson(sgBin, cliArgs, args.timeoutMs)

  const matches: AstGrepSearchResult["matches"] = []
  for (const item of stdout as any[]) {
    const file = item?.file ?? item?.path
    const line = Number(item?.range?.start?.line ?? 0) + 1
    const col = Number(item?.range?.start?.column ?? 0) + 1
    if (typeof file === "string") {
      matches.push({ file, line, col })
    }
  }

  return { matches }
}

/**
 * CLI로 치환한다.
 */
async function runViaCliReplace(args: ReplaceArgs): Promise<AstGrepReplaceResult> {
  const sgBin = await resolveAstGrepCli()

  const roots = args.paths && args.paths.length > 0 ? args.paths : ["."]
  const cliArgs: string[] = ["scan", "--json", "--lang", args.lang, "--pattern", args.pattern, "--rewrite", args.rewrite]

  if (!args.apply) {
    cliArgs.push("--dry-run")
  }

  if (args.globs && args.globs.length > 0) {
    for (const g of args.globs) {
      cliArgs.push("--globs", g)
    }
  }

  cliArgs.push(...roots)

  const stdout = await runCommandJson(sgBin, cliArgs, args.timeoutMs)

  let replacements = 0
  const files = new Set<string>()

  for (const item of stdout as any[]) {
    const file = item?.file ?? item?.path
    if (typeof file === "string") files.add(file)
    replacements += 1
  }

  return { replacements, files: Array.from(files) }
}

/**
 * ast-grep CLI 실행 파일을 찾는다.
 */
async function resolveAstGrepCli(): Promise<string> {
  // OpenCode 실행 시 PATH에 ~/.config/opencode/node_modules/.bin 이 포함되는 경우가 많다.
  // 우선 PATH에서 찾고, 없으면 "sg"를 그대로 실행한다.
  const which = (Bun as any).which?.("sg") as string | undefined
  if (which) return which
  return "sg"
}

/**
 * JSON을 stdout으로 출력하는 CLI를 실행한다.
 */
function runCommandJson(command: string, args: string[], timeoutMs: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    })

    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []

    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error(`Timeout after ${timeoutMs}ms`))
    }, timeoutMs)

    proc.stdout.on("data", (d) => chunks.push(d))
    proc.stderr.on("data", (d) => errChunks.push(d))

    proc.on("error", (err) => {
      clearTimeout(timer)
      reject(err)
    })

    proc.on("close", (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(new Error(Buffer.concat(errChunks).toString("utf-8") || `Exit code ${code}`))
        return
      }

      const text = Buffer.concat(chunks).toString("utf-8")
      try {
        resolve(JSON.parse(text))
      } catch (e) {
        reject(new Error(`Failed to parse JSON: ${e instanceof Error ? e.message : String(e)}`))
      }
    })
  })
}

/**
 * 정규식 특수문자를 escape 한다.
 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
