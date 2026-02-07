"use client";

import React, { useState } from "react";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  ComposedChart, Scatter 
} from "recharts";

// Custom Dot Component to render the Bias Markers
const BiasDot = (props: any) => {
  const { cx, cy, payload } = props;
  
  // If this data point has a bias, draw a dot
  if (payload.bias_event) {
    return (
      <circle 
        cx={cx} 
        cy={cy} 
        r={6} 
        fill={payload.bias_color || "#fff"} 
        stroke="#fff" 
        strokeWidth={2} 
        className="animate-pulse cursor-pointer"
      />
    );
  }
  return null; // Don't draw anything for normal trades
};

// Custom Tooltip to show the Bias Name
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#111] border border-white/10 p-3 rounded shadow-xl">
        <p className="text-gray-400 text-xs mb-1">{data.time}</p>
        <p className="text-white font-mono font-bold text-lg">
          ${data.equity.toLocaleString()}
        </p>
        
        {/* If there is a bias, show the warning badge */}
        {data.bias_event && (
          <div className="mt-2 pt-2 border-t border-white/10">
            <span className="text-xs font-bold px-2 py-1 rounded bg-red-900/50 text-red-200 border border-red-500/30">
              ⚠ {data.bias_event}
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function PnLWidget({ data }: { data: any[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!data || data.length === 0) return null;

  const isProfitable = data[data.length - 1].equity >= 0;
  const color = isProfitable ? "#10b981" : "#ef4444";

  return (
    <>
      {/* 1. MINI WIDGET */}
      <div 
        className="relative w-full h-48 bg-[#1e222d] rounded-xl overflow-hidden border border-white/10 shadow-lg transition-all hover:border-blue-500/50 cursor-pointer group"
        onClick={() => setIsExpanded(true)}
      >
        <div className="absolute top-4 left-4 z-10">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">Performance</h3>
            <p className={`text-2xl font-mono font-bold ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                ${data[data.length - 1].equity.toLocaleString()}
            </p>
        </div>

        {/* Legend for the Mini View */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-1 items-end">
            <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-[10px] text-gray-400">Revenge</span>
            </div>
            <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                <span className="text-[10px] text-gray-400">Loss Aversion</span>
            </div>
        </div>

        <div className="pt-10 h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data}>
                <defs>
                  <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="equity" 
                  stroke={color} 
                  fillOpacity={1} 
                  fill="url(#colorPnL)" 
                  strokeWidth={2}
                  // Attach the Custom Dot renderer here
                  dot={<BiasDot />} 
                />
                <Tooltip content={<CustomTooltip />} />
              </ComposedChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* 2. EXPANDED MODAL */}
      {isExpanded && (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-8">
          <div className="w-full h-full max-w-5xl bg-[#1e222d] rounded-xl border border-white/10 flex flex-col p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white">Equity Analysis</h2>
                    <p className="text-gray-400 text-sm">Colored dots indicate detected psychological biases.</p>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold"
                >
                  Close
                </button>
            </div>
            <div className="flex-grow">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
                  <defs>
                    <linearGradient id="colorPnLFull" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#555" tick={{fontSize: 12}} />
                  <YAxis stroke="#555" domain={['auto', 'auto']} tickFormatter={(val)=>`$${val}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="equity" 
                    stroke={color} 
                    fillOpacity={1} 
                    fill="url(#colorPnLFull)" 
                    strokeWidth={3}
                    dot={<BiasDot />}
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