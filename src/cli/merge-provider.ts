/**
 * provider 병합 로직
 * - providerId 단위로 1회만 물어보고 처리한다.
 * - 내부는 deep merge
 * - 충돌 키만 overwrite/keep 한다.
 */

export type ProviderId = "openai" | "google"

export type ConflictMode = "overwrite" | "keep"

export type ProviderDiffSummary = {
  addedCount: number
  conflictCount: number
  conflictPaths: string[]
}

/**
 * providerId 단위로 diff를 계산한다.
 */
export function summarizeProviderDiff(target: unknown, preset: unknown): ProviderDiffSummary {
  const added: string[] = []
  const conflicts: string[] = []

  walkDiff(target, preset, "", added, conflicts)

  return {
    addedCount: added.length,
    conflictCount: conflicts.length,
    conflictPaths: conflicts,
  }
}

/**
 * providerId 단위로 병합을 수행한다.
 * - missing은 항상 preset 값을 추가
 * - conflict는 mode에 따라 overwrite/keep
 */
export function mergeProviderId(
  target: unknown,
  preset: unknown,
  mode: ConflictMode
): unknown {
  return mergeRecursive(target, preset, mode)
}

/**
 * diff를 재귀적으로 계산한다.
 */
function walkDiff(
  target: unknown,
  preset: unknown,
  path: string,
  added: string[],
  conflicts: string[]
): void {
  if (preset === undefined) {
    return
  }

  if (target === undefined) {
    added.push(path || "(root)")
    return
  }

  if (isPrimitive(preset) || isPrimitive(target)) {
    if (!deepEqual(target, preset)) {
      conflicts.push(path || "(root)")
    }
    return
  }

  // 배열은 atomic 으로 취급한다.
  if (Array.isArray(preset) || Array.isArray(target)) {
    if (!deepEqual(target, preset)) {
      conflicts.push(path || "(root)")
    }
    return
  }

  if (!isPlainObject(target) || !isPlainObject(preset)) {
    if (!deepEqual(target, preset)) {
      conflicts.push(path || "(root)")
    }
    return
  }

  const presetEntries = Object.entries(preset)
  for (const [key, presetValue] of presetEntries) {
    const nextPath = path ? `${path}.${key}` : key
    const targetValue = (target as Record<string, unknown>)[key]
    if (targetValue === undefined) {
      added.push(nextPath)
      continue
    }
    walkDiff(targetValue, presetValue, nextPath, added, conflicts)
  }
}

/**
 * 재귀적으로 병합한다.
 */
function mergeRecursive(target: unknown, preset: unknown, mode: ConflictMode): unknown {
  if (preset === undefined) {
    return target
  }

  if (target === undefined) {
    return clone(preset)
  }

  if (isPrimitive(preset) || isPrimitive(target)) {
    if (deepEqual(target, preset)) return target
    return mode === "overwrite" ? clone(preset) : target
  }

  // 배열은 atomic 으로 취급한다.
  if (Array.isArray(preset) || Array.isArray(target)) {
    if (deepEqual(target, preset)) return target
    return mode === "overwrite" ? clone(preset) : target
  }

  if (!isPlainObject(target) || !isPlainObject(preset)) {
    if (deepEqual(target, preset)) return target
    return mode === "overwrite" ? clone(preset) : target
  }

  const out: Record<string, unknown> = { ...(target as Record<string, unknown>) }

  for (const [key, presetValue] of Object.entries(preset)) {
    const targetValue = (target as Record<string, unknown>)[key]
    out[key] = mergeRecursive(targetValue, presetValue, mode)
  }

  return out
}

/**
 * 원시 타입인지 판별한다.
 */
function isPrimitive(v: unknown): boolean {
  return v === null || v === undefined || typeof v === "string" || typeof v === "number" || typeof v === "boolean"
}

/**
 * 일반 객체인지 판별한다.
 */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object") return false
  if (Array.isArray(v)) return false
  return Object.getPrototypeOf(v) === Object.prototype
}

/**
 * 깊은 동등 비교
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true

  if (isPrimitive(a) || isPrimitive(b)) {
    return a === b
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false
    }
    return true
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a)
    const bk = Object.keys(b)
    if (ak.length !== bk.length) return false
    for (const k of ak) {
      if (!Object.prototype.hasOwnProperty.call(b, k)) return false
      if (!deepEqual(a[k], b[k])) return false
    }
    return true
  }

  return false
}

/**
 * 값을 복제한다.
 */
function clone<T>(v: T): T {
  if (v === null || v === undefined) return v
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v
  return JSON.parse(JSON.stringify(v)) as T
}
