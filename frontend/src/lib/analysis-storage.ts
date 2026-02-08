const STORAGE_KEY = "resetpoint_last_analysis"

/** Returns the last analysis from localStorage, or null. Safe for SSR. */
export function getLastAnalysis(): unknown {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Saves the analysis result to localStorage so it survives navigation/refresh. */
export function setLastAnalysis(data: unknown): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // quota or disabled
  }
}

/** Clears the stored analysis (e.g. when user clicks "Analyze New File"). */
export function clearLastAnalysis(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}
