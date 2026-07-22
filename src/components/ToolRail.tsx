import type { ReactNode } from 'react';
import { SANS } from './styles';

export type Tool = {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
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
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: '1px solid transparent',
            borderRadius: 8,
            color: '#4a5560',
            fontFamily: SANS,
            transition: 'background .15s, border-color .15s, color .15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#eceadf';
            e.currentTarget.style.borderColor = '#ddd6c8';
            e.currentTarget.style.color = '#2c4a66';
          }}
          onMouseLeave={(e) => {
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
