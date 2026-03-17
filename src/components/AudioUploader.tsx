"use client";

import { useState, useRef, useCallback } from "react";
import { MAX_FILE_SIZE_MB } from "@/lib/constants";

interface AudioUploaderProps {
  onFileLoaded: (file: File) => void;
  isLoaded: boolean;
  fileName?: string;
  label: string;
  accentColor: string;
}

export default function AudioUploader({
  onFileLoaded,
  isLoaded,
  fileName,
  label,
  accentColor,
}: AudioUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);

      if (!file.type.startsWith("audio/")) {
        setError("音声ファイルを選択してください。");
        return;
      }

      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(`ファイルサイズは${MAX_FILE_SIZE_MB}MB以下にしてください。`);
        return;
      }

      onFileLoaded(file);
    },
    [onFileLoaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center p-4 rounded-lg
          border-2 border-dashed cursor-pointer transition-colors
          ${
            isDragging
              ? "border-blue-400 bg-blue-400/10"
              : isLoaded
              ? "border-green-500/50 bg-green-500/5"
              : "border-gray-600 hover:border-gray-400"
          }
        `}
      >
        {isLoaded ? (
          <>
            <span className="text-sm text-green-400">{fileName}</span>
            <span className="text-xs text-[var(--color-text-muted)] mt-1">
              クリックして変更
            </span>
          </>
        ) : (
          <>
            <span className="text-sm text-[var(--color-text-muted)]">
              {label}
            </span>
            <span className="text-xs text-[var(--color-text-muted)] mt-1">
              ドラッグ&ドロップ or クリック（MP3, WAV, AAC）
            </span>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
