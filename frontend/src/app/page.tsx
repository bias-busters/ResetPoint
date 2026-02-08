"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import axios from "axios"
import { AlertTriangle, TrendingUp, Activity, BrainCircuit, RotateCcw, BarChart3, User, Volume2, Loader2, MessageCircle, ChevronDown, ChevronRight } from "lucide-react"
import { UploadZone } from "@/components/upload-zone"
import { BiasRadar } from "@/components/bias-radar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { getLastAnalysis, setLastAnalysis, clearLastAnalysis } from "@/lib/analysis-storage"


// Define the shape of the data returning from FastAPI
interface AnalysisResponse {
  status: string
  metadata: {
    filename: string
    total_trades: number
    account_balance: number
    net_profit: number
  }
  equity_curve: any[]
  biases: {
    overtrading: { detected: boolean; summary: string; metric?: string; examples?: any[] }
    loss_aversion: { detected: boolean; summary: string; ratio?: number; examples?: any[] }
    revenge_trading: { detected: boolean; summary: string; metric?: string; examples?: any[] }
    monte_carlo: { detected: boolean; summary: string; metric?: string; examples?: any[] }
    disposition: { detected: boolean; summary: string; metric?: string; examples?: any[] }
    recency_bias: { detected: boolean; summary: string; metric?: string; examples?: any[] }
  }
  ai_advice: string[]
  message?: string 
}

const COACH_QUESTIONS: { label: string; children?: { label: string }[] }[] = [
  { label: "What is revenge trading?" },
  { label: "What is loss aversion?" },
  { label: "What did my analysis find?", children: [
    { label: "Explain my overtrading result" },
    { label: "Why did you recommend a break?" },
    { label: "What does my bias radar mean?" },
  ]},
  { label: "How can I improve?", children: [
    { label: "One rule I can try today" },
    { label: "How do I stick to my rules?" },
  ]},
]

export default function Dashboard() {
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedBias, setSelectedBias] = useState<{ title: string; data: any } | null>(null)
  const [listenLoading, setListenLoading] = useState(false)
  const [listenError, setListenError] = useState<string | null>(null)
  const [coachAnswer, setCoachAnswer] = useState<string | null>(null)
  const [coachLoading, setCoachLoading] = useState(false)
  const [coachListenLoading, setCoachListenLoading] = useState(false)
  const [coachExpanded, setCoachExpanded] = useState<Record<number, boolean>>({})
  const adviceAudioRef = useRef<{ audio: HTMLAudioElement; url: string } | null>(null)

  // Restore last analysis after navigation or refresh so "Back to Dashboard" shows results again
  useEffect(() => {
    const saved = getLastAnalysis()
    if (saved && typeof saved === "object" && saved !== null && "status" in saved && "biases" in saved) {
      setResult(saved as AnalysisResponse)
    }
  }, [])

  const handleAnalyze = async () => {
    if (!file) return
    setIsLoading(true)
    setError(null)
    
    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await axios.post("http://localhost:8000/analyze", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setResult(response.data)
      setLastAnalysis(response.data)
    } catch (err) {
      setError("Analysis failed. Ensure backend is running.")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setResult(null)
    clearLastAnalysis()
  }

  const buildCoachContext = (): string | undefined => {
    if (!result) return undefined
    const parts = []
    const b = result.biases
    const detected = Object.entries(b).filter(([, v]) => v?.detected).map(([k]) => k)
    if (detected.length) parts.push("Detected: " + detected.join(", "))
    if (result.ai_advice?.length) parts.push("AI advice: " + result.ai_advice.join(" "))
    return parts.length ? parts.join("\n") : undefined
  }

  const handleListenToAdvice = async () => {
    if (!result?.ai_advice?.length) return
    if (adviceAudioRef.current?.audio && !adviceAudioRef.current.audio.paused) {
      adviceAudioRef.current.audio.pause()
      adviceAudioRef.current.audio.currentTime = 0
      URL.revokeObjectURL(adviceAudioRef.current.url)
      adviceAudioRef.current = null
      return
    }
    setListenError(null)
    setListenLoading(true)
    const text = result.ai_advice.join(" ")
    try {
      const res = await fetch("http://localhost:8000/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
      if (res.status === 503) {
        setListenError("Voice not configured. Add ELEVENLABS_API_KEY to backend .env.")
        return
      }
      if (!res.ok) {
        const msg = await res.text().catch(() => "Voice unavailable.")
        setListenError(msg || "Voice unavailable.")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      adviceAudioRef.current = { audio, url }
      audio.onended = () => {
        if (adviceAudioRef.current) {
          URL.revokeObjectURL(adviceAudioRef.current.url)
          adviceAudioRef.current = null
        }
      }
      await audio.play()
    } catch (e) {
      setListenError("Could not play. Is the backend running?")
      console.error(e)
    } finally {
      setListenLoading(false)
    }
  }

  const askCoach = async (question: string) => {
    setCoachAnswer(null)
    setCoachLoading(true)
    try {
      const context = buildCoachContext()
      const res = await fetch("http://localhost:8000/coach_answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context ? { question, context } : { question }),
      })
      const text = await res.text()
      let data: { reply?: string } = {}
      try {
        data = JSON.parse(text)
      } catch {
        setCoachAnswer(res.ok ? "Could not get an answer." : `Error ${res.status}: ${text.slice(0, 200)}`)
        return
      }
      setCoachAnswer(data.reply ?? "Could not get an answer.")
    } catch (e) {
      setCoachAnswer("Could not reach the coach. Is the backend running?")
      console.error(e)
    } finally {
      setCoachLoading(false)
    }
  }

  const listenToCoachAnswer = async () => {
    if (!coachAnswer) return
    setCoachListenLoading(true)
    try {
      const res = await fetch("http://localhost:8000/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: coachAnswer }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        await audio.play()
        audio.onended = () => URL.revokeObjectURL(url)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCoachListenLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-6 font-sans">
      <div className="max-w-[1600px] mx-auto space-y-4">
        
        {/* HEADER */}
        <div className="flex justify-between items-center border-b border-border pb-4">
          <div className="flex items-center gap-2"> 
            <div className="relative h-9 w-9 shrink-0"> 
              <Image 
                src="/ResetPoint-Logo.png" 
                alt="ResetPoint Logo" 
                fill 
                className="object-contain mix-blend-screen" 
              />
            </div>
            <div className="flex flex-col justify-center"> 
              <h1 className="text-2xl font-bold tracking-tight text-foreground leading-none">
                ResetPoint
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-medium mt-1">
                Behavioral Analytics
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {result && (
              <Button variant="outline" size="sm" onClick={reset}>
                Analyze New File
              </Button>
            )}
            <Link href="/profile">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                <User className="h-4 w-4" /> Profile
              </Button>
            </Link>
          </div>
        </div>

        {/* ERROR MESSAGE */}
        {error && (
          <div className="p-3 rounded bg-destructive/10 text-destructive text-sm border border-destructive/20">
            {error}
          </div>
        )}

        {/* UPLOAD VIEW */}
        {!result && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 fade-in">
            <UploadZone onFileSelect={setFile} />
            {file && (
              <Button 
                onClick={handleAnalyze} 
                disabled={isLoading} 
                className="w-full max-w-xs bg-primary text-primary-foreground shadow-[0_0_20px_rgba(59,130,246,0.25)] hover:shadow-[0_0_25px_rgba(59,130,246,0.45)] hover:bg-primary/90 transition-all duration-300"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Activity className="animate-spin h-4 w-4" /> Processing...
                  </span>
                ) : (
                  "Run Analysis"
                )}
              </Button>
            )}
            {isLoading && <Progress value={66} className="h-1 w-64" />}
          </div>
        )}

        {/* ANALYTICS DASHBOARD */}
        {result && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* === LEFT COLUMN: PSYCH PROFILE + ASK COACH (sticky) === */}
            <div className="lg:col-span-4 space-y-6 flex flex-col">
              <div className="sticky top-4 space-y-4">
              <Card className="border-border bg-card/50 shadow-md flex flex-col">
                <CardHeader className="pb-0">
                  <CardTitle className="text-lg font-medium text-muted-foreground uppercase tracking-wider">
                    Psychological Profile
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  
                
                 {/* Radar Chart Container - Tighter Spacing */}
                  <div className="flex items-center justify-center min-h-[280px] py-0 mt-2 overflow-visible">
                     {/* Scale kept at 1.25, but container is shorter to pull it up */}
                     <div className="w-full h-full scale-125 transform origin-center">
                        <BiasRadar results={result.biases} />
                     </div>
                  </div>
                  
                  {/* Account Metrics - compact to fit */}
                  <div className="mt-3 space-y-1.5 pt-3 border-t border-border bg-black/20 -mx-4 px-4 pb-2">
                    <div className="flex justify-between items-center gap-2 min-w-0">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">File</span>
                      <span className="font-mono text-[10px] text-foreground truncate" title={result.metadata?.filename || "Unknown"}>{result.metadata?.filename || "Unknown"}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Trades</span>
                      <span className="font-mono text-[10px] text-foreground">{result.metadata?.total_trades ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</span>
                      <span className={`font-mono text-xs font-bold ${(result.metadata?.account_balance || 0) >= 0 ? "text-green-500" : "text-destructive"}`}>
                        ${(result.metadata?.account_balance ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Net P/L</span>
                      <span className={`font-mono text-xs font-bold ${(result.metadata?.net_profit ?? 0) >= 0 ? "text-green-500" : "text-destructive"}`}>
                        ${(result.metadata?.net_profit ?? 0).toLocaleString()}
                      </span>
                    </div>

                     {/* Error Display */}
                    {result.status === "error" && (
                       <div className="mt-2 text-xs text-red-200 bg-red-900/20 p-2 rounded border border-red-500/20">
                          ⚠ Analysis Error: {result.message}
                       </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Ask coach - below Psychological Profile */}
              <Card className="border-border bg-card/50 shadow-sm">
                <CardHeader className="py-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" /> Ask coach
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Pick a question:</p>
                  <ul className="space-y-0.5">
                    {COACH_QUESTIONS.map((q, i) => (
                      <li key={i}>
                        <div className="flex items-center gap-0.5">
                          {q.children?.length ? (
                            <button type="button" onClick={() => setCoachExpanded((e) => ({ ...e, [i]: !e[i] }))} className="p-0.5 rounded hover:bg-muted">
                              {coachExpanded[i] ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                          ) : null}
                          <button type="button" onClick={() => askCoach(q.label)} disabled={coachLoading} className="text-left text-xs text-foreground hover:text-primary hover:underline py-1 px-1.5 rounded flex-1">
                            {q.label}
                          </button>
                        </div>
                        {q.children?.length && coachExpanded[i] ? (
                          <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
                            {q.children.map((sub, j) => (
                              <li key={j}>
                                <button type="button" onClick={() => askCoach(sub.label)} disabled={coachLoading} className="text-left text-xs text-muted-foreground hover:text-foreground hover:underline py-0.5">
                                  {sub.label}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {coachLoading && <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Getting answer...</p>}
                  {coachAnswer && (
                    <div className="mt-2 p-2 rounded-md bg-muted/50 border border-border">
                      <p className="text-xs text-foreground whitespace-pre-wrap">{coachAnswer}</p>
                      <Button variant="outline" size="sm" className="mt-1.5 h-7 text-xs gap-1" onClick={listenToCoachAnswer} disabled={coachListenLoading}>
                        {coachListenLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Volume2 className="h-3 w-3" />}
                        Listen
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              </div>
            </div>

            {/* === RIGHT COLUMN: BIAS GRID + AI === */}
            <div className="lg:col-span-8 space-y-6 flex flex-col h-full">
              
              {/* 1. The Bias Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                
                <BiasCard 
                    title="Overtrading" 
                    data={result.biases.overtrading} 
                    icon={<TrendingUp className="h-5 w-5" />} 
                    onViewDetails={() => setSelectedBias({ title: "Overtrading", data: result.biases.overtrading })}
                />

                <BiasCard 
                    title="Loss Aversion" 
                    data={result.biases.loss_aversion} 
                    icon={<AlertTriangle className="h-5 w-5" />} 
                    onViewDetails={() => setSelectedBias({ title: "Loss Aversion", data: result.biases.loss_aversion })}
                />

                <BiasCard 
                    title="Revenge Trading" 
                    data={result.biases.revenge_trading} 
                    icon={<BrainCircuit className="h-5 w-5" />} 
                    onViewDetails={() => setSelectedBias({ title: "Revenge Trading", data: result.biases.revenge_trading })}
                />

                <BiasCard 
                    title="Disposition Effect" 
                    data={result.biases.disposition} 
                    icon={<BarChart3 className="h-5 w-5" />} 
                    onViewDetails={() => setSelectedBias({ title: "Disposition Effect", data: result.biases.disposition })}
                />

                <BiasCard 
                    title="Monte Carlo Fallacy" 
                    data={result.biases.monte_carlo} 
                    icon={<RotateCcw className="h-5 w-5" />} 
                    onViewDetails={() => setSelectedBias({ title: "Monte Carlo", data: result.biases.monte_carlo })}
                />

                <BiasCard 
                    title="Recency Bias" 
                    data={result.biases.recency_bias} 
                    icon={<Activity className="h-5 w-5" />} 
                    onViewDetails={() => setSelectedBias({ title: "Recency Bias", data: result.biases.recency_bias })}
                />
              </div>

              {/* 2. AI Coach Card */}
              <Card className="bg-primary/5 border-primary/20 mt-auto">
                <CardHeader className="py-2 flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4" /> AI Strategy Adjustments
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleListenToAdvice}
                    disabled={listenLoading || !result.ai_advice?.length}
                    className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    {listenLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                    Listen to advice
                  </Button>
                </CardHeader>
                {listenError && <div className="px-6 pb-1 text-xs text-destructive">{listenError}</div>}
                <CardContent className="pt-0 pb-3 text-sm text-muted-foreground"> {/* pt-0 pulls content up */}
                 <ul className="space-y-2 mt-1">
                   {result.ai_advice && result.ai_advice.length > 0 ? (
                     result.ai_advice.map((tip: string, index: number) => (
                       <li key={index} className="flex items-start gap-3 p-3 rounded-md bg-background/80 border border-white/5 shadow-sm">
                         <span className="text-blue-500 mt-0.5 text-lg">➤</span>
                         <span className="text-foreground/90 leading-relaxed">{tip}</span>
                       </li>
                     ))
                   ) : (
                     <li className="text-muted-foreground italic">Analysis pending...</li>
                   )}
                 </ul>
                </CardContent>
              </Card>

              {/* Modal Render Logic */}
              {selectedBias && (
                 <EvidenceModal bias={selectedBias} onClose={() => setSelectedBias(null)} />
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// --- CARD COMPONENT ---
// --- UPDATED HELPER COMPONENT: Bias Card with Metric ---
// --- PREMIUM BIAS CARD ---
function BiasCard({ title, data, icon, onViewDetails }: { title: string, data: any, icon: any, onViewDetails: () => void }) {
  if (!data) return null;

  return (
    <Card className={`group flex flex-col relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg
      ${data.detected 
        ? 'border-l-[4px] border-l-red-500 bg-gradient-to-br from-card to-red-950/10 border-y-0 border-r-0' 
        : 'border-l-[4px] border-l-emerald-500 bg-card border-y-0 border-r-0'
      } min-h-[170px]`}>
      
      {/* HEADER */}
      <div className="p-4 pb-2 flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg shadow-inner ${data.detected ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
            {icon}
          </div>
          <h3 className="text-sm font-bold text-foreground tracking-tight">{title}</h3>
        </div>
        
        {/* BADGE */}
        {data.detected ? (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400 uppercase tracking-wider shadow-[0_0_10px_rgba(239,68,68,0.2)]">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Detected
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Pass
          </span>
        )}
      </div>

      {/* CONTENT */}
      <CardContent className="flex-grow flex flex-col justify-between p-4 pt-1">
        
        {/* Summary Text */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {data.summary}
        </p>

        {/* METRIC BOX (Only if metric exists) */}
        {data.metric && (
          <div className="mt-3 bg-black/20 rounded-md px-3 py-2 border border-white/5 flex justify-between items-center group-hover:border-white/10 transition-colors">
             <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Metric</span>
             <span className={`text-xs font-mono font-bold ${data.detected ? 'text-red-300' : 'text-emerald-300'}`}>
               {data.metric}
             </span>
          </div>
        )}

        {/* ACTION AREA */}
        <div className="mt-4 pt-2 border-t border-white/5">
           {data.detected ? (
             <button 
                onClick={onViewDetails}
                className="w-full relative overflow-hidden bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-semibold py-2 rounded-md transition-all flex items-center justify-center gap-2 group/btn"
             >
                <span className="relative z-10">View Evidence</span>
                <span className="relative z-10 group-hover/btn:translate-x-1 transition-transform">→</span>
             </button>
           ) : (
             <div className="flex items-center justify-center gap-2 w-full py-2 text-[10px] text-emerald-500/50 font-medium uppercase tracking-widest select-none">
                <span className="w-1 h-1 rounded-full bg-emerald-500/50" />
                Within Limits
                <span className="w-1 h-1 rounded-full bg-emerald-500/50" />
             </div>
           )}
        </div>
      </CardContent>
    </Card>
  )
}
// --- EVIDENCE MODAL ---
function EvidenceModal({ bias, onClose }: { bias: any, onClose: () => void }) {
  if (!bias) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#1e222d] border border-white/10 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
               Evidence Locker
            </h3>
            <p className="text-sm text-red-400 font-medium mt-0.5">{bias.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors">✕</button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {bias.data.examples && bias.data.examples.length > 0 ? (
            bias.data.examples.map((ex: any, i: number) => (
              <div key={i} className="p-4 bg-black/40 rounded-lg border border-red-500/20 hover:border-red-500/40 transition-colors">
                 <div className="flex justify-between text-xs text-gray-400 mb-2 font-mono uppercase tracking-wide">
                    <span>{ex.trade_id ? `Trade ID: ${ex.trade_id}` : 'System Event'}</span>
                    <span>{ex.date}</span>
                 </div>
                 
                 <div className="flex justify-between items-center gap-4">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-200">
                         {ex.reason || ex.metric || ex.context}
                      </div>
                    </div>
                    
                    {ex.pnl !== undefined && (
                        <div className={`text-sm font-mono font-bold px-3 py-1 rounded ${ex.pnl >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                           {ex.pnl >= 0 ? '+' : ''}{ex.pnl}
                        </div>
                    )}
                 </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 flex flex-col items-center">
               <div className="p-4 rounded-full bg-white/5 mb-3">
                 <RotateCcw className="h-6 w-6 text-gray-500" />
               </div>
               <p className="text-gray-400 font-medium">No specific trade examples returned.</p>
               <p className="text-sm text-gray-600 mt-1 max-w-xs">The bias was detected via aggregate statistical patterns rather than isolated events.</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end shrink-0">
          <Button variant="secondary" onClick={onClose}>Close Evidence</Button>
        </div>
      </div>
    </div>
  );
}