'use client';

import { useEffect, useMemo, useRef, useState, use } from 'react';
import { api } from '@/lib/api';

type CalendarTask = {
  id: number;
  parent_id: number | null;
  title: string;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  phase?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  assigned_to?: number | null;
  assignee_name?: string | null;
};

type ProjectMember = {
  id: number;
  name: string;
  role_name?: string;
};

type CalendarDay = {
  day: number;
  currentMonth: boolean;
  date: Date;
};

type CalendarSegment = {
  task: CalendarTask;
  startCol: number;
  endCol: number;
  lane: number;
  isStart: boolean;
  isEnd: boolean;
};

type CalendarWeek = {
  days: CalendarDay[];
  segments: CalendarSegment[];
  laneCount: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_OPTIONS = [
  { value: 'todo', label: 'A faire' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'done', label: 'Terminee' },
];
const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normale' },
  { value: 'urgent_important', label: 'Urg. & Imp.' },
  { value: 'not_urgent_important', label: 'Importante' },
  { value: 'urgent_not_important', label: 'Urgente' },
];

export default function CalendarPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [previewTask, setPreviewTask] = useState<CalendarTask | null>(null);
  const [editingTask, setEditingTask] = useState<CalendarTask | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('todo');
  const [priority, setPriority] = useState('normal');
  const [phase, setPhase] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [parentId, setParentId] = useState('');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!editingTask) return;

    setTitle(editingTask.title || '');
    setDescription(editingTask.description || '');
    setStatus(editingTask.status || 'todo');
    setPriority(editingTask.priority || 'normal');
    setPhase(editingTask.phase || '');
    setStartDate(editingTask.start_date ? editingTask.start_date.substring(0, 10) : '');
    setDueDate(editingTask.due_date ? editingTask.due_date.substring(0, 10) : '');
    setAssignedTo(editingTask.assigned_to ? String(editingTask.assigned_to) : '');
    setParentId(editingTask.parent_id ? String(editingTask.parent_id) : '');
  }, [editingTask]);

  async function fetchData(nextRefreshing = false) {
    if (nextRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      const [tasksRes, projectRes] = await Promise.all([
        api.get(`/projects/${projectId}/tasks`),
        api.get(`/projects/${projectId}`),
      ]);

      setTasks(Array.isArray(tasksRes) ? tasksRes : []);
      setMembers(Array.isArray(projectRes?.members) ? projectRes.members : []);
    } catch (err) {
      console.error(err);
    } finally {
      if (nextRefreshing) setRefreshing(false);
      else setLoading(false);
    }
  }

  const features = useMemo(
    () => tasks.filter((task) => task.parent_id == null).sort((a, b) => a.title.localeCompare(b.title)),
    [tasks]
  );

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const today = () => setCurrentDate(new Date());

  const calendarDays = useMemo(() => getDaysInMonth(currentDate), [currentDate]);

  const weeks = useMemo(() => {
    const normalizedTasks = tasks
      .map((task) => {
        const due = normalizeDate(task.due_date);
        const start = normalizeDate(task.start_date) || due;
        const safeDue = due || start;
        if (!start || !safeDue) return null;

        return {
          ...task,
          rangeStart: start.getTime() <= safeDue.getTime() ? start : safeDue,
          rangeEnd: start.getTime() <= safeDue.getTime() ? safeDue : start,
        };
      })
      .filter(Boolean) as Array<CalendarTask & { rangeStart: Date; rangeEnd: Date }>;

    const result: CalendarWeek[] = [];

    for (let weekIndex = 0; weekIndex < calendarDays.length; weekIndex += 7) {
      const days = calendarDays.slice(weekIndex, weekIndex + 7);
      const weekStart = startOfDay(days[0].date);
      const weekEnd = startOfDay(days[6].date);

      const overlappingTasks = normalizedTasks.filter(
        (task) => task.rangeStart.getTime() <= weekEnd.getTime() && task.rangeEnd.getTime() >= weekStart.getTime()
      );

      const segments = overlappingTasks
        .map((task) => {
          const segmentStart = task.rangeStart.getTime() < weekStart.getTime() ? weekStart : task.rangeStart;
          const segmentEnd = task.rangeEnd.getTime() > weekEnd.getTime() ? weekEnd : task.rangeEnd;

          return {
            task,
            startCol: diffInDays(weekStart, segmentStart) + 1,
            endCol: diffInDays(weekStart, segmentEnd) + 1,
            isStart: task.rangeStart.getTime() >= weekStart.getTime(),
            isEnd: task.rangeEnd.getTime() <= weekEnd.getTime(),
          };
        })
        .sort((a, b) => {
          if (a.startCol !== b.startCol) return a.startCol - b.startCol;
          return (b.endCol - b.startCol) - (a.endCol - a.startCol);
        });

      const lanesEnd: number[] = [];
      const placedSegments: CalendarSegment[] = segments.map((segment) => {
        let lane = 0;
        while (lanesEnd[lane] !== undefined && lanesEnd[lane] >= segment.startCol) {
          lane += 1;
        }
        lanesEnd[lane] = segment.endCol;

        return {
          task: segment.task,
          startCol: segment.startCol,
          endCol: segment.endCol,
          lane,
          isStart: segment.isStart,
          isEnd: segment.isEnd,
        };
      });

      result.push({ days, segments: placedSegments, laneCount: lanesEnd.length });
    }

    return result;
  }, [calendarDays, tasks]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTask) return;

    setSaving(true);
    try {
      await api.patch(`/projects/${projectId}/tasks/${editingTask.id}`, {
        title: title.trim(),
        description: description || null,
        status,
        priority,
        phase: phase || null,
        start_date: startDate || null,
        due_date: dueDate || null,
        assigned_to: assignedTo ? Number(assignedTo) : null,
        parent_id: editingTask.parent_id == null ? null : parentId ? Number(parentId) : null,
      });

      await fetchData(true);
      setEditingTask(null);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function moveTaskToDate(task: CalendarTask, targetDate: Date) {
    const normalizedTarget = startOfDay(targetDate);
    const currentStart = normalizeDate(task.start_date) || normalizeDate(task.due_date);
    const currentEnd = normalizeDate(task.due_date) || currentStart;

    if (!currentStart || !currentEnd) return;

    const deltaDays = diffInDays(currentStart, normalizedTarget);
    const nextStart = addDays(currentStart, deltaDays);
    const nextEnd = addDays(currentEnd, deltaDays);

    try {
      setRefreshing(true);
      await api.patch(`/projects/${projectId}/tasks/${task.id}`, {
        start_date: task.start_date ? formatDateInput(nextStart) : null,
        due_date: formatDateInput(nextEnd),
      });
      await fetchData(true);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  function handleDragStart(task: CalendarTask) {
    setDraggingTaskId(task.id);
  }

  function handleDragEnd() {
    setDraggingTaskId(null);
    setDragOverDateKey(null);
  }

  function handleDayDragOver(event: React.DragEvent, date: Date) {
    event.preventDefault();
    setDragOverDateKey(formatDateInput(date));
  }

  async function handleDayDrop(event: React.DragEvent, date: Date) {
    event.preventDefault();
    const task = tasks.find((item) => item.id === draggingTaskId);
    setDragOverDateKey(null);
    setDraggingTaskId(null);

    if (!task) return;
    await moveTaskToDate(task, date);
  }

  async function handleExport() {
    const token = typeof window === 'undefined' ? null : localStorage.getItem('galineo_token');
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/projects/${projectId}/tasks/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      alert('Export impossible');
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `project-${projectId}-tasks.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const csv = await file.text();
      await api.post(`/projects/${projectId}/tasks/import`, { csv });
      await fetchData(true);
      alert('Import termine');
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function openPreview(task: CalendarTask) {
    setPreviewTask(task);
  }

  function openEditor(task: CalendarTask) {
    setPreviewTask(null);
    setEditingTask(task);
  }

  const isToday = (date: Date) => {
    const t = new Date();
    return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="relative z-20 flex flex-col md:flex-row items-start md:items-center justify-between mb-6 shrink-0 gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 flex items-center gap-2 sm:gap-3">
            Calendrier du projet
            <div className="group relative z-30">
              <div className="w-5 h-5 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center text-xs font-bold cursor-help hover:bg-orange-100 hover:text-orange-600 transition-colors">?</div>
              <div className="absolute left-0 sm:left-1/2 sm:-translate-x-1/2 top-full mt-2 w-72 bg-stone-800 text-white text-xs p-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[80]">
                Clic sur une plage pour voir l&apos;aperçu. Le bouton Modifier ouvre l&apos;édition. Le glisser-déposer déplace toute la plage, même sur la semaine suivante.
                <div className="absolute left-6 sm:left-1/2 sm:-translate-x-1/2 bottom-full border-4 border-transparent border-b-stone-800"></div>
              </div>
            </div>
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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

          <button type="button" onClick={handleExport} className="rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50">
            Export CSV
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={importing} className="rounded-2xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-70">
            {importing ? 'Import...' : 'Import CSV'}
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleImportFile} className="hidden" />
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse bg-white border border-stone-200 rounded-3xl h-[600px] w-full"></div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden flex flex-col shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50/70 px-4 py-3 text-xs text-stone-500">
            <span>Glisse une plage vers une autre date pour la deplacer. Utilise Export/Import pour manipuler les taches en CSV.</span>
            <button type="button" onClick={() => fetchData(true)} className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 font-semibold text-stone-600 transition hover:bg-stone-100">
              {refreshing ? 'Actualisation...' : 'Actualiser'}
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50/50">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
              <div key={day} className="py-3 text-center text-xs font-bold uppercase tracking-widest text-stone-400">{day}</div>
            ))}
          </div>

          <div className="bg-stone-100">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="border-b border-stone-200 last:border-b-0">
                <div className="grid grid-cols-7 gap-[1px] bg-stone-100">
                  {week.days.map((dayInfo, dayIndex) => {
                    const isTodayDate = isToday(dayInfo.date);
                    const dateKey = formatDateInput(dayInfo.date);
                    const isDragOver = dragOverDateKey === dateKey;

                    return (
                      <div
                        key={dayIndex}
                        onDragOver={(event) => handleDayDragOver(event, dayInfo.date)}
                        onDragEnter={(event) => handleDayDragOver(event, dayInfo.date)}
                        onDragLeave={() => setDragOverDateKey((current) => (current === dateKey ? null : current))}
                        onDrop={(event) => handleDayDrop(event, dayInfo.date)}
                        className={`min-h-[92px] bg-white p-2 transition-colors ${!dayInfo.currentMonth ? 'opacity-50 bg-stone-50/30' : ''} ${isDragOver ? 'bg-orange-50 ring-2 ring-inset ring-orange-300' : 'hover:bg-stone-50/50'}`}
                      >
                        <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold select-none ${isTodayDate ? 'bg-orange-500 text-white shadow-md' : 'text-stone-600'}`}>{dayInfo.day}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="relative bg-white px-1 py-2">
                  {week.segments.length === 0 ? (
                    <div className="h-6"></div>
                  ) : (
                    <div className="relative grid grid-cols-7 gap-[1px]" style={{ height: `${Math.max(week.laneCount, 1) * 36}px` }}>
                      {week.segments.map((segment) => {
                        const { task } = segment;
                        const isDone = task.status === 'done';
                        const isLate = !!task.due_date && new Date(task.due_date) < new Date() && !isDone;

                        let colorClass = 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200';
                        if (task.parent_id == null) colorClass = 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100';
                        if (task.status === 'in_progress') colorClass = 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100';
                        if (isDone) colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100';
                        if (isLate) colorClass = 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100';

                        return (
                          <div key={`${task.id}-${segment.startCol}-${segment.endCol}-${segment.lane}`} className={`absolute flex items-center gap-2 rounded-xl border px-3 py-1.5 text-left text-xs font-medium shadow-sm transition-all ${colorClass} ${isDone ? 'opacity-70' : ''} ${draggingTaskId === task.id ? 'opacity-40' : ''}`} style={{ left: `calc(${((segment.startCol - 1) / 7) * 100}% + 2px)`, width: `calc(${((segment.endCol - segment.startCol + 1) / 7) * 100}% - 4px)`, top: `${segment.lane * 36}px` }}>
                            <button type="button" draggable onDragStart={() => handleDragStart(task)} onDragEnd={handleDragEnd} onClick={() => openPreview(task)} className="flex min-w-0 flex-1 items-center gap-2 text-left" title={task.title}>
                              {!segment.isStart && <span className="text-xs opacity-70">{'<'}</span>}
                              <span className={`truncate ${isDone ? 'line-through' : ''}`}>{task.title}</span>
                              {!segment.isEnd && <span className="text-xs opacity-70">{'>'}</span>}
                            </button>
                            <button type="button" onClick={(event) => { event.stopPropagation(); openEditor(task); }} className="shrink-0 rounded-lg bg-white/80 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-700 transition hover:bg-white">
                              Modif
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {previewTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-[fadeUp_0.3s_ease-out]">
            <div className="px-6 py-5 border-b border-stone-100 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                    previewTask.parent_id == null
                      ? 'bg-sky-100 text-sky-800'
                      : previewTask.status === 'done'
                        ? 'bg-emerald-100 text-emerald-800'
                        : previewTask.status === 'in_progress'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-stone-100 text-stone-800'
                  }`}>
                    {previewTask.parent_id == null ? 'Fonctionnalite' : 'Tache'}
                  </span>
                  {previewTask.phase && <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">{previewTask.phase}</span>}
                </div>
                <h3 className="font-bold text-xl text-stone-900 leading-tight">{previewTask.title}</h3>
              </div>
              <button onClick={() => setPreviewTask(null)} className="text-stone-400 hover:text-stone-800 transition-colors p-1 bg-stone-50 hover:bg-stone-100 rounded-full">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {previewTask.description ? (
                <p className="text-stone-600 text-sm leading-relaxed">{previewTask.description}</p>
              ) : (
                <p className="text-stone-400 text-sm italic">Aucune description fournie.</p>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-stone-100">
                <PreviewField
                  label="Periode"
                  value={[
                    previewTask.start_date ? `Du ${formatHumanDate(previewTask.start_date)}` : null,
                    previewTask.due_date ? `${previewTask.start_date ? 'Au' : 'Le'} ${formatHumanDate(previewTask.due_date)}` : null,
                  ].filter(Boolean).join(' · ') || 'Aucune date'}
                />
                <PreviewField label="Assigne a" value={previewTask.assignee_name || 'Non assigne'} />
                <PreviewField label="Statut" value={STATUS_OPTIONS.find((option) => option.value === (previewTask.status || 'todo'))?.label || 'A faire'} />
                <PreviewField label="Priorite" value={PRIORITY_OPTIONS.find((option) => option.value === (previewTask.priority || 'normal'))?.label || 'Normale'} />
              </div>
            </div>

            <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-between">
              <button type="button" onClick={() => setPreviewTask(null)} className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-100">
                Fermer
              </button>
              <button type="button" onClick={() => openEditor(previewTask)} className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold rounded-xl transition-all shadow-sm">
                Modifier
              </button>
            </div>
          </div>
        </div>
      )}

      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-[fadeUp_0.3s_ease-out]">
            <div className="px-6 py-5 border-b border-stone-100 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${editingTask.parent_id == null ? 'bg-sky-100 text-sky-800' : 'bg-stone-100 text-stone-800'}`}>
                    {editingTask.parent_id == null ? 'Fonctionnalite' : 'Tache'}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">Edition</span>
                </div>
                <h3 className="font-bold text-xl text-stone-900 leading-tight">{editingTask.title}</h3>
              </div>
              <button onClick={() => setEditingTask(null)} className="text-stone-400 hover:text-stone-800 transition-colors p-1 bg-stone-50 hover:bg-stone-100 rounded-full">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">{editingTask.parent_id == null ? 'Nom de la fonctionnalite' : 'Intitule de la tache'}</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Date de debut</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Date d&apos;echeance</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900" />
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Statut</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-4 py-2 border border-stone-200 rounded-xl bg-white focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900">
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Priorite</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full px-4 py-2 border border-stone-200 rounded-xl bg-white focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900">
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Phase</label>
                  <input type="text" value={phase} onChange={(e) => setPhase(e.target.value)} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Assigne a</label>
                  <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full px-4 py-2 border border-stone-200 rounded-xl bg-white focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900">
                    <option value="">Non assigne</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {editingTask.parent_id != null && features.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Fonctionnalite parente</label>
                  <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="w-full px-4 py-2 border border-stone-200 rounded-xl bg-white focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900">
                    <option value="">Aucune</option>
                    {features.map((feature) => (
                      <option key={feature.id} value={feature.id}>{feature.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                <span>Astuce : tu peux aussi glisser cette plage sur une autre date depuis le calendrier.</span>
                <button type="button" onClick={() => setEditingTask(null)} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100">
                  Annuler
                </button>
              </div>

              <div className="flex justify-end">
                <button type="submit" disabled={saving} className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold rounded-xl transition-all shadow-sm disabled:opacity-70">
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-stone-800">{value}</p>
    </div>
  );
}

function getDaysInMonth(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const days: CalendarDay[] = [];

  for (let i = startOffset; i > 0; i -= 1) {
    const d = new Date(year, month - 1, daysInPrevMonth - i + 1);
    days.push({ day: d.getDate(), currentMonth: false, date: d });
  }

  for (let i = 1; i <= daysInMonth; i += 1) {
    const d = new Date(year, month, i);
    days.push({ day: d.getDate(), currentMonth: true, date: d });
  }

  const totalDays = startOffset + daysInMonth;
  const endOffset = (7 - (totalDays % 7)) % 7;
  const weeksFilled = Math.ceil((totalDays + endOffset) / 7);
  const addedOffset = weeksFilled === 5 ? endOffset + 7 : endOffset;

  for (let i = 1; i <= addedOffset; i += 1) {
    const d = new Date(year, month + 1, i);
    days.push({ day: d.getDate(), currentMonth: false, date: d });
  }

  return days;
}

function normalizeDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return startOfDay(date);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function diffInDays(start: Date, end: Date) {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY_MS);
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function formatDateInput(date: Date) {
  return startOfDay(date).toISOString().slice(0, 10);
}

function formatHumanDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
}
