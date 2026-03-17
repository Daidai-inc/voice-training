"use client";

import { useState, useRef, useCallback } from "react";
import { MAX_FILE_SIZE_MB } from "@/lib/constants";

interface ReferenceUploaderProps {
  onFileLoaded: (file: File) => void;
  isLoaded: boolean;
  fileName?: string;
}

export default function ReferenceUploader({
  onFileLoaded,
  isLoaded,
  fileName,
}: ReferenceUploaderProps) {
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center p-6 rounded-lg
          border-2 border-dashed cursor-pointer transition-colors
          ${
            isDragging
              ? "border-[var(--color-reference)] bg-[var(--color-reference)]/10"
              : isLoaded
              ? "border-green-500/50 bg-green-500/5"
              : "border-[var(--color-text-muted)]/30 hover:border-[var(--color-reference)]/50"
          }
        `}
      >
        {isLoaded ? (
          <>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-green-400 mb-2"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <span className="text-sm text-green-400">{fileName}</span>
            <span className="text-xs text-[var(--color-text-muted)] mt-1">
              クリックして変更
            </span>
          </>
        ) : (
          <>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-[var(--color-text-muted)] mb-2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="text-sm text-[var(--color-text-muted)]">
              お手本の音声ファイルをドロップ
            </span>
            <span className="text-xs text-[var(--color-text-muted)] mt-1">
              または クリックして選択（MP3, WAV, AAC）
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
