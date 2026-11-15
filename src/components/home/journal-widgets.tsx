import { useId, type ReactNode } from 'react';
import { Icon } from './journal-icons';
import { asleepMinutes, dateValue, duration, rehabLoads, stageTotals, getNights, type Category, type Day, type RehabLoad, type SleepNight } from './journal-data';

export function Hold({ category }: { category: Category }) {
  return <span className="hold" data-category={category} />;
}
export function Holds({ categories, overlap = false }: { categories: Category[]; overlap?: boolean }) {
  return <span className={`holds${overlap ? ' holds-overlap' : ''}`} aria-hidden="true">{categories.map((category, i) => <Hold key={`${category}-${i}`} category={category} />)}</span>;
}
export function Widget({ title, category, headline, subline, children }: {
  title: string; category: Category; headline: ReactNode; subline: string; children: ReactNode;
}) {
  const titleId = useId();
  return <section className="journal-widget" aria-labelledby={titleId}>
    <div className="widget-label" data-category={category} id={titleId}><Hold category={category} />{title}</div>
    {/* TODO: Add widget configuration when its controls are designed. */}
    <button className="widget-configure" aria-label={`Configure ${title} widget`} aria-disabled="true" title="Widget configuration coming soon"><Icon name="more" size={18} /></button>
    <div><div className="widget-value">{headline}</div><div className="widget-subline">{subline}</div></div>
    {children}
  </section>;
}
export function RehabChart({ loads = rehabLoads }: { loads?: RehabLoad[] }) {
  const values = loads.map(load => load.kg);
  const min = Math.min(...values) - 1.4;
  const max = Math.max(...values) + 1.4;
  const points = loads.map((load, i) => [3 + i / Math.max(1, loads.length - 1) * 129, 56 - (load.kg - min) / (max - min) * 56]);
  const last = points.at(-1)!;
  return <svg viewBox="0 0 137 56" width="137" height="56" role="img" aria-label={`Max-hang load over eight weeks, rising from +${values[0]} kg to +${values.at(-1)} kg`} className="rehab-chart">
    <path d={`M${points.map(p => p.join(' ')).join(' L')} L132 56 L3 56 Z`} fill="var(--color-rehab-bg)" />
    <polyline points={points.map(p => p.join(',')).join(' ')} fill="none" stroke="var(--color-rehab-fg)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    <circle cx={last[0]} cy={last[1]} r="3.5" fill="var(--color-rehab-fg)" stroke="var(--color-surface)" strokeWidth="2" />
  </svg>;
}
export function SleepChart({ nights }: { nights: SleepNight[] }) {
  return <div className="sleep-chart">
    <svg viewBox="0 0 137 48" width="137" height="48" role="img" aria-label={`Sleep stages for the last ${nights.length} nights, between ${duration(Math.min(...nights.map(asleepMinutes)))} and ${duration(Math.max(...nights.map(asleepMinutes)))}`}>
      {nights.map((night, i) => {
        const totals = stageTotals(night);
        let y = 48;
        return <g key={night.date} opacity={i === nights.length - 1 ? 1 : 0.55} stroke="var(--color-surface)" strokeWidth="0.6">
          {(['deep', 'rem', 'light'] as const).map(stage => {
            const height = totals[stage] / 10;
            y -= height;
            return <rect key={stage} x={i * 20.5} y={y} width="14" height={height} fill={`var(--color-sleep-${stage})`} />;
          })}
        </g>;
      })}
    </svg>
    <div className="sleep-weekdays" aria-hidden="true">{nights.map((night, i) => <span key={night.date} className={i === nights.length - 1 ? 'is-today' : ''}>{dateValue(night.date).toLocaleDateString('en-GB', { weekday: 'narrow', timeZone: 'UTC' })}</span>)}</div>
  </div>;
}
export function JournalWidgets({ days }: { days: Day[] }) {
  const nights = getNights(days);
  const latest = rehabLoads.at(-1)!;
  const weeks = Math.round((dateValue(latest.date).getTime() - dateValue(rehabLoads[0].date).getTime()) / 604800000);
  return <div className="journal-widgets">
    <Widget title="Finger rehab" category="rehab" headline={<><span>+{latest.kg}</span><small>kg</small></>} subline={`${latest.edgeMm} mm · +${latest.kg - rehabLoads[0].kg} / ${weeks} wk`}><RehabChart /></Widget>
    <Widget title="Sleep" category="sleep" headline={<span>{duration(nights.reduce((sum, n) => sum + asleepMinutes(n), 0) / nights.length)}</span>} subline={`avg of ${nights.length} nights`}><SleepChart nights={nights} /></Widget>
  </div>;
}
