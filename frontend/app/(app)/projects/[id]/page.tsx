'use client';
export default function ProjectDashboardPage() {
  return (
    <div className="p-8">
      <h2 className="text-xl font-semibold text-stone-800 mb-6">Vue d'ensemble du projet</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Activité récente
            </h3>
            <div className="py-12 text-center text-stone-400 text-sm">
              Rien à afficher pour le moment.
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
             <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
               <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
               Membres
             </h3>
             <div className="text-sm text-stone-500">
               Menu Dashboard en construction
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
