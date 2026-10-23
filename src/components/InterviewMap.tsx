import { useMemo, useRef, useState } from 'react';
import { useElementWidth } from '../hooks/useElementWidth';
import { NODE_WIDTH, OUTCOMES, roundFlow, type Outcome } from '../lib/rounds';
import type { Round, Status } from '../lib/schema';
import { SANS, section, sectionHeading, sectionHeadingRow } from './styles';

/**
 * Validated against the page surface (#f7f5f0) for colour-blind separation.
 * Rejected is orange rather than the app's red: the muted red and green read
 * as the same colour to a deuteranope (ΔE 3.4), and telling an offer path from
 * a rejection path is the whole point of the map. Ghosted is a deliberate
 * neutral — nothing happened — and every node is labelled, so no ending is
 * identified by colour alone.
 */
const OUTCOME_COLOUR: Record<Outcome, string> = {
  'In progress': '#4a6fae',
  Offer: '#13876b',
  Rejected: '#dd7a2a',
  Ghosted: '#a3abb5',
};

const HEIGHT = 260;
/** Room to the right of the last column for its labels. */
const LABEL_ROOM = 130;
const HEADER = 22;

type Hover = { x: number; y: number; text: string } | null;

/**
 * Every application with recorded rounds, followed from its first round to how
 * it ended. Band width is the number of applications; band colour is how they
 * ended, so the paths that lead to offers stand out from the ones that don't.
 */
export function InterviewMap({ rows }: { rows: { status: Status; rounds: Round[] }[] }) {
  const [ref, width] = useElementWidth(320, 900);
  const [hover, setHover] = useState<Hover>(null);
  const [active, setActive] = useState<string | null>(null);

  const plot = Math.max(200, width - LABEL_ROOM);
  const flow = useMemo(() => roundFlow(rows, plot, HEIGHT - HEADER), [rows, plot]);
  const byId = useMemo(() => new Map(flow.nodes.map((n) => [n.id, n])), [flow]);
  const roundCols = Math.max(0, flow.cols - 1);

  // Tooltip position relative to the chart's own box, so it follows the cursor
  // wherever the section has scrolled to.
  const box = useRef<HTMLDivElement>(null);
  const at = (e: React.MouseEvent, text: string) => {
    const b = box.current?.getBoundingClientRect();
    if (!b) return;
    setHover({ x: e.clientX - b.left, y: e.clientY - b.top, text });
  };

  return (
    <section style={section}>
      <div style={sectionHeadingRow}>
        <h2 style={sectionHeading}>Interview Rounds</h2>
        {flow.total > 0 && (
          <span style={{ fontFamily: SANS, fontSize: 11.5, color: '#8b939e' }}>
            {flow.total} {flow.total === 1 ? 'application' : 'applications'} with rounds recorded
          </span>
        )}
      </div>

      <div ref={ref} style={{ borderTop: '1px solid #d8d1c2', paddingTop: 16 }}>
        {flow.total === 0 ? (
          <p style={{ margin: '18px 0', fontSize: 13, color: '#8b939e', lineHeight: 1.7 }}>
            No interview rounds recorded yet. Open an application&rsquo;s details with ▸ and add its
            rounds in order — HR, hiring manager, panel — and this maps how your interviews run and
            where they end.
          </p>
        ) : (
          <>
            <div
              style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12 }}
              aria-label="Legend: band colour is how the applications ended"
            >
              {OUTCOMES.map((o) => (
                <span
                  key={o}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: SANS,
                    fontSize: 11,
                    color: '#5f6a75',
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: OUTCOME_COLOUR[o],
                    }}
                  />
                  {o}
                </span>
              ))}
            </div>

            <div ref={box} style={{ position: 'relative' }}>
              <svg
                width={plot + LABEL_ROOM}
                height={HEIGHT}
                role="img"
                aria-label={`Interview rounds for ${flow.total} applications, from first round to outcome`}
                onMouseLeave={() => {
                  setHover(null);
                  setActive(null);
                }}
                style={{ display: 'block', overflow: 'visible' }}
              >
                {Array.from({ length: roundCols }, (_, c) => (
                  <text
                    key={c}
                    x={c * ((plot - NODE_WIDTH) / Math.max(1, flow.cols - 1))}
                    y={10}
                    style={{
                      fontFamily: SANS,
                      fontSize: 10,
                      letterSpacing: '.1em',
                      fill: '#9aa3ad',
                    }}
                  >
                    ROUND {c + 1}
                  </text>
                ))}

                <g transform={`translate(0,${HEADER})`}>
                  {flow.links.map((l, i) => {
                    const src = byId.get(l.source)!;
                    const dst = byId.get(l.target)!;
                    const lit = active === null || active === l.source || active === l.target;
                    return (
                      <path
                        key={i}
                        d={l.path}
                        fill={OUTCOME_COLOUR[l.outcome]}
                        fillOpacity={lit ? 0.42 : 0.1}
                        stroke="#f7f5f0"
                        strokeWidth={1}
                        onMouseMove={(e) =>
                          at(
                            e,
                            `${src.name} → ${dst.name} · ${l.value} ${l.value === 1 ? 'application' : 'applications'}${dst.kind === 'outcome' ? '' : `, ended ${l.outcome.toLowerCase()}`}`,
                          )
                        }
                        style={{ transition: 'fill-opacity .15s' }}
                      />
                    );
                  })}

                  {flow.nodes.map((n) => {
                    const fill =
                      n.kind === 'outcome' ? OUTCOME_COLOUR[n.name as Outcome] : '#2c3640';
                    return (
                      <g
                        key={n.id}
                        onMouseEnter={() => setActive(n.id)}
                        onMouseMove={(e) =>
                          at(
                            e,
                            n.kind === 'round'
                              ? `Round ${n.col + 1} · ${n.name} · ${n.value}`
                              : `${n.name} after ${n.col} ${n.col === 1 ? 'round' : 'rounds'} · ${n.value}`,
                          )
                        }
                      >
                        {/* A wider invisible target than the 12px bar. */}
                        <rect
                          x={n.x - 4}
                          y={n.y}
                          width={NODE_WIDTH + 8}
                          height={Math.max(n.h, 8)}
                          fill="transparent"
                        />
                        <rect
                          x={n.x}
                          y={n.y}
                          width={NODE_WIDTH}
                          height={Math.max(n.h, 2)}
                          rx={2}
                          fill={fill}
                        />
                        <text
                          x={n.x + NODE_WIDTH + 6}
                          y={n.y + Math.max(n.h, 2) / 2}
                          dominantBaseline="middle"
                          paintOrder="stroke"
                          stroke="#f7f5f0"
                          strokeWidth={3}
                          style={{ fontFamily: SANS, fontSize: 11, fill: '#37414c' }}
                        >
                          {n.name}
                          <tspan style={{ fill: '#8b939e' }}> {n.value}</tspan>
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>

              {hover && (
                <div
                  role="tooltip"
                  style={{
                    position: 'absolute',
                    left: Math.min(hover.x + 12, plot + LABEL_ROOM - 220),
                    top: hover.y + 12,
                    maxWidth: 240,
                    pointerEvents: 'none',
                    background: '#2c3640',
                    color: '#f7f5f0',
                    fontFamily: SANS,
                    fontSize: 11.5,
                    lineHeight: 1.45,
                    padding: '6px 9px',
                    borderRadius: 6,
                    boxShadow: '0 6px 18px rgba(0,0,0,.18)',
                  }}
                >
                  {hover.text}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
