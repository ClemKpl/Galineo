'use client';
import { useState, useEffect, use } from 'react';
import { api } from '@/lib/api';

export default function CalendarPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;

  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get(`/projects/${projectId}/tasks`);
        // Garder uniquement les tâches avec au moins une date d'échéance
        const tasksWithDates = res.filter((t: any) => t.due_date);
        
        // Tri par date croissante
        tasksWithDates.sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        setTasks(tasksWithDates);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [projectId]);

  return (
    <div className="p-8 max-w-6xl mx-auto h-full flex flex-col">
      {/* HEADER & INFO BULLE */}
      <div className="relative z-20 flex items-start justify-between mb-8 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 flex items-center gap-3">
            Calendrier & Timeline
            <div className="group relative z-30">
              <div className="w-5 h-5 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center text-xs font-bold cursor-help hover:bg-orange-100 hover:text-orange-600 transition-colors">?</div>
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 bg-stone-800 text-white text-xs p-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[80]">
                Vue chronologique (Gantt simplifié) de toutes les tâches qui ont une date d'échéance. Idéal pour voir quels jalons arrivent à court et moyen terme.
                <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-stone-800"></div>
              </div>
            </div>
          </h2>
          <p className="text-stone-400 text-sm mt-1">Vision globale sur le temps alloué au projet</p>
        </div>
      </div>

      {loading ? (
         <div className="animate-pulse bg-white border border-stone-200 rounded-2xl h-64"></div>
      ) : tasks.length === 0 ? (
        <div className="bg-white border text-center border-stone-200 rounded-2xl py-16">
          <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-stone-300 mb-4" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <p className="text-stone-500 mb-2 font-medium">Timeline vide</p>
          <p className="text-stone-400 text-sm max-w-sm mx-auto">Ajoutez des dates d'échéance à vos tâches dans l'onglet "Tâches" pour qu'elles apparaissent ici.</p>
        </div>
      ) : (
        <div className="flex-1 bg-white border border-stone-200 rounded-2xl overflow-hidden flex flex-col">
           {/* En-tête du timeline */}
           <div className="bg-stone-50 border-b border-stone-200 px-6 py-3 flex text-xs font-semibold text-stone-500 uppercase tracking-wider">
               <div className="flex-1 min-w-[200px]">Tâche</div>
               <div className="w-32 text-center shrink-0">Statut</div>
               <div className="w-32 text-right shrink-0">Échéance</div>
           </div>
           
           <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
              {tasks.map((task, i) => {
                 const date = new Date(task.due_date);
                 const datePassed = date < new Date() && task.status !== 'done';
                 const isDone = task.status === 'done';

                 // Connecteur visuel Timeline
                 return (
                   <div key={task.id} className={`flex items-stretch px-6 py-4 hover:bg-stone-50 transition-colors ${isDone ? 'opacity-60' : ''}`}>
                      <div className="flex-1 min-w-[200px] flex items-center gap-3">
                         <div className={`w-3 h-3 rounded-full shrink-0 ${isDone ? 'bg-emerald-500' : datePassed ? 'bg-red-500 animate-pulse' : 'bg-orange-400'}`}></div>
                         <div>
                            <p className={`text-sm font-medium ${isDone ? 'line-through text-stone-500' : 'text-stone-900'}`}>{task.title}</p>
                            {task.phase && <span className="text-[10px] uppercase font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded mt-1 inline-block">{task.phase}</span>}
                         </div>
                      </div>
                      <div className="w-32 shrink-0 flex items-center justify-center">
                         {isDone ? (
                            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">Terminée</span>
                         ) : datePassed ? (
                            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-100">En retard</span>
                         ) : (
                            <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100">En cours</span>
                         )}
                      </div>
                      <div className={`w-32 shrink-0 flex items-center justify-end text-sm font-medium ${datePassed ? 'text-red-600' : 'text-stone-700'}`}>
                         {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                   </div>
                 )
              })}
           </div>
        </div>
      )}
    </div>
  );
}
