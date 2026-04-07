'use client';
import { useState, useEffect, use } from 'react';
import { api } from '@/lib/api';

export default function CalendarPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;

  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Interactive Modal for a specific task
  const [selectedTask, setSelectedTask] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get(`/projects/${projectId}/tasks`);
        const tasksWithDates = res.filter((t: any) => t.due_date);
        setTasks(tasksWithDates);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [projectId]);

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const today = () => setCurrentDate(new Date());

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // Adjust for Monday start
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const days = [];
    // Previous month padding
    for (let i = startOffset; i > 0; i--) {
       const d = new Date(year, month - 1, daysInPrevMonth - i + 1);
       days.push({ day: d.getDate(), currentMonth: false, date: d });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
       const d = new Date(year, month, i);
       days.push({ day: d.getDate(), currentMonth: true, date: d });
    }
    // Next month padding to fill weeks (up to 42 for 6 weeks grid, but we can do dynamic)
    const totalDays = startOffset + daysInMonth;
    const endOffset = (7 - (totalDays % 7)) % 7;
    // ensure at least 5 rows (35 days) or 6 rows (42 days)
    const weeksFilled = Math.ceil((totalDays + endOffset) / 7);
    const addedOffset = weeksFilled === 5 ? endOffset + 7 : endOffset;

    for (let i = 1; i <= addedOffset; i++) {
       const d = new Date(year, month + 1, i);
       days.push({ day: d.getDate(), currentMonth: false, date: d });
    }
    return days;
  };

  const calendarDays = getDaysInMonth(currentDate);

  const isToday = (date: Date) => {
    const t = new Date();
    return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
  };

  const getTasksForDate = (date: Date) => {
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    
    return tasks.filter((t: any) => {
      const hasDue = !!t.due_date;
      if (!hasDue) return false;
      
      const dueData = new Date(t.due_date);
      const due = new Date(dueData.getFullYear(), dueData.getMonth(), dueData.getDate()).getTime();
      
      let start = due;
      if (t.start_date) {
         const startData = new Date(t.start_date);
         start = new Date(startData.getFullYear(), startData.getMonth(), startData.getDate()).getTime();
      }
      
      return target >= start && target <= due;
    });
  };

  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      {/* HEADER */}
      <div className="relative z-20 flex flex-col md:flex-row items-start md:items-center justify-between mb-6 shrink-0 gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 flex items-center gap-2 sm:gap-3">
            Calendrier du projet
            <div className="group relative z-30">
              <div className="w-5 h-5 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center text-xs font-bold cursor-help hover:bg-orange-100 hover:text-orange-600 transition-colors">?</div>
              <div className="absolute left-0 sm:left-1/2 sm:-translate-x-1/2 top-full mt-2 w-64 sm:w-72 bg-stone-800 text-white text-xs p-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[80]">
                Vue mensuelle interactive de vos échéances. Cliquez sur une tâche pour voir ses détails. Les tâches s'étalent de leur date de début à leur échéance.
                <div className="absolute left-6 sm:left-1/2 sm:-translate-x-1/2 bottom-full border-4 border-transparent border-b-stone-800"></div>
              </div>
            </div>
          </h2>
        </div>

        <div className="flex items-center gap-4 bg-white border border-stone-200 p-1.5 rounded-2xl shadow-sm">
          <button onClick={prevMonth} className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-500 hover:text-stone-900">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          
          <div className="w-40 text-center font-bold text-stone-800 capitalize select-none cursor-pointer hover:text-orange-600 transition-colors" onClick={today}>
             {currentDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
          </div>
          
          <button onClick={nextMonth} className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-500 hover:text-stone-900">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      {loading ? (
         <div className="animate-pulse bg-white border border-stone-200 rounded-3xl h-[600px] w-full"></div>
      ) : (
        <div className="flex-1 bg-white border border-stone-200 rounded-3xl overflow-hidden flex flex-col shadow-sm">
           {/* Jours de la semaine */}
           <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50/50">
             {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
                <div key={day} className="py-3 text-center text-xs font-bold uppercase tracking-widest text-stone-400">
                   {day}
                </div>
             ))}
           </div>
           
           {/* Grille du calendrier */}
           <div className="flex-1 grid grid-cols-7 bg-stone-100 gap-[1px]">
             {calendarDays.map((dayInfo, idx) => {
               const dayTasks = getTasksForDate(dayInfo.date);
               const isTodayDate = isToday(dayInfo.date);
               
               return (
                 <div key={idx} className={`min-h-[120px] bg-white p-2 transition-colors hover:bg-stone-50/50 flex flex-col ${!dayInfo.currentMonth ? 'opacity-50 bg-stone-50/30' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                       <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold select-none ${isTodayDate ? 'bg-orange-500 text-white shadow-md' : 'text-stone-600'}`}>
                          {dayInfo.day}
                       </span>
                    </div>
                    
                    <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto pr-1 custom-scrollbar">
                       {dayTasks.map(task => {
                         const isDone = task.status === 'done';
                         const isLate = new Date(task.due_date) < new Date() && !isDone && !isTodayDate;
                         
                         let colorClass = 'bg-stone-100 text-stone-700 hover:bg-stone-200 border-transparent';
                         if (isDone) colorClass = 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100';
                         else if (isLate) colorClass = 'bg-red-50 text-red-700 hover:bg-red-100 border-red-100';
                         else if (task.status === 'in_progress') colorClass = 'bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-100';
                         
                         return (
                           <div 
                              key={task.id}
                              onClick={() => setSelectedTask(task)}
                              className={`text-xs px-2 py-1.5 rounded-lg border cursor-pointer font-medium truncate transition-all ${colorClass} ${isDone ? 'opacity-60 line-through' : 'shadow-sm hover:shadow'}`}
                              title={task.title}
                           >
                             {task.title}
                           </div>
                         );
                       })}
                    </div>
                 </div>
               );
             })}
           </div>
        </div>
      )}

      {/* MODAL TÂCHE */}
      {selectedTask && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-[fadeUp_0.3s_ease-out]">
                <div className="px-6 py-5 border-b border-stone-100 flex items-start justify-between">
                   <div>
                      <div className="flex items-center gap-2 mb-1">
                         <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                            selectedTask.status === 'done' ? 'bg-emerald-100 text-emerald-800' : 
                            selectedTask.status === 'in_progress' ? 'bg-orange-100 text-orange-800' : 'bg-stone-100 text-stone-800'
                         }`}>
                           {selectedTask.status === 'done' ? 'Terminé' : selectedTask.status === 'in_progress' ? 'En cours' : 'À faire'}
                         </span>
                         {selectedTask.phase && (
                           <span className="text-[10px] text-stone-500 font-semibold uppercase">{selectedTask.phase}</span>
                         )}
                      </div>
                      <h3 className="font-bold text-xl text-stone-900 leading-tight">{selectedTask.title}</h3>
                   </div>
                   <button onClick={() => setSelectedTask(null)} className="text-stone-400 hover:text-stone-800 transition-colors p-1 bg-stone-50 hover:bg-stone-100 rounded-full">
                     <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                   </button>
                </div>
                
                <div className="p-6 space-y-5">
                   {selectedTask.description ? (
                      <p className="text-stone-600 text-sm leading-relaxed">{selectedTask.description}</p>
                   ) : (
                      <p className="text-stone-400 text-sm italic">Aucune description fournie.</p>
                   )}
                   
                   <div className="grid grid-cols-2 gap-4 pt-4 border-t border-stone-100">
                      <div>
                         <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Période</p>
                         <p className={`text-sm font-semibold flex flex-col gap-1.5 ${new Date(selectedTask.due_date) < new Date() && selectedTask.status !== 'done' ? 'text-red-600' : 'text-stone-800'}`}>
                           {selectedTask.start_date && (
                             <span className="flex items-center gap-1.5 text-stone-500">
                               <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                               Du {new Date(selectedTask.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                             </span>
                           )}
                           <span className="flex items-center gap-1.5">
                             <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                             {selectedTask.start_date ? 'Au ' : ''}{new Date(selectedTask.due_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
                           </span>
                         </p>
                      </div>
                      <div>
                         <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Assigné à</p>
                         <div className="flex items-center gap-2">
                             <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                               {(selectedTask.assignee_name || '?').substring(0, 2).toUpperCase()}
                             </div>
                             <p className="text-sm font-semibold text-stone-800 truncate">{selectedTask.assignee_name || 'Non assigné'}</p>
                         </div>
                      </div>
                   </div>
                </div>
                
                <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-end">
                   <button onClick={() => setSelectedTask(null)} className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold rounded-xl transition-all shadow-sm">
                      Fermer
                   </button>
                </div>
            </div>
         </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #d1d5db; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
}
