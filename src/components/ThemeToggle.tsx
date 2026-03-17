import React from "react";
import { MoonStar, SunMedium, Sparkles } from "lucide-react";
import { ThemeMode, useTheme } from "../theme";

const OPTIONS: { id: ThemeMode; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: "light", label: "浅色", icon: SunMedium },
  { id: "dark", label: "深色", icon: MoonStar },
  { id: "system", label: "自动", icon: Sparkles },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="inline-flex rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)]/90 p-1 shadow-[var(--shadow-soft)] backdrop-blur-xl">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = option.id === theme;
        return (
          <button
            key={option.id}
            onClick={() => setTheme(option.id)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              active
                ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-[var(--shadow-soft)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Icon size={14} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
