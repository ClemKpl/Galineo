'use client';
import { useState, useEffect, useRef, use } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import ManageGroupMembersModal from '@/components/ManageGroupMembersModal';
import AttachmentBubble from '@/components/AttachmentBubble';

const getApiBase = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('localhost')) return envUrl.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return 'https://galineo-api.onrender.com';
  }
  return 'http://localhost:3001';
};
const API_URL = getApiBase();

export default function ChatGroupRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const groupId = Number(resolvedParams.id);
  const { user } = useAuth();
  const router = useRouter();

  const [group, setGroup] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  
  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAvatar, setEditAvatar] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchGroup = async () => {
    try {
      const data = await api.get(`/chat-groups/${groupId}`);
      setGroup(data);
      setEditTitle(data.title);
      setEditDesc(data.description || '');
      setEditAvatar(data.avatar || '');
    } catch (err) {
      console.error(err);
      router.push('/messages');
    }
  };

  const fetchMessages = async () => {
    try {
      const data = await api.get(`/chat-groups/${groupId}/messages`);
      setMessages(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroup();
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [groupId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const token = typeof window !== 'undefined' ? localStorage.getItem('galineo_token') : null;
      const res = await fetch(`${API_URL}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur upload');
      setPendingFile({ url: data.url, name: data.name, type: data.type });
    } catch (err) { alert((err as Error).message); }
    finally { setUploading(false); }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !pendingFile) || sending) return;

    setSending(true);
    try {
      const resp = await api.post(`/chat-groups/${groupId}/messages`, {
        content: newMessage,
        ...(pendingFile ? { attachment_url: pendingFile.url, attachment_name: pendingFile.name, attachment_type: pendingFile.type } : {}),
      });
      setMessages([...messages, resp]);
      setNewMessage('');
      setPendingFile(null);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch(`/chat-groups/${groupId}`, {
        title: editTitle,
        description: editDesc,
        avatar: editAvatar
      });
      setIsEditing(false);
      fetchGroup();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm('Quitter ce groupe ? Vous ne pourrez plus voir les messages sauf si vous êtes réinvité.')) return;
    try {
      await api.post(`/chat-groups/${groupId}/leave`, {});
      router.push('/messages');
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer définitivement ce groupe et tous ses messages ? Cette action est irréversible.')) return;
    try {
      await api.delete(`/chat-groups/${groupId}`);
      router.push('/messages');
    } catch (err) {
      alert((err as Error).message);
    }
  };

  if (loading) return <div className="p-8"><div className="animate-pulse h-10 bg-stone-100 rounded-xl w-64"></div></div>;
  if (!group) return null;

  const isAdmin = group.myRole === 'admin';

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-stone-50 animate-fadeIn">
      {/* Group Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-stone-200 bg-white px-4 py-4 md:px-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/messages')}
            className="p-2 hover:bg-stone-50 rounded-xl transition-all text-stone-400"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
          </button>
          
          <div className="w-12 h-12 rounded-[1.25rem] bg-orange-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-orange-500/10 overflow-hidden">
            {group.avatar ? <img src={group.avatar} alt="" className="w-full h-full object-cover" /> : group.title.substring(0, 2).toUpperCase()}
          </div>
          
          <div>
            <h1 className="text-lg font-black text-stone-900 leading-tight flex items-center gap-2">
              {group.title}
              {isAdmin && (
                <button onClick={() => setIsEditing(true)} className="p-1 hover:bg-stone-50 rounded text-stone-300 hover:text-orange-500 transition-all">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              )}
            </h1>
            <p className="text-xs text-stone-400 font-medium truncate max-w-md">{group.description || 'Pas de description'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMembersModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-black hover:bg-stone-800 transition-all shadow-xl shadow-stone-900/10"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
            {group.members?.length || 0} <span className="hidden md:inline">Membres</span>
          </button>
          <button
            onClick={handleLeaveGroup}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-stone-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all"
            title="Quitter le groupe"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 pb-36 pt-6 custom-scrollbar md:px-8 md:pb-8 flex flex-col">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-orange-100 text-orange-500 rounded-2xl flex items-center justify-center mb-4">
              <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            </div>
            <p className="text-stone-900 font-black">Aucun message</p>
            <p className="text-stone-400 text-sm font-medium">Soyez le premier à envoyer un message !</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.user_id === user?.id;
            const prev = messages[idx - 1];
            const next = messages[idx + 1];

            const isGroupedWithPrev = !!(
              prev &&
              prev.user_id === msg.user_id &&
              new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000
            );
            const isGroupedWithNext = !!(
              next &&
              next.user_id === msg.user_id &&
              new Date(next.created_at).getTime() - new Date(msg.created_at).getTime() < 5 * 60 * 1000
            );

            const bubbleRadius = (() => {
              if (isMe) {
                if (!isGroupedWithPrev && !isGroupedWithNext) return 'rounded-[22px] rounded-tr-md';
                if (!isGroupedWithPrev && isGroupedWithNext)  return 'rounded-[22px] rounded-tr-md rounded-br-md';
                if (isGroupedWithPrev && isGroupedWithNext)   return 'rounded-[22px] rounded-r-md';
                return 'rounded-[22px] rounded-br-md';
              } else {
                if (!isGroupedWithPrev && !isGroupedWithNext) return 'rounded-[22px] rounded-tl-md';
                if (!isGroupedWithPrev && isGroupedWithNext)  return 'rounded-[22px] rounded-tl-md rounded-bl-md';
                if (isGroupedWithPrev && isGroupedWithNext)   return 'rounded-[22px] rounded-l-md';
                return 'rounded-[22px] rounded-bl-md';
              }
            })();

            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-scaleIn ${isGroupedWithPrev ? 'mt-0.5' : 'mt-4'}`}>
                {!isGroupedWithPrev && !isMe && (
                  <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">
                    {msg.author_name}
                  </p>
                )}
                <div className={`flex items-end gap-3 max-w-[80%] ${isMe ? 'flex-row-reverse' : ''}`}>
                  <div className="hidden sm:block w-8 shrink-0">
                    {!isGroupedWithPrev && (
                      <div className="w-8 h-8 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-[10px] font-black text-stone-400 shadow-sm overflow-hidden">
                        {msg.author_avatar ? <img src={msg.author_avatar} alt="" className="w-full h-full object-cover" /> : msg.author_name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className={`px-5 py-3.5 ${bubbleRadius} shadow-sm text-sm leading-relaxed font-medium ${
                    isMe
                      ? 'bg-orange-500 text-white'
                      : 'bg-white text-stone-800 border border-stone-100'
                  }`}>
                    {msg.content}
                    {msg.attachment_url && <AttachmentBubble url={msg.attachment_url} name={msg.attachment_name} type={msg.attachment_type} isMe={isMe} />}
                  </div>
                </div>
                {!isGroupedWithNext && (
                  <p className={`text-[9px] text-stone-400 mt-1 font-bold ${isMe ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <footer className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-20 px-4 py-4 md:relative md:bottom-0 md:z-auto md:px-8 md:py-4">
        <form onSubmit={handleSendMessage} className="mx-auto max-w-4xl">
          <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.txt,.csv,.md,.docx,.xlsx" onChange={handleFileChange} />
          {pendingFile && (
            <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-700 font-medium">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
              <span className="truncate max-w-[200px]">{pendingFile.name}</span>
              <button type="button" onClick={() => setPendingFile(null)} className="ml-auto text-orange-400 hover:text-orange-600">✕</button>
            </div>
          )}
          <div className="flex gap-2.5">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="w-10 h-10 bg-white/60 hover:bg-white/80 backdrop-blur-sm border border-stone-200/60 disabled:opacity-50 text-stone-500 rounded-xl flex items-center justify-center transition-all shrink-0">
              {uploading
                ? <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                : <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
              }
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e as any); }
              }}
              disabled={sending}
              placeholder="Tapez votre message..."
              className="flex-1 bg-white/60 backdrop-blur-sm border border-stone-200/60 rounded-2xl px-5 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all text-sm text-stone-900 placeholder:text-stone-400"
            />
            <button type="submit" disabled={(!newMessage.trim() && !pendingFile) || sending}
              className="w-10 h-10 bg-orange-500 hover:bg-orange-600 text-white rounded-xl flex items-center justify-center transition-all shrink-0 active:scale-90 shadow-lg shadow-orange-500/20">
              {sending
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              }
            </button>
          </div>
        </form>
      </footer>

      {/* Modals */}
      {showMembersModal && (
        <ManageGroupMembersModal 
          groupId={groupId}
          myRole={group.myRole}
          onClose={() => setShowMembersModal(false)}
          onChanged={() => {
            fetchGroup();
          }}
        />
      )}

      {isEditing && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-fadeUp">
            <header className="px-8 py-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <h2 className="text-xl font-bold text-stone-900">Paramètres du groupe</h2>
              <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-stone-200 rounded-full transition-colors text-stone-400">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </header>
            <form onSubmit={handleUpdateGroup} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-black text-stone-500 uppercase tracking-widest mb-1.5 ml-1">Titre</label>
                  <input 
                    type="text" 
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                    className="w-full px-5 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 text-stone-900 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-stone-500 uppercase tracking-widest mb-1.5 ml-1">Description</label>
                  <textarea 
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={3}
                    className="w-full px-5 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 text-stone-900 font-medium resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-stone-500 uppercase tracking-widest mb-1.5 ml-1">Photo (URL)</label>
                  <input 
                    type="url" 
                    value={editAvatar}
                    onChange={(e) => setEditAvatar(e.target.value)}
                    className="w-full px-5 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 text-stone-900 font-medium"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <button type="button" onClick={() => setIsEditing(false)} className="flex-1 px-6 py-4 bg-stone-100 text-stone-600 rounded-2xl text-sm font-black">Annuler</button>
                <button type="submit" className="flex-1 px-6 py-4 bg-orange-500 text-white rounded-2xl text-sm font-black shadow-lg shadow-orange-500/20">Enregistrer</button>
              </div>

              <div className="pt-4 border-t border-stone-100">
                <button 
                  type="button" 
                  onClick={handleDeleteGroup}
                  className="w-full px-6 py-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                >
                  Supprimer définitivement le groupe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
