'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, X, Sparkles } from 'lucide-react';
import { AiModeBadge } from '@/components/AiModeBadge';

/* ═══════════════════════════════════════════════════════════
   TOAST SYSTEM
   ═══════════════════════════════════════════════════════════ */

interface Toast {
  id: number;
  title: string;
  description?: string;
  variant: 'success' | 'error' | 'info' | 'warning';
}

const ToastContext = createContext<{ toast: (t: Omit<Toast, 'id'>) => void }>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { ...t, id }]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-sm" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={cn(
            'animate-in slide-in-from-right-5 fade-in rounded-lg border p-4 shadow-lg backdrop-blur-sm',
            t.variant === 'success' && 'border-[#0f9d70]/50 bg-[#111916] text-[#e8ede9]',
            t.variant === 'error' && 'border-[#C0392B]/50 bg-[#111916] text-[#e8ede9]',
            t.variant === 'warning' && 'border-[#D9822B]/50 bg-[#111916] text-[#e8ede9]',
            t.variant === 'info' && 'border-[#1e2e25] bg-[#111916] text-[#e8ede9]',
          )}>
            <p className="text-sm font-semibold">{t.title}</p>
            {t.description && <p className="text-xs mt-1 text-[#7a8f80]">{t.description}</p>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() { return useContext(ToastContext); }

/* ═══════════════════════════════════════════════════════════
   BUTTON — Palette VECTRACOM
   ═══════════════════════════════════════════════════════════ */

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'ai';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0f9d70] focus-visible:ring-offset-[#0a0f0d] disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
        variant === 'primary' && 'bg-[#0f9d70] text-white hover:bg-[#0d8a62]',
        variant === 'secondary' && 'bg-[#1a2420] text-[#e8ede9] hover:bg-[#172019] border border-[#1e2e25]',
        variant === 'danger' && 'bg-[#C0392B] text-white hover:bg-[#a93226]',
        variant === 'ghost' && 'text-[#7a8f80] hover:text-[#e8ede9] hover:bg-[#172019]',
        variant === 'outline' && 'border border-[#1e2e25] bg-[#111916] text-[#e8ede9] hover:bg-[#172019] hover:text-[#e8ede9]',
        variant === 'ai' && 'bg-[#f5a623] text-[#0a0f0d] hover:bg-[#d9911f]',
        size === 'sm' && 'h-8 px-3 text-xs',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-6 text-base',
        size === 'icon' && 'h-10 w-10',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   BADGE — Statuts avec couleurs VECTRACOM
   ═══════════════════════════════════════════════════════════ */

export function Badge({ variant = 'neutral', children, className }: { variant?: string; children: React.ReactNode; className?: string }) {
  const variants: Record<string, string> = {
    success: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30',
    danger: 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30',
    warning: 'bg-[#D9822B]/20 text-[#D9822B] border-[#D9822B]/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    neutral: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]',
    ai: 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border', variants[variant] || variants.neutral, className)}>
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   INPUT / SELECT / TEXTAREA — Palette VECTRACOM
   ═══════════════════════════════════════════════════════════ */

export function Input({ label, error, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs font-medium text-[#7a8f80]">{label}</label>}
      <input
        className={cn(
          'w-full h-10 px-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] placeholder:text-[#7a8f80]',
          'focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50 focus:border-[#0f9d70] transition-all duration-200',
          error && 'border-[#C0392B]/50 focus:ring-[#C0392B]/50',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-[#C0392B]">{error}</p>}
    </div>
  );
}

export function Select({ label, error, className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs font-medium text-[#7a8f80]">{label}</label>}
      <select
        className={cn(
          'w-full h-10 px-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9]',
          'focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50 focus:border-[#0f9d70] transition-all',
          error && 'border-[#C0392B]/50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-[#C0392B]">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs font-medium text-[#7a8f80]">{label}</label>}
      <textarea
        className={cn(
          'w-full min-h-[80px] px-3 py-2 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] placeholder:text-[#7a8f80] resize-none',
          'focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50 focus:border-[#0f9d70] transition-all',
          error && 'border-[#C0392B]/50',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-[#C0392B]">{error}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL — Fond VECTRACOM
   ═══════════════════════════════════════════════════════════ */

export function Modal({ open, onClose, title, children, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative w-full rounded-[0.625rem] border border-[#1e2e25] bg-[#111916] shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto',
          size === 'sm' && 'max-w-sm p-5',
          size === 'md' && 'max-w-md p-6',
          size === 'lg' && 'max-w-2xl p-6',
          size === 'xl' && 'max-w-4xl p-6',
        )}
      >
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-[#111916] z-10 pb-2">
          <h2 className="text-lg font-semibold text-[#e8ede9]">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-[#7a8f80] hover:text-[#e8ede9] hover:bg-[#172019] transition-colors" aria-label="Fermer">
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmText = 'Confirmer', danger }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; confirmText?: string; danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-[#7a8f80] mb-5">{message}</p>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose(); }}>{confirmText}</Button>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════
   CARD / SKELETON
   ═══════════════════════════════════════════════════════════ */

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-[0.625rem] border border-[#1e2e25] bg-[#111916]', className)} {...props}>{children}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-[#1a2420]', className)} />;
}

/* ═══════════════════════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════════════════════ */

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && <span className="text-[#7a8f80] mb-3">{icon}</span>}
      <p className="text-sm font-medium text-[#7a8f80]">{title}</p>
      {description && <p className="text-xs text-[#7a8f80]/60 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TABLE — Style VECTRACOM
   ═══════════════════════════════════════════════════════════ */

export function Table({ headers, children, loading, emptyMessage = 'Aucune donnée' }: {
  headers: string[]; children: React.ReactNode; loading?: boolean; emptyMessage?: string;
}) {
  if (loading) {
    return <div className="space-y-2 p-4">{headers.map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }
  return (
    <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1e2e25] hover:bg-transparent">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-[#7a8f80] uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1e2e25]/50">{children}</tbody>
      </table>
    </div>
  );
}

export function TableRow({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return <tr className={cn('border-b border-[#1e2e25] transition-colors', onClick && 'cursor-pointer hover:bg-[#172019]')} onClick={onClick}>{children}</tr>;
}

export function TableCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 text-[#e8ede9]', className)}>{children}</td>;
}

/* ═══════════════════════════════════════════════════════════
   STAT CARD
   ═══════════════════════════════════════════════════════════ */

export function StatCard({ label, value, icon, variant = 'default', sublabel }: {
  label: string; value: string | number; icon?: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' | 'ai'; sublabel?: string;
}) {
  const colors = {
    default: { bar: 'bg-[#7a8f80]', text: 'text-[#e8ede9]', iconBg: 'bg-[#1a2420]', iconColor: 'text-[#7a8f80]' },
    success: { bar: 'bg-[#0f9d70]', text: 'text-[#0f9d70]', iconBg: 'bg-[#0f9d70]/15', iconColor: 'text-[#0f9d70]' },
    warning: { bar: 'bg-[#D9822B]', text: 'text-[#D9822B]', iconBg: 'bg-[#D982B]/15', iconColor: 'text-[#D9822B]' },
    danger: { bar: 'bg-[#C0392B]', text: 'text-[#C0392B]', iconBg: 'bg-[#C0392B]/15', iconColor: 'text-[#C0392B]' },
    ai: { bar: 'bg-[#f5a623]', text: 'text-[#f5a623]', iconBg: 'bg-[#f5a623]/15', iconColor: 'text-[#f5a623]' },
  };
  const c = colors[variant] || colors.default;
  return (
    <Card className="p-4 relative overflow-hidden group hover:border-[#0f9d70]/30 transition-all duration-300 cursor-pointer">
      <div className={cn('absolute inset-x-0 top-0 h-0.5 transition-all duration-300 group-hover:h-1', c.bar)} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[#7a8f80] mb-1">{label}</p>
          <p className={cn('text-2xl font-bold tracking-tight', c.text)}>{value}</p>
          {sublabel && <p className="text-[10px] text-[#7a8f80]/60 mt-1">{sublabel}</p>}
        </div>
        {icon && <span className={cn('p-2 rounded-lg', c.iconBg, c.iconColor)}>{icon}</span>}
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   FORM SECTION
   ═══════════════════════════════════════════════════════════ */

export function FormSection({ title, children, columns = 2 }: { title: string; children: React.ReactNode; columns?: 1 | 2 | 3 }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-[#7a8f80] uppercase tracking-wider border-b border-[#1e2e25] pb-2">{title}</p>
      <div className={cn('grid gap-3', columns === 1 && 'grid-cols-1', columns === 2 && 'grid-cols-1 sm:grid-cols-2', columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   AI BLOCK (ambre) — Réservé IA
   ═══════════════════════════════════════════════════════════ */

export function AiBlock({ children, title = 'Recommandations IA' }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="rounded-[0.625rem] border border-[#f5a623]/40 bg-[#f5a623]/[0.06] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="p-1.5 rounded-lg bg-[#f5a623]/20">
          <Sparkles size={14} strokeWidth={2} className="text-[#f5a623]" />
        </span>
        <p className="text-sm font-semibold text-[#f5a623]">{title}</p>
        <AiModeBadge />
      </div>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TABS
   ═══════════════════════════════════════════════════════════ */

export function Tabs({ tabs, active, onChange }: { tabs: Array<{ value: string; label: string; count?: number }>; active: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex items-center gap-1 bg-[#111916] border border-[#1e2e25] rounded-lg p-1">
      {tabs.map(tab => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
            active === tab.value ? 'bg-[#0f9d70] text-white' : 'text-[#7a8f80] hover:text-[#e8ede9] hover:bg-[#172019]',
          )}
        >
          {tab.label}
          {tab.count !== undefined && <span className={cn('ml-1.5 text-xs', active === tab.value ? 'text-white/70' : 'text-[#7a8f80]/60')}>{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
