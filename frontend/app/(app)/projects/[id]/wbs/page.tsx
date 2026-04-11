'use client';
import { useState, useEffect, use } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

interface Task {
  id: number;
  title: string;
  parent_id: number | null;
  status: string;
  priority: string;
}

export default function WBSPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    async function fetchTasks() {
      try {
        const data = await api.get(`/tasks?project_id=${projectId}`);
        setTasks(data);
      } catch (err) {
        console.error(err);
        showToast("Erreur lors de la récupération du WBS", "error");
      } finally {
        setLoading(false);
      }
    }
    fetchTasks();
  }, [projectId, showToast]);

  if (loading) return <div className="p-8"><div className="animate-pulse space-y-4"><div className="h-10 bg-stone-200 rounded-xl w-64" /><div className="h-64 bg-stone-100 rounded-3xl w-full" /></div></div>;

  const rootTasks = tasks.filter(t => t.parent_id === null);
  const getChildren = (parentId: number) => tasks.filter(t => t.parent_id === parentId);

  return (
    <div className="p-4 md:p-8 min-h-full bg-stone-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-stone-900 tracking-tight">Organigramme technique (WBS)</h2>
            <p className="text-stone-400 text-sm mt-1">Visualisation hiérarchisée des fonctionnalités et des tâches du projet.</p>
          </div>
          <button 
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-stone-200 text-stone-600 font-bold rounded-xl hover:bg-stone-50 transition-all active:scale-95 shadow-sm text-sm"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
            Imprimer l'organigramme
          </button>
        </div>

        {/* The WBS Tree */}
        <div className="overflow-x-auto pb-12 scrollbar-thin scrollbar-thumb-stone-200">
          <div className="inline-flex flex-col items-center min-w-full p-4">
            
            {/* Main Project Node */}
            <div className="mb-12 relative">
              <div className="px-8 py-4 bg-orange-500 text-white rounded-2xl shadow-xl shadow-orange-200 font-black uppercase tracking-widest text-sm text-center min-w-[200px]">
                PROJET GLOBAL
              </div>
              <div className="absolute top-full left-1/2 w-px h-12 bg-stone-200 -translate-x-1/2" />
            </div>

            {/* Features (Level 1) */}
            <div className="flex justify-center gap-8 relative items-start">
              {rootTasks.map((feature, idx) => {
                const children = getChildren(feature.id);
                return (
                  <div key={feature.id} className="flex flex-col items-center group relative">
                    {/* Horizontal connector line for siblings */}
                    {rootTasks.length > 1 && (
                      <div className={`absolute top-0 h-px bg-stone-200 transition-all group-hover:bg-orange-300 ${
                        idx === 0 ? 'left-1/2 right-0' : 
                        idx === rootTasks.length - 1 ? 'left-0 right-1/2' : 
                        'left-0 right-0'
                      }`} />
                    )}

                    {/* Vertical connector to parent */}
                    <div className="w-px h-6 bg-stone-200 mb-0" />

                    {/* Feature Card */}
                    <div className="relative z-10 px-5 py-3.5 bg-white border-2 border-stone-200 rounded-2xl shadow-sm hover:border-orange-500 transition-all group-hover:shadow-md min-w-[180px] text-center">
                      <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1.5 shrink-0">Module {idx + 1}</p>
                      <p className="text-xs font-bold text-stone-900 leading-tight">{feature.title}</p>
                      <div className="mt-2 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className={`w-1.5 h-1.5 rounded-full ${feature.status === 'done' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                        <span className="text-[9px] font-bold text-stone-400 uppercase tracking-tighter">{feature.status}</span>
                      </div>
                    </div>

                    {/* Vertical connector to children */}
                    {children.length > 0 && (
                      <>
                        <div className="w-px h-8 bg-stone-200 mt-0" />
                        <div className="flex flex-col items-center gap-3">
                          {children.map((task) => (
                            <div key={task.id} className="flex items-center">
                               <div className="w-4 h-px bg-stone-200" />
                               <div className="px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-[11px] font-semibold text-stone-600 min-w-[160px] hover:bg-white hover:shadow-sm hover:border-stone-300 transition-all">
                                 {task.title}
                               </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {rootTasks.length === 0 && (
                <div className="text-center py-12 px-8 bg-white rounded-3xl border border-dashed border-stone-200 text-stone-400 italic">
                  Aucune fonctionnalité définie pour générer l'organigramme.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @media print {
          body * { visibility: hidden; }
          .max-w-7xl, .max-w-7xl * { visibility: visible; }
          .max-w-7xl { position: absolute; left: 0; top: 0; width: 100%; }
          button { display: none !important; }
        }
      `}</style>
    </div>
  );
}
