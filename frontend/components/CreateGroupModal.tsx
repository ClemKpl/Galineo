'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
}

export default function CreateGroupModal({ onClose, onCreated }: { onClose: () => void, onCreated: (groupId: number) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (search.trim().length > 0) {
      const delay = setTimeout(async () => {
        try {
          const data = await api.get(`/users/search?q=${encodeURIComponent(search)}`);
          setSearchResults(data);
        } catch (err) {
          console.error(err);
        }
      }, 300);
      return () => clearTimeout(delay);
    } else {
      setSearchResults([]);
    }
  }, [search]);

  const toggleMember = (user: User) => {
    if (selectedMembers.find(m => m.id === user.id)) {
      setSelectedMembers(selectedMembers.filter(m => m.id !== user.id));
    } else {
      setSelectedMembers([...selectedMembers, user]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const resp = await api.post('/chat-groups', {
        title,
        description,
        avatar,
        initialMembers: selectedMembers.map(m => m.id)
      });
      onCreated(resp.id);
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
            <h2 className="text-xl font-bold text-stone-900">Nouveau Groupe</h2>
            <p className="text-xs text-stone-400 mt-1 uppercase tracking-widest font-black">Discutez à plusieurs</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-full transition-colors text-stone-400">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-black text-stone-500 uppercase tracking-widest mb-1.5 ml-1">Titre du groupe</label>
              <input 
                autoFocus
                type="text" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex : Équipe Design, Soirée Galineo..."
                required
                className="w-full px-5 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 text-stone-900 transition-all font-medium placeholder:text-stone-300"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-stone-500 uppercase tracking-widest mb-1.5 ml-1">Description (Optionnel)</label>
              <textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                placeholder="De quoi allez-vous discuter ?"
                rows={2}
                className="w-full px-5 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 text-stone-900 transition-all resize-none placeholder:text-stone-300"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-stone-500 uppercase tracking-widest mb-1.5 ml-1">Photo du groupe (URL)</label>
              <input 
                type="url" 
                value={avatar} 
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="https://images..."
                className="w-full px-5 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 text-stone-900 transition-all font-medium placeholder:text-stone-300"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-stone-500 uppercase tracking-widest mb-1.5 ml-1">Membres ({selectedMembers.length})</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Chercher un utilisateur..."
                  className="w-full px-5 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 text-stone-900 transition-all text-sm"
                />
                
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-stone-200 rounded-2xl shadow-xl z-50 max-h-48 overflow-y-auto p-2">
                    {searchResults.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { toggleMember(u); setSearch(''); setSearchResults([]); }}
                        className="w-full flex items-center justify-between p-3 hover:bg-stone-50 rounded-xl transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xs uppercase overflow-hidden border border-orange-200">
                            {u.avatar ? (
                              <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              u.name.substring(0, 2)
                            )}
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

              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {selectedMembers.map(m => (
                    <div key={m.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-xs font-bold border border-orange-100 animate-fadeIn">
                      {m.name}
                      <button type="button" onClick={() => toggleMember(m)} className="hover:text-orange-900">
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-2xl text-sm font-black transition-all"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 px-6 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-orange-500/30 disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                'Créer le groupe'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
