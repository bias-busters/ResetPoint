"use client";

import React, { useState, useEffect, useRef } from "react";

// --- HELPER COMPONENT: The Native Chart ---
// This injects the TradingView script manually, bypassing the broken React library.
const TradingViewNative = ({ containerId, options }: { containerId: string, options: any }) => {
  const hasLoaded = useRef(false);

  useEffect(() => {
    // Prevent double-loading
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    // 1. Define the script URL
    const scriptSrc = "https://s3.tradingview.com/tv.js";

    // 2. Check if script is already on page
    let script = document.querySelector(`script[src="${scriptSrc}"]`) as HTMLScriptElement;

    // 3. Function to initialize the widget
    const initWidget = () => {
      if (typeof window !== "undefined" && (window as any).TradingView) {
        new (window as any).TradingView.widget({
          container_id: containerId,
          width: "100%",
          height: "100%",
          symbol: "NASDAQ:AAPL",
          interval: "D",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#f1f3f6",
          enable_publishing: false,
          allow_symbol_change: true,
          ...options, // Merge custom options (like hiding toolbars)
        });
      }
    };

    // 4. Load script if missing, or run init if present
    if (!script) {
      script = document.createElement("script");
      script.src = scriptSrc;
      script.async = true;
      script.onload = initWidget;
      document.head.appendChild(script);
    } else {
      // If script is already cached, wait a moment then init
      setTimeout(initWidget, 1000); 
    }
  }, [containerId, options]);

  return <div id={containerId} className="h-full w-full" />;
};

// --- MAIN COMPONENT ---
export default function MarketWidget() {
  const [isExpanded, setIsExpanded] = useState(false);
  const toggleExpand = () => setIsExpanded(!isExpanded);

  return (
    <>
      {/* 1. THE TINY WIDGET (Always visible) */}
      <div 
        className="relative w-full h-48 bg-[#1e222d] rounded-xl overflow-hidden border border-white/10 shadow-lg transition-all duration-300 hover:border-blue-500/50 group cursor-pointer"
        onClick={toggleExpand}
      >
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
           <span className="text-white font-bold text-sm tracking-widest uppercase">
             ⤢ Click to Expand
           </span>
        </div>

        <div className="pointer-events-none h-full w-full"> 
            <TradingViewNative 
                containerId="tv_chart_mini"
                options={{
                    hide_legend: true,
                    hide_side_toolbar: true,
                    hide_top_toolbar: true,
                    autosize: true
                }}
            />
        </div>
      </div>

      {/* 2. THE EXPANDED MODAL */}
      {isExpanded && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-10">
          <div className="relative w-full h-full bg-[#1e222d] rounded-xl overflow-hidden shadow-2xl border border-white/10 flex flex-col">
            
            <div className="bg-[#111] p-2 flex justify-end border-b border-white/10">
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleExpand(); }}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-1 rounded text-sm font-bold transition-colors"
                >
                  ✕ Close
                </button>
            </div>

            <div className="flex-grow">
                {/* Note: We use a different ID for the full view to force a re-render */}
                <TradingViewNative 
                    containerId="tv_chart_full"
                    options={{
                        hide_side_toolbar: false,
                        autosize: true
                    }}
                />
            </div>
          </div>
        </div>
      )}
    </>
  );
}