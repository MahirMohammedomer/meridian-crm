import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------- Button ------------------------------- */

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success" | "glass";
type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 shadow-sm",
  secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15",
  outline:
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10",
  ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
  glass:
    "backdrop-blur-xl bg-white/70 border border-white/40 text-slate-700 hover:bg-white/85 dark:bg-white/10 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/15",
};

const SIZES: Record<ButtonSize, string> = {
  xs: "h-7 px-2 text-xs rounded-lg gap-1",
  sm: "h-8 px-3 text-[13px] rounded-lg gap-1.5",
  md: "h-9 px-3.5 text-sm rounded-xl gap-2",
  lg: "h-11 px-5 text-[15px] rounded-xl gap-2",
  icon: "h-9 w-9 rounded-xl",
  "icon-sm": "h-8 w-8 rounded-lg",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900",
        "disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] whitespace-nowrap",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});

/* ------------------------------- Inputs ------------------------------- */

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400",
          "transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10",
          "dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-white/25 dark:focus:ring-white/10",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400",
          "transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 resize-y",
          "dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-white/25",
          className,
        )}
        {...props}
      />
    );
  },
);

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function NativeSelect({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-900",
        "transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer",
        "dark:border-white/10 dark:bg-white/5 dark:text-white dark:[&>option]:bg-slate-900",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="text-[12px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </label>
      )}
      {children}
      {hint && <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  className,
  ...rest
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange">) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "h-4 w-4 shrink-0 rounded-[5px] border transition-colors flex items-center justify-center",
        checked
          ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
          : "border-slate-300 bg-white dark:border-white/20 dark:bg-white/5",
        className,
      )}
      {...rest}
    >
      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
    </button>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5"
      role="switch"
      aria-checked={checked}
    >
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          checked ? "bg-slate-900 dark:bg-white" : "bg-slate-300 dark:bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all dark:bg-slate-900",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
      {label && <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>}
    </button>
  );
}

/* ------------------------------- Badge ------------------------------- */

export function Badge({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ring-slate-500/20",
        "bg-slate-500/10 text-slate-600 dark:text-slate-300",
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

/* -------------------------------- Card -------------------------------- */

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]",
        "dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/5", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn("text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500", className)}>
      {children}
    </h3>
  );
}

/* ------------------------------- Dialog ------------------------------- */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in" onClick={onClose} />
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl",
          "dark:border-white/10 dark:bg-[#111318]",
          widths[size],
          "max-h-[92vh] flex flex-col",
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/5">
            <div className="min-w-0">
              {title && <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">{title}</h2>}
              {description && <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">{description}</p>}
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 dark:border-white/5 dark:bg-white/[0.02]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------- Drawer ------------------------------- */

export function Drawer({
  open,
  onClose,
  children,
  width = "max-w-2xl",
  header,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
  header?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[95]">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="pointer-events-none absolute left-1/2 top-3 z-10 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-300 sm:hidden dark:bg-white/30" />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[93vh] w-full flex-col rounded-t-2xl border-t border-slate-200 bg-white shadow-2xl animate-slide-up sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:rounded-none sm:border-l sm:border-t-0 sm:rounded-l-2xl dark:border-white/10 dark:bg-[#0f1115]",
          width,
          "sm:max-w-2xl",
        )}
      >
        {header}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------ Dropdown ------------------------------ */

export function Dropdown({
  trigger,
  children,
  align = "right",
  className,
  panelClassName,
}: {
  trigger: (o: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (o: { close: () => void }) => React.ReactNode;
  align?: "left" | "right";
  className?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panelW = panelRef.current?.offsetWidth || 200;
    const panelH = panelRef.current?.offsetHeight || 280;
    const gap = 6;
    let top = r.bottom + gap;
    let left = align === "right" ? r.right - panelW : r.left;

    // Flip up if not enough space below
    if (top + panelH > window.innerHeight - 8 && r.top > panelH + gap) {
      top = r.top - panelH - gap;
    }
    // Keep in viewport horizontally
    left = Math.max(8, Math.min(left, window.innerWidth - panelW - 8));
    setPos({ top, left, width: r.width });
  };

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    // Position after paint so we can measure panel
    const id = requestAnimationFrame(() => {
      updatePosition();
    });
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onScroll = () => updatePosition();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, align]);

  // Re-measure when panel content mounts
  useEffect(() => {
    if (open && panelRef.current) updatePosition();
  }, [open]);

  return (
    <div className={cn("relative inline-flex", className)} ref={triggerRef}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              zIndex: 200,
              visibility: pos ? "visible" : "hidden",
            }}
            className={cn(
              "min-w-[190px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl",
              "dark:border-white/10 dark:bg-[#181b21]",
              panelClassName,
            )}
          >
            {children({ close: () => setOpen(false) })}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  icon,
  danger,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors",
        danger
          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10",
        disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      {icon}
      <span className="flex-1 truncate">{children}</span>
    </button>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{children}</div>
  );
}

/* ------------------------------ Select ------------------------------ */

export function Select({
  value,
  onChange,
  options,
  placeholder,
  className,
  size = "md",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-slate-900 transition",
          "focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10",
          "dark:border-white/10 dark:bg-white/5 dark:text-white dark:[&>option]:bg-slate-900",
          size === "sm" ? "py-1.5 text-[13px]" : "py-2 text-sm",
        )}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

/* -------------------------------- Misc -------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-200/70 dark:bg-white/10", className)} />;
}

export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: string; label: React.ReactNode }[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-white/5", className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all",
            value === t.value
              ? "bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10", className)}>
      <div
        className="h-full rounded-full bg-slate-900 transition-all duration-500 dark:bg-white"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{message}</p>
    </Dialog>
  );
}
