"use client"

import Image from "next/image"
import { useState } from "react"
import axios from "axios"
import { AlertTriangle, TrendingUp, Activity, BrainCircuit, RotateCcw, BarChart3 } from "lucide-react"
import { UploadZone } from "@/components/upload-zone"
import { BiasRadar } from "@/components/bias-radar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"


// Define the shape of the data returning from FastAPI
interface AnalysisResponse {
  status: string
  metadata: {
    filename: string
    total_trades: number
    account_balance: number
    net_profit: number
  }
  biases: {
    overtrading: { detected: boolean; summary: string; metric?: string }
    loss_aversion: { detected: boolean; summary: string; ratio?: number }
    revenge_trading: { detected: boolean; summary: string; metric?: string }
    monte_carlo: { detected: boolean; summary: string; metric?: string }
    disposition: { detected: boolean; summary: string; metric?: string }
    recency_bias: { detected: boolean; summary: string; metric?: string }
  }
  // This array comes from the new 'generate_ai_advice' function in backend
  ai_advice: string[]
}

export default function Dashboard() {
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    if (!file) return
    setIsLoading(true)
    setError(null)
    
    const formData = new FormData()
    formData.append("file", file)

    try {
      // Ensure your backend is running on port 8000
      const response = await axios.post("http://localhost:8000/analyze", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setResult(response.data)
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
  }

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* HEADER */}
     <div className="flex justify-between items-center border-b border-border pb-4">
          
          {/* Container for Logo + Text */}
          <div className="flex items-center gap-2"> 
            
            {/* LOGO: Increased to h-10 w-10 (40px) for better weight against the text */}
            <div className="relative h-9 w-9 shrink-0"> 
              <Image 
                src="/app-logo.png" 
                alt="ResetPoint Logo" 
                fill 
                className="object-contain mix-blend-screen" 
              />
            </div>
            
            {/* TEXT: Tightened leading (line-height) to lock it to the logo */}
            <div className="flex flex-col justify-center"> 
              <h1 className="text-2xl font-bold tracking-tight text-foreground leading-none">
                ResetPoint
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-medium mt-1">
                Behavioral Analytics
              </p>
            </div>
          </div>
          
          {result && (
            <Button variant="outline" size="sm" onClick={reset}>
              Analyze New File
            </Button>
          )}
        </div>
     

        {/* ERROR MESSAGE */}
        {error && (
          <div className="p-3 rounded bg-destructive/10 text-destructive text-sm border border-destructive/20">
            {error}
          </div>
        )}

        {/* UPLOAD VIEW (Visible when no result) */}
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

        {/* ANALYTICS DASHBOARD (Visible after analysis) */}
        {result && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* LEFT COLUMN: Sticky Radar Chart & Metrics */}
            <div className="md:col-span-4 lg:col-span-3 space-y-4 h-full">
              <Card className="border-border bg-card/50 shadow-sm sticky top-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Psychological Profile
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <BiasRadar results={result.biases} />
                  
                  {/* Embedded Account Metrics */}
                  <div className="mt-6 space-y-3 pt-4 border-t border-border">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">File</span>
                      <span className="font-mono text-foreground">{result.metadata.filename}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Trades</span>
                      <span className="font-mono text-foreground">{result.metadata.total_trades}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Balance</span>
                      <span className={`font-mono font-bold ${result.metadata.account_balance >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                        ${result.metadata.account_balance.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Net Profit</span>
                      <span className={`font-mono font-bold ${result.metadata.net_profit >= 0 ? "text-green-500" : "text-destructive"}`}>
                        ${result.metadata.net_profit.toLocaleString()}
                      </span>
                    </div>

                  </div>
                </CardContent>
              </Card>
            </div>

            {/* RIGHT COLUMN: Bias Cards & AI Coach */}
            <div className="md:col-span-8 lg:col-span-9 space-y-4">
              
              {/* THE GRID: 6 Bias Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <BiasCard title="Overtrading" data={result.biases.overtrading} icon={<TrendingUp className="h-4 w-4" />} />
                <BiasCard title="Loss Aversion" data={result.biases.loss_aversion} icon={<AlertTriangle className="h-4 w-4" />} />
                <BiasCard title="Revenge Trading" data={result.biases.revenge_trading} icon={<BrainCircuit className="h-4 w-4" />} />
                <BiasCard title="Disposition Effect" data={result.biases.disposition} icon={<BarChart3 className="h-4 w-4" />} />
                <BiasCard title="Monte Carlo" data={result.biases.monte_carlo} icon={<RotateCcw className="h-4 w-4" />} />
                <BiasCard title="Recency Bias" data={result.biases.recency_bias} icon={<Activity className="h-4 w-4" />} />
              </div>

              {/* AI COACH: Full Width Card */}
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4" /> AI Strategy Adjustments
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 text-sm text-muted-foreground">
                  
                  {/* UPDATED: Dynamic AI List */}




                 <ul className="space-y-2 mt-1"> {/* Vertical stack with spacing */}
  {result.ai_advice && result.ai_advice.length > 0 ? (
    result.ai_advice.map((tip, index) => (
      <li key={index} className="flex items-start gap-3 p-3 rounded-md bg-white/5 border border-white/10">
        <span className="text-blue-400 mt-1">➤</span> {/* Custom bullet point */}
        <span className="text-gray-300 leading-relaxed">{tip}</span>
      </li>
    ))
  ) : (
    <li className="text-muted-foreground">Analysis pending...</li>
  )}
</ul>

                </CardContent>
              </Card>

            </div>
          </div>
        )}
      </div>
    </main>
  )
}

// --- HELPER COMPONENT: Ultra Compact Bias Card ---
function BiasCard({ title, data, icon }: { title: string, data: any, icon: any }) {
  return (
    <Card className={`flex flex-col justify-between transition-all border-l-4 ${data.detected ? 'border-l-destructive' : 'border-l-green-500'} border-y-0 border-r-0 bg-card shadow-sm`}>
      <CardHeader className="p-3 pb-0">
        <div className="flex justify-between items-start">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <div className={`p-1.5 rounded-full ${data.detected ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-500'}`}>
              {icon}
            </div>
            {title}
          </CardTitle>
          {data.detected ? (
            <span className="text-[10px] text-destructive border border-destructive/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Detected</span>
          ) : (
            <span className="text-[10px] text-green-500 border border-green-500/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Pass</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-2">
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 min-h-[2.5em]">
          {data.summary}
        </p>
        {data.metric && (
          <div className="mt-2 pt-2 border-t border-border/40 flex justify-between items-center">
             <span className="text-[10px] text-muted-foreground uppercase font-medium">Metric</span>
             <span className="text-xs font-mono text-foreground">{data.metric}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}