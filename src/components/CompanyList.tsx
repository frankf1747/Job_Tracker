import { useEffect, useRef, useState } from 'react';
import type { Company } from '../data/companies';
import { SANS, SERIF, microLabel } from './styles';

/**
 * A standalone page for target companies and outreach notes — places to apply
 * to or reach out to, kept apart from the applications already sent.
 *
 * Rendered beneath the tool rail (which stays fixed above it) rather than as a
 * modal, so it reads as its own page reached from the rail, with Home to return.
 */
export function CompanyList({
  companies,
  load,
  onAdd,
  onRename,
  onNotes,
  onDelete,
  onReload,
}: {
  companies: Company[];
  load: 'loading' | 'ready' | 'error';
  onAdd: (name: string, notes: string) => Promise<void>;
  onRename: (id: string, name: string) => void;
  onNotes: (id: string, notes: string) => void;
  onDelete: (id: string) => void;
  onReload: () => void;
}) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [adding, setAdding] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);

  const add = async () => {
    const n = name.trim();
    if (!n || adding) return;
    setAdding(true);
    try {
      await onAdd(n, notes.trim());
      setName('');
      setNotes('');
      nameInput.current?.focus();
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        background: '#f7f5f0',
        backgroundImage:
          'linear-gradient(rgba(44,54,64,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(44,54,64,.022) 1px,transparent 1px)',
        backgroundSize: '44px 44px',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: 940,
          margin: '0 auto',
          padding: '54px 34px 90px',
        }}
      >
        <div style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '.14em', color: '#41678a' }}>
          OUTREACH
        </div>
        <h1
          style={{
            fontFamily: SERIF,
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: '-.01em',
            color: '#2c3640',
            margin: '6px 0 4px',
          }}
        >
          Company List
        </h1>
        <p style={{ fontFamily: SANS, fontSize: 13, color: '#8b939e', margin: '0 0 26px' }}>
          Companies worth an application or a message — and who to reach out to.
        </p>

        {/* Add row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(180px, 260px) 1fr auto',
            gap: 10,
            alignItems: 'end',
            background: '#fbfaf7',
            border: '1px solid #e2dccd',
            borderRadius: 9,
            padding: 14,
            marginBottom: 22,
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={microLabel}>Company</span>
            <input
              ref={nameInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void add();
                }
              }}
              placeholder="e.g. Regeneron"
              style={fieldInput}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={microLabel}>Notes</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void add();
                }
              }}
              placeholder="Referral, contact, why they're a fit…"
              style={fieldInput}
            />
          </label>
          <button
            onClick={() => void add()}
            disabled={!name.trim() || adding}
            style={{
              background: '#41678a',
              border: '1px solid #41678a',
              borderRadius: 7,
              padding: '9px 18px',
              fontSize: 13,
              fontWeight: 600,
              color: '#f4f2ec',
              opacity: !name.trim() || adding ? 0.55 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>

        {load === 'loading' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div
              style={{
                width: 28,
                height: 28,
                margin: '0 auto',
                border: '2.5px solid #ddd6c8',
                borderTopColor: '#41678a',
                borderRadius: '50%',
                animation: 'spin .8s linear infinite',
              }}
            />
          </div>
        )}

        {load === 'error' && (
          <div style={{ textAlign: 'center', padding: 30, color: '#8b6420' }}>
            <p style={{ fontFamily: SANS, fontSize: 13, margin: '0 0 12px', lineHeight: 1.6 }}>
              Couldn't load your companies. If the project was idle it may have paused — opening the
              Supabase dashboard wakes it.
            </p>
            <button
              onClick={onReload}
              style={{
                background: 'transparent',
                border: '1px solid #d8d1c2',
                borderRadius: 7,
                padding: '8px 18px',
                fontSize: 13,
                color: '#41678a',
              }}
            >
              Try again
            </button>
          </div>
        )}

        {load === 'ready' && companies.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: 44,
              fontFamily: SANS,
              fontSize: 13,
              color: '#9aa3ad',
            }}
          >
            No companies yet — add the first one above.
          </div>
        )}

        {load === 'ready' && companies.length > 0 && (
          <div style={{ border: '1px solid #e2dccd', borderRadius: 9, overflow: 'hidden' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(160px, 240px) 1fr 34px',
                gap: 12,
                padding: '10px 14px',
                borderBottom: '1px solid #e2dccd',
                background: '#f3efe6',
                fontFamily: SANS,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '.08em',
                color: '#8b939e',
              }}
            >
              <span>COMPANY</span>
              <span>NOTES</span>
              <span />
            </div>
            {companies.map((c, i) => (
              <CompanyRow
                key={c.id}
                company={c}
                striped={i % 2 === 1}
                onRename={onRename}
                onNotes={onNotes}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CompanyRow({
  company,
  striped,
  onRename,
  onNotes,
  onDelete,
}: {
  company: Company;
  striped: boolean;
  onRename: (id: string, name: string) => void;
  onNotes: (id: string, notes: string) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState(company.name);
  const [notes, setNotes] = useState(company.notes);
  const [armed, setArmed] = useState(false);

  // Keep local fields in step when the row changes underneath (e.g. reload).
  useEffect(() => setName(company.name), [company.name]);
  useEffect(() => setNotes(company.notes), [company.notes]);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const commitName = () => {
    const n = name.trim();
    if (!n) {
      setName(company.name); // A blank name isn't a rename; snap back.
      return;
    }
    if (n !== company.name) onRename(company.id, n);
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(160px, 240px) 1fr 34px',
        gap: 12,
        padding: '8px 14px',
        alignItems: 'center',
        background: striped ? '#f6f2ea' : 'transparent',
        borderBottom: '1px solid #ece7db',
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        aria-label={`Company name for ${company.name}`}
        className="company-cell"
        style={{ ...rowInput, fontWeight: 600, color: '#2c3640' }}
      />
      <input
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          onNotes(company.id, e.target.value);
        }}
        placeholder="add a note…"
        aria-label={`Company notes for ${company.name}`}
        className="company-cell"
        style={rowInput}
      />
      <button
        onClick={() => (armed ? onDelete(company.id) : setArmed(true))}
        onBlur={() => setArmed(false)}
        aria-label={armed ? `Confirm removing ${company.name}` : `Remove ${company.name}`}
        title={armed ? 'Click again to remove' : 'Remove'}
        style={{
          width: 26,
          height: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          border: armed ? '1px solid #a35242' : '1px solid transparent',
          background: armed ? '#a35242' : 'transparent',
          color: armed ? '#f7f5f0' : '#b0a99a',
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

const fieldInput = {
  background: '#fff',
  border: '1.5px solid #cfc8b9',
  borderRadius: 6,
  padding: '9px 11px',
  fontSize: 13,
  fontFamily: SANS,
};

const rowInput = {
  width: '100%',
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 5,
  padding: '6px 8px',
  fontSize: 12.5,
  fontFamily: SANS,
  color: '#37414c',
};
