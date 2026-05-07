import React from 'react';
import { clsx } from 'clsx';

export function PageHeader({
  title,
  eyebrow,
  children,
  action,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-slate-800/80 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        {eyebrow && <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-blue-300">{eyebrow}</p>}
        <h2 className="text-2xl font-semibold tracking-tight text-slate-50">{title}</h2>
        <p className="mt-2 max-w-[70ch] text-sm leading-6 text-slate-400">{children}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children: React.ReactNode;
}) {
  const toneClass = {
    info: 'border-blue-900/70 bg-blue-950/30 text-blue-100',
    success: 'border-emerald-900/70 bg-emerald-950/30 text-emerald-100',
    warning: 'border-amber-900/70 bg-amber-950/30 text-amber-100',
    danger: 'border-red-900/70 bg-red-950/30 text-red-100',
  }[tone];

  return (
    <div className={clsx('rounded-lg border px-4 py-3 text-sm leading-6', toneClass)} role={tone === 'danger' ? 'alert' : 'status'}>
      {title && <p className="font-medium text-current">{title}</p>}
      <div className={clsx(title && 'mt-1', 'text-current/80')}>{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-10 text-center">
      <h3 className="text-base font-medium text-slate-100">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">{children}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingState({ children = 'Loading records...' }: { children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400" role="status">
      {children}
    </div>
  );
}

export function ConceptPanel({
  title,
  children,
  items,
}: {
  title: string;
  children: React.ReactNode;
  items?: string[];
}) {
  return (
    <aside className="rounded-xl border border-slate-800 bg-slate-900/70 p-4" aria-label={title}>
      <h3 className="text-sm font-medium text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{children}</p>
      {items && (
        <ul className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-3">
          {items.map((item) => (
            <li key={item} className="rounded-lg bg-slate-950 px-3 py-2">{item}</li>
          ))}
        </ul>
      )}
    </aside>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const [dismissed, setDismissed] = React.useState(false);
  if (dismissed) return null;

  return (
    <Notice tone="danger" title="Action needs attention">
      <p>{message}</p>
      <p className="mt-2 text-sm text-current/70">If this keeps happening, use the reference in the message or the action name when checking API logs.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {onRetry && (
          <button type="button" onClick={onRetry} className="rounded-md bg-red-950 px-3 py-2 text-sm font-medium text-red-100 hover:bg-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300">
            Reload data
          </button>
        )}
        <button type="button" onClick={() => setDismissed(true)} className="rounded-md px-3 py-2 text-sm font-medium text-red-100 hover:bg-red-900/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300">
          Dismiss
        </button>
      </div>
    </Notice>
  );
}

export function ConfirmAction({
  label,
  confirmLabel,
  consequence,
  tone = 'danger',
  onConfirm,
  className,
}: {
  label: string;
  confirmLabel: string;
  consequence: string;
  tone?: 'danger' | 'warning';
  onConfirm: () => Promise<void> | void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={className ?? dangerTextClass(tone)}>
        {label}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm shadow-none">
      <p className="max-w-md text-slate-300">{consequence}</p>
      {error && <p className="mt-2 text-red-300" role="alert">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className={clsx(
            'rounded-md px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60',
            tone === 'warning'
              ? 'border border-amber-800 bg-amber-950/60 text-amber-100 hover:bg-amber-900/60 focus-visible:outline-amber-300'
              : 'border border-red-800 bg-red-950/60 text-red-100 hover:bg-red-900/60 focus-visible:outline-red-300',
          )}
        >
          {busy ? 'Working...' : confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300 disabled:opacity-60"
        >
          Keep unchanged
        </button>
      </div>
    </div>
  );
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded px-2 py-1 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
      aria-label={`${label}: ${value}`}
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

function dangerTextClass(tone: 'danger' | 'warning') {
  return tone === 'warning'
    ? 'rounded px-2 py-1 text-xs font-medium text-amber-300 hover:bg-amber-950/40 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300'
    : 'rounded px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-950/40 hover:text-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300';
}

