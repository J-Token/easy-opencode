/**
 * 두 객체를 깊게 merge 한다.
 * - 배열은 override(대체)한다
 * - 객체는 재귀적으로 merge 한다
 */
export function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }

  for (const [key, value] of Object.entries(override)) {
    const prev = out[key]

    if (Array.isArray(value)) {
      out[key] = value
      continue
    }

    if (isPlainObject(prev) && isPlainObject(value)) {
      out[key] = deepMerge(prev, value)
      continue
    }

    out[key] = value
  }

  return out
}

/**
 * 일반 객체인지 판별한다.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false
  if (Array.isArray(value)) return false
  return Object.getPrototypeOf(value) === Object.prototype
}
