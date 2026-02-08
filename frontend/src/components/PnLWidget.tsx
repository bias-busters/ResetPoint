"use client";

import React, { useState } from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  Scatter
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Maximize2, XCircle, AlertTriangle } from "lucide-react";

// --- CUSTOM TOOLTIP (Shows Bias Details) ---
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isBias = !!data.bias;

    return (
      <div className={`p-3 rounded-lg border shadow-xl backdrop-blur-md ${isBias ? "bg-red-950/90 border-red-500/50" : "bg-[#111]/90 border-white/10"}`}>
        <p className="text-xs text-gray-400 mb-1">{data.time}</p>
        
        {/* Account Balance */}
        <div className="flex items-end gap-2">
            <span className="text-lg font-mono font-bold text-white">
            ${data.equity.toLocaleString()}
            </span>
            <span className={`text-xs font-mono ${data.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ({data.pnl >= 0 ? '+' : ''}{data.pnl})
            </span>
        </div>

        {/* BIAS WARNING (Only shows if this trade was bad) */}
        {isBias && (
            <div className="mt-2 pt-2 border-t border-red-500/30 flex items-center gap-2 text-red-300 animate-pulse">
                <AlertTriangle className="h-3 w-3" />
                <span className="text-xs font-bold uppercase tracking-wider">{data.bias}</span>
            </div>
        )}
      </div>
    );
  }
  return null;
};

// --- CUSTOM DOT (Draws Red Markers for Biases) ---
const CustomizedDot = (props: any) => {
  const { cx, cy, payload } = props;
  
  if (payload.bias) {
    return (
      <svg x={cx - 6} y={cy - 6} width={12} height={12} fill="red" viewBox="0 0 1024 1024">
        <circle cx="512" cy="512" r="512" fill="#ef4444" />
        <path d="M512 0C229.2 0 0 229.2 0 512s229.2 512 512 512 512-229.2 512-512S794.8 0 512 0zm0 960C264.6 960 64 759.4 64 512S264.6 64 512 64s448 200.6 448 448-200.6 448-448 448z" fill="#7f1d1d" opacity="0.3"/>
      </svg>
    );
  }
  return null; // Don't draw dots for normal trades
};

export default function PnLWidget({ data }: { data: any[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!data || data.length === 0) return null;
  const currentBalance = data[data.length - 1].equity;
  const isProfitable = currentBalance >= 0;

  return (
    <>
      {/* 1. DASHBOARD WIDGET */}
      <Card 
        className="relative overflow-hidden cursor-pointer group hover:border-blue-500/50 transition-all duration-300"
        onClick={() => setIsExpanded(true)}
      >
        <CardContent className="p-0 h-48 relative">
            
            {/* Header Info */}
            <div className="absolute top-4 left-4 z-10">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Equity Curve</p>
                <h3 className={`text-2xl font-mono font-bold ${isProfitable ? 'text-green-500' : 'text-red-500'}`}>
                    ${currentBalance.toLocaleString()}
                </h3>
            </div>

            {/* Hover Overlay */}
            <div className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-2 text-white font-bold uppercase tracking-widest text-sm">
                    <Maximize2 className="h-4 w-4" /> Expand Analysis
                </div>
            </div>

            {/* The Chart */}
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 50, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={isProfitable ? "#10b981" : "#ef4444"} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={isProfitable ? "#10b981" : "#ef4444"} stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <Area 
                        type="monotone" 
                        dataKey="equity" 
                        stroke={isProfitable ? "#10b981" : "#ef4444"} 
                        fill="url(#colorEquity)" 
                        strokeWidth={2}
                        dot={<CustomizedDot />} // <--- THIS ADDS THE RED DOTS
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 2. EXPANDED MODAL (Full Screen Analysis) */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-5xl h-[80vh] bg-background border border-border rounded-xl shadow-2xl flex flex-col">
                
                {/* Modal Header */}
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <AlertTriangle className="text-yellow-500 h-5 w-5" /> 
                            Behavioral Timeline
                        </h2>
                        <p className="text-sm text-muted-foreground">Red markers indicate detected emotional biases (Revenge Trading, Tilt).</p>
                    </div>
                    <button onClick={(e) => {e.stopPropagation(); setIsExpanded(false)}} className="p-2 hover:bg-destructive/20 rounded-full transition-colors">
                        <XCircle className="h-6 w-6 text-muted-foreground hover:text-destructive" />
                    </button>
                </div>

                {/* Full Chart */}
                <div className="flex-1 p-6">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis dataKey="time" hide />
                            <YAxis domain={['auto', 'auto']} stroke="#666" tickFormatter={(val) => `$${val}`} />
                            <Tooltip content={<CustomTooltip />} />
                            <Line 
                                type="monotone" 
                                dataKey="equity" 
                                stroke={isProfitable ? "#10b981" : "#ef4444"} 
                                strokeWidth={3}
                                dot={<CustomizedDot />} // <--- RED DOTS HERE TOO
                                activeDot={{ r: 8, strokeWidth: 0 }}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
      )}
    </>
  );
}