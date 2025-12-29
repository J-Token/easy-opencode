import type { PluginInput, ToolDefinition } from "@opencode-ai/plugin"

import { createAstGrepTools } from "./tools/ast-grep"
import { createLspTools } from "./tools/lsp"
import { loadEasyOpencodeConfig } from "./config/loader"

/**
 * easy-opencode 플러그인 엔트리 포인트
 * - 에이전트/백그라운드 없이 도구만 제공
 * - LSP 11개 + AST-grep 2개
 */
export const EasyOpencodePlugin = async (
  ctx: PluginInput
): Promise<{ tool: Record<string, ToolDefinition> }> => {
  const pluginConfig = await loadEasyOpencodeConfig(ctx.directory)

  const tools: Record<string, ToolDefinition> = {
    ...createLspTools(pluginConfig),
    ...createAstGrepTools(pluginConfig),
  }

  return {
    tool: tools,
  }
}

export default EasyOpencodePlugin
