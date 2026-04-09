'use client';
import { useState, useEffect, use, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const { user: currentUser } = useAuth();

  const [messages, setMessages] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [mentionListVisible, setMentionListVisible] = useState(false);
  
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  
  // Scroller en bas au chargement
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    fetchData();
    // Auto refresh toutes les 5 secondes (illusion temps réel)
    const intervalId = setInterval(fetchData, 5000);
    return () => clearInterval(intervalId);
  }, [projectId]);

  async function fetchData() {
    try {
      const [msgRes, projectRes] = await Promise.all([
        api.get(`/projects/${projectId}/messages`),
        api.get(`/projects/${projectId}`)
      ]);
      setMessages(msgRes);
      setMembers(projectRes.members);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      await api.post(`/projects/${projectId}/messages`, { content: newMessage });
      setNewMessage('');
      fetchData(); // Rafraîchir tout de suite
      setMentionListVisible(false);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteMessage(msgId: number) {
    if (!confirm('Voulez-vous vraiment supprimer ce message ?')) return;
    try {
      await api.delete(`/projects/${projectId}/messages/${msgId}`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  async function submitEditMessage(msgId: number) {
    if (!editContent.trim()) return;
    try {
      await api.patch(`/projects/${projectId}/messages/${msgId}`, { content: editContent });
      setEditingMessageId(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  function startEditing(msg: any) {
    setEditingMessageId(msg.id);
    setEditContent(msg.content);
  }

  // Fonction pour afficher un message en surlignant les mentions texte (@Nom)
  const renderMessageContent = (content: string) => {
    const parts = content.split(/(@[a-zA-Z0-9_]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const isMe = currentUser?.name && part.toLowerCase() === `@${currentUser.name.toLowerCase()}`;
        return <span key={i} className={`font-semibold ${isMe ? 'bg-orange-100 text-orange-700 px-1 rounded' : 'text-blue-500'}`}>{part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const insertMention = (name: string) => {
    const words = newMessage.split(' ');
    words[words.length - 1] = `@${name} `;
    setNewMessage(words.join(' '));
    setMentionListVisible(false);
    document.getElementById('chat-input')?.focus();
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewMessage(val);
    const words = val.split(' ');
    const lastWord = words[words.length - 1];
    
    // Détection basique pour /@ qqch
    if (lastWord.startsWith('@')) {
      setMentionListVisible(true);
    } else {
      setMentionListVisible(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-stone-50 animate-fadeIn">
      {/* HEADER & INFO BULLE */}
      <div className="relative z-20 px-4 md:px-8 py-4 md:py-5 border-b border-stone-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl md:text-2xl font-black text-stone-900 tracking-tight">Discussion</h2>
          <div className="group relative">
            <div className="w-5 h-5 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center text-[10px] font-black cursor-help hover:bg-orange-100 hover:text-orange-600 transition-colors">?</div>
            <div className="absolute left-0 md:left-1/2 md:-translate-x-1/2 top-full mt-2 w-72 bg-stone-900 border border-stone-800 text-stone-300 text-[11px] p-4 rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-[80] leading-relaxed">
              Espace d'échange du projet. Utilisez <strong>@Nom</strong> pour les notifier. Les messages s'actualisent automatiquement.
              <div className="absolute left-4 md:left-1/2 md:-translate-x-1/2 bottom-full border-8 border-transparent border-b-stone-900"></div>
            </div>
          </div>
        </div>
        <p className="text-stone-400 text-[10px] font-bold uppercase tracking-widest mt-1">Échangez avec votre équipe</p>
      </div>

      {/* CHAT MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-none">
        {loading ? (
          <div className="text-center text-stone-400 text-sm">Chargement...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-stone-400 text-sm mt-12 bg-white p-6 rounded-2xl border border-stone-200 inline-block mx-auto">
            Aucun message. Soyez le premier à parler !
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.user_id === currentUser?.id;
            const avatar = msg.author_avatar; // Assumer que author_avatar est retourné par l'API
            
            return (
              <div key={msg.id} className={`flex w-full group ${isMe ? 'justify-end' : 'justify-start'} animate-fadeUp`}>
                <div className={`flex max-w-[90%] sm:max-w-[75%] lg:max-w-[70%] gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className="shrink-0 pt-1">
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs shadow-sm overflow-hidden border ${
                      isMe ? 'bg-stone-100 border-stone-200' : 'bg-stone-200 border-stone-300'
                    }`}>
                      {avatar ? (
                        <img src={avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-stone-400">{msg.author_name?.substring(0,2).toUpperCase()}</span>
                      )}
                    </div>
                  </div>

                  {/* Message Content Container */}
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} min-w-0`}>
                    {/* Header: Name & Time */}
                    <div className="flex items-center gap-2 px-1 mb-1.5 min-w-0">
                      <span className="text-[11px] font-black text-stone-900 uppercase tracking-tight truncate">
                         {isMe ? 'Moi' : msg.author_name}
                      </span>
                      <span className="text-[9px] font-bold text-stone-300 uppercase tracking-tighter whitespace-nowrap">
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                    
                    {editingMessageId === msg.id ? (
                      <div className="flex flex-col gap-2 w-full min-w-[200px] mt-1 p-2 bg-white rounded-2xl border border-stone-200 shadow-sm">
                        <textarea
                          autoFocus 
                          className="w-full text-sm text-stone-900 bg-stone-50 rounded-xl px-4 py-3 resize-none outline-none focus:ring-2 focus:ring-orange-500/20" 
                          value={editContent} 
                          onChange={e => setEditContent(e.target.value)} 
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              submitEditMessage(msg.id);
                            }
                            if (e.key === 'Escape') setEditingMessageId(null);
                          }} 
                          rows={2}
                        />
                        <div className="flex justify-end gap-3 text-[10px] font-black uppercase tracking-widest px-1">
                          <button onClick={() => setEditingMessageId(null)} className="text-stone-400 hover:text-stone-600 transition-colors">Annuler</button>
                          <button onClick={() => submitEditMessage(msg.id)} className="text-orange-500 hover:text-orange-600 transition-colors">Enregistrer</button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative group">
                        {/* Action Buttons (Visible on Hover) */}
                        {isMe && (
                          <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 ${isMe ? 'right-full mr-3' : 'left-full ml-3'}`}>
                            <button onClick={() => startEditing(msg)} className="p-2 bg-white text-stone-400 hover:text-blue-500 rounded-xl shadow-sm border border-stone-100 transition-all hover:scale-110" title="Modifier">
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                            </button>
                            <button onClick={() => handleDeleteMessage(msg.id)} className="p-2 bg-white text-stone-400 hover:text-red-500 rounded-xl shadow-sm border border-stone-100 transition-all hover:scale-110" title="Supprimer">
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M19 7l-1 12H6L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3"/></svg>
                            </button>
                          </div>
                        )}
                        
                        <div className={`px-5 py-3.5 rounded-[22px] text-sm leading-relaxed shadow-sm ${
                          isMe 
                            ? 'bg-orange-500 text-white rounded-tr-none shadow-orange-200/50' 
                            : 'bg-white border border-stone-100 text-stone-800 rounded-tl-none'
                        }`} style={{ whiteSpace: 'pre-wrap' }}>
                          {renderMessageContent(msg.content)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* CHAT INPUT AREA */}
      <div className="px-4 md:px-8 pb-24 lg:pb-8 pt-4 bg-white border-t border-stone-100 shrink-0">
        <form onSubmit={handleSend} className="relative max-w-4xl mx-auto">
          {/* Autocomplete Mentions Box */}
          {mentionListVisible && (
            <div className="absolute bottom-full mb-3 left-0 min-w-48 bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl p-2 z-10 flex flex-col gap-1">
              <span className="text-[10px] font-black text-stone-500 px-3 pb-1 pt-1 uppercase tracking-widest">Membres</span>
              {members.filter(m => m.id !== currentUser?.id).map(m => (
                <button type="button" key={m.id} onClick={() => insertMention(m.name)} className="text-left px-3 py-2 text-xs text-stone-300 hover:bg-stone-800 hover:text-orange-400 rounded-xl transition-all font-bold">
                  @{m.name}
                </button>
              ))}
            </div>
          )}
          
          <div className="flex gap-2.5">
            <input id="chat-input" type="text"
              className="flex-1 bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3.5 shadow-inner focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all text-sm text-stone-900 placeholder:text-stone-400"
              placeholder="Message... (@ pour mentionner)"
              value={newMessage}
              onChange={handleInputChange}
              autoComplete="off"
            />
            <button type="submit" disabled={!newMessage.trim()} className="w-12 h-12 bg-orange-500 hover:bg-orange-600 disabled:bg-stone-200 disabled:text-stone-400 text-white rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-orange-500/20 shrink-0 active:scale-90">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
