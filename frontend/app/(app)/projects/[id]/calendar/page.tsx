'use client';

import { useEffect, useMemo, useState, use } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { startOfDay } from 'date-fns';

type CalendarTask = {
  id: number;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  start_date: string;
  due_date: string;
  assigned_to?: number | null;
  assigned_name?: string | null;
  parent_id?: number | null;
  phase?: string | null;
  project_id: number;
  color?: string | null;
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

type DateNote = {
  id: number;
  content: string;
  user_id: number;
  author_name: string;
};

type Milestone = {
  id: number;
  project_id: number;
  title: string;
  date: string;
  color: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function diffInDays(start: Date, end: Date) {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY_MS);
}



function formatDateInput(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatHumanDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function GanttPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = useAuth();
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Editing state
  const [editingTask, setEditingTask] = useState<CalendarTask | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<number | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

  // Day panel (notes)
  const [dayPanelDate, setDayPanelDate] = useState<string | null>(null);
  const [dayNotes, setDayNotes] = useState<DateNote[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editNoteContent, setEditNoteContent] = useState('');
  const [editNoteLoading, setEditNoteLoading] = useState(false);
  const [monthNotes, setMonthNotes] = useState<(DateNote & { date: string })[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('');
  const [milestoneColor, setMilestoneColor] = useState('#a855f7');

  // Task edit form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('todo');
  const [priority, setPriority] = useState('normal');
  const [phase, setPhase] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [parentId, setParentId] = useState('');
  const [color, setColor] = useState('#f97316');
  const { showToast } = useToast();

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    api.get(`/projects/${projectId}/events/date-notes?month=${month}`)
      .then((data) => setMonthNotes(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [projectId, currentDate]);

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
    setColor(editingTask.color || '#f97316');
  }, [editingTask]);

  async function fetchData(nextRefreshing = false) {
    if (nextRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      const [tasksRes, projectRes, notesRes, milestonesRes] = await Promise.all([
        api.get(`/projects/${projectId}/tasks`),
        api.get(`/projects/${projectId}`),
        api.get(`/projects/${projectId}/events/date-notes?month=${month}`),
        api.get(`/projects/${projectId}/milestones`),
      ]);

      setTasks(Array.isArray(tasksRes) ? tasksRes : []);
      setMembers(Array.isArray(projectRes?.members) ? projectRes.members : []);
      setMonthNotes(Array.isArray(notesRes) ? notesRes : []);
      setMilestones(Array.isArray(milestonesRes) ? milestonesRes : []);
    } catch (err) {
      console.error(err);
    } finally {
      if (nextRefreshing) setRefreshing(false);
      else setLoading(false);
    }
  }

  async function openDayPanel(dateKey: string) {
    setDayPanelDate(dateKey);
    setNoteInput('');
    setNoteLoading(true);
    try {
      const notesData = await api.get(`/projects/${projectId}/events/date-notes/${dateKey}`);
      setDayNotes(Array.isArray(notesData) ? notesData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setNoteLoading(false);
    }
  }

  async function submitNote() {
    if (!dayPanelDate || !noteInput.trim()) return;
    setNoteLoading(true);
    try {
      await api.post(`/projects/${projectId}/events/date-notes/${dayPanelDate}`, { content: noteInput });
      const notesData = await api.get(`/projects/${projectId}/events/date-notes/${dayPanelDate}`);
      const notes = Array.isArray(notesData) ? notesData : [];
      setDayNotes(notes);
      setMonthNotes(prev => [...prev.filter(n => n.date !== dayPanelDate), ...notes.map((n: DateNote) => ({ ...n, date: dayPanelDate! }))]);
      setNoteInput('');
      showToast("Note ajoutée", "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setNoteLoading(false);
    }
  }

  async function submitEditNote(noteId: number) {
    if (!editNoteContent.trim()) return;
    setEditNoteLoading(true);
    try {
      await api.patch(`/projects/${projectId}/events/date-notes/${noteId}`, { content: editNoteContent });
      setDayNotes(prev => prev.map(n => n.id === noteId ? { ...n, content: editNoteContent } : n));
      setMonthNotes(prev => prev.map(n => n.id === noteId ? { ...n, content: editNoteContent } : n));
      setEditingNoteId(null);
      showToast("Note modifiée", "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setEditNoteLoading(false);
    }
  }

  async function deleteNote(noteId: number) {
    if (!dayPanelDate) return;
    try {
      await api.delete(`/projects/${projectId}/events/date-notes/${noteId}`);
      setDayNotes((prev) => prev.filter((n) => n.id !== noteId));
      setMonthNotes((prev) => prev.filter((n) => n.id !== noteId));
      showToast("Note supprimée", "info");
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const today = () => setCurrentDate(new Date());

  function getDaysInMonth(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const firstDayIndex = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Start on Monday

    const days: CalendarDay[] = [];
    
    // Previous month filler
    const lastDayPrevMonth = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i -= 1) {
      const d = new Date(year, month - 1, lastDayPrevMonth - i);
      days.push({ day: d.getDate(), currentMonth: false, date: d });
    }

    // Current month
    for (let i = 1; i <= daysInMonth; i += 1) {
      const d = new Date(year, month, i);
      days.push({ day: i, currentMonth: true, date: d });
    }

    // Next month filler
    const totalDays = firstDayIndex + daysInMonth;
    const endOffset = (7 - (totalDays % 7)) % 7;
    const weeksFilled = Math.ceil((totalDays + endOffset) / 7);
    const addedOffset = weeksFilled === 5 ? endOffset + 7 : endOffset;

    for (let i = 1; i <= addedOffset; i += 1) {
      const d = new Date(year, month + 1, i);
      days.push({ day: d.getDate(), currentMonth: false, date: d });
    }

    return days;
  }

  const calendarDays = useMemo(() => getDaysInMonth(currentDate), [currentDate]);

  const features = useMemo(() => tasks.filter(t => !t.parent_id), [tasks]);

  const weeks = useMemo(() => {
    const normalizedTasks = tasks
      .filter(t => {
        const isFeature = !t.parent_id;
        // If sorting by feature, only show the selected feature and its children
        if (selectedFeatureId !== null) {
          return t.id === selectedFeatureId || t.parent_id === selectedFeatureId;
        }
        return true;
      })
      .filter(t => {
        const isFeature = !t.parent_id;
        if (selectedMemberId === null) return true;
        // Features might not be assigned, but we show them if we have subtasks matching
        if (isFeature) return true; 
        return t.assigned_to === selectedMemberId;
      })
      .map((task) => {
        const start = task.start_date ? startOfDay(new Date(task.start_date)) : null;
        const due = task.due_date ? startOfDay(new Date(task.due_date)) : null;
        if (!start || !due) return null;
        
        let rangeStart = start;
        let rangeEnd = due;
        if (rangeStart.getTime() > rangeEnd.getTime()) {
          [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
        }

        return {
          ...task,
          rangeStart,
          rangeEnd,
        };
      })
      .filter((t): t is (NonNullable<typeof t>) => t !== null);

    const result: CalendarWeek[] = [];
    for (let weekIndex = 0; weekIndex < calendarDays.length; weekIndex += 7) {
      const days = calendarDays.slice(weekIndex, weekIndex + 7);
      if (days.length < 7) break;
      
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
          // 1. Features come first
          const isFeatureA = !a.task.parent_id;
          const isFeatureB = !b.task.parent_id;
          if (isFeatureA !== isFeatureB) return isFeatureA ? -1 : 1;

          // 2. Map tasks to their feature title for grouping if possible
          // But here segments are already per week. Let's stick to Feature prominence.
          
          // 3. Sort by assignee name (Group by person)
          const nameA = a.task.assigned_name || '';
          const nameB = b.task.assigned_name || '';
          if (nameA !== nameB) return nameA.localeCompare(nameB);

          if (a.startCol !== b.startCol) return a.startCol - b.startCol;
          return (b.endCol - b.startCol) - (a.endCol - a.startCol);
        });

      const lanesEnd: number[] = [];
      const placedSegments: CalendarSegment[] = segments.map((segment) => {
        let lane = 0;
        while (lanesEnd && lanesEnd[lane] !== undefined && lanesEnd[lane] >= segment.startCol && lane < 50) {
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

      result.push({ days, segments: placedSegments, laneCount: Math.min(lanesEnd.length, 50) });
    }

    return result;
  }, [calendarDays, tasks, selectedFeatureId, selectedMemberId]);

  const isToday = (date: Date) => {
    if (!date) return false;
    const t = new Date();
    return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
  };

  async function handleExport() {
    const token = typeof window === 'undefined' ? null : localStorage.getItem('galineo_token');
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/projects/${projectId}/tasks/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      showToast('Erreur lors de l’export', 'error');
      return;
    }
    showToast('Export CSV réussi', 'success');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasks_${projectId}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csv = event.target?.result;
      if (typeof csv !== 'string') return;
      try {
        await api.post(`/projects/${projectId}/tasks/import`, { csv });
        showToast('Import réussi', 'success');
        fetchData(true);
      } catch (err) {
        showToast((err as Error).message, 'error');
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  }

  async function handleUpdateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTask) return;
    try {
      const payload: any = {
        title: title.trim(),
        description: description || null,
        priority,
        start_date: startDate,
        due_date: dueDate,
        assigned_to: assignedTo ? Number(assignedTo) : null,
        parent_id: parentId ? Number(parentId) : null,
        phase: phase || null,
        color
      };

      // Only subtasks have a manually settable status
      if (editingTask.parent_id) {
        payload.status = status;
      }

      await api.patch(`/projects/${projectId}/tasks/${editingTask.id}`, payload);
      setEditingTask(null);
      showToast("Tâche mise à jour", "success");
      fetchData(true);
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    setDraggingTaskId(taskId);
    e.dataTransfer.setData('taskId', String(taskId));
  };

  const handleDragOver = (e: React.DragEvent, dateKey: string) => {
    e.preventDefault();
    setDragOverDateKey(dateKey);
  };

  const handleDrop = async (e: React.DragEvent, dateKey: string) => {
    e.preventDefault();
    setDragOverDateKey(null);
    const taskId = draggingTaskId || Number(e.dataTransfer.getData('taskId'));
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.start_date || !task.due_date) return;

    const currentStart = startOfDay(new Date(task.start_date));
    const currentDue = startOfDay(new Date(task.due_date));
    const duration = currentDue.getTime() - currentStart.getTime();

    const newStart = startOfDay(new Date(dateKey));
    const newDue = new Date(newStart.getTime() + duration);

    try {
      await api.patch(`/projects/${projectId}/tasks/${taskId}`, {
        ...task,
        start_date: formatDateInput(newStart),
        due_date: formatDateInput(newDue),
      });
      showToast("Tâche replanifiée", "success");
      fetchData(true);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setDraggingTaskId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mb-4"></div>
        <p className="text-stone-500 animate-pulse font-medium">Chargement du GANTT...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto animate-fadeIn overflow-hidden">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-stone-900 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-stone-200 shrink-0">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-black text-stone-900 tracking-tight truncate uppercase">GANTT</h1>
            <p className="text-stone-400 mt-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest leading-none">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
              Timeline visuelle des tâches
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white border border-stone-200 rounded-2xl p-1.5 flex items-center shadow-sm">
            <button onClick={prevMonth} className="p-2 text-stone-500 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all active:scale-90">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button onClick={today} className="px-4 py-1.5 text-xs font-black text-stone-700 hover:text-orange-600 transition-colors uppercase tracking-widest">Aujourd'hui</button>
            <button onClick={nextMonth} className="p-2 text-stone-500 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all active:scale-90">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setEditingMilestone(null); setMilestoneTitle(''); setMilestoneDate(formatDateInput(new Date())); setMilestoneColor('#a855f7'); setShowMilestoneModal(true); }}
              className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-purple-700 transition hover:bg-purple-100 active:scale-95 shadow-sm flex items-center gap-2"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
              Jalon
            </button>
            <label className="cursor-pointer rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-stone-700 transition hover:bg-stone-50 active:scale-95 shadow-sm">
              Import
              <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
            </label>
            <button type="button" onClick={handleExport} className="rounded-2xl bg-stone-900 px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-white transition hover:bg-stone-800 active:scale-95 shadow-lg shadow-stone-900/20">
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <span className="text-xs font-bold text-stone-400 uppercase tracking-widest mr-2 shrink-0">Filtrer par fonctionnalité :</span>
        <button
          onClick={() => setSelectedFeatureId(null)}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 border ${
            selectedFeatureId === null
              ? 'bg-stone-900 border-stone-900 text-white shadow-md'
              : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
          }`}
        >
          Toutes
        </button>
        {features.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelectedFeatureId(f.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 border ${
              selectedFeatureId === f.id
                ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-100'
                : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
            }`}
          >
            {f.title}
          </button>
        ))}
      </div>

      <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <span className="text-xs font-bold text-stone-400 uppercase tracking-widest mr-2 shrink-0">Filtrer par membre :</span>
        <button
          onClick={() => setSelectedMemberId(null)}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 border ${
            selectedMemberId === null
              ? 'bg-stone-900 border-stone-900 text-white shadow-md'
              : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
          }`}
        >
          Tous
        </button>
        {members.map((m: any) => (
          <button
            key={m.id}
            onClick={() => setSelectedMemberId(m.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 border ${
              selectedMemberId === m.id
                ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-100'
                : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
            }`}
          >
             <div className="w-5 h-5 rounded-full bg-stone-100 flex items-center justify-center text-[10px] font-black uppercase text-stone-600 border border-stone-200 shrink-0">
               {m.avatar ? <img src={m.avatar} alt={m.name} className="w-full h-full rounded-full object-cover" /> : m.name.substring(0, 2)}
             </div>
            {m.name}
          </button>
        ))}
      </div>

      <div className="bg-white border border-stone-200 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-sm shadow-stone-200/50 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-100 bg-stone-50/50 px-6 md:px-8 py-4 gap-4">
            <h2 className="text-sm md:text-lg font-black text-stone-900 uppercase tracking-widest">
              {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex items-center gap-3">
              <span className="hidden md:inline text-[10px] text-stone-400 font-bold uppercase tracking-widest">Glissez une tâche pour replanifier</span>
              <button type="button" onClick={() => fetchData(true)} className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-stone-600 transition hover:bg-stone-50 active:scale-95 shadow-sm">
                {refreshing ? '...' : 'Actualiser'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-none">
            <div className="min-w-[800px] lg:min-w-full">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                  <div key={d} className="py-2.5 text-center text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] text-stone-400">{d}</div>
                ))}
              </div>

              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="border-b border-stone-200 last:border-b-0">
                  <div className="grid grid-cols-7 bg-stone-100">
                    {week.days && week.days.map((dayInfo, dayIndex) => {
                      const isTodayDate = isToday(dayInfo.date);
                      const dateKey = formatDateInput(dayInfo.date);
                      const isDragOver = dragOverDateKey === dateKey;

                      const notesForDay = monthNotes.filter(n => n.date === dateKey);

                      return (
                        <div
                          key={dayIndex}
                          onDragOver={(e) => handleDragOver(e, dateKey)}
                          onDrop={(e) => handleDrop(e, dateKey)}
                          onClick={() => openDayPanel(dateKey)}
                          className={`min-h-[100px] md:min-h-[140px] bg-white border-r border-stone-100 last:border-r-0 p-1 md:p-2 transition-all relative cursor-pointer group/day flex flex-col ${!dayInfo.currentMonth ? 'bg-stone-50/30' : 'hover:bg-orange-50/30'} ${isDragOver ? 'bg-orange-50' : ''}`}
                        >
                          <div
                            className={`w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-lg text-[10px] md:text-xs font-black transition-all shrink-0 ${isTodayDate ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'text-stone-400 group-hover/day:text-stone-900 group-hover/day:bg-stone-100'}`}
                          >
                            {dayInfo.day}
                          </div>
                          {milestones.filter(m => m.date === dateKey).map(m => (
                            <div
                              key={m.id}
                              onClick={(e) => { e.stopPropagation(); setEditingMilestone(m); setMilestoneTitle(m.title); setMilestoneDate(m.date); setMilestoneColor(m.color || '#a855f7'); setShowMilestoneModal(true); }}
                              className="mt-1 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-black cursor-pointer hover:opacity-80 transition-opacity"
                              style={{ backgroundColor: `${m.color}20`, color: m.color, border: `1px solid ${m.color}40` }}
                              title={m.title}
                            >
                              <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                              <span className="truncate">{m.title}</span>
                            </div>
                          ))}
                          {notesForDay.length > 0 && (
                            <div className="mt-1 flex flex-col gap-0.5 overflow-hidden">
                              {notesForDay.slice(0, 2).map(note => (
                                <div key={note.id} className="flex items-start gap-1 px-1 py-0.5 bg-amber-50 border border-amber-100 rounded text-[9px] md:text-[10px] text-amber-700 font-semibold leading-tight">
                                  <svg className="shrink-0 mt-px" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                  <span className="truncate">{note.content}</span>
                                </div>
                              ))}
                              {notesForDay.length > 2 && (
                                <div className="text-[9px] font-black text-stone-400 px-1">+{notesForDay.length - 2}</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Tasks layers */}
                  {week.segments.length > 0 && (
                    <div className="relative bg-stone-50/30 py-2 border-t border-stone-100" style={{ height: `${week.laneCount * 32 + 16}px` }}>
                      {week.segments.map((segment) => {
                        const { task } = segment;
                        const isDone = task.status === 'done';
                        const isDragging = draggingTaskId === task.id;
                        const isFeature = !task.parent_id;

                        return (
                          <div
                            key={`${task.id}-${segment.startCol}-${segment.endCol}-${segment.lane}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onClick={() => setEditingTask(task)}
                            className={`absolute flex items-center px-3 h-7 rounded-lg text-[11px] font-bold text-white shadow-sm cursor-grab active:cursor-grabbing transition-all hover:brightness-110 group ${isDone ? 'opacity-40 grayscale-[0.5]' : ''} ${isDragging ? 'opacity-20 scale-95' : ''}`}
                            style={{
                              left: `${((segment.startCol - 1) * 100) / 7}%`,
                              width: `${((segment.endCol - segment.startCol + 1) * 100) / 7}%`,
                              top: `${segment.lane * 32 + 8}px`,
                              marginLeft: segment.isStart ? '4px' : '0',
                              marginRight: segment.isEnd ? '4px' : '0',
                              borderTopLeftRadius: segment.isStart ? '8px' : '0',
                              borderBottomLeftRadius: segment.isStart ? '8px' : '0',
                              borderTopRightRadius: segment.isEnd ? '8px' : '0',
                              borderBottomRightRadius: segment.isEnd ? '8px' : '0',
                              backgroundColor: task.color || '#f97316'
                            }}
                          >
                            <span className="truncate">
                              {task.title}
                            </span>
                            <button type="button" onClick={(e) => { e.stopPropagation(); setEditingTask(task); }} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 hover:bg-white/40 p-0.5 rounded">
                              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      {/* Milestone Modal */}
      {showMilestoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowMilestoneModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-stone-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-black text-stone-900 uppercase tracking-tight mb-5">
              {editingMilestone ? 'Modifier le jalon' : 'Nouveau jalon'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1.5 uppercase tracking-wider">Titre</label>
                <input
                  type="text"
                  value={milestoneTitle}
                  onChange={e => setMilestoneTitle(e.target.value)}
                  placeholder="Ex: Livraison v1.0"
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1.5 uppercase tracking-wider">Date</label>
                <input
                  type="date"
                  value={milestoneDate}
                  onChange={e => setMilestoneDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1.5 uppercase tracking-wider">Couleur</label>
                <div className="flex items-center gap-2">
                  {['#a855f7', '#f97316', '#ef4444', '#3b82f6', '#10b981', '#64748b'].map(c => (
                    <button key={c} type="button" onClick={() => setMilestoneColor(c)}
                      className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: c, borderColor: milestoneColor === c ? '#1c1917' : 'transparent' }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              {editingMilestone && (
                <button
                  type="button"
                  onClick={async () => {
                    await api.delete(`/projects/${projectId}/milestones/${editingMilestone.id}`);
                    setMilestones(ms => ms.filter(m => m.id !== editingMilestone.id));
                    setShowMilestoneModal(false);
                    showToast('Jalon supprimé', 'success');
                  }}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 border border-red-200 transition-colors"
                >Supprimer</button>
              )}
              <button type="button" onClick={() => setShowMilestoneModal(false)}
                className="ml-auto px-4 py-2.5 rounded-xl text-sm font-bold text-stone-500 hover:bg-stone-50 border border-stone-200 transition-colors">
                Annuler
              </button>
              <button
                type="button"
                disabled={!milestoneTitle.trim() || !milestoneDate}
                onClick={async () => {
                  if (editingMilestone) {
                    const updated = await api.patch(`/projects/${projectId}/milestones/${editingMilestone.id}`, { title: milestoneTitle, date: milestoneDate, color: milestoneColor });
                    setMilestones(ms => ms.map(m => m.id === editingMilestone.id ? updated : m));
                    showToast('Jalon mis à jour', 'success');
                  } else {
                    const created = await api.post(`/projects/${projectId}/milestones`, { title: milestoneTitle, date: milestoneDate, color: milestoneColor });
                    setMilestones(ms => [...ms, created]);
                    showToast('Jalon créé', 'success');
                  }
                  setShowMilestoneModal(false);
                }}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: milestoneColor }}
              >
                {editingMilestone ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Edit Modal */}
      {editingTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-fadeUp">
            <header className="px-8 py-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-1 block">Modification</span>
                <h3 className="font-bold text-xl text-stone-900">Editer la tâche</h3>
              </div>
              <button onClick={() => setEditingTask(null)} className="text-stone-400 hover:text-stone-900 transition-colors p-2 hover:bg-stone-100 rounded-full">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </header>

            <form onSubmit={handleUpdateTask} className="p-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Titre</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Statut</label>
                  <select 
                    value={status} 
                    onChange={(e) => setStatus(e.target.value)} 
                    disabled={!editingTask.parent_id}
                    className={`w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 appearance-none ${!editingTask.parent_id ? 'opacity-50 cursor-not-allowed bg-stone-100' : ''}`}
                  >
                    <option value="todo">À faire</option>
                    <option value="in_progress">En cours</option>
                    <option value="done">Terminé</option>
                    <option value="pending">En attente de tâches</option>
                  </select>
                  {!editingTask.parent_id && (
                    <p className="text-[9px] font-bold text-stone-400 uppercase mt-1.5 tracking-tighter">Automatique</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Priorité</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 appearance-none">
                    <option value="low">Basse</option>
                    <option value="normal">Normale</option>
                    <option value="high">Haute</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
                <div className="col-span-2 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Date de début</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-stone-900 transition-all font-medium" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Date d'échéance</label>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-stone-900 transition-all font-medium" />
                  </div>
                </div>
                <div className="col-span-2">
                   <label className="block text-sm font-medium text-stone-700 mb-1.5">Couleur de la barre</label>
                   <div className="flex items-center gap-4">
                      <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                        className="w-20 h-10 p-1 bg-white border border-stone-200 rounded-xl cursor-pointer" />
                      <div className="flex flex-wrap gap-2">
                         {['#f97316', '#ef4444', '#3b82f6', '#10b981', '#a855f7', '#64748b'].map(c => (
                           <button key={c} type="button" onClick={() => setColor(c)}
                             className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-stone-900 shadow-md' : 'border-transparent'}`}
                             style={{ backgroundColor: c }} />
                         ))}
                      </div>
                   </div>
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setEditingTask(null)} className="px-6 py-3 rounded-xl text-sm font-bold text-stone-500 hover:bg-stone-50 transition-colors">Annuler</button>
                <button type="submit" className="px-8 py-3 rounded-xl bg-stone-900 text-white text-sm font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-200">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Day Panel Modal */}
      {dayPanelDate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-fadeUp">
            <header className="px-6 py-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 shrink-0">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-1 block">Agenda</span>
                <h3 className="font-bold text-xl text-stone-900">{formatHumanDate(dayPanelDate)}</h3>
              </div>
              <button onClick={() => setDayPanelDate(null)} className="text-stone-400 hover:text-stone-900 transition-colors p-2 hover:bg-stone-100 rounded-full">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </header>

            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {/* Notes section */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-amber-500"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <h4 className="text-xs font-black uppercase tracking-widest text-stone-500">Notes</h4>
                  <span className="ml-auto px-2 py-0.5 bg-amber-100 text-amber-600 rounded text-[10px] font-bold">{dayNotes.length}</span>
                </div>

                {noteLoading ? (
                  <div className="space-y-2">
                    <div className="h-16 bg-stone-50 rounded-2xl animate-pulse" />
                  </div>
                ) : dayNotes.length === 0 ? (
                  <p className="text-xs text-stone-400 italic px-1">Aucune note pour ce jour.</p>
                ) : (
                  <div className="space-y-2">
                    {dayNotes.map((note) => (
                      <div key={note.id} className="group rounded-2xl border border-amber-100 bg-amber-50/50 transition-all hover:bg-amber-50">
                        {editingNoteId === note.id ? (
                          <div className="p-4 space-y-2">
                            <textarea value={editNoteContent} onChange={e => setEditNoteContent(e.target.value)}
                              rows={3} autoFocus
                              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400/30 resize-none" />
                            <div className="flex gap-2">
                              <button onClick={() => setEditingNoteId(null)} className="flex-1 py-1.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-500 hover:bg-stone-50 transition-all">Annuler</button>
                              <button onClick={() => submitEditNote(note.id)} disabled={editNoteLoading}
                                className="flex-1 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-xs font-black text-white transition-all disabled:opacity-40">
                                {editNoteLoading ? '...' : 'Enregistrer'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 flex items-start gap-3">
                            <p className="text-sm text-stone-800 leading-relaxed break-words whitespace-pre-wrap min-w-0 flex-1">{note.content}</p>
                            {user && note.user_id === user.id && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => { setEditingNoteId(note.id); setEditNoteContent(note.content); }}
                                  className="p-1.5 text-stone-300 hover:text-amber-500 rounded-lg hover:bg-amber-50 transition-all">
                                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button onClick={() => deleteNote(note.id)}
                                  className="p-1.5 text-stone-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all">
                                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        {editingNoteId !== note.id && (
                          <p className="text-[10px] font-bold text-stone-400 px-4 pb-3 flex items-center gap-1.5 uppercase tracking-wider">
                            <span className="w-1 h-1 rounded-full bg-stone-300"></span>
                            {note.author_name}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="relative mt-3">
                  <textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Écrire une note..."
                    className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-4 pr-14 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    rows={2}
                  />
                  <button
                    type="button"
                    onClick={submitNote}
                    disabled={!noteInput.trim() || noteLoading}
                    className="absolute right-3 bottom-3 p-2 bg-stone-900 text-white rounded-xl hover:bg-stone-800 disabled:opacity-30 transition-all"
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
