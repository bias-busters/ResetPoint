"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { getProfile, setProfile, type UserProfile } from "@/lib/profile"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { User, Pencil, ArrowLeft } from "lucide-react"

export default function ProfilePage() {
  const [profile, setProfileState] = useState<UserProfile>({ displayName: "", avatar: "" })
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<UserProfile>({ displayName: "", avatar: "" })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setProfileState(getProfile())
    setForm(getProfile())
    setMounted(true)
  }, [])

  const handleSave = () => {
    const next = { ...form }
    setProfile(next)
    setProfileState(next)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setForm(profile)
    setIsEditing(false)
  }

  if (!mounted) {
    return (
      <main className="min-h-screen bg-background text-foreground p-4 md:p-6 font-sans">
        <div className="max-w-xl mx-auto">
          <div className="animate-pulse h-8 w-48 bg-muted rounded mb-6" />
          <div className="animate-pulse h-40 bg-muted rounded" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-6 font-sans">
      <div className="max-w-xl mx-auto space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
        </div>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <User className="h-4 w-4" /> User Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isEditing ? (
              <>
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-2xl border border-border">
                    {profile.avatar || (profile.displayName ? profile.displayName.slice(0, 2).toUpperCase() : "?")}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {profile.displayName || "No name set"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setForm(profile)
                    setIsEditing(true)
                  }}
                  className="gap-2"
                >
                  <Pencil className="h-4 w-4" /> Edit profile
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div>
                  <label htmlFor="displayName" className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Display name
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    value={form.displayName}
                    onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
                    placeholder="e.g. Trader Alex"
                    className="w-full h-9 px-3 rounded-md border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  />
                </div>
                <div>
                  <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Choose an emoji
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "📈", "📉", "💰", "🎯", "🧠", "📊", "✅", "⚡", "🔒", "🎲",
                      "🦁", "🦅", "🐺", "🦉", "💎", "🔥", "🌟", "🚀", "⚖️", " ",
                    ].map((emoji) => (
                      <button
                        key={emoji === " " ? "none" : emoji}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, avatar: emoji === " " ? "" : emoji }))}
                        className={`h-10 w-10 rounded-md border text-xl flex items-center justify-center transition-colors ${
                          (emoji === " " ? !form.avatar : form.avatar === emoji)
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-muted/50 text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                        }`}
                        title={emoji === " " ? "No emoji" : undefined}
                      >
                        {emoji === " " ? "—" : emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} className="gap-2">
                    Save
                  </Button>
                  <Button variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Profile is stored only on this device. Clearing site data will restore default settings.
        </p>
      </div>
    </main>
  )
}
