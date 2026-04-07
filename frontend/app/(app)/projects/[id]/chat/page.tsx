'use client';
import { useState, useEffect, use, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const { user: currentUser } = useAuth();

  const [messages, setMessages] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [mentionListVisible, setMentionListVisible] = useState(false);
  
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
    <div className="flex flex-col h-full bg-stone-50">
      {/* HEADER & INFO BULLE */}
      <div className="relative z-20 px-8 py-5 border-b border-stone-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-stone-900">Discussion</h2>
          <div className="group relative z-30">
            <div className="w-5 h-5 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center text-xs font-bold cursor-help hover:bg-orange-100 hover:text-orange-600 transition-colors">?</div>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 bg-stone-800 text-white text-xs p-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[80]">
              Espace d'échange du projet. Utilisez <strong>@NomDuMembre</strong> pour les notifier (les mentions s'afficheront en couleur). Les messages s'actualisent sans recharger la page.
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full border-4 border-transparent border-b-stone-800"></div>
            </div>
          </div>
        </div>
        <p className="text-stone-400 text-sm mt-0.5">Échangez avec votre équipe</p>
      </div>

      {/* CHAT MESSAGES */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {loading ? (
          <div className="text-center text-stone-400 text-sm">Chargement...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-stone-400 text-sm mt-12 bg-white p-6 rounded-2xl border border-stone-200 inline-block mx-auto">
            Aucun message. Soyez le premier à parler !
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.user_id === currentUser?.id;
            return (
              <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${isMe ? 'bg-orange-500' : 'bg-stone-300'}`}>
                  {msg.author_name?.substring(0,2).toUpperCase()}
                </div>
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[70%]`}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-medium text-stone-500">{isMe ? 'Vous' : msg.author_name}</span>
                    <span className="text-[10px] text-stone-400">{new Date(msg.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <div className={`px-4 py-2 rounded-2xl text-sm ${isMe ? 'bg-stone-900 text-white rounded-tr-sm' : 'bg-white border border-stone-200 text-stone-800 rounded-tl-sm shadow-sm'}`}>
                    {renderMessageContent(msg.content)}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* CHAT INPUT AREA */}
      <div className="px-8 pb-8 pt-4 bg-transparent shrink-0">
        <form onSubmit={handleSend} className="relative max-w-4xl mx-auto">
          {/* Autocomplete Mentions Box */}
          {mentionListVisible && (
            <div className="absolute bottom-full mb-2 left-0 min-w-48 bg-white border border-stone-200 rounded-xl shadow-lg p-2 z-10 flex flex-col gap-1">
              <span className="text-xs font-bold text-stone-400 px-2 pb-1 uppercase">Membres</span>
              {members.filter(m => m.id !== currentUser?.id).map(m => (
                <button type="button" key={m.id} onClick={() => insertMention(m.name)} className="text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg transition-colors font-medium">
                  @{m.name}
                </button>
              ))}
            </div>
          )}
          
          <div className="flex gap-2">
            <input id="chat-input" type="text"
              className="flex-1 bg-white border border-stone-200 rounded-full px-6 py-3.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all text-sm text-stone-900"
              placeholder="Écrivez un message... (Tapez @ pour mentionner)"
              value={newMessage}
              onChange={handleInputChange}
              autoComplete="off"
            />
            <button type="submit" disabled={!newMessage.trim()} className="w-12 h-12 bg-orange-500 hover:bg-orange-600 disabled:bg-stone-300 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition-colors shadow-sm shrink-0">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
