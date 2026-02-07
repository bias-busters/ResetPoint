"use client"

import { useState } from "react"
import axios from "axios"
import { AlertTriangle, CheckCircle, TrendingUp, Activity, BrainCircuit } from "lucide-react"
import { UploadZone } from "@/components/upload-zone"
import { BiasRadar } from "@/components/bias-radar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

// Define the shape of the API response
interface AnalysisResponse {
  status: string
  metadata: {
    filename: string
    total_trades: number
    account_balance: number
  }
  biases: {
    overtrading: { detected: boolean; summary: string; metric?: string }
    loss_aversion: { detected: boolean; summary: string; ratio?: number }
    revenge_trading: { detected: boolean; summary: string }
    monte_carlo: { detected: boolean; summary: string }
    disposition: { detected: boolean; summary: string }
  }
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
      // Connect to your FastAPI Backend
      const response = await axios.post("http://localhost:8000/analyze", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setResult(response.data)
    } catch (err) {
      setError("Failed to analyze file. Ensure the backend is running on port 8000.")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setResult(null)
    setError(null)
  }

  return (
    <main className="min-h-screen bg-background text-foreground p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">ResetPoint</h1>
            <p className="text-muted-foreground">Behavioral Bias Detection System</p>
          </div>
          {result && (
            <Button variant="outline" onClick={reset}>
              Analyze New File
            </Button>
          )}
        </div>

        {/* ERROR STATE */}
        {error && (
          <div className="p-4 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
            {error}
          </div>
        )}

        {/* UPLOAD STATE (Visible only when no result) */}
        {!result && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6 fade-in">
            <div className="w-full max-w-2xl text-center space-y-2">
              <h2 className="text-2xl font-semibold">Upload Trading History</h2>
              <p className="text-muted-foreground">
                Drag and drop your CSV file to detect hidden psychological biases.
              </p>
            </div>
            
            <UploadZone onFileSelect={setFile} />

            {file && (
              <Button 
                size="lg" 
                onClick={handleAnalyze} 
                disabled={isLoading}
                className="w-full max-w-xs"
              >
                {isLoading ? "Analyzing..." : "Run Bias Engine"}
              </Button>
            )}
            
            {isLoading && (
              <div className="w-full max-w-md space-y-2">
                <Progress value={66} className="h-2" />
                <p className="text-xs text-center text-muted-foreground animate-pulse">
                  Processing trades & identifying patterns...
                </p>
              </div>
            )}
          </div>
        )}

        {/* RESULTS DASHBOARD */}
        {result && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
            
            {/* Column 1: Profile & Radar */}
            <div className="space-y-6">
              <Card className="border-primary/20 bg-card/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" /> 
                    Trader Profile
                  </CardTitle>
                  <CardDescription>Psychological Signature</CardDescription>
                </CardHeader>
                <CardContent>
                  <BiasRadar results={result.biases} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Account Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-muted-foreground">Filename</span>
                    <span className="font-mono text-sm">{result.metadata.filename}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-muted-foreground">Total Trades</span>
                    <span className="font-mono">{result.metadata.total_trades}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Ending Balance</span>
                    <span className={`font-mono font-bold ${result.metadata.account_balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      ${result.metadata.account_balance.toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Column 2 & 3: Detailed Bias Cards */}
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <BiasCard 
                title="Overtrading" 
                data={result.biases.overtrading} 
                icon={<TrendingUp className="h-5 w-5" />}
              />
              <BiasCard 
                title="Loss Aversion" 
                data={result.biases.loss_aversion} 
                icon={<AlertTriangle className="h-5 w-5" />}
              />
              <BiasCard 
                title="Revenge Trading" 
                data={result.biases.revenge_trading} 
                icon={<BrainCircuit className="h-5 w-5" />}
              />
              <BiasCard 
                title="Disposition Effect" 
                data={result.biases.disposition} 
                icon={<Activity className="h-5 w-5" />}
              />
              <BiasCard 
                title="Monte Carlo Fallacy" 
                data={result.biases.monte_carlo} 
                icon={<Activity className="h-5 w-5" />}
              />

              {/* Personalized Suggestion Box */}
              <Card className="col-span-1 sm:col-span-2 bg-primary/5 border-primary/20">
                <CardHeader>
                  <CardTitle className="text-primary">AI Coach Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-2 text-sm">
                    {result.biases.overtrading.detected && (
                      <li><strong>Cooling-off Period:</strong> Mandate a 1-hour break after 3 consecutive trades.</li>
                    )}
                    {result.biases.revenge_trading.detected && (
                      <li><strong>Risk Lock:</strong> Reduce position size by 50% immediately after a loss.</li>
                    )}
                    {result.biases.loss_aversion.detected && (
                      <li><strong>Hard Stops:</strong> Automate your exit strategy to remove emotion from losing trades.</li>
                    )}
                    {!result.biases.overtrading.detected && !result.biases.revenge_trading.detected && (
                      <li className="text-muted-foreground">Your trading psychology appears stable. Keep maintaining your discipline.</li>
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

// Simple Helper Component for the Grid
function BiasCard({ title, data, icon }: { title: string, data: any, icon: any }) {
  return (
    <Card className={`transition-all ${data.detected ? 'border-destructive/50 bg-destructive/5' : 'border-green-500/20 bg-green-500/5'}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            {icon} {title}
          </CardTitle>
          {data.detected ? (
            <span className="bg-destructive/15 text-destructive text-xs px-2 py-1 rounded-full font-bold">DETECTED</span>
          ) : (
            <span className="bg-green-500/15 text-green-500 text-xs px-2 py-1 rounded-full font-bold">PASS</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{data.summary}</p>
        {data.metric && <p className="text-xs font-mono mt-2 pt-2 border-t border-dashed border-border/50">Metric: {data.metric}</p>}
      </CardContent>
    </Card>
  )
}