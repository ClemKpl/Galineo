'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';

interface Role { id: number; name: string; is_default: number; }
interface User { id: number; name: string; email: string; }
interface Member { user: User; roleId: number; }
interface Permission { id: number; name: string; description: string; }

interface Props {
  onClose: () => void;
  onCreated: (newId?: number) => void;
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

// Markdown très léger pour le Wizard
function renderMarkdown(text: string) {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('- ') || line.startsWith('• ')) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('• '))) {
        items.push(lines[i].slice(2));
        i++;
      }
      result.push(
        <ul key={i} className="list-disc list-inside space-y-1 my-2 text-stone-700">
          {items.map((it, k) => <li key={k}>{formatInline(it)}</li>)}
        </ul>
      );
    } else if (line.trim() === '') {
      result.push(<div key={i} className="h-2" />);
      i++;
    } else {
      result.push(<p key={i} className="leading-relaxed mb-2">{formatInline(line)}</p>);
      i++;
    }
  }
  return result;
}

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-bold text-stone-900">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i} className="italic text-stone-600">{part.slice(1, -1)}</em>;
    return part;
  });
}

type ModalView = 'choice' | 'manual' | 'wizard';

export default function CreateProjectModal({ onClose, onCreated }: Props) {
  const [view, setView] = useState<ModalView>('choice');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [deadline, setDeadline] = useState('');
  const [startDate, setStartDate] = useState('');
  const [avatar, setAvatar] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [showList, setShowList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showRoleForm, setShowRoleForm] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRolePerms, setNewRolePerms] = useState<number[]>([]);
  const [roleLoading, setRoleLoading] = useState(false);

  const [wizardMessages, setWizardMessages] = useState<any[]>([
    { role: 'assistant', content: "Merveilleux ! Je suis là pour t'aider à donner vie à ton nouveau projet. ✨\n\nPour commencer, pourrais-tu me dire quel est le **nom** de ce beau projet ?" }
  ]);
  const [wizardInput, setWizardInput] = useState('');
  const [wizardLoading, setWizardLoading] = useState(false);
  const wizardEndRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/roles').then(setRoles).catch(console.error);
    api.get('/roles/permissions').then(setPerms).catch(console.error);
    api.get('/users').then(setAllUsers).catch(console.error);
  }, []);

  const filteredUsers = allUsers.filter((u) =>
    !members.find((m) => m.user.id === u.id) &&
    (search.trim() === '' ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowList(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (view === 'wizard') {
      wizardEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [wizardMessages, view]);

  // Polling pour le Wizard
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (view === 'wizard' && wizardLoading) {
      interval = setInterval(() => {
        checkActiveTask();
      }, 1500);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [view, wizardLoading]);

  // Détection initiale au montage du mode wizard
  useEffect(() => {
    if (view === 'wizard') {
      checkActiveTask();
      loadHistory();
    }
  }, [view]);

  async function checkActiveTask() {
    try {
      const res = await api.get('/ai/active-task/wizard');
      if (res && res.active) {
        setWizardLoading(true);
      } else {
        if (wizardLoading) {
          setWizardLoading(false);
          loadHistory();
        }
        // Redirection automatique si le projet vient d'être créé par l'IA en arrière-plan
        if (res.task && res.task.status === 'completed' && res.task.project_id && wizardLoading) {
           setWizardLoading(false);
           setTimeout(() => onCreated(res.task.project_id), 1500);
        }

        // Si la tâche a échoué (failed), on pourrait afficher un message d'erreur
        if (res.task && res.task.status === 'failed') {
          setWizardLoading(false);
          setWizardMessages(prev => {
            if (prev[prev.length - 1].content.includes('⚠️')) return prev;
            return [...prev, { role: 'assistant', content: "⚠️ **Désolé**, j'ai rencontré une difficulté technique. Peux-tu reformuler ou réessayer ?" }];
          });
        }
      }
    } catch (err) {
      console.error('Failed to check wizard task', err);
      setWizardLoading(false);
    }
  }

  async function loadHistory() {
    try {
      const data = await api.get('/ai/history/wizard');
      if (data && data.history && data.history.length > 0) {
        const MappedHistory = data.history.map((h: any) => ({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.content
        }));

        // On garde le message de bienvenue s'il n'est pas déjà dans l'historique
        setWizardMessages([
          { role: 'assistant', content: "Merveilleux ! Je suis là pour t'aider à donner vie à ton nouveau projet. ✨\n\nPour commencer, pourrais-tu me dire quel est le **nom** de ce beau projet ?" },
          ...MappedHistory
        ]);
      }
    } catch (err) {
      console.error('Failed to load wizard history', err);
    }
  }

  const addMember = useCallback((user: User) => {
    const defaultRole = roles.find((r) => r.name === 'Membre') ?? roles[2];
    setMembers((prev) => [...prev, { user, roleId: defaultRole?.id ?? 3 }]);
    setSearch('');
    // setShowList(false); // On laisse la liste ouverte pour permettre d'ajouter plusieurs membres
  }, [roles]);

  const removeMember = (id: number) => setMembers((prev) => prev.filter((m) => m.user.id !== id));
  const updateRole = (userId: number, roleId: number) => {
    setMembers((prev) => prev.map((m) => m.user.id === userId ? { ...m, roleId } : m));
  };

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    setRoleLoading(true);
    try {
      const role = await api.post('/roles', { name: newRoleName, permissionIds: newRolePerms });
      setRoles((prev) => [...prev, role]);
      setNewRoleName(''); setNewRolePerms([]); setShowRoleForm(false);
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally { setRoleLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Le titre est requis'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/projects', {
        title: title.trim(),
        description: desc.trim() || null,
        deadline: deadline || null,
        start_date: startDate || null,
        avatar: avatar || null,
        members: members.map((m) => ({ userId: m.user.id, roleId: m.roleId })),
      });
      onCreated(res.id);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally { setLoading(false); }
  };

  const handleWizardSend = async () => {
    const text = wizardInput.trim();
    if (!text || wizardLoading) return;

    setWizardInput('');
    const userMsg = { role: 'user', content: text };
    const next = [...wizardMessages, userMsg];
    setWizardMessages(next);
    setWizardLoading(true);

    try {
      const res = await api.post('/ai/chat', { messages: next, mode: 'wizard' });

      if (res.status === 'processing') {
        // En arrière-plan. On laisse wizardLoading = true
        return;
      }

      setWizardMessages(prev => [...prev, { role: 'assistant', content: res.reply }]);

      // Détection via le nouveau champ d'actions (cas synchrone extrêmement rare pour wizard)
      if (res.actions && res.actions.includes('creer_projet') && res.projectId) {
        setTimeout(() => onCreated(res.projectId), 1500);
      }
      setWizardLoading(false);
    } catch (err) {
      console.error(err);
      setWizardMessages(prev => [...prev, {
        role: 'assistant',
        content: "⚠️ **Oups !** J'ai eu un petit problème technique pour traiter votre demande. Pourriez-vous réessayer dans un instant ?"
      }]);
      setWizardLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-lg h-[100dvh] lg:h-full bg-white shadow-2xl flex flex-col overflow-hidden animate-[slideIn_0.3s_cubic-bezier(0.16,1,0.3,1)]">

        {/* Header (Depends on View) */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-stone-900">
              {view === 'choice' && 'Créer un projet'}
              {view === 'manual' && 'Nouveau projet (Manuel)'}
              {view === 'wizard' && 'Assistant Galineo ✨'}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-stone-400 text-sm">
                {view === 'choice' && 'Choisissez votre méthode'}
                {(view === 'manual' || view === 'wizard') && (
                  <button onClick={() => setView('choice')} className="text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1">
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
                    Retour aux choix
                  </button>
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 hover:bg-stone-50 p-2 rounded-xl transition-colors">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* View Content */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* 1. CHOICE VIEW */}
          {view === 'choice' && (
            <div className="flex-1 p-8 flex flex-col items-center justify-center space-y-6">
              <div className="text-center space-y-2 mb-4">
                <p className="text-stone-500 max-w-xs mx-auto">Préparez le terrain pour votre prochaine réussite.</p>
              </div>

              {/* AI Card */}
              <button
                onClick={() => setView('wizard')}
                className="w-full group relative p-6 bg-gradient-to-br from-orange-500 to-amber-600 rounded-3xl shadow-xl shadow-orange-500/20 hover:shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all text-left overflow-hidden border-2 border-transparent hover:border-white/20"
              >
                <div className="relative z-10 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl animate-pulse">✨</div>
                  <div className="flex-1">
                    <h3 className="text-white font-bold text-xl">Assistant IA</h3>
                    <p className="text-white/80 text-sm leading-relaxed mt-1">L'IA s'occupe de tout : objectifs, membres et structure. Rapide et intelligent.</p>
                  </div>
                  <div className="self-center text-white/40 group-hover:text-white transition-colors">
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
                {/* Decoration */}
                <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
              </button>

              {/* Manual Card */}
              <button
                onClick={() => setView('manual')}
                className="w-full group p-6 bg-stone-50 border-2 border-stone-100 rounded-3xl hover:bg-white hover:border-orange-200 hover:shadow-lg transition-all text-left flex items-start gap-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-stone-200 group-hover:bg-orange-100 flex items-center justify-center text-stone-500 group-hover:text-orange-500 text-2xl transition-colors">📝</div>
                <div className="flex-1">
                  <h3 className="text-stone-800 font-bold text-xl group-hover:text-orange-600 transition-colors">Saisie manuelle</h3>
                  <p className="text-stone-500 text-sm leading-relaxed mt-1">Vous avez déjà tout en tête ? Remplissez le formulaire classique.</p>
                </div>
                <div className="self-center text-stone-200 group-hover:text-orange-300 transition-colors">
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
                </div>
              </button>
            </div>
          )}

          {/* 2. WIZARD VIEW */}
          {view === 'wizard' && (
            <div className="flex-1 flex flex-col bg-stone-50 overflow-hidden relative">
              <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 lg:py-6 space-y-4">
                {wizardMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm break-words ${m.role === 'user' ? 'bg-orange-500 text-white rounded-tr-none' : 'bg-white text-stone-700 border border-stone-200 rounded-tl-none font-medium'
                      }`}>
                      {m.role === 'assistant' ? renderMarkdown(m.content) : m.content}
                    </div>
                  </div>
                ))}
                {wizardLoading && (
                  <div className="flex justify-start">
                    <div className="px-4 py-2 bg-white border border-stone-100 rounded-2xl text-[10px] font-bold text-stone-400 animate-pulse uppercase tracking-widest">
                      L'Assistant réfléchit...
                    </div>
                  </div>
                )}
                <div ref={wizardEndRef} />
              </div>
              <div className="p-4 bg-white border-t border-stone-100 shrink-0">
                <div className="relative">
                  <input
                    type="text"
                    autoFocus
                    value={wizardInput}
                    onChange={(e) => setWizardInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleWizardSend();
                      }
                    }}
                    placeholder="Répondez à l'assistant..."
                    className="w-full pl-4 pr-12 py-3.5 rounded-2xl bg-stone-100 border-none text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all"
                  />
                  <button
                    onClick={handleWizardSend}
                    disabled={!wizardInput.trim() || wizardLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center disabled:opacity-30 disabled:grayscale transition-all shadow-md shadow-orange-500/20"
                  >
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. MANUAL VIEW */}
          {view === 'manual' && (
            <>
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {error && (
                  <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">{error}</div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1.5">Titre du projet <span className="text-orange-500">*</span></label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all font-medium"
                    placeholder="Ex: Refonte du site web" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1.5">Description</label>
                  <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all resize-none font-medium"
                    placeholder="Décrivez brièvement votre projet..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-1.5">Date de début</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all font-medium" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-1.5">Échéance</label>
                    <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all font-medium" />
                  </div>
                </div>
                {/* Members logic remains same but UI polished */}
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-2">Équipe du projet</label>
                  <div className="relative" ref={wrapperRef}>
                    <div className="relative">
                      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                      </svg>
                      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} onFocus={() => setShowList(true)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all font-medium"
                        placeholder="Ajouter des membres..." />
                    </div>
                    {showList && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-stone-200 rounded-2xl shadow-xl z-20 overflow-hidden max-h-52 overflow-y-auto animate-in slide-in-from-top-2">
                        {filteredUsers.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-stone-400 text-center font-medium">Aucun résultat</div>
                        ) : (
                          filteredUsers.map((u) => (
                            <button key={u.id} type="button" onClick={() => addMember(u)}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50 transition-colors text-left group">
                              <div className="w-9 h-9 rounded-xl bg-stone-100 group-hover:bg-orange-100 flex items-center justify-center text-stone-600 group-hover:text-orange-700 text-xs font-bold transition-colors">{initials(u.name)}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-stone-900 truncate">{u.name}</p>
                                <p className="text-xs text-stone-400 truncate">{u.email}</p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {/* Selected members list */}
                  {members.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {members.map((m) => (
                        <div key={m.user.id} className="flex items-center gap-3 bg-stone-50 rounded-2xl px-3 py-2 border border-stone-100 animate-in slide-in-from-left-2 transition-all">
                          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-700 text-[10px] font-black">{initials(m.user.name)}</div>
                          <div className="flex-1 min-w-0"><p className="text-xs font-bold text-stone-900 truncate">{m.user.name}</p></div>
                          <select value={m.roleId} onChange={(e) => updateRole(m.user.id, Number(e.target.value))}
                            className="text-[10px] uppercase tracking-wider font-black border-none rounded-lg px-2 py-1 bg-white shadow-sm ring-1 ring-stone-100">
                            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                          <button type="button" onClick={() => removeMember(m.user.id)} className="text-stone-300 hover:text-red-500 transition-colors p-1">
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>
              <div className="px-6 py-5 bg-stone-50 border-t border-stone-100 flex items-center justify-end gap-3 shrink-0">
                <button type="button" onClick={onClose} className="px-5 py-2.5 text-stone-500 hover:text-stone-800 font-bold transition-colors">Annuler</button>
                <button type="submit" onClick={handleSubmit} disabled={loading} className="px-8 py-3 bg-stone-900 text-white rounded-2xl font-bold shadow-xl shadow-stone-900/10 hover:bg-stone-800 active:scale-95 disabled:bg-stone-300 transition-all flex items-center gap-2">
                  {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Créer le projet
                </button>
              </div>
            </>
          )}

        </div>

        <style jsx>{`
          @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
          .animate-in { animation: fadeIn 0.3s ease-out; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
      </div>
    </div>
  );
}
