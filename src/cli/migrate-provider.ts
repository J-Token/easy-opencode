/**
 * provider 마이그레이션 로직
 * - google-ai → google으로 마이그레이션
 * - 기존 사용자의 설정을 자동으로 이동
 */

import { confirm } from "@clack/prompts"
import pc from "picocolors"

import { mergeProviderId } from "./merge-provider"
import { writeProviderId } from "./opencode-config"

/**
 * 마이그레이션 필요 여부를 확인하는 결과 타입
 */
export type MigrationCheckResult = {
  /** 마이그레이션이 필요한지 여부 */
  needed: boolean
  /** google-ai 설정이 존재하는지 여부 */
  hasGoogleAi: boolean
  /** google 설정이 존재하는지 여부 */
  hasGoogle: boolean
  /** google-ai 설정 값 */
  googleAiValue: unknown
  /** google 설정 값 */
  googleValue: unknown
}

/**
 * 마이그레이션 실행 결과 타입
 */
export type MigrationResult = {
  /** 마이그레이션이 실행되었는지 여부 */
  executed: boolean
  /** 마이그레이션 후 google 설정 값 */
  mergedValue: unknown
  /** google-ai가 삭제되었는지 여부 */
  googleAiDeleted: boolean
  /** 업데이트된 raw JSON 문자열 */
  updatedRaw: string
}

/**
 * 값이 유효한지 확인한다. (undefined와 null 모두 무효로 처리)
 * @param value - 확인할 값
 * @returns 유효한 값이면 true
 */
function isValidValue(value: unknown): boolean {
  return value !== undefined && value !== null
}

/**
 * 마이그레이션 필요 여부를 확인한다.
 * @param provider - provider 객체 (설정 파일에서 읽어온 값)
 * @returns 마이그레이션 필요 여부 및 관련 정보
 */
export function checkMigrationNeeded(provider: Record<string, unknown>): MigrationCheckResult {
  const googleAiValue = provider["google-ai"]
  const googleValue = provider["google"]

  // null도 "존재하지 않음"으로 처리 (BUG FIX)
  const hasGoogleAi = isValidValue(googleAiValue)
  const hasGoogle = isValidValue(googleValue)

  return {
    needed: hasGoogleAi,
    hasGoogleAi,
    hasGoogle,
    googleAiValue,
    googleValue,
  }
}

/**
 * 사용자에게 마이그레이션 확인을 요청한다.
 * - TTY가 아니면 에러를 발생시킨다.
 * @param checkResult - 마이그레이션 체크 결과
 * @returns 사용자가 확인했으면 true, 취소했으면 false
 */
export async function promptMigration(checkResult: MigrationCheckResult): Promise<boolean> {
  // non-TTY 환경에서는 대화형 진행이 불가능하다
  if (!process.stdin.isTTY) {
    throw new Error("Non-interactive terminal: migration requires user confirmation")
  }

  const message = checkResult.hasGoogle
    ? `${pc.yellow("google-ai")}와 ${pc.green("google")} 설정이 모두 존재합니다.\n두 설정을 병합하고 ${pc.yellow("google-ai")}를 ${pc.green("google")}으로 마이그레이션할까요?`
    : `${pc.yellow("google-ai")} 설정이 발견되었습니다.\n${pc.green("google")}으로 마이그레이션할까요?`

  const result = await confirm({
    message,
    initialValue: true,
  })

  // isCancel 체크
  if (typeof result !== "boolean") {
    return false
  }

  return result
}

/**
 * 사용자에게 google-ai 키 삭제 확인을 요청한다.
 * @returns 사용자가 삭제를 확인했으면 true, 아니면 false
 */
export async function promptDeleteOldKey(): Promise<boolean> {
  // non-TTY 환경에서는 대화형 진행이 불가능하다
  if (!process.stdin.isTTY) {
    return false
  }

  const result = await confirm({
    message: `기존 ${pc.yellow("google-ai")} 키를 삭제할까요?`,
    initialValue: true,
  })

  // isCancel 체크
  if (typeof result !== "boolean") {
    return false
  }

  return result
}

/**
 * 마이그레이션을 실행한다.
 * - google-ai 값을 google으로 이동/병합한다.
 * - 사용자 확인 후 google-ai 키를 삭제한다.
 * @param args - 마이그레이션 실행에 필요한 인자
 * @returns 마이그레이션 결과
 */
export async function executeMigration(args: {
  /** 설정 파일 경로 */
  path: string
  /** 설정 파일 raw JSON 문자열 */
  raw: string
  /** 마이그레이션 체크 결과 */
  checkResult: MigrationCheckResult
  /** dry-run 모드 여부 */
  dryRun: boolean
}): Promise<MigrationResult> {
  const { path, raw, checkResult, dryRun } = args
  const { hasGoogle, googleAiValue, googleValue } = checkResult

  // 병합된 값 계산
  // - google만 있으면 google-ai 값을 그대로 사용
  // - 둘 다 있으면 google 값 우선으로 병합
  let mergedValue: unknown

  if (hasGoogle) {
    // 둘 다 있는 경우: google 값 우선으로 병합 ("keep" 모드)
    // google 값을 기준으로 google-ai의 고유 키만 추가
    mergedValue = mergeProviderId(googleValue, googleAiValue, "keep")
  } else {
    // google-ai만 있는 경우: google-ai 값을 그대로 사용
    mergedValue = googleAiValue
  }

  // dry-run 모드면 실제 파일 수정 없이 반환
  if (dryRun) {
    return {
      executed: true,
      mergedValue,
      googleAiDeleted: false,
      updatedRaw: raw,
    }
  }

  // google 키에 병합된 값 쓰기
  let currentRaw = raw
  const writeGoogleResult = await writeProviderId({
    path,
    raw: currentRaw,
    providerId: "google",
    providerValue: mergedValue,
  })
  currentRaw = writeGoogleResult.updatedRaw

  // google-ai 키 삭제 확인
  const shouldDelete = await promptDeleteOldKey()

  if (shouldDelete) {
    // google-ai 키 삭제 (undefined 전달)
    const deleteResult = await writeProviderId({
      path,
      raw: currentRaw,
      providerId: "google-ai",
      providerValue: undefined,
    })
    currentRaw = deleteResult.updatedRaw

    return {
      executed: true,
      mergedValue,
      googleAiDeleted: true,
      updatedRaw: currentRaw,
    }
  }

  return {
    executed: true,
    mergedValue,
    googleAiDeleted: false,
    updatedRaw: currentRaw,
  }
}

/**
 * 마이그레이션 완료 메시지를 생성한다.
 * @param result - 마이그레이션 결과
 * @returns 완료 메시지 문자열
 */
export function formatMigrationMessage(result: MigrationResult): string {
  if (!result.executed) {
    return ""
  }

  const deleteMessage = result.googleAiDeleted
    ? `, ${pc.yellow("google-ai")} 키 삭제됨`
    : ""

  return `${pc.yellow("google-ai")} → ${pc.green("google")} 마이그레이션 완료${deleteMessage}`
}

/**
 * dry-run 모드에서 마이그레이션 후 provider 상태를 시뮬레이션한다.
 * - 파일을 실제로 수정하지 않고 메모리에서만 마이그레이션 결과를 계산한다.
 * - 이를 통해 이후 프리셋 diff 계산이 정확해진다.
 * @param provider - 원본 provider 객체
 * @param checkResult - 마이그레이션 체크 결과
 * @returns 마이그레이션 후 provider 객체 (시뮬레이션)
 */
export function simulateMigration(
  provider: Record<string, unknown>,
  checkResult: MigrationCheckResult
): Record<string, unknown> {
  const { hasGoogle, googleAiValue, googleValue } = checkResult

  // 병합된 값 계산
  let mergedValue: unknown

  if (hasGoogle) {
    // 둘 다 있는 경우: google 값 우선으로 병합
    mergedValue = mergeProviderId(googleValue, googleAiValue, "keep")
  } else {
    // google-ai만 있는 경우: google-ai 값을 그대로 사용
    mergedValue = googleAiValue
  }

  // 시뮬레이션: google에 병합된 값 설정, google-ai는 유지 (삭제 확인 전이므로)
  return {
    ...provider,
    google: mergedValue,
  }
}
