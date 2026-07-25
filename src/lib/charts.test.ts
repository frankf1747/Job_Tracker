import { describe, expect, test } from 'vitest';
import {
  dailyMomentum,
  exitStats,
  funnelStages,
  hourHistogram,
  hourLabel,
  industryArcs,
  mapCaption,
  momentum,
  skillArcs,
} from './charts';
import { EMPTY_FILTER, derive } from './derive';
import { normalizeLoc } from './locations';
import type { Application, Status } from './schema';

const NOW = new Date(2026, 6, 21);

function app(over: Partial<Application> = {}): Application {
  const location = over.location ?? 'Remote';
  const applied = over.applied ?? '2026-07-20';
  return {
    id: over.id ?? Math.random().toString(),
    company: 'Acme',
    position: 'Analyst',
    industry: 'Fintech',
    level: 'Intern',
    employmentType: 'Internship',
    salary: '',
    skills: [],
    status: 'Submitted',
    reached: 0,
    resume: '',
    notes: '',
    sourceUrl: '',
    ...over,
    location,
    loc: normalizeLoc(location),
    applied,
    appliedTs: Date.parse(applied + 'T00:00'),
    createdAt: over.createdAt ?? Date.parse(applied + 'T09:00'),
  };
}

describe('funnelStages', () => {
  const rows = [
    ...Array.from({ length: 6 }, () => app({ reached: 0, status: 'Submitted' })),
    ...Array.from({ length: 3 }, () => app({ reached: 1, status: 'OA' })),
    app({ reached: 2, status: 'Interview' }),
  ];

  test('the three progression stages count what reached at least that far', () => {
    const s = funnelStages(derive(rows, NOW), EMPTY_FILTER);
    expect(s.slice(0, 3).map((x) => x.key)).toEqual(['Submitted', 'OA', 'Interview']);
    expect(s.slice(0, 3).map((x) => x.count)).toEqual([10, 4, 1]);
  });

  test('the fourth row totals rejected and ghosted, not offers', () => {
    const closedRows = [
      ...rows,
      app({ status: 'Rejected' }),
      app({ status: 'Rejected' }),
      app({ status: 'Ghosted' }),
    ];
    const s = funnelStages(derive(closedRows, NOW), EMPTY_FILTER);
    const closed = s[3];
    expect(closed.key).toBe('Rejected + Ghosted');
    expect(closed.stage).toBe(-1);
    expect(closed.count).toBe(3);
    // Share of all submitted (13 rows), not conversion from the prior stage.
    expect(closed.conv).toBe('23% of all');
  });

  test('the widest stage is 100% and the rest scale to it', () => {
    const s = funnelStages(derive(rows, NOW), EMPTY_FILTER);
    expect(s[0].width).toBe(100);
    expect(s[1].width).toBe(40);
  });

  test('conversion is measured against the previous stage', () => {
    const s = funnelStages(derive(rows, NOW), EMPTY_FILTER);
    expect(s[0].conv).toBe('100%');
    expect(s[1].conv).toBe('40%');
    expect(s[2].conv).toBe('25%');
  });

  test('an empty closed row has zero width, but a tiny one stays visible', () => {
    expect(funnelStages(derive(rows, NOW), EMPTY_FILTER)[3].width).toBe(0);
    const withOne = funnelStages(derive([...rows, app({ status: 'Rejected' })], NOW), EMPTY_FILTER);
    expect(withOne[3].width).toBeGreaterThanOrEqual(4);
  });

  test('the selected stage is highlighted', () => {
    const s = funnelStages(derive(rows, NOW), { ...EMPTY_FILTER, stage: 2 });
    expect(s[2].active).toBe(true);
    expect(s[2].fill).toBe('#2c4a66');
    expect(s[0].active).toBe(false);
  });

  test('the closed row is active only when both terminal statuses are filtered', () => {
    const closedRows = [...rows, app({ status: 'Rejected' }), app({ status: 'Ghosted' })];
    const one = funnelStages(derive(closedRows, NOW), { ...EMPTY_FILTER, statuses: ['Rejected'] });
    expect(one[3].active).toBe(false);
    const both = funnelStages(derive(closedRows, NOW), {
      ...EMPTY_FILTER,
      statuses: ['Rejected', 'Ghosted'],
    });
    expect(both[3].active).toBe(true);
  });

  test('no rows produces zeroes rather than dividing by zero', () => {
    const s = funnelStages(derive([], NOW), EMPTY_FILTER);
    expect(s.map((x) => x.count)).toEqual([0, 0, 0, 0]);
    expect(s.map((x) => x.width)).toEqual([0, 0, 0, 0]);
  });
});

describe('exitStats', () => {
  test('reports counts and share of the filtered total', () => {
    const rows = [
      app({ status: 'Rejected' }),
      app({ status: 'Rejected' }),
      app({ status: 'Ghosted' }),
      app({ status: 'Submitted' }),
    ];
    const e = exitStats(derive(rows, NOW), EMPTY_FILTER);
    expect(e[0]).toMatchObject({ key: 'Rejected', count: 2, pct: '50%' });
    expect(e[1]).toMatchObject({ key: 'Ghosted', count: 1, pct: '25%' });
  });

  test('underlines whichever exit is being filtered on', () => {
    const e = exitStats(derive([], NOW), { ...EMPTY_FILTER, statuses: ['Ghosted'] as Status[] });
    expect(e[0].deco).toBe('none');
    expect(e[1].deco).toBe('underline');
  });

  test('an empty list yields 0% rather than NaN', () => {
    expect(exitStats(derive([], NOW), EMPTY_FILTER)[0].pct).toBe('0%');
  });
});

describe('momentum', () => {
  test('buckets by week and returns oldest first', () => {
    const rows = [
      app({ applied: '2026-07-20' }), // this week
      app({ applied: '2026-07-19' }), // this week
      app({ applied: '2026-07-10' }), // one week back
    ];
    const m = momentum(rows, NOW);
    expect(m.bars).toHaveLength(8);
    expect(m.bars[7].label).toBe('now');
    expect(m.bars[0].label).toBe('-7');
    expect(m.thisWeek).toBe(2);
  });

  test('describes the change against last week in words', () => {
    const up = momentum([app({ applied: '2026-07-20' }), app({ applied: '2026-07-19' })], NOW);
    expect(up.deltaLabel).toContain('more than last week');

    const down = momentum([app({ applied: '2026-07-10' }), app({ applied: '2026-07-11' })], NOW);
    expect(down.deltaLabel).toContain('fewer than last week');

    const flat = momentum([app({ applied: '2026-07-20' }), app({ applied: '2026-07-10' })], NOW);
    expect(flat.deltaLabel).toBe('= same as last week');
  });

  test('ignores applications older than eight weeks', () => {
    expect(momentum([app({ applied: '2025-01-01' })], NOW).thisWeek).toBe(0);
  });

  test('an empty list is flat, not NaN', () => {
    const m = momentum([], NOW);
    expect(m.thisWeek).toBe(0);
    expect(m.bars.every((b) => b.h === 0)).toBe(true);
  });
});

describe('skillArcs', () => {
  test('counts mentions, so a row with three skills contributes three', () => {
    const rows = [app({ skills: ['SQL', 'Python'] }), app({ skills: ['SQL'] })];
    const arcs = skillArcs(rows, []);
    expect(arcs.find((a) => a.name === 'SQL')!.count).toBe(2);
    expect(arcs.find((a) => a.name === 'Python')!.count).toBe(1);
  });

  test('rolls everything past the top eight into Other', () => {
    const rows = Array.from({ length: 12 }, (_, i) => app({ skills: ['skill' + i] }));
    const arcs = skillArcs(rows, []);
    expect(arcs).toHaveLength(9);
    const other = arcs[arcs.length - 1];
    expect(other.name).toBe('Other');
    expect(other.other).toBe(true);
    expect(other.count).toBe(4);
  });

  test('selection highlights the picked slice and dims the rest', () => {
    const rows = [app({ skills: ['SQL', 'Python'] })];
    const arcs = skillArcs(rows, ['SQL']);
    const sql = arcs.find((a) => a.name === 'SQL')!;
    const py = arcs.find((a) => a.name === 'Python')!;
    expect(sql.opacity).toBe(1);
    expect(sql.color).toBe('#2c4a66');
    expect(py.opacity).toBe(0.4);
  });

  test('no selection leaves every slice at full opacity', () => {
    const arcs = skillArcs([app({ skills: ['SQL', 'Python'] })], []);
    expect(arcs.every((a) => a.opacity === 1)).toBe(true);
  });

  test('rows without skills produce no arcs', () => {
    expect(skillArcs([app({ skills: [] })], [])).toEqual([]);
  });
});

describe('industryArcs', () => {
  test('counts applications, so each row contributes exactly one', () => {
    const rows = [
      app({ industry: 'Fintech' }),
      app({ industry: 'Fintech' }),
      app({ industry: 'Healthcare' }),
    ];
    const arcs = industryArcs(rows, []);
    expect(arcs.find((a) => a.name === 'Fintech')!.count).toBe(2);
    expect(arcs.reduce((t, a) => t + a.count, 0)).toBe(3);
  });

  test('rolls everything past the top seven into Other', () => {
    const rows = Array.from({ length: 10 }, (_, i) => app({ industry: 'ind' + i }));
    const arcs = industryArcs(rows, []);
    expect(arcs).toHaveLength(8);
    expect(arcs[arcs.length - 1].count).toBe(3);
  });

  test('the Other slice is never treated as selectable', () => {
    const rows = Array.from({ length: 10 }, (_, i) => app({ industry: 'ind' + i }));
    const arcs = industryArcs(rows, ['ind0']);
    const other = arcs[arcs.length - 1];
    expect(other.other).toBe(true);
    expect(other.opacity).toBe(1);
  });
});

describe('mapCaption', () => {
  test('splits rows into mapped, remote, unspecified, and Canadian', () => {
    const rows = [
      app({ location: 'San Francisco, CA' }),
      app({ location: 'Toronto, ON' }),
      app({ location: 'Remote' }),
      app({ location: '' }),
      app({ location: 'Reykjavik' }),
    ];
    expect(mapCaption(rows)).toBe('2 mapped · 1 remote · 2 unspec · 1 in Canada');
  });

  test('an empty list reads as all zeroes', () => {
    expect(mapCaption([])).toBe('0 mapped · 0 remote · 0 unspec · 0 in Canada');
  });
});

describe('hourLabel', () => {
  test('reads hours the way a person says them', () => {
    expect(hourLabel(0)).toBe('12am');
    expect(hourLabel(9)).toBe('9am');
    expect(hourLabel(12)).toBe('12pm');
    expect(hourLabel(13)).toBe('1pm');
    expect(hourLabel(23)).toBe('11pm');
  });
});

describe('hourHistogram', () => {
  /** A row added at a given local hour, whatever the applied date says. */
  const at = (hour: number) => app({ createdAt: new Date(2026, 6, 20, hour, 30).getTime() });

  test('counts by local hour of day', () => {
    const s = hourHistogram([at(9), at(9), at(21)]);
    expect(s.bars[9].count).toBe(2);
    expect(s.bars[21].count).toBe(1);
    expect(s.total).toBe(3);
  });

  test('always returns 24 bars, so the axis never shifts', () => {
    expect(hourHistogram([at(3)]).bars).toHaveLength(24);
    expect(hourHistogram([]).bars).toHaveLength(24);
  });

  test('names the busiest hour and scales bars against it', () => {
    const s = hourHistogram([at(22), at(22), at(22), at(8)]);
    expect(s.peakHour).toBe(22);
    expect(s.peakCount).toBe(3);
    expect(s.bars[22].h).toBe(100);
    expect(s.bars[8].h).toBe(33);
    expect(s.caption).toBe('Most often around 10pm — 3 of 4');
  });

  test('marks every hour tied for the peak, but reports the earliest', () => {
    const s = hourHistogram([at(7), at(19)]);
    expect(s.peakHour).toBe(7);
    expect(s.bars.filter((b) => b.peak).map((b) => b.hour)).toEqual([7, 19]);
  });

  test('no rows means no peak, rather than crowning midnight', () => {
    const s = hourHistogram([]);
    expect(s.peakHour).toBeNull();
    expect(s.peakCount).toBe(0);
    expect(s.total).toBe(0);
    expect(s.caption).toBe('No applications logged yet.');
    expect(s.bars.every((b) => b.h === 0 && !b.peak)).toBe(true);
  });

  test('skips rows with no usable timestamp instead of counting them as midnight', () => {
    const s = hourHistogram([at(14), app({ createdAt: NaN })]);
    expect(s.total).toBe(1);
    expect(s.bars[0].count).toBe(0);
    expect(s.peakHour).toBe(14);
  });

  test('labels only the six-hour ticks, keeping 24 bars readable', () => {
    const labelled = hourHistogram([at(1)]).bars.filter((b) => b.label);
    expect(labelled.map((b) => b.label)).toEqual(['12am', '6am', '12pm', '6pm']);
  });
});

describe('dailyMomentum', () => {
  const NOW = new Date(2026, 6, 22, 14, 0);
  const on = (iso: string) => app({ applied: iso });

  test('buckets the last seven days, oldest bar first', () => {
    const d = dailyMomentum(
      [on('2026-07-22'), on('2026-07-22'), on('2026-07-21'), on('2026-07-16')],
      NOW,
    );
    expect(d.bars).toHaveLength(7);
    // Reversed for display, so the last bar is today.
    expect(d.bars[6].label).toBe('today');
    expect(d.thisWeek).toBe(2);
  });

  test('ignores anything older than seven days', () => {
    expect(dailyMomentum([on('2026-07-01')], NOW).thisWeek).toBe(0);
    expect(dailyMomentum([on('2026-07-15')], NOW).bars.every((b) => b.h === 0)).toBe(true);
  });

  test('compares today with yesterday', () => {
    const up = dailyMomentum([on('2026-07-22'), on('2026-07-22'), on('2026-07-21')], NOW);
    expect(up.deltaLabel).toBe('▲ 1 more than yesterday');

    const down = dailyMomentum([on('2026-07-21'), on('2026-07-21')], NOW);
    expect(down.deltaLabel).toBe('▼ 2 fewer than yesterday');

    const same = dailyMomentum([on('2026-07-22'), on('2026-07-21')], NOW);
    expect(same.deltaLabel).toBe('= same as yesterday');
  });

  test('labels the earlier days by weekday', () => {
    const d = dailyMomentum([on('2026-07-22')], NOW);
    // 22 Jul 2026 is a Wednesday, so the bar before it is Tuesday.
    expect(d.bars[5].label).toBe('Tue');
  });

  test('scales the tallest bar to full height', () => {
    const d = dailyMomentum([on('2026-07-22'), on('2026-07-22'), on('2026-07-21')], NOW);
    expect(d.bars[6].h).toBe(100);
    expect(d.bars[5].h).toBe(50);
  });

  test('no applications leaves flat bars rather than dividing by zero', () => {
    const d = dailyMomentum([], NOW);
    expect(d.bars.every((b) => b.h === 0)).toBe(true);
    expect(d.thisWeek).toBe(0);
  });
});
