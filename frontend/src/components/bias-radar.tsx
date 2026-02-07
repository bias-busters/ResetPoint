"use client"

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  PolarRadiusAxis
} from "recharts"

interface BiasResults {
  overtrading: { detected: boolean }
  loss_aversion: { detected: boolean }
  revenge_trading: { detected: boolean }
  monte_carlo: { detected: boolean }
  disposition: { detected: boolean }
}

export function BiasRadar({ results }: { results: BiasResults }) {
  // Convert boolean detections to "Risk Scores" for the chart
  const data = [
    { subject: "Overtrading", A: results.overtrading.detected ? 100 : 20, fullMark: 100 },
    { subject: "Loss Aversion", A: results.loss_aversion.detected ? 100 : 20, fullMark: 100 },
    { subject: "Revenge Trading", A: results.revenge_trading.detected ? 100 : 10, fullMark: 100 },
    { subject: "Monte Carlo", A: results.monte_carlo.detected ? 90 : 30, fullMark: 100 },
    { subject: "Disposition", A: results.disposition.detected ? 90 : 30, fullMark: 100 },
  ]

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} 
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="Trader Profile"
            dataKey="A"
            stroke="var(--primary)"
            strokeWidth={3}
            fill="var(--primary)"
            fillOpacity={0.3}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}