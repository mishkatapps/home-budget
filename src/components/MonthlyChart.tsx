import { useState } from 'react';
import { MONTHS_SHORT, money, ymLabel } from '../lib/format';
import { EN, T } from '../lib/i18n';
import type { MonthTotals } from '../lib/stats';

const W = 720, H = 260, PAD = { top: 12, bottom: 28, start: 8, end: 52 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
const compact = (v: number) => (v >= 1000 ? T(`${+(v / 1000).toFixed(1)} ألف`, `${+(v / 1000).toFixed(1)}k`) : String(v));
// اتجاه الزمن يتبع اتجاه القراءة: بالعربية من اليمين إلى اليسار، وبالإنجليزية من اليسار إلى اليمين
const PLOT_LEFT = EN ? PAD.end : PAD.start, PLOT_RIGHT = EN ? W - PAD.start : W - PAD.end;

/** عمود بطرف علوي مستدير وقاعدة مستوية على خط الأساس */
function bar(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/** دخل مقابل مصروف لكل شهر. الزمن يسير من اليمين إلى اليسار ليوافق اتجاه القراءة العربي. */
export default function MonthlyChart({ months, showIncome = true }: { months: MonthTotals[]; showIncome?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...months.map((m) => Math.max(showIncome ? m.income : 0, m.spent)), 1));
  const plotW = W - PAD.start - PAD.end, plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / months.length;
  const bw = Math.min(18, (slot - 8) / 2);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const slotX = (i: number) => (EN ? PLOT_LEFT + i * slot : PLOT_RIGHT - (i + 1) * slot); // الشهر الأول في بداية السطر
  const h = hover != null ? months[hover] : null;

  return (
    <div className="chart">
      {showIncome && <div className="legend">
        <span><i className="swatch s1" /> الدخل</span>
        <span><i className="swatch s2" /> المصروف</span>
      </div>}
      {/* على الشاشات الضيقة يُمرَّر الرسم أفقياً ويبدأ من أحدث الشهور (اليسار) */}
      <div className="chart-scroll" ref={(el) => { if (el) el.scrollLeft = EN ? el.scrollWidth : -el.scrollWidth; }}>
      <div className="chart-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="الدخل والمصروف لكل شهر" onMouseLeave={() => setHover(null)}>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y(max * f)} y2={y(max * f)} className={f === 0 ? 'axis' : 'grid'} />
              <text x={EN ? PLOT_LEFT - 6 : PLOT_RIGHT + 6} y={y(max * f) + 4} className="tick" textAnchor={EN ? 'end' : 'start'} direction="ltr">{compact(max * f)}</text>
            </g>
          ))}
          {months.map((m, i) => {
            const cx = slotX(i) + slot / 2;
            return (
              <g key={m.ym} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
                <rect x={slotX(i)} y={PAD.top} width={slot} height={plotH} className={hover === i ? 'band on' : 'band'} />
                {showIncome && m.income > 0 && <path d={bar(EN ? cx - bw - 1 : cx + 1, y(m.income), bw, plotH - (y(m.income) - PAD.top))} className="s1" />}
                {m.spent > 0 && <path d={bar(!showIncome ? cx - bw / 2 : EN ? cx + 1 : cx - bw - 1, y(m.spent), bw, plotH - (y(m.spent) - PAD.top))} className="s2" />}
                <text x={cx} y={H - 9} className="tick" textAnchor="middle">
                  {months.length > 12 && i % 2 ? '' : MONTHS_SHORT[Number(m.ym.slice(5)) - 1]}
                </text>
              </g>
            );
          })}
        </svg>
        {h && hover != null && (
          <div className="tooltip" style={{ left: `${((slotX(hover) + slot / 2) / W) * 100}%` }}>
            <strong>{ymLabel(h.ym)}</strong>
            {showIncome && <span><i className="swatch s1" /> الدخل <b className="num">{money(h.income)}</b></span>}
            <span><i className="swatch s2" /> المصروف <b className="num">{money(h.spent)}</b></span>
            {showIncome && <span>الصافي <b className="num">{money(h.income - h.spent)}</b></span>}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
