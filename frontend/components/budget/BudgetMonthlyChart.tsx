'use client';

interface Entry {
  amount_cents: number;
  status: string;
  entry_date: string | null;
}

interface BudgetMonthlyChartProps {
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

export default function BudgetMonthlyChart({ entries, devise }: BudgetMonthlyChartProps) {
  // Group by month (last 6 months)
  const monthMap: Record<string, { depenses: number; revenus: number }> = {};

  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap[key] = { depenses: 0, revenus: 0 };
  }

  for (const e of entries) {
    if (!e.entry_date) continue;
    const key = e.entry_date.substring(0, 7);
    if (!(key in monthMap)) continue;
    if (e.status === 'annulé') continue;

    if (e.amount_cents < 0 && (e.status === 'payé' || e.status === 'engagé')) {
      monthMap[key].depenses += Math.abs(e.amount_cents);
    } else if (e.amount_cents > 0 && (e.status === 'payé' || e.status === 'engagé')) {
      monthMap[key].revenus += e.amount_cents;
    }
  }

  const months = Object.entries(monthMap);
  const maxVal = Math.max(...months.map(([, v]) => Math.max(v.depenses, v.revenus)), 1);

  const monthLabels: Record<string, string> = {
    '01': 'Jan', '02': 'Fév', '03': 'Mar', '04': 'Avr',
    '05': 'Mai', '06': 'Juin', '07': 'Juil', '08': 'Aoû',
    '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Déc',
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Évolution mensuelle</p>
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Dépenses</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Revenus</span>
        </div>
      </div>
      <div className="flex items-end gap-2 h-32">
        {months.map(([key, val]) => {
          const monthNum = key.substring(5, 7);
          const label = monthLabels[monthNum] || monthNum;
          const depH = (val.depenses / maxVal) * 100;
          const revH = (val.revenus / maxVal) * 100;
          return (
            <div key={key} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end gap-0.5 h-24">
                <div
                  className="flex-1 bg-red-400 rounded-t-sm transition-all"
                  style={{ height: `${depH}%` }}
                  title={`Dépenses : ${fmt(val.depenses, devise)}`}
                />
                <div
                  className="flex-1 bg-emerald-400 rounded-t-sm transition-all"
                  style={{ height: `${revH}%` }}
                  title={`Revenus : ${fmt(val.revenus, devise)}`}
                />
              </div>
              <span className="text-[9px] font-bold text-stone-400 uppercase">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
