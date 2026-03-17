import React from "react";
import { CheckCircle2 } from "lucide-react";

type StepRailProps = {
  step: number;
  labels: string[];
  onChange: (step: number) => void;
};

export function StepRail({ step, labels, onChange }: StepRailProps) {
  return (
    <div className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/86 p-2 shadow-[var(--shadow-soft)] backdrop-blur-2xl">
      <div className="flex gap-2 overflow-x-auto">
        {labels.map((label, index) => {
          const num = index + 1;
          const active = num === step;
          const completed = num < step;
          return (
            <button
              key={label}
              onClick={() => onChange(num)}
              className={`group min-w-fit rounded-[22px] px-4 py-3 text-left transition-all ${
                active
                  ? "bg-[var(--accent-strong)] text-white shadow-[var(--shadow-soft)]"
                  : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    active
                      ? "bg-white/20 text-white"
                      : completed
                        ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                        : "bg-[var(--surface-muted)] text-[var(--text-tertiary)]"
                  }`}
                >
                  {completed ? <CheckCircle2 size={14} /> : num}
                </span>
                <div>
                  <div className={`text-sm font-semibold ${active ? "text-white" : ""}`}>{label}</div>
                  <div className={`text-xs ${active ? "text-white/70" : "text-[var(--text-tertiary)]"}`}>阶段 {num}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
