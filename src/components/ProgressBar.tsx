"use client";

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
}

export default function ProgressBar({ progress, label }: ProgressBarProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
        <span>{label ?? "解析中..."}</span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--color-brand)] rounded-full transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
