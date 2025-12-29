#!/usr/bin/env node

import { intro, outro, select, isCancel, cancel, note } from "@clack/prompts"
import pc from "picocolors"

import { PROVIDER_PRESET } from "./provider-preset"
import { mergeProviderId, summarizeProviderDiff, type ConflictMode, type ProviderId } from "./merge-provider"
import {
  resolveOpenCodeConfigPath,
  ensureOpenCodeConfigExists,
  readOpenCodeConfig,
  backupOpenCodeConfig,
  writeProviderId,
} from "./opencode-config"

/**
 * npx @j-token/easy-opencode CLI
 * - ~/.config/opencode/opencode.jsonc(json)에서 provider(openai, google-ai)만 병합한다.
 * - 충돌은 providerId 단위로 1회만 묻는다.
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printHelp()
    return
  }

  intro(pc.bold("easy-opencode provider sync"))

  const { path } = resolveOpenCodeConfigPath()
  await ensureOpenCodeConfigExists(path)

  const { raw, data } = await readOpenCodeConfig(path)

  const provider = (data && typeof data === "object" ? (data as any).provider : undefined) ?? {}

  const providerIds: ProviderId[] = ["openai", "google-ai"]

  const planned: Array<{ providerId: ProviderId; mode: ConflictMode | "skip"; summary: ReturnType<typeof summarizeProviderDiff> }> = []

  for (const providerId of providerIds) {
    const presetValue = (PROVIDER_PRESET as any)[providerId]
    const targetValue = provider[providerId]

    const summary = summarizeProviderDiff(targetValue, presetValue)

    if (summary.addedCount === 0 && summary.conflictCount === 0) {
      planned.push({ providerId, mode: "skip", summary })
      continue
    }

    const chosen = await chooseConflictMode(providerId, summary, args.onConflict)
    if (chosen === "quit") {
      cancel("사용자 요청으로 중단했습니다.")
      process.exit(1)
      return
    }

    planned.push({ providerId, mode: chosen, summary })
  }

  const toApply = planned.filter((p) => p.mode !== "skip")

  if (toApply.length === 0) {
    outro(pc.green("변경 사항이 없습니다."))
    return
  }

  if (args.dryRun) {
    for (const p of toApply) {
      note(formatSummaryLine(p.providerId, p.summary), pc.cyan("dry-run"))
    }
    outro(pc.green("dry-run 완료"))
    return
  }

  let backupPath: string | null = null
  if (!args.noBackup) {
    backupPath = await backupOpenCodeConfig(path)
  }

  let currentRaw = raw
  for (const p of toApply) {
    const presetValue = (PROVIDER_PRESET as any)[p.providerId]
    const targetValue = provider[p.providerId]

    const merged = mergeProviderId(targetValue, presetValue, p.mode as ConflictMode)

    const writeResult = await writeProviderId({
      path,
      raw: currentRaw,
      providerId: p.providerId,
      providerValue: merged,
    })
    currentRaw = writeResult.updatedRaw
  }

  if (backupPath) {
    note(backupPath, pc.dim("backup"))
  }

  outro(pc.green("provider 설정을 반영했습니다."))
}

/**
 * CLI 인자를 파싱한다.
 */
function parseArgs(argv: string[]): {
  dryRun: boolean
  noBackup: boolean
  help: boolean
  onConflict: "ask" | "overwrite" | "keep"
} {
  let dryRun = false
  let noBackup = false
  let help = false
  let onConflict: "ask" | "overwrite" | "keep" = "ask"

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]

    if (a === "--dry-run") {
      dryRun = true
      continue
    }

    if (a === "--no-backup") {
      noBackup = true
      continue
    }

    if (a === "--help" || a === "-h") {
      help = true
      continue
    }

    if (a === "--on-conflict") {
      const v = argv[i + 1]
      if (v === "ask" || v === "overwrite" || v === "keep") {
        onConflict = v
        i++
        continue
      }
      throw new Error("--on-conflict expects one of: ask|overwrite|keep")
    }

    throw new Error(`Unknown argument: ${a}`)
  }

  return { dryRun, noBackup, help, onConflict }
}

/**
 * help를 출력한다.
 */
function printHelp(): void {
  const lines = [
    "npx @j-token/easy-opencode",
    "",
    "Options:",
    "  --dry-run          변경 요약만 출력하고 파일은 수정하지 않습니다.",
    "  --on-conflict <m>   ask|overwrite|keep (기본 ask)",
    "  --no-backup         백업 파일을 생성하지 않습니다.",
    "  -h, --help          도움말 출력",
    "",
    "Scope:",
    "  - provider.openai / provider.google-ai 만 병합합니다.",
    "  - opencode.jsonc가 있으면 우선 수정합니다.",
  ]

  // eslint-disable-next-line no-console
  console.log(lines.join("\n"))
}

/**
 * providerId 단위로 충돌 처리 방식을 결정한다.
 */
async function chooseConflictMode(
  providerId: ProviderId,
  summary: ReturnType<typeof summarizeProviderDiff>,
  onConflict: "ask" | "overwrite" | "keep"
): Promise<ConflictMode | "skip" | "quit"> {
  if (summary.conflictCount === 0) {
    // 충돌이 없으면 자동으로 overwrite 모드로 병합해도 안전(추가만 발생)
    return "overwrite"
  }

  if (onConflict === "overwrite") return "overwrite"
  if (onConflict === "keep") return "keep"

  // TTY가 아니면 대화형 진행이 불가능하다.
  if (!process.stdin.isTTY) {
    throw new Error("Non-interactive terminal: use --on-conflict overwrite|keep")
  }

  const title = `${providerId}: 추가 ${summary.addedCount}개 / 충돌 ${summary.conflictCount}개`

  const selected = await select({
    message: `${title}\n어떻게 처리할까요?`,
    options: [
      {
        label: "충돌 키만 프리셋으로 덮어쓰기 (추가 키는 항상 추가)",
        value: "overwrite" as const,
      },
      {
        label: "충돌 키는 유지하고, 추가 키만 반영",
        value: "keep" as const,
      },
      {
        label: "이번 providerId는 건너뛰기",
        value: "skip" as const,
      },
      {
        label: "중단",
        value: "quit" as const,
      },
    ],
  })

  if (isCancel(selected)) {
    return "quit"
  }

  return selected
}

/**
 * 요약 문자열을 만든다.
 */
function formatSummaryLine(providerId: ProviderId, summary: ReturnType<typeof summarizeProviderDiff>): string {
  return `${providerId}: added=${summary.addedCount}, conflicts=${summary.conflictCount}`
}

main().catch((e) => {
  cancel(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
