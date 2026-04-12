'use client';

const CATEGORY_COLORS: Record<string, string> = {
  Personnel:       '#f97316',
  Matériel:        '#3b82f6',
  Logiciel:        '#a855f7',
  'Sous-traitance':'#ef4444',
  Marketing:       '#ec4899',
  Divers:          '#64748b',
};

interface Entry {
  amount_cents: number;
  category: string;
  status: string;
}

interface BudgetCategoryChartProps {
  entries: Entry[];
  devise: string;
}

function fmt(cents: number, devise: string) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: devise || 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function BudgetCategoryChart({ entries, devise }: BudgetCategoryChartProps) {
  // Only dépenses (negative amounts) payées ou engagées
  const depenses = entries.filter(
    e => e.amount_cents < 0 && (e.status === 'payé' || e.status === 'engagé')
  );

  const byCategory: Record<string, number> = {};
  for (const e of depenses) {
    byCategory[e.category] = (byCategory[e.category] || 0) + Math.abs(e.amount_cents);
  }

  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, v]) => s + v, 0);

  if (total === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">Répartition par catégorie</p>
        <p className="text-sm text-stone-400 text-center py-8">Aucune dépense réelle</p>
      </div>
    );
  }

  // SVG donut chart
  const R = 56;
  const cx = 70;
  const cy = 70;
  const circumference = 2 * Math.PI * R;

  let offset = 0;
  const segments = sorted.map(([cat, val]) => {
    const pct = val / total;
    const dash = pct * circumference;
    const seg = { cat, val, dash, offset, color: CATEGORY_COLORS[cat] || '#94a3b8' };
    offset += dash;
    return seg;
  });

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">Répartition par catégorie</p>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Donut SVG */}
        <svg width="140" height="140" className="shrink-0">
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth="20"
              strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
              strokeDashoffset={-seg.offset + circumference / 4}
              style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
            />
          ))}
          <text x={cx} y={cy - 6} textAnchor="middle" className="text-xs" fill="#78716c" fontSize="11" fontWeight="600">Total</text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="#1c1917" fontSize="12" fontWeight="800">
            {fmt(total, devise)}
          </text>
        </svg>

        {/* Légende */}
        <div className="flex flex-col gap-2 w-full">
          {segments.map((seg) => (
            <div key={seg.cat} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="text-xs font-bold text-stone-700 truncate">{seg.cat}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-black text-stone-900">{fmt(seg.val, devise)}</span>
                <span className="text-[10px] text-stone-400 ml-1">({Math.round((seg.val / total) * 100)}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
