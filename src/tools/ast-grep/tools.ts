import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import type { EasyOpencodeConfig } from "../../config/schema"

import { runAstGrepSearch, runAstGrepReplace } from "./runner"

const CLI_LANGUAGES = [
  "bash",
  "c",
  "cpp",
  "csharp",
  "css",
  "go",
  "html",
  "java",
  "javascript",
  "json",
  "kotlin",
  "lua",
  "php",
  "python",
  "ruby",
  "rust",
  "swift",
  "toml",
  "tsx",
  "typescript",
  "yaml",
] as const

type CliLanguage = (typeof CLI_LANGUAGES)[number]

/**
 * AST-grep tool들을 생성한다.
 */
export function createAstGrepTools(config: EasyOpencodeConfig): Record<string, ToolDefinition> {
  return {
    ast_grep_search: createAstGrepSearchTool(config),
    ast_grep_replace: createAstGrepReplaceTool(config),
  }
}

/**
 * AST 기반 검색 tool
 */
function createAstGrepSearchTool(config: EasyOpencodeConfig): ToolDefinition {
  return tool({
    description:
      "Search code patterns across filesystem using AST-aware matching. " +
      "Use meta-variables: $VAR (single node), $$$ (multiple nodes). " +
      "IMPORTANT: Pattern must be valid code for the chosen language.",
    args: {
      pattern: tool.schema.string().describe("AST pattern with meta-variables ($VAR, $$$)."),
      lang: tool.schema.enum(CLI_LANGUAGES).describe("Target language"),
      paths: tool.schema.array(tool.schema.string()).optional().describe("Paths to search (default: ['.'])"),
      globs: tool.schema.array(tool.schema.string()).optional().describe("Include/exclude globs (prefix ! to exclude)"),
      context: tool.schema.number().optional().describe("Context lines around match"),
    },
    execute: async (args) => {
      try {
        const result = await runAstGrepSearch({
          preferNapi: config.astGrep.preferNapi,
          pattern: args.pattern,
          lang: args.lang as CliLanguage,
          paths: args.paths,
          globs: args.globs,
          context: args.context,
          timeoutMs: config.astGrep.timeoutMs,
        })

        if (result.matches.length === 0) {
          return "No matches"
        }

        const total = result.matches.length
        const limit = config.astGrep.maxMatches
        const truncated = total > limit
        const matches = truncated ? result.matches.slice(0, limit) : result.matches

        const lines: string[] = []
        if (truncated) {
          lines.push(`Found ${total} matches (showing first ${limit}):`)
        }

        for (const match of matches) {
          lines.push(`${match.file}:${match.line}:${match.col}`)
          if (match.preview) {
            lines.push(match.preview)
          }
        }
        return capOutput(lines.join("\n"), config.astGrep.maxOutputBytes)
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}

/**
 * AST 기반 치환 tool
 */
function createAstGrepReplaceTool(config: EasyOpencodeConfig): ToolDefinition {
  return tool({
    description:
      "Replace code patterns across filesystem with AST-aware rewriting. " +
      "Dry-run by default. Use meta-variables in rewrite to preserve matched content.",
    args: {
      pattern: tool.schema.string().describe("AST pattern to match"),
      rewrite: tool.schema.string().describe("Replacement pattern (can use $VAR from pattern)"),
      lang: tool.schema.enum(CLI_LANGUAGES).describe("Target language"),
      paths: tool.schema.array(tool.schema.string()).optional().describe("Paths to search"),
      globs: tool.schema.array(tool.schema.string()).optional().describe("Include/exclude globs"),
      dryRun: tool.schema.boolean().optional().describe("Preview changes without applying (default: true)"),
    },
    execute: async (args) => {
      try {
        const dryRun = args.dryRun ?? config.astGrep.defaultDryRun

        const result = await runAstGrepReplace({
          preferNapi: config.astGrep.preferNapi,
          pattern: args.pattern,
          rewrite: args.rewrite,
          lang: args.lang as CliLanguage,
          paths: args.paths,
          globs: args.globs,
          apply: dryRun === false,
          timeoutMs: config.astGrep.timeoutMs,
        })

        const lines: string[] = []
        if (dryRun) {
          lines.push(`Dry-run: ${result.replacements} replacement(s) would be applied.`)
        } else {
          lines.push(`Applied: ${result.replacements} replacement(s).`)
        }

        for (const file of result.files) {
          lines.push(file)
        }

        return capOutput(lines.join("\n"), config.astGrep.maxOutputBytes)
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
