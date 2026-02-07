"use client"

import { useState, useCallback } from "react"
import { UploadCloud, FileSpreadsheet, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface UploadZoneProps {
  onFileSelect: (file: File) => void
}

export function UploadZone({ onFileSelect }: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.name.endsWith(".csv")) {
        setSelectedFile(file)
        onFileSelect(file)
      }
    }
  }, [onFileSelect])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setSelectedFile(file)
      onFileSelect(file)
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <div
        className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-all duration-200 ease-in-out ${
          dragActive
            ? "border-primary bg-primary/10"
            : "border-border bg-card hover:bg-muted/50"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {/* --- FIXED INPUT BELOW --- */}
        <input
          type="file"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleChange}
          accept=".csv"
          aria-label="Upload trading history CSV" 
          title="Upload trading history CSV"
        />
        {/* ------------------------- */}

        {selectedFile ? (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <div className="p-4 bg-green-500/20 rounded-full mb-4">
              <FileSpreadsheet className="h-10 w-10 text-green-500" />
              
            </div>
            <p className="text-lg font-medium text-foreground">{selectedFile.name}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {(selectedFile.size / 1024).toFixed(2)} KB
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-4 text-destructive hover:text-destructive hover:bg-destructive/10 z-10"
              onClick={(e) => {
                e.stopPropagation() // Prevent triggering file input
                setSelectedFile(null)
              }}
            >
              <X className="h-4 w-4 mr-2" /> Remove
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center p-6 pointer-events-none">
            <div className="p-4 bg-primary/10 rounded-full mb-4">
              <UploadCloud className="h-10 w-10 text-primary" />
            </div>
            <p className="text-lg font-semibold text-foreground">
              Drop your trading history here
            </p>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs">
              Supports CSV files from National Bank Challenge (e.g., overtrader.csv)
            </p>
          </div>
        )}
      </div>
    </div>
  )
}