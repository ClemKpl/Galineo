'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';

interface Role   { id: number; name: string; is_default: number; }
interface User   { id: number; name: string; email: string; }
interface Member { user: User; roleId: number; }
interface Permission { id: number; name: string; description: string; }

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function CreateProjectModal({ onClose, onCreated }: Props) {
  const [title, setTitle]       = useState('');
  const [desc, setDesc]         = useState('');
  const [deadline, setDeadline] = useState('');
  const [startDate, setStartDate] = useState('');
  const [avatar, setAvatar]     = useState('');
  const [members, setMembers]   = useState<Member[]>([]);
  const [roles, setRoles]       = useState<Role[]>([]);
  const [perms, setPerms]       = useState<Permission[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [search, setSearch]     = useState('');
  const [showList, setShowList] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const [showRoleForm, setShowRoleForm]   = useState(false);
  const [newRoleName, setNewRoleName]     = useState('');
  const [newRolePerms, setNewRolePerms]   = useState<number[]>([]);
  const [roleLoading, setRoleLoading]     = useState(false);
  const [showWizard, setShowWizard]     = useState(false);
  const [wizardMessages, setWizardMessages] = useState<any[]>([
    { role: 'assistant', content: "Bonjour ! Je suis l'Assistant Wizard de Galineo ✨\n\nDécris-moi ton projet (nom, objectifs, membres à inclure) et je m'occupe de tout configurer pour toi !" }
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
    if (showWizard) {
      wizardEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [wizardMessages, showWizard]);

  const addMember = useCallback((user: User) => {
    const defaultRole = roles.find((r) => r.name === 'Membre') ?? roles[2];
    setMembers((prev) => [...prev, { user, roleId: defaultRole?.id ?? 3 }]);
    setSearch('');
    setShowList(false);
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
      await api.post('/projects', {
        title: title.trim(),
        description: desc.trim() || null,
        deadline: deadline || null,
        start_date: startDate || null,
        avatar: avatar || null,
        members: members.map((m) => ({ userId: m.user.id, roleId: m.roleId })),
      });
      onCreated();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-white shadow-2xl flex flex-col overflow-hidden animate-[slideIn_0.25s_ease-out]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Nouveau projet</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-stone-400 text-sm">Remplissez les informations</p>
              <span className="text-stone-300">·</span>
              <button 
                type="button"
                onClick={() => setShowWizard(!showWizard)}
                className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md transition-all ${
                  showWizard ? 'bg-orange-500 text-white shadow-sm' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
              >
                {showWizard ? 'Mode Manuel' : 'Assistant IA ✨'}
              </button>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 hover:bg-stone-100 p-2 rounded-xl transition-colors">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {showWizard ? (
          <div className="flex-1 flex flex-col bg-stone-50 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              {wizardMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    m.role === 'user' ? 'bg-orange-500 text-white rounded-tr-none' : 'bg-white text-stone-700 border border-stone-200 rounded-tl-none'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {wizardLoading && (
                <div className="flex justify-start">
                  <div className="px-4 py-2 bg-white border border-stone-100 rounded-2xl text-[10px] font-bold text-stone-400 animate-pulse uppercase tracking-widest">
                    L'IA réfléchit...
                  </div>
                </div>
              )}
              <div ref={wizardEndRef} />
            </div>
            <div className="p-4 bg-white border-t border-stone-100 shrink-0">
               <div className="relative">
                 <input 
                   type="text"
                   value={wizardInput}
                   onChange={(e) => setWizardInput(e.target.value)}
                   onKeyDown={async (e) => {
                     if (e.key === 'Enter' && wizardInput.trim()) {
                       const text = wizardInput.trim();
                       setWizardInput('');
                       const userMsg = { role: 'user', content: text };
                       const next = [...wizardMessages, userMsg];
                       setWizardMessages(next);
                       setWizardLoading(true);
                       try {
                         const res = await api.post('/ai/chat', { messages: next, mode: 'wizard' });
                         setWizardMessages(prev => [...prev, { role: 'assistant', content: res.reply }]);
                         if (res.reply.includes('[Actions: creer_projet]')) {
                            setTimeout(() => onCreated(), 1500);
                         }
                       } catch (err) {
                         console.error(err);
                       } finally { setWizardLoading(false); }
                     }
                   }}
                   placeholder="Répondez à l'assistant..."
                   className="w-full pl-4 pr-10 py-3 rounded-xl bg-stone-50 border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                 />
                 <button className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-500">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                 </button>
               </div>
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Titre du projet <span className="text-orange-500">*</span></label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all"
                  placeholder="Ex: Refonte du site web" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Description</label>
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all resize-none"
                  placeholder="Décrivez brièvement votre projet..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Début</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Fin</label>
                  <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Avatar (URL)</label>
                <input type="url" value={avatar} onChange={(e) => setAvatar(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all"
                  placeholder="https://votre-image.jpg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Membres</label>
                <div className="relative" ref={wrapperRef}>
                  <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                    </svg>
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} onFocus={() => setShowList(true)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all"
                      placeholder="Chercher ou sélectionner un membre..." />
                  </div>
                  {showList && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-stone-200 rounded-xl shadow-lg z-20 overflow-hidden max-h-52 overflow-y-auto">
                      {filteredUsers.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-stone-400 text-center">Aucun résultat</div>
                      ) : (
                        filteredUsers.map((u) => (
                          <button key={u.id} type="button" onClick={() => addMember(u)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 transition-colors text-left group">
                            <div className="w-8 h-8 rounded-full bg-stone-100 group-hover:bg-orange-100 flex items-center justify-center text-stone-600 group-hover:text-orange-700 text-xs font-semibold shrink-0 transition-colors">{initials(u.name)}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-stone-900 truncate">{u.name}</p>
                              <p className="text-xs text-stone-400 truncate">{u.email}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {members.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {members.map((m) => (
                      <div key={m.user.id} className="flex items-center gap-3 bg-stone-50 rounded-xl px-3 py-2.5 border border-stone-100">
                        <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 text-xs font-semibold shrink-0">{initials(m.user.name)}</div>
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium text-stone-900 truncate">{m.user.name}</p></div>
                        <select value={m.roleId} onChange={(e) => updateRole(m.user.id, Number(e.target.value))}
                          className="text-xs border border-stone-200 rounded-lg px-2 py-1 text-stone-700 bg-white">
                          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        <button type="button" onClick={() => removeMember(m.user.id)} className="text-stone-400 hover:text-red-400 transition-colors p-1 rounded-lg">
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => setShowRoleForm((v) => !v)} className="mt-3 text-xs text-orange-500 font-medium flex items-center gap-1.5">
                   {showRoleForm ? 'Annuler' : '+ Créer un rôle personnalisé'}
                </button>
                {showRoleForm && (
                  <div className="mt-3 bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-3">
                    <input type="text" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="Nom du rôle" className="w-full px-3 py-2 rounded-lg border border-orange-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30" />
                    <button type="button" onClick={createRole} disabled={roleLoading || !newRoleName.trim()} className="w-full py-2 bg-orange-500 text-white text-sm font-medium rounded-lg">{roleLoading ? 'Création...' : 'Créer ce rôle'}</button>
                  </div>
                )}
              </div>
            </form>
            <div className="px-6 py-5 bg-stone-50 border-t border-stone-100 flex items-center justify-end gap-3 shrink-0">
              <button type="button" onClick={onClose} className="px-5 py-2.5 text-stone-500 hover:text-stone-800 font-medium transition-colors">Annuler</button>
              <button type="submit" onClick={handleSubmit} disabled={loading} className="px-6 py-2.5 bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 active:scale-95 disabled:bg-stone-300 transition-all flex items-center gap-2">
                {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Créer le projet
              </button>
            </div>
          </>
        )}
        <style jsx>{`
          @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        `}</style>
      </div>
    </div>
  );
}
