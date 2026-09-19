import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Sistema Liquid Glass de RMORDIE.
 * Solo presentación: ningún componente toca datos ni lógica de negocio.
 */

type Level = 1 | 2 | 3;

const levelClass: Record<Level, string> = {
  1: "glass-quiet",
  2: "glass glass-sheen",
  3: "glass-elevated glass-sheen",
};

export function GlassCard({
  level = 2,
  gold = false,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { level?: Level; gold?: boolean }) {
  return (
    <div
      className={cn(levelClass[level], gold && "glass-gold", "overflow-hidden", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function GlassSection({
  title,
  action,
  className,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("mt-7", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-end justify-between gap-3">
          {title ? <h2 className="eyebrow">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

type ButtonVariant = "primary" | "glass" | "ghost" | "gold";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-foreground text-[color:var(--primary-foreground)] border border-transparent shadow-[0_16px_34px_-22px_rgba(0,0,0,0.9)]",
  gold: "gold-gradient border border-[rgba(216,180,107,0.5)] shadow-[0_16px_34px_-20px_rgba(216,180,107,0.45)]",
  glass:
    "glass glass-sheen text-foreground hover:border-[color:var(--glass-border-strong)]",
  ghost: "border border-transparent text-muted-foreground hover:text-foreground",
};

export function GlassButton({
  variant = "glass",
  size = "md",
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      className={cn(
        "pressable inline-flex items-center justify-center gap-2 rounded-[var(--r-md)] font-semibold disabled:opacity-45",
        size === "sm" && "min-h-[38px] px-3.5 text-[13px]",
        size === "md" && "tap px-4 text-sm",
        size === "lg" && "min-h-[54px] px-5 text-[15px] rounded-[var(--r-lg)]",
        buttonVariants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function GlassBadge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "gold" | "solid";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
        tone === "neutral" && "border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] text-muted-foreground",
        tone === "gold" && "border border-[rgba(216,180,107,0.38)] bg-[rgba(216,180,107,0.10)] text-gold",
        tone === "solid" && "bg-foreground text-[color:var(--primary-foreground)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export const GlassInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label?: string }
>(function GlassInput({ label, className, ...rest }, ref) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block eyebrow">{label}</span>}
      <input
        ref={ref}
        className={cn(
          "tap w-full rounded-[var(--r-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3.5 py-3 text-[15px] tabular text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-[rgba(216,180,107,0.55)] focus:bg-[color:var(--glass-bg-2)]",
          className,
        )}
        {...rest}
      />
    </label>
  );
});

export const GlassTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }
>(function GlassTextarea({ label, className, ...rest }, ref) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block eyebrow">{label}</span>}
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-[var(--r-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3.5 py-3 text-[15px] text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-[rgba(216,180,107,0.55)]",
          className,
        )}
        {...rest}
      />
    </label>
  );
});

export function GlassModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/65 backdrop-blur-[6px]"
      />
      <div className="glass-elevated glass-sheen animate-fade relative m-3 w-full max-w-md p-5 safe-bottom">
        {title && <h3 className="mb-3 text-lg font-semibold tracking-tight">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

/** Cifra protagonista: 26:48 / TIME */
export function MetricHero({
  value,
  label,
  gold = false,
  className,
}: {
  value: React.ReactNode;
  label: string;
  gold?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className={cn("display-lg truncate", gold && "gold-text")}>{value}</div>
      <p className="eyebrow mt-2.5">{label}</p>
    </div>
  );
}
