"use client"

import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, PolarRadiusAxis
} from "recharts"

interface BiasResults {
  overtrading: { detected: boolean }
  loss_aversion: { detected: boolean }
  revenge_trading: { detected: boolean }
  monte_carlo: { detected: boolean }
  disposition: { detected: boolean }
  recency_bias: { detected: boolean }
}

export function BiasRadar({ results }: { results: BiasResults }) {
  const data = [
    { subject: "Overtrading", A: results.overtrading.detected ? 100 : 20, fullMark: 100 },
    { subject: "Loss Av.", A: results.loss_aversion.detected ? 100 : 20, fullMark: 100 },
    { subject: "Revenge", A: results.revenge_trading.detected ? 100 : 10, fullMark: 100 },
    
    // CHANGED: "Gambler's" -> "Monte Carlo" to match the card
    { subject: "Monte Carlo", A: results.monte_carlo.detected ? 90 : 30, fullMark: 100 },
    
    { subject: "Disposition", A: results.disposition.detected ? 90 : 30, fullMark: 100 },
    { subject: "Recency", A: results.recency_bias.detected ? 90 : 30, fullMark: 100 },
  ]

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#52525b" strokeOpacity={0.4} />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: "#a1a1aa", fontSize: 11, fontWeight: 600 }} 
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="Trader Profile"
            dataKey="A"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="#3b82f6"
            fillOpacity={0.3}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}