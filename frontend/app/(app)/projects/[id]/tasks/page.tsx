'use client';
import { useState, useEffect, use } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const KANBAN_COLUMNS = [
  { key: 'todo', label: 'À faire', accent: 'bg-stone-700', soft: 'bg-stone-100 text-stone-700' },
  { key: 'in_progress', label: 'En cours', accent: 'bg-amber-500', soft: 'bg-amber-100 text-amber-800' },
  { key: 'done', label: 'Terminée', accent: 'bg-emerald-500', soft: 'bg-emerald-100 text-emerald-800' },
  { key: 'pending', label: 'En attente de tâches', accent: 'bg-stone-400', soft: 'bg-stone-50 text-stone-400' },
] as const;

type ViewMode = 'list' | 'kanban';

export default function TasksPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const { user } = useAuth();

  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [isFeatureModal, setIsFeatureModal] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  
  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal'); // 'urgent_important', 'urgent_not_important', 'not_urgent_important', 'not_urgent_not_important' ou 'normal'
  const [phase, setPhase] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [parentId, setParentId] = useState('');
  const [status, setStatus] = useState('todo'); // todo, in_progress, done
  const [color, setColor] = useState('#f97316');
  
  const [searchUser, setSearchUser] = useState('');
  const [showUserList, setShowUserList] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedFeatureId, setSelectedFeatureId] = useState<number | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [expandedFeatures, setExpandedFeatures] = useState<Set<number>>(new Set());
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [taskComments, setTaskComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  async function fetchData() {
    try {
      const tasksRes = await api.get(`/projects/${projectId}/tasks`).catch(e => { console.error('Tasks fetch error:', e); return []; });
      const projectRes = await api.get(`/projects/${projectId}`).catch(e => { console.error('Project fetch error:', e); return null; });
      
      setTasks(tasksRes || []);
      setMembers(Array.isArray(projectRes?.members) ? projectRes.members : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateFeature() {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setPriority('normal');
    setPhase('');
    setStartDate('');
    setDueDate('');
    setAssignedTo('');
    setParentId('');
    setStatus('todo');
    setColor('#f97316');
    setIsFeatureModal(true);
    setShowModal(true);
  }

  function openCreateTask(parentTaskId = '') {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setPriority('normal');
    setPhase('');
    setStartDate('');
    setDueDate('');
    setAssignedTo('');
    setParentId(parentTaskId.toString());
    setStatus('todo');
    setColor('#f97316');
    setIsFeatureModal(false);
    setShowModal(true);
  }

  function openEditModal(task: any) {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority || 'normal');
    setPhase(task.phase || '');
    setStartDate(task.start_date ? task.start_date.substring(0, 10) : '');
    setDueDate(task.due_date ? task.due_date.substring(0, 10) : '');
    setAssignedTo(task.assigned_to ? task.assigned_to.toString() : '');
    setParentId(task.parent_id ? task.parent_id.toString() : '');
    setStatus(task.status || 'todo');
    setColor(task.color || '#f97316');
    setIsFeatureModal(!task.parent_id);
    setShowModal(true);
  }

  async function openHistoryModal(task: any) {
    setSelectedTask(task);
    setShowHistoryModal(true);
    setNewComment('');
    setCommentsLoading(true);

    try {
      const comments = await api.get(`/projects/${projectId}/tasks/${task.id}/comments`);
      setTaskComments(Array.isArray(comments) ? comments : []);
    } catch (err) {
      console.error(err);
      setTaskComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }

  function closeHistoryModal() {
    setShowHistoryModal(false);
    setSelectedTask(null);
    setTaskComments([]);
    setNewComment('');
    setCommentsLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
        title,
        description,
        priority,
        phase,
        start_date: startDate || null,
        due_date: dueDate || null,
        assigned_to: assignedTo ? parseInt(assignedTo) : null,
        parent_id: parentId ? parseInt(parentId) : null,
        color
      };

      // Only subtasks have a manually settable status
      if (parentId) {
        payload.status = status;
      }

      if (editingTask) {
        await api.patch(`/projects/${projectId}/tasks/${editingTask.id}`, payload);
      } else {
        await api.post(`/projects/${projectId}/tasks`, payload);
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Supprimer cette tâche ? (Les sous-tâches seront supprimées)')) return;
    try {
      await api.delete(`/projects/${projectId}/tasks/${id}`);
      fetchData();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTask || !newComment.trim()) return;

    setCommentSaving(true);
    try {
      const createdComment = await api.post(`/projects/${projectId}/tasks/${selectedTask.id}/comments`, {
        content: newComment,
      });
      setTaskComments((current) => [createdComment, ...current]);
      setNewComment('');
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCommentSaving(false);
    }
  }

  const filteredMembers = members.filter(m => 
    searchUser.trim() === '' || 
    m.name.toLowerCase().includes(searchUser.toLowerCase()) || 
    m.email.toLowerCase().includes(searchUser.toLowerCase())
  );

  const getAssignedUserName = (assignedId: string) => {
    if (!assignedId) return '';
    const m = members.find(x => x.id.toString() === assignedId.toString());
    return m ? m.name : '';
  };

  async function handleClearProject() {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer TOUTES les tâches et fonctionnalités de ce projet ? Cette action est irréversible.')) {
      return;
    }
    
    try {
      await api.delete(`/projects/${projectId}/tasks/clear`);
      fetchData();
    } catch (err) {
      alert("Erreur lors de la suppression");
      console.error(err);
    }
  }
  

  async function toggleStatus(task: any) {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      await api.patch(`/projects/${projectId}/tasks/${task.id}`, { status: newStatus });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  async function moveTaskToStatus(taskId: number, newStatus: string) {
    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask || currentTask.status === newStatus) return;

    const previousTasks = tasks;
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, status: newStatus } : task
      )
    );

    try {
      await api.patch(`/projects/${projectId}/tasks/${taskId}`, { status: newStatus });
    } catch (err) {
      setTasks(previousTasks);
      console.error(err);
    }
  }

  function startDragTask(event: React.DragEvent, taskId: number) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(taskId));
    setDraggedTaskId(taskId);
  }

  const renderPriority = (p: string) => {
    switch(p) {
      case 'urgent_important': return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md text-xs font-semibold">Urgent & Important</span>;
      case 'urgent_not_important': return <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-md text-xs font-semibold">Urgent</span>;
      case 'not_urgent_important': return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-xs font-semibold">Important</span>;
      default: return null;
    }
  };

  const renderStatusBadge = (currentStatus: string) => {
    const column = KANBAN_COLUMNS.find((item) => item.key === currentStatus) || KANBAN_COLUMNS[0];
    return (
      <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-current transition-all ${column.soft}`}>
        {column.label}
      </span>
    );
  };

  const formatCommentDate = (date: string) =>
    new Date(date).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  const features = tasks.filter(t => !t.parent_id);
  const getTasksForFeature = (featureId: number) => tasks.filter(t => t.parent_id === featureId);
  
  const toggleFeature = (featureId: number) => {
    setExpandedFeatures(prev => {
      const next = new Set(prev);
      if (next.has(featureId)) next.delete(featureId);
      else next.add(featureId);
      return next;
    });
  };

  const kanbanTasks = tasks.filter(t => 
    t.parent_id && 
    t.status !== 'pending' && 
    (selectedFeatureId === null || t.parent_id === selectedFeatureId) &&
    (selectedMemberId === null || t.assigned_to === selectedMemberId)
  );
  
  const tasksByStatus = KANBAN_COLUMNS
    .filter(column => column.key !== 'pending')
    .map((column) => ({
      ...column,
      tasks: kanbanTasks
        .filter((task) => (task.status || 'todo') === column.key)
        .sort((a, b) => (a.assignee_name || '').localeCompare(b.assignee_name || '')),
    }));

  const TaskRow = ({ task, isFeature = false, isExpanded = false }: { task: any, isFeature?: boolean, isExpanded?: boolean }) => {
    const isDone = task.status === 'done';
    
    return (
      <div className={`flex items-start gap-3 px-4 py-3 border-b border-stone-100 hover:bg-stone-50 transition-colors group ${isDone ? 'opacity-60' : ''} ${isFeature ? 'bg-stone-50/50' : 'pl-10 sm:pl-12'}`}>
        {isFeature && (
          <button 
            onClick={() => toggleFeature(task.id)}
            className="mt-1 flex items-center justify-center w-5 h-5 text-stone-400 hover:text-stone-900 transition-transform duration-200"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); toggleStatus(task); }} className={`mt-0.5 w-5 h-5 rounded-full border flex flex-shrink-0 items-center justify-center transition-colors ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-300 hover:border-orange-400'}`}>
          {isDone && <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>}
        </button>
        
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`${isFeature ? 'text-base font-bold text-stone-900' : 'text-sm font-medium'} max-w-[200px] sm:max-w-xs md:max-w-md truncate ${isDone ? 'line-through text-stone-500' : 'text-stone-900'}`}>{task.title}</span>
            {!isFeature && renderStatusBadge(task.status || 'todo')}
            {task.description && <span className="hidden sm:inline-block px-2 py-0.5 bg-stone-100 text-stone-500 rounded-md text-[10px] font-semibold uppercase tracking-wider">Descr.</span>}
            {renderPriority(task.priority)}
            {task.phase && <span className="px-2 py-0.5 bg-stone-100 text-stone-600 rounded-md text-[10px] font-bold uppercase tracking-wider">{task.phase}</span>}
          </div>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs shrink-0 mt-1 sm:mt-0">
            {task.due_date && (
              <span className={`flex items-center gap-1 ${new Date(task.due_date) < new Date() && !isDone ? 'text-red-500 font-semibold' : 'text-stone-400'}`}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {new Date(task.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
              </span>
            )}
            {task.assignee_name && (
              <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded-full border border-stone-200">{task.assignee_name}</span>
            )}
            
            <div className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 flex items-center gap-1 transition-opacity">
              {isFeature && (
                <button onClick={(e) => { e.stopPropagation(); openCreateTask(task.id); }} className="px-2 py-1 text-xs font-semibold text-orange-600 hover:bg-orange-100 bg-orange-50 rounded-lg transition-colors" title="Ajouter une tâche à cette fonctionnalité">
                  + Tâche
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); openHistoryModal(task); }} className="px-2 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-200 bg-stone-100 rounded-lg transition-colors" title="Historique d'avancement">
                Historique
              </button>
              <button onClick={(e) => { e.stopPropagation(); openEditModal(task); }} className="p-1.5 text-stone-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors" title="Modifier">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }} className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Supprimer">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const KanbanCard = ({ task }: { task: any }) => {
    const parentFeature = features.find((feature) => feature.id === task.parent_id);
    const isDone = task.status === 'done';

    return (
      <div
        draggable
        onDragStart={(event) => startDragTask(event, task.id)}
        onDragEnd={() => {
          setDraggedTaskId(null);
          setDragOverColumn(null);
        }}
        className={`relative rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-colors hover:border-orange-300 cursor-grab active:cursor-grabbing ${isDone ? 'opacity-75' : ''} ${draggedTaskId === task.id ? 'opacity-50 ring-2 ring-orange-400' : ''}`}
      >
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              {task.description && <span className="px-2 py-0.5 bg-stone-100 text-stone-500 rounded-md text-[10px] font-semibold uppercase tracking-wider">Description</span>}
            </div>
            <p className={`text-sm font-semibold leading-5 ${isDone ? 'line-through text-stone-400' : 'text-stone-900'}`}>{task.title}</p>
            {task.description && (
              <p className="mt-2 text-xs leading-5 text-stone-500 line-clamp-3">{task.description}</p>
            )}
          </div>

          <button onClick={(e) => { e.stopPropagation(); toggleStatus(task); }} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${isDone ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-stone-300 text-transparent hover:border-orange-400'}`} title={isDone ? 'Marquer a faire' : 'Marquer termine'}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {parentFeature && (
            <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-orange-700">
              {parentFeature.title}
            </span>
          )}
          {renderPriority(task.priority)}
          {task.phase && <span className="px-2 py-0.5 bg-stone-100 text-stone-600 rounded-md text-[10px] font-bold uppercase tracking-wider">{task.phase}</span>}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-stone-500">
          <div className="flex flex-wrap items-center gap-2">
            {task.due_date && (
              <span className={new Date(task.due_date) < new Date() && !isDone ? 'font-semibold text-red-500' : ''}>
                {new Date(task.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
              </span>
            )}
            {task.assignee_name && (
              <span className="rounded-full bg-stone-100 px-2 py-1 text-stone-600">{task.assignee_name}</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => openHistoryModal(task)} className="rounded-lg px-2 py-1 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-200 bg-stone-100" title="Historique d'avancement">
              Historique
            </button>
            <button onClick={() => openEditModal(task)} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-blue-50 hover:text-blue-500" title="Modifier">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button onClick={() => handleDelete(task.id)} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500" title="Supprimer">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* HEADER & INFO BULLE */}
      <div className="relative z-20 flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 flex items-center gap-2 sm:gap-3">
            Fonctionnalités & Tâches
            <div className="group relative z-30">
              <div className="w-5 h-5 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center text-xs font-bold cursor-help hover:bg-orange-100 hover:text-orange-600 transition-colors">?</div>
              <div className="absolute left-0 sm:left-1/2 sm:-translate-x-1/2 top-full mt-2 w-64 sm:w-72 bg-stone-800 text-white text-xs p-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[80]">
                Créez d'abord vos "Fonctionnalités" (ex: Page d'Accueil), puis insérez vos "Tâches" à l'intérieur (ex: Maquetter le Header).
                <div className="absolute left-6 sm:left-1/2 sm:-translate-x-1/2 bottom-full border-4 border-transparent border-b-stone-800"></div>
              </div>
            </div>
          </h2>
          <p className="text-stone-400 text-xs sm:text-sm mt-1">Séparez votre projet en grands blocs (Fonctionnalités) puis découpez-les (Tâches)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
           <div className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white p-1 shadow-sm shrink-0">
              <button onClick={() => setViewMode('list')} className={`rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition-colors ${viewMode === 'list' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
                Liste
              </button>
              <button onClick={() => setViewMode('kanban')} className={`rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition-colors ${viewMode === 'kanban' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
                Kanban
              </button>
           </div>
           <button onClick={() => openCreateTask()} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-sm flex items-center gap-1.5">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Tâche
           </button>
           <button onClick={() => openCreateFeature()} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-sm flex items-center gap-1.5 line-clamp-1 overflow-hidden max-w-[120px] sm:max-w-none">
               <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
               <span className="hidden xs:inline">Fonctionnalité</span><span className="xs:hidden">Fonc.</span>
            </button>
            <button onClick={handleClearProject} className="px-3 py-1.5 sm:py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-sm flex items-center gap-1.5" title="Vider le projet">
               <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
               Vider
            </button>
        </div>
      </div>

      {/* FILTER BAR FOR KANBAN */}
      {viewMode === 'kanban' && (
        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-xs font-bold text-stone-400 uppercase tracking-widest mr-2 shrink-0">Filtrer :</span>
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
          {features.map((f: any) => (
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
      )}

      {viewMode === 'kanban' && (
        <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-xs font-bold text-stone-400 uppercase tracking-widest mr-2 shrink-0">Par membre :</span>
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
      )}

      {loading ? (
         <div className="animate-pulse bg-white border border-stone-200 rounded-2xl h-64"></div>
      ) : tasks.length === 0 ? (
        <div className="bg-white border text-center border-stone-200 rounded-2xl py-16">
          <p className="text-stone-400 mb-4">Votre projet est vide.</p>
          <button onClick={() => openCreateFeature()} className="text-orange-500 text-sm font-semibold hover:underline">Créer la première fonctionnalité</button>
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="grid gap-5 lg:grid-cols-3">
          {tasksByStatus.map((column) => (
            <section
              key={column.key}
              onDragOver={(event) => {
                event.preventDefault();
                if (dragOverColumn !== column.key) setDragOverColumn(column.key);
              }}
              onDragLeave={(event) => {
                const nextTarget = event.relatedTarget as Node | null;
                if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                  setDragOverColumn((current) => (current === column.key ? null : current));
                }
              }}
              onDrop={async (event) => {
                event.preventDefault();
                const droppedTaskId = Number(event.dataTransfer.getData('text/plain'));
                setDragOverColumn(null);
                setDraggedTaskId(null);
                if (!Number.isNaN(droppedTaskId)) {
                  await moveTaskToStatus(droppedTaskId, column.key);
                }
              }}
              className={`overflow-hidden rounded-3xl border border-stone-200 bg-stone-50/80 shadow-sm transition-all ${dragOverColumn === column.key ? 'border-orange-300 ring-2 ring-orange-200' : ''}`}
            >
              <div className="border-b border-stone-200 bg-white/90 px-5 py-4 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`h-3 w-3 rounded-full ${column.accent}`}></span>
                    <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-stone-700">{column.label}</h3>
                  </div>
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">{column.tasks.length}</span>
                </div>
              </div>

              <div className="space-y-3 p-4">
                {column.tasks.length === 0 ? (
                  <div className={`rounded-2xl border border-dashed bg-white/70 px-4 py-8 text-center text-sm transition-colors ${dragOverColumn === column.key ? 'border-orange-300 text-orange-500' : 'border-stone-300 text-stone-400'}`}>
                    {dragOverColumn === column.key ? 'Deposez la tache ici.' : 'Aucune tache dans cette colonne.'}
                  </div>
                ) : (
                  column.tasks.map((task) => <KanbanCard key={task.id} task={task} />)
                )}
              </div>
            </section>
          ))}
        </div>
       ) : (
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
           {features.map(feature => {
             const isExpanded = expandedFeatures.has(feature.id);
             return (
               <div key={feature.id} className="border-b border-stone-200 last:border-0">
                  <TaskRow task={feature} isFeature={true} isExpanded={isExpanded} />
                  {isExpanded && (
                    <div className="divide-y divide-stone-100 animate-[fadeDown_0.2s_ease-out]">
                      {getTasksForFeature(feature.id).map(task => (
                        <TaskRow key={task.id} task={task} />
                      ))}
                      {getTasksForFeature(feature.id).length === 0 && (
                        <div className="pl-16 py-3 text-xs text-stone-400 italic">Aucune tâche dans cette fonctionnalité</div>
                      )}
                    </div>
                  )}
               </div>
             );
           })}
        </div>
      )}

      {/* MODAL */}
       {showModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-visible animate-[fadeUp_0.3s_ease-out]">
               <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
                   <h3 className="font-semibold text-lg text-stone-900">{editingTask ? (isFeatureModal ? 'Modifier la fonctionnalité' : 'Modifier la tâche') : (isFeatureModal ? 'Nouvelle Fonctionnalité' : 'Nouvelle Tâche')}</h3>
                  <button onClick={() => setShowModal(false)} className="text-stone-400 hover:text-stone-600 p-1">
                     <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
               </div>
               
               <form onSubmit={handleSave} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      {isFeatureModal ? 'Nom de la fonctionnalité' : 'Intitulé de la tâche'}
                    </label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} required autoFocus
                      className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900" 
                      placeholder={isFeatureModal ? "Ex: Espace Utilisateur" : "Ex: Maquetter la page d'accueil"} />
                  </div>
                  
                  {!isFeatureModal && (
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Couleur de la tâche (GANTT)</label>
                      <div className="flex items-center gap-3">
                         <input type="color" value={color} onChange={e => setColor(e.target.value)}
                           className="h-10 w-20 p-1 bg-white border border-stone-200 rounded-xl cursor-pointer" />
                         <div className="flex-1 flex gap-2">
                            {['#f97316', '#ef4444', '#3b82f6', '#10b981', '#a855f7', '#64748b'].map(c => (
                              <button key={c} type="button" onClick={() => setColor(c)}
                                className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-stone-900 shadow-sm' : 'border-transparent'}`}
                                style={{ backgroundColor: c }} />
                            ))}
                         </div>
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900 resize-none"
                      placeholder="Ajoutez le contexte, les objectifs, les détails utiles ou les critères de validation..." />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Date de début</label>
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                        className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Date d'échéance</label>
                      <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                        className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Phase</label>
                      <input type="text" value={phase} onChange={e => setPhase(e.target.value)}
                        className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900" 
                        placeholder="Ex: Design..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Priorité</label>
                      <select value={priority} onChange={e => setPriority(e.target.value)}
                        className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900 bg-white">
                        <option value="normal">Normale</option>
                        <option value="urgent_important">Urg. & Imp.</option>
                        <option value="not_urgent_important">Important</option>
                        <option value="urgent_not_important">Urgent</option>
                      </select>
                    </div>
                    <div className="relative">
                      <label className="block text-sm font-medium text-stone-700 mb-1">Assigner à</label>
                      <div className="relative">
                        {assignedTo ? (
                           <div className="flex items-center justify-between w-full px-4 py-2 border border-orange-200 bg-orange-50 rounded-xl">
                              <span className="text-sm font-semibold text-orange-700 truncate">{getAssignedUserName(assignedTo)}</span>
                              <button type="button" onClick={() => { setAssignedTo(''); setSearchUser(''); }} className="text-orange-400 hover:text-orange-600 shrink-0 ml-1">
                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                           </div>
                        ) : (
                           <div>
                              <div className="relative">
                                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                                </svg>
                                <input type="text" value={searchUser} onChange={(e) => setSearchUser(e.target.value)} onFocus={() => setShowUserList(true)} onBlur={() => setTimeout(() => setShowUserList(false), 200)}
                                  className="w-full pl-10 pr-2 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-sm transition-all"
                                  placeholder="Chercher..." />
                              </div>
                              {showUserList && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                                   {filteredMembers.length === 0 ? (
                                     <div className="p-3 text-sm text-stone-400 text-center">Aucun membre</div>
                                   ) : (
                                     filteredMembers.map(u => (
                                       <button key={u.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setAssignedTo(u.id.toString()); setShowUserList(false); setSearchUser(''); }}
                                         className="w-full text-left px-4 py-2 text-sm hover:bg-orange-50 text-stone-700 hover:text-orange-700 font-medium flex items-center gap-2">
                                         <div className="w-6 h-6 rounded-full bg-stone-100 flex justify-center items-center text-xs font-bold shrink-0">{u.name.substring(0,2).toUpperCase()}</div>
                                         <div className="flex flex-col truncate">
                                            <span>{u.name}</span>
                                            <span className="text-[10px] text-stone-400">{u.role_name}</span>
                                         </div>
                                       </button>
                                     ))
                                   )}
                                </div>
                              )}
                           </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Statut</label>
                      <select 
                        value={status} 
                        onChange={e => setStatus(e.target.value)}
                        disabled={!parentId}
                        className={`w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900 bg-white ${!parentId ? 'opacity-50 cursor-not-allowed bg-stone-50' : ''}`}
                      >
                        {KANBAN_COLUMNS.map((column) => (
                           // For subtasks, don't show "pending" as an option
                           column.key === 'pending' && parentId ? null : (
                             <option key={column.key} value={column.key}>{column.label}</option>
                           )
                        ))}
                      </select>
                      {!parentId && (
                        <p className="text-[9px] font-bold text-stone-400 uppercase mt-1.5 tracking-tighter">Le statut est calculé automatiquement</p>
                      )}
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Visualisation</p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-sm text-stone-600">Colonne Kanban</span>
                        {renderStatusBadge(status)}
                      </div>
                    </div>
                  </div>

                  {!isFeatureModal && features.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Associer à la fonctionnalité</label>
                      <select value={parentId} onChange={e => setParentId(e.target.value)} required
                        className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900 bg-white">
                        <option value="" disabled>Sélectionner une fonctionnalité</option>
                        {features.map(f => (
                           <option key={f.id} value={f.id}>{f.title}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end gap-3">
                    <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-xl text-sm font-medium">Annuler</button>
                    <button type="submit" disabled={saving} className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-medium flex items-center gap-2">
                       {saving && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                       {editingTask ? 'Enregistrer' : 'Créer'}
                    </button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {showHistoryModal && selectedTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-[fadeUp_0.3s_ease-out]">
            <div className="px-6 py-4 border-b border-stone-100 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Historique d'avancement</p>
                <h3 className="mt-1 text-lg font-semibold text-stone-900">{selectedTask.title}</h3>
                {selectedTask.description && <p className="mt-2 text-sm text-stone-500">{selectedTask.description}</p>}
              </div>
              <button onClick={closeHistoryModal} className="text-stone-400 hover:text-stone-600 p-1">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="grid gap-0 md:grid-cols-[1.3fr_0.9fr]">
              <div className="border-r border-stone-100 p-6">
                <form onSubmit={handleCommentSubmit} className="space-y-3">
                  <label className="block text-sm font-medium text-stone-700">Ajouter un commentaire d'avancement</label>
                  <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={4}
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900 resize-none"
                    placeholder="Ex: API terminée, reste les tests et la validation UX." />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-stone-400">Visible dans l'historique de la tâche.</span>
                    <button type="submit" disabled={commentSaving || !newComment.trim()} className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white rounded-xl text-sm font-medium">
                      {commentSaving ? 'Publication...' : 'Publier'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="max-h-[32rem] overflow-y-auto bg-stone-50/60 p-6">
                <p className="mb-4 text-sm font-semibold text-stone-700">Commentaires</p>
                {commentsLoading ? (
                  <div className="space-y-3">
                    <div className="h-20 rounded-2xl bg-white border border-stone-200 animate-pulse"></div>
                    <div className="h-20 rounded-2xl bg-white border border-stone-200 animate-pulse"></div>
                  </div>
                ) : taskComments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-400">
                    Aucun commentaire pour le moment.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {taskComments.map((comment) => (
                      <article key={comment.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-stone-100 text-stone-700 flex items-center justify-center text-xs font-bold shrink-0">
                              {(comment.author_name || user?.name || '?').substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-stone-900 truncate">{comment.author_name || 'Membre'}</p>
                              <p className="text-xs text-stone-400">{formatCommentDate(comment.created_at)}</p>
                            </div>
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-stone-600 whitespace-pre-wrap">{comment.content}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
