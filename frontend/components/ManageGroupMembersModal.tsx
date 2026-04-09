'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export default function ManageGroupMembersModal({ 
  groupId, 
  onClose, 
  onChanged,
  myRole 
}: { 
  groupId: number, 
  onClose: () => void, 
  onChanged: () => void,
  myRole: string 
}) {
  const [members, setMembers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const isAdmin = myRole === 'admin';

  useEffect(() => {
    fetchMembers();
  }, [groupId]);

  const fetchMembers = async () => {
    try {
      const data = await api.get(`/chat-groups/${groupId}`);
      setMembers(data.members || []);
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (search.trim().length > 0) {
      const delay = setTimeout(async () => {
        try {
          const data = await api.get(`/users/search?q=${encodeURIComponent(search)}`);
          // Filter out those who are already members
          const filtered = data.filter((u: any) => !members.some(m => m.id === u.id));
          setSearchResults(filtered);
        } catch (err) {
          console.error(err);
        }
      }, 300);
      return () => clearTimeout(delay);
    } else {
      setSearchResults([]);
    }
  }, [search, members]);

  const addMember = async (userId: number) => {
    setLoading(true);
    try {
      await api.post(`/chat-groups/${groupId}/members`, { userId });
      setSearch('');
      setSearchResults([]);
      fetchMembers();
      onChanged();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (userId: number) => {
    if (!confirm('Retirer ce membre du groupe ?')) return;
    setLoading(true);
    try {
      await api.delete(`/chat-groups/${groupId}/members/${userId}`);
      fetchMembers();
      onChanged();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm('Voulez-vous vraiment quitter ce groupe ?')) return;
    setLoading(true);
    try {
      await api.post(`/chat-groups/${groupId}/leave`, {});
      onClose();
      window.location.href = '/messages';
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md animate-fadeIn">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-fadeUp">
        <header className="px-8 py-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div>
            <h2 className="text-xl font-bold text-stone-900">Membres</h2>
            <p className="text-xs text-stone-400 mt-1 uppercase tracking-widest font-black">Gérez l'équipe de discussion</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-full transition-colors text-stone-400">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </header>

        <div className="p-8 space-y-6">
          {isAdmin && (
            <div className="space-y-4">
              <label className="block text-[11px] font-black text-stone-500 uppercase tracking-widest ml-1">Ajouter un membre</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nom ou email..."
                  className="w-full px-5 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 text-stone-900 transition-all font-medium"
                />
                
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-stone-200 rounded-2xl shadow-xl z-50 max-h-48 overflow-y-auto p-2">
                    {searchResults.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => addMember(u.id)}
                        disabled={loading}
                        className="w-full flex items-center justify-between p-3 hover:bg-stone-50 rounded-xl transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xs uppercase">
                            {u.name.substring(0, 2)}
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-bold text-stone-900">{u.name}</p>
                            <p className="text-[10px] text-stone-400">{u.email}</p>
                          </div>
                        </div>
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <label className="block text-[11px] font-black text-stone-500 uppercase tracking-widest ml-1">Membres actuels ({members.length})</label>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {fetching ? (
                <div className="py-8 text-center"><div className="w-6 h-6 border-2 border-stone-200 border-t-orange-500 rounded-full animate-spin mx-auto"></div></div>
              ) : members.map(m => (
                <div key={m.id} className="flex items-center justify-between p-4 bg-stone-50 border border-stone-100 rounded-2xl group transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-700 font-bold text-sm shadow-sm">
                      {m.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-stone-900">{m.name}</p>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${m.role === 'admin' ? 'bg-orange-100 text-orange-600' : 'bg-stone-200 text-stone-500'}`}>
                        {m.role}
                      </span>
                    </div>
                  </div>
                  {isAdmin && m.role !== 'admin' && (
                    <button 
                      onClick={() => removeMember(m.id)}
                      disabled={loading}
                      className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={onClose}
              className="w-full px-6 py-4 bg-stone-900 text-white rounded-2xl text-sm font-black transition-all hover:bg-stone-800 shadow-xl shadow-stone-900/10"
            >
              Fermer
            </button>
            
            <button
              onClick={handleLeave}
              disabled={loading}
              className="w-full px-6 py-3 text-red-500 text-xs font-black uppercase tracking-widest hover:bg-red-50 rounded-2xl transition-all"
            >
              Quitter le groupe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
