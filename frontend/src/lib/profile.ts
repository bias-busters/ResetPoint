const STORAGE_KEY = "resetpoint_profile"

export interface UserProfile {
  displayName: string
  /** Optional emoji or short string used as avatar (e.g. "📈" or "JD") */
  avatar?: string
}

const defaultProfile: UserProfile = {
  displayName: "",
  avatar: "",
}

/** Safe read: only runs in browser. Returns default profile on SSR or missing data. */
export function getProfile(): UserProfile {
  if (typeof window === "undefined") return defaultProfile
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultProfile
    const parsed = JSON.parse(raw) as Partial<UserProfile>
    return {
      displayName: parsed.displayName ?? defaultProfile.displayName,
      avatar: parsed.avatar ?? defaultProfile.avatar,
    }
  } catch {
    return defaultProfile
  }
}

/** Save profile to localStorage. No-op on SSR. */
export function setProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // quota or disabled storage
  }
}
