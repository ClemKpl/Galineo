'use client';
import { useState, useEffect, use } from 'react';
import { api } from '@/lib/api';

export default function TasksPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;

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
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [parentId, setParentId] = useState('');
  const [status, setStatus] = useState('todo'); // todo, in_progress, done
  
  const [searchUser, setSearchUser] = useState('');
  const [showUserList, setShowUserList] = useState(false);
  
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
    setDueDate('');
    setAssignedTo('');
    setParentId('');
    setStatus('todo');
    setIsFeatureModal(true);
    setShowModal(true);
  }

  function openCreateTask(parentTaskId = '') {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setPriority('normal');
    setPhase('');
    setDueDate('');
    setAssignedTo('');
    setParentId(parentTaskId.toString());
    setStatus('todo');
    setIsFeatureModal(false);
    setShowModal(true);
  }

  function openEditModal(task: any) {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority || 'normal');
    setPhase(task.phase || '');
    setDueDate(task.due_date ? task.due_date.substring(0, 10) : '');
    setAssignedTo(task.assigned_to ? task.assigned_to.toString() : '');
    setParentId(task.parent_id ? task.parent_id.toString() : '');
    setStatus(task.status || 'todo');
    setIsFeatureModal(!task.parent_id);
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title,
        description,
        priority,
        phase,
        due_date: dueDate || null,
        assigned_to: assignedTo ? parseInt(assignedTo) : null,
        parent_id: parentId ? parseInt(parentId) : null,
        status
      };

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
  

  async function toggleStatus(task: any) {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      await api.patch(`/projects/${projectId}/tasks/${task.id}`, { status: newStatus });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  const renderPriority = (p: string) => {
    switch(p) {
      case 'urgent_important': return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md text-xs font-semibold">Urgent & Important</span>;
      case 'urgent_not_important': return <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-md text-xs font-semibold">Urgent</span>;
      case 'not_urgent_important': return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-xs font-semibold">Important</span>;
      default: return null;
    }
  }

  const features = tasks.filter(t => !t.parent_id);
  const getTasksForFeature = (featureId: number) => tasks.filter(t => t.parent_id === featureId);

  const TaskRow = ({ task, isFeature = false }: { task: any, isFeature?: boolean }) => {
    const isDone = task.status === 'done';
    
    return (
      <div className={`flex items-center gap-3 px-4 py-3 border-b border-stone-100 hover:bg-stone-50 transition-colors group ${isDone ? 'opacity-60' : ''} ${isFeature ? 'bg-stone-50/50' : 'pl-12'}`}>
        <button onClick={() => toggleStatus(task)} className={`w-5 h-5 rounded-full border flex flex-shrink-0 items-center justify-center transition-colors ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-300 hover:border-orange-400'}`}>
          {isDone && <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>}
        </button>
        
        <div className="flex-1 min-w-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`${isFeature ? 'text-base font-bold text-stone-900' : 'text-sm font-medium'} truncate ${isDone ? 'line-through text-stone-500' : 'text-stone-900'}`}>{task.title}</span>
            {renderPriority(task.priority)}
            {task.phase && <span className="px-2 py-0.5 bg-stone-100 text-stone-600 rounded-md text-[10px] font-bold uppercase tracking-wider">{task.phase}</span>}
          </div>
          
          <div className="flex items-center gap-4 text-xs">
            {task.due_date && (
              <span className={`flex items-center gap-1 ${new Date(task.due_date) < new Date() && !isDone ? 'text-red-500 font-semibold' : 'text-stone-400'}`}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {new Date(task.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
              </span>
            )}
            {task.assignee_name && (
              <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded-full border border-stone-200">{task.assignee_name}</span>
            )}
            
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
              {isFeature && (
                <button onClick={() => openCreateTask(task.id)} className="px-2 py-1 text-xs font-semibold text-orange-600 hover:bg-orange-100 bg-orange-50 rounded-lg transition-colors" title="Ajouter une tâche à cette fonctionnalité">
                  + Tâche
                </button>
              )}
              <button onClick={() => openEditModal(task)} className="p-1.5 text-stone-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors" title="Modifier">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button onClick={() => handleDelete(task.id)} className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Supprimer">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* HEADER & INFO BULLE */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 flex items-center gap-3">
            Fonctionnalités & Tâches
            <div className="group relative">
              <div className="w-5 h-5 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center text-xs font-bold cursor-help hover:bg-orange-100 hover:text-orange-600 transition-colors">?</div>
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 bg-stone-800 text-white text-xs p-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Créez d'abord vos "Fonctionnalités" (ex: Page d'Accueil), puis insérez vos "Tâches" à l'intérieur (ex: Maquetter le Header).
                <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-stone-800"></div>
              </div>
            </div>
          </h2>
          <p className="text-stone-400 text-sm mt-1">Séparez votre projet en grands blocs (Fonctionnalités) puis découpez-les (Tâches)</p>
        </div>
        <div className="flex gap-2">
           <button onClick={() => openCreateTask()} className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-sm transition-colors shadow-sm flex items-center gap-2">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nouvelle Tâche
           </button>
           <button onClick={() => openCreateFeature()} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm flex items-center gap-2">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nouvelle Fonctionnalité
           </button>
        </div>
      </div>

      {loading ? (
         <div className="animate-pulse bg-white border border-stone-200 rounded-2xl h-64"></div>
      ) : tasks.length === 0 ? (
        <div className="bg-white border text-center border-stone-200 rounded-2xl py-16">
          <p className="text-stone-400 mb-4">Votre projet est vide.</p>
          <button onClick={() => openCreateFeature()} className="text-orange-500 text-sm font-semibold hover:underline">Créer la première fonctionnalité</button>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
           {features.map(feature => (
             <div key={feature.id} className="border-b border-stone-200 last:border-0">
                <TaskRow task={feature} isFeature={true} />
                <div className="divide-y divide-stone-100">
                  {getTasksForFeature(feature.id).map(task => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </div>
             </div>
           ))}
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
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Phase / Catégorie</label>
                      <input type="text" value={phase} onChange={e => setPhase(e.target.value)}
                        className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900" 
                        placeholder="Ex: Design, Backend..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Priorité (Eisenhower)</label>
                      <select value={priority} onChange={e => setPriority(e.target.value)}
                        className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900 bg-white">
                        <option value="normal">Normale</option>
                        <option value="urgent_important">Urgent & Important</option>
                        <option value="not_urgent_important">Important, pas urgent</option>
                        <option value="urgent_not_important">Urgent, pas important</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Date d'échéance</label>
                      <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                        className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900" />
                    </div>
                    <div className="relative">
                      <label className="block text-sm font-medium text-stone-700 mb-1">Assigner à</label>
                      <div className="relative">
                        {assignedTo ? (
                           <div className="flex items-center justify-between w-full px-4 py-2 border border-orange-200 bg-orange-50 rounded-xl">
                              <span className="text-sm font-semibold text-orange-700">{getAssignedUserName(assignedTo)}</span>
                              <button type="button" onClick={() => { setAssignedTo(''); setSearchUser(''); }} className="text-orange-400 hover:text-orange-600">
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
                                  className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-sm transition-all"
                                  placeholder="Chercher un partenaire..." />
                              </div>
                              {showUserList && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                                   {filteredMembers.length === 0 ? (
                                     <div className="p-3 text-sm text-stone-400 text-center">Aucun membre trouvé</div>
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

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
