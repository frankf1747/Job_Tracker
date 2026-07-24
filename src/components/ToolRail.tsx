import type { ReactNode } from 'react';
import { SANS } from './styles';

export type Tool = {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  /** Marks the rail button for the view currently showing. */
  active?: boolean;
};

/**
 * Fixed vertical rail on the right edge, holding entry points to configuration.
 *
 * Built as a list rather than a single button so future tools slot in by
 * appending to the array — the rail sizes itself to whatever it is given.
 */
export function ToolRail({ tools }: { tools: Tool[] }) {
  if (!tools.length) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 14,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        background: 'rgba(252,251,248,.82)',
        backdropFilter: 'blur(5px)',
        border: '1px solid rgba(110,120,132,.24)',
        borderRadius: 12,
        padding: 6,
        boxShadow: '0 8px 26px rgba(44,54,64,.10)',
      }}
    >
      {tools.map((t) => (
        <button
          key={t.id}
          onClick={t.onClick}
          title={t.label}
          aria-label={t.label}
          aria-current={t.active ? 'page' : undefined}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: t.active ? '#e3e9ef' : 'transparent',
            border: `1px solid ${t.active ? '#c3d0da' : 'transparent'}`,
            borderRadius: 8,
            color: t.active ? '#2c4a66' : '#4a5560',
            fontFamily: SANS,
            transition: 'background .15s, border-color .15s, color .15s',
          }}
          onMouseEnter={(e) => {
            if (t.active) return;
            e.currentTarget.style.background = '#eceadf';
            e.currentTarget.style.borderColor = '#ddd6c8';
            e.currentTarget.style.color = '#2c4a66';
          }}
          onMouseLeave={(e) => {
            if (t.active) return;
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.color = '#4a5560';
          }}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}

/** A house — the home/dashboard view. */
export function HomeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

/** A building — the company list. */
export function CompanyIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" />
      <path d="M15 9h4a1 1 0 0 1 1 1v11" />
      <path d="M2 21h20" />
      <path d="M8 8h3M8 12h3M8 16h3" />
    </svg>
  );
}

/** A door with an arrow — sign out. */
export function SignOutIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

/** A stack of paper — the resumes tool. */
export function ResumeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}
