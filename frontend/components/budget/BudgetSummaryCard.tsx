'use client';

interface BudgetSummaryCardProps {
  budgetTotal: number;
  soldeNet: number;
  totalDepenses: number;
  totalRevenus: number;
  depensesPrevisionnelles: number;
  pctConsomme: number;
  devise: string;
}

function fmt(cents: number, devise: string) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: devise || 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export default function BudgetSummaryCard({
  budgetTotal,
  soldeNet,
  totalDepenses,
  totalRevenus,
  depensesPrevisionnelles,
  pctConsomme,
  devise,
}: BudgetSummaryCardProps) {
  const hasBudget = budgetTotal > 0;
  const barColor = pctConsomme > 100 ? 'bg-red-500' : pctConsomme > 80 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Solde net */}
      <div className="col-span-2 lg:col-span-1 bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Solde net</p>
        <p className={`text-2xl font-black ${soldeNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {fmt(soldeNet, devise)}
        </p>
        <p className="text-xs text-stone-400 mt-1">Revenus − Dépenses réelles</p>
      </div>

      {/* Dépenses réelles */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Dépenses</p>
        <p className="text-2xl font-black text-red-600">{fmt(totalDepenses, devise)}</p>
        <p className="text-xs text-stone-400 mt-1">Payées + engagées</p>
      </div>

      {/* Revenus */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Revenus</p>
        <p className="text-2xl font-black text-emerald-600">{fmt(totalRevenus, devise)}</p>
        <p className="text-xs text-stone-400 mt-1">Payés + engagés</p>
      </div>

      {/* Budget consommé */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Budget total</p>
        {hasBudget ? (
          <>
            <p className="text-2xl font-black text-stone-900">{fmt(budgetTotal, devise)}</p>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-stone-500 mb-1">
                <span>Consommé</span>
                <span className={`font-black ${pctConsomme > 100 ? 'text-red-600' : pctConsomme > 80 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {pctConsomme}%
                </span>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.min(pctConsomme, 100)}%` }}
                />
              </div>
              {depensesPrevisionnelles > 0 && (
                <p className="text-[10px] text-stone-400 mt-1">
                  + {fmt(depensesPrevisionnelles, devise)} prévus
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-stone-400 mt-1">Non configuré</p>
        )}
      </div>
    </div>
  );
}
