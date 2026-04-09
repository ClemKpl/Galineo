'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import CreateGroupModal from '@/components/CreateGroupModal';

export default function MessagesOverviewPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const fetchGroups = useCallback(async () => {
    try {
      const data = await api.get('/chat-groups');
      setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const filteredGroups = groups.filter(g => 
    g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (g.description && g.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fadeIn">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black text-stone-900 tracking-tight">Discussions</h1>
          <p className="text-stone-400 mt-2 font-medium">Échangez avec vos collaborateurs en dehors des projets</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-[2rem] font-black text-sm shadow-xl shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          Nouveau groupe
        </button>
      </header>

      {/* Filters/Search */}
      <div className="mb-8 relative group">
        <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-stone-300 group-focus-within:text-orange-500 transition-colors">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
        <input
          type="text"
          placeholder="Rechercher une discussion..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-14 pr-8 py-5 bg-white border border-stone-200 rounded-3xl focus:ring-4 focus:ring-orange-500/5 focus:border-orange-500 text-stone-900 transition-all font-medium placeholder:text-stone-300 shadow-sm"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-[2.5rem] p-8 border border-stone-100 shadow-sm animate-pulse">
              <div className="w-16 h-16 bg-stone-100 rounded-2xl mb-6"></div>
              <div className="h-4 bg-stone-100 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-stone-100 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-8 bg-white rounded-[3rem] border border-stone-200 border-dashed">
          <div className="w-24 h-24 bg-stone-50 rounded-[2rem] flex items-center justify-center text-stone-200 mb-8">
            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
          </div>
          <h2 className="text-2xl font-black text-stone-900 mb-2">Aucune discussion trouvée</h2>
          <p className="text-stone-400 font-medium mb-10 text-center max-w-sm">Commencez par créer votre premier groupe de discussion pour collaborer librement.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-orange-600 font-black hover:text-orange-700 underline underline-offset-8 transition-all"
          >
            Créer un nouveau groupe
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGroups.map(group => (
            <button
              key={group.id}
              onClick={() => router.push(`/messages/${group.id}`)}
              className="bg-white rounded-[2.5rem] p-8 border border-stone-100 shadow-sm hover:shadow-2xl hover:shadow-orange-500/10 hover:-translate-y-1 transition-all text-left flex flex-col group"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-16 h-16 rounded-[1.25rem] bg-gradient-to-br from-stone-50 to-stone-100 border border-stone-200 flex items-center justify-center text-stone-400 font-black text-2xl shadow-inner overflow-hidden shrink-0">
                  {group.avatar ? (
                    <img src={group.avatar} alt={group.title} className="w-full h-full object-cover" />
                  ) : (
                    group.title.substring(0, 2).toUpperCase()
                  )}
                </div>
                <div className="flex -space-x-3">
                  <div className="w-10 h-10 rounded-full bg-stone-50 border-2 border-white flex items-center justify-center text-[10px] font-black text-stone-400 shadow-sm uppercase">
                    {group.member_count}+
                  </div>
                </div>
              </div>
              
              <h3 className="text-xl font-black text-stone-900 line-clamp-1 mb-2 group-hover:text-orange-500 transition-colors">
                {group.title}
              </h3>
              <p className="text-sm text-stone-500 line-clamp-2 leading-relaxed font-medium mb-auto min-h-[40px]">
                {group.description || 'Pas de description.'}
              </p>
              
              <div className="mt-8 pt-6 border-t border-stone-50 flex items-center justify-between">
                <span className="text-[10px] font-black text-stone-300 uppercase tracking-widest">
                  {group.role === 'admin' ? 'Administrateur' : 'Membre'}
                </span>
                <span className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center text-stone-400 group-hover:bg-orange-50 group-hover:text-orange-500 transition-all">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateGroupModal 
          onClose={() => setShowCreateModal(false)}
          onCreated={(id) => {
            setShowCreateModal(false);
            router.push(`/messages/${id}`);
          }}
        />
      )}
    </div>
  );
}
