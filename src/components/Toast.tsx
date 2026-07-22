export type ToastKind = 'success' | 'warn' | 'error';

export type ToastState = { msg: string; kind: ToastKind };

const STYLES: Record<ToastKind, { bg: string; border: string; fg: string; icon: string }> = {
  success: { bg: '#e7eef4', border: '#c9d9e5', fg: '#2c5a80', icon: '✓' },
  warn: { bg: '#f7ecd4', border: '#e7d5a8', fg: '#8a6420', icon: '⚠' },
  error: { bg: '#2c3640', border: '#2c3640', fg: '#f4f2ec', icon: '•' },
};

export function Toast({ toast }: { toast: ToastState }) {
  const s = STYLES[toast.kind];
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 26,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.fg,
        borderRadius: 8,
        padding: '12px 18px',
        boxShadow: '0 14px 40px rgba(0,0,0,.22)',
        animation: 'toastIn .3s cubic-bezier(.2,.8,.2,1)',
        fontSize: 13,
        fontWeight: 500,
        maxWidth: 440,
      }}
    >
      <span style={{ fontSize: 15 }}>{s.icon}</span>
      {toast.msg}
    </div>
  );
}
