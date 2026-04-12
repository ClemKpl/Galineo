'use client';

interface BudgetAlertBannerProps {
  alerte: 'warning' | 'critique' | null;
  pctConsomme: number;
}

export default function BudgetAlertBanner({ alerte, pctConsomme }: BudgetAlertBannerProps) {
  if (!alerte) return null;

  const isWarning = alerte === 'warning';

  return (
    <div className={`px-4 lg:px-8 py-3 flex items-center gap-3 rounded-xl border ${
      isWarning
        ? 'bg-amber-50 border-amber-200 text-amber-800'
        : 'bg-red-50 border-red-200 text-red-800'
    }`}>
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
        isWarning ? 'bg-amber-100' : 'bg-red-100'
      }`}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <p className="text-sm font-bold">
        {isWarning
          ? `⚠️ Attention : ${pctConsomme}% du budget consommé. Vous approchez de la limite.`
          : `🚨 Budget dépassé ! ${pctConsomme}% du budget total a été consommé.`}
      </p>
    </div>
  );
}
