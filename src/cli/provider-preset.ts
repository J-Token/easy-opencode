/**
 * easy-opencode 내장 provider 프리셋
 * - 대상: provider.openai / provider["google-ai"]
 * - npx CLI에서 ~/.config/opencode/opencode.json(c)의 provider에 병합한다.
 */
export const PROVIDER_PRESET: {
  openai: unknown
  "google-ai": unknown
  anthropic: unknown
} = {
  openai: {
    options: {
      reasoningEffort: "medium",
      reasoningSummary: "auto",
      textVerbosity: "medium",
      include: ["reasoning.encrypted_content"],
      store: false,
    },
    models: {
      "gpt-5.2-none": {
        name: "GPT 5.2 None (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "none",
          reasoningSummary: "auto",
          textVerbosity: "medium",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
      "gpt-5.2-low": {
        name: "GPT 5.2 Low (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "low",
          reasoningSummary: "auto",
          textVerbosity: "medium",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
      "gpt-5.2-medium": {
        name: "GPT 5.2 Medium (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "medium",
          reasoningSummary: "auto",
          textVerbosity: "medium",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
      "gpt-5.2-high": {
        name: "GPT 5.2 High (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "high",
          reasoningSummary: "detailed",
          textVerbosity: "medium",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
      "gpt-5.2-xhigh": {
        name: "GPT 5.2 Extra High (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "xhigh",
          reasoningSummary: "detailed",
          textVerbosity: "medium",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
      "gpt-5.2-codex-low": {
        name: "GPT 5.2 Codex Low (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "low",
          reasoningSummary: "auto",
          textVerbosity: "medium",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
      "gpt-5.2-codex-medium": {
        name: "GPT 5.2 Codex Medium (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "medium",
          reasoningSummary: "auto",
          textVerbosity: "medium",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
      "gpt-5.2-codex-high": {
        name: "GPT 5.2 Codex High (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "high",
          reasoningSummary: "detailed",
          textVerbosity: "medium",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
      "gpt-5.2-codex-xhigh": {
        name: "GPT 5.2 Codex Extra High (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "xhigh",
          reasoningSummary: "detailed",
          textVerbosity: "medium",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
      "gpt-5.1-codex-max-low": {
        name: "GPT 5.1 Codex Max Low (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "low",
          reasoningSummary: "detailed",
          textVerbosity: "medium",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
      "gpt-5.1-codex-max-medium": {
        name: "GPT 5.1 Codex Max Medium (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "medium",
          reasoningSummary: "detailed",
          textVerbosity: "medium",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
      "gpt-5.1-codex-max-high": {
        name: "GPT 5.1 Codex Max High (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "high",
          reasoningSummary: "detailed",
          textVerbosity: "medium",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
      "gpt-5.1-codex-max-xhigh": {
        name: "GPT 5.1 Codex Max Extra High (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "xhigh",
          reasoningSummary: "detailed",
          textVerbosity: "medium",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
      "gpt-5.1-codex-low": {
        name: "GPT 5.1 Codex Low (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "low",
          reasoningSummary: "auto",
          textVerbosity: "medium",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
      "gpt-5.1-codex-medium": {
        name: "GPT 5.1 Codex Medium (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "medium",
          reasoningSummary: "auto",
          textVerbosity: "medium",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
      "gpt-5.1-codex-high": {
        name: "GPT 5.1 Codex High (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "high",
          reasoningSummary: "detailed",
          textVerbosity: "medium",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
      "gpt-5.1-codex-mini-medium": {
        name: "GPT 5.1 Codex Mini Medium (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "medium",
          reasoningSummary: "auto",
          textVerbosity: "medium",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
      "gpt-5.1-codex-mini-high": {
        name: "GPT 5.1 Codex Mini High (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "high",
          reasoningSummary: "detailed",
          textVerbosity: "medium",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
      "gpt-5.1-none": {
        name: "GPT 5.1 None (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "none",
          reasoningSummary: "auto",
          textVerbosity: "medium",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
      "gpt-5.1-low": {
        name: "GPT 5.1 Low (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "low",
          reasoningSummary: "auto",
          textVerbosity: "low",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
      "gpt-5.1-medium": {
        name: "GPT 5.1 Medium (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "medium",
          reasoningSummary: "auto",
          textVerbosity: "medium",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
      "gpt-5.1-high": {
        name: "GPT 5.1 High (OAuth)",
        limit: { context: 272000, output: 128000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          reasoningEffort: "high",
          reasoningSummary: "detailed",
          textVerbosity: "high",
          include: ["reasoning.encrypted_content"],
          store: false,
        },
      },
    },
  },
  "google-ai": {
    npm: "@ai-sdk/google",
    name: "Google AI Studio",
    models: {
      "gemini-3-pro-high": {
        id: "models/gemini-3-pro-preview",
        name: "Gemini 3 Pro High",
        options: { thinkingLevel: "high", includeThoughts: true },
      },
      "gemini-3-pro-medium": {
        id: "models/gemini-3-pro-preview",
        name: "Gemini 3 Pro Medium",
        options: { thinkingLevel: "medium", includeThoughts: true },
      },
      "gemini-3-pro-low": {
        id: "models/gemini-3-pro-preview",
        name: "Gemini 3 Pro Low",
        options: { thinkingLevel: "low", includeThoughts: true },
      },
      "gemini-3-flash-high": {
        id: "models/gemini-3-flash-preview",
        name: "Gemini 3 Flash High",
        options: { thinkingLevel: "high", includeThoughts: true },
      },
      "gemini-3-flash-medium": {
        id: "models/gemini-3-flash-preview",
        name: "Gemini 3 Flash Medium",
        options: { thinkingLevel: "medium", includeThoughts: true },
      },
      "gemini-3-flash-low": {
        id: "models/gemini-3-flash-preview",
        name: "Gemini 3 Flash Low",
        options: { thinkingLevel: "low", includeThoughts: true },
      },
    },
  },
  // Anthropic 프로바이더 - Claude 모델 설정
  anthropic: {
    npm: "@ai-sdk/anthropic",
    name: "Anthropic",
    models: {
      // Claude Opus 4.5 - Extended Thinking 활성화 (high effort)
      "claude-opus-4-5-high": {
        id: "claude-opus-4-5-20251101",
        name: "Claude Opus 4.5 high",
        limit: { context: 200000, output: 32000 },
        modalities: { input: ["text", "image"], output: ["text"] },
        options: {
          effort: "high",
          thinking: { type: "enabled", budgetTokens: 50000 },
        },
      },
    },
  },
}
