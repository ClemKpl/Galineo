'use client';
import { useState, useRef, useEffect, use } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import AttachmentBubble from '@/components/AttachmentBubble';

type Role = 'user' | 'assistant' | 'model';
type Message = { 
  role: Role; 
  content: string; 
  user_name?: string; 
  user_avatar?: string | null; 
  created_at?: string;
};

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('galineo_token');
}

// Markdown très léger : **gras**, *italique*, listes -
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
      result.push(<p key={i} className="leading-relaxed mb-2 text-stone-700">{formatInline(line)}</p>);
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

export default function ProjectAiRoom({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Bienvenue dans la **Galineo Room**. Je suis l'assistant dédié à ce projet.\n\nIci, je peux effectuer des actions directes pour vous : créer des tâches, modifier des échéances, assigner des membres, etc.\n\nL'historique est **partagé** avec tous les membres du projet.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingHistory, setFetchingHistory] = useState(true);
  const [aiSettings, setAiSettings] = useState<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_URL}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur upload');
      setPendingFile({ url: data.url, name: data.name, type: data.type });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur upload');
    } finally { setUploading(false); }
  };

  // Ref vers le dernier message model affiché — pour détecter une nouvelle réponse IA
  const lastModelContentRef = useRef<string>('');

  useEffect(() => {
    const lastModel = [...messages].reverse().find(m => m.role === 'assistant' || m.role === 'model');
    lastModelContentRef.current = lastModel?.content ?? '';
  }, [messages]);

  useEffect(() => {
    loadHistory();
    checkActiveTask();
    loadAiSettings();
  }, [projectId]);

  async function loadAiSettings() {
    try {
      const res = await api.get(`/projects/${projectId}/ai-settings`);
      setAiSettings(res);
    } catch (err) { console.error(err); }
  }

  // Recharge l'historique quand une nouvelle notification arrive (ex: réponse IA prête)
  useEffect(() => {
    function onNewNotification() {
      loadHistory();
    }
    window.addEventListener('new-notification', onNewNotification);
    return () => window.removeEventListener('new-notification', onNewNotification);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(async () => {
      try {
        const activeRes = await api.get(`/ai/active-task/${projectId}`);
        
        // Si la tâche a échoué (failed)
        if (activeRes.task && activeRes.task.status === 'failed') {
          setLoading(false);
          setMessages(prev => {
            if (prev[prev.length - 1].content.includes('⚠️')) return prev;
            return [...prev, { 
              role: 'assistant', 
              content: "⚠️ **Désolé**, j'ai rencontré une difficulté technique. Peux-tu reformuler ou réessayer ?",
              user_name: 'Système',
              created_at: new Date().toISOString()
            }];
          });
          return;
        }

        // Si la tâche n'est plus active mais qu'on était en train de charger
        if (!activeRes.active) {
           loadHistory();
           setLoading(false);
           return;
        }

        const data = await api.get(`/ai/history/${projectId}`);
        if (data?.history?.length > 0) {
          const lastDbMsg = data.history[data.history.length - 1];
          // On compare avec le dernier contenu connu pour voir si l'IA a répondu
          if (lastDbMsg.role === 'model' && lastDbMsg.content !== lastModelContentRef.current) {
            const mapped = data.history.map((h: any) => ({
              role: h.role === 'model' ? 'assistant' : 'user',
              content: h.content,
              user_name: h.user_name,
              user_avatar: h.user_avatar,
              created_at: h.created_at,
            }));
            
            setMessages(prev => mergeHistory(prev, mapped));
            setLoading(false);
          }
        }
      } catch {
        // silencieux, on réessaie au prochain tick
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [loading, projectId]);

  // Fonction de fusion inteligente pour éviter les disparitions
  const mergeHistory = (prev: Message[], incoming: Message[]) => {
    // On garde le message de bienvenue (prev[0])
    const welcome = prev[0];
    const current = prev.slice(1);

    // Création d'un set de "clés" pour dédupliquer (rôle + contenu + date)
    const existingKeys = new Set(current.map(m => `${m.role}|${m.content}|${m.created_at}`));
    
    const newFromIncoming = incoming.filter(m => {
       const key = `${m.role}|${m.content}|${m.created_at}`;
       return !existingKeys.has(key);
    });

    if (newFromIncoming.length === 0 && current.length === incoming.length) return prev;
    
    // On retourne le welcome + tout le reste (trié par date si possible)
    return [welcome, ...incoming];
  };

  async function checkActiveTask() {
    try {
      const res = await api.get(`/ai/active-task/${projectId}`);
      if (res && res.active) {
        setLoading(true);
      } else if (res.task && res.task.status === 'failed') {
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to check active task', err);
    }
  }

  async function handleResetHistory() {
    if (!confirm("Voulez-vous vraiment effacer tout l'historique de cette Galineo Room ? Cette action est irréversible pour tous les membres.")) return;
    
    setLoading(true);
    try {
      await api.delete(`/ai/history/${projectId}`);
      // Reset local messages
      setMessages([
        {
          role: 'assistant',
          content: "L'historique a été réinitialisé. Comment puis-je vous aider à nouveau sur ce projet ?",
        },
      ]);
    } catch (err) {
      console.error('Reset failed', err);
      alert("Une erreur est survenue lors de la réinitialisation.");
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    setFetchingHistory(true);
    try {
      const data = await api.get(`/ai/history/${projectId}`);
      if (data && data.history && data.history.length > 0) {
        const mapped = data.history.map((h: any) => ({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.content,
          user_name: h.user_name,
          user_avatar: h.user_avatar,
          created_at: h.created_at
        }));
        
        setMessages(prev => mergeHistory(prev, mapped));
      }
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setFetchingHistory(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text && !pendingFile || loading) return;

    const userMsg: Message = {
      role: 'user',
      content: text,
      user_name: user?.name,
      user_avatar: user?.avatar,
      created_at: new Date().toISOString()
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    const sentFile = pendingFile;
    setPendingFile(null);
    setLoading(true);

    try {
      const history = next.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

      const res = await api.post('/ai/chat', {
        messages: history,
        projectId: projectId,
        mode: 'project',
        ...(sentFile ? { attachment_url: sentFile.url, attachment_name: sentFile.name, attachment_type: sentFile.type } : {}),
      });

      if (res.status === 'processing') {
        // En arrière-plan sur le serveur. On laisse loading = true
        // Le polling de l'active-task prendra le relais
        return;
      }

      // Cas synchrone (legacy ou fallback)
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: res.reply,
        user_name: 'Galineo Room',
        created_at: new Date().toISOString()
      }]);
      setLoading(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `⚠️ ${msg}`,
        user_name: 'Système',
        created_at: new Date().toISOString()
      }]);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-stone-50 overflow-hidden relative text-stone-900 font-sans">
      {/* Header Interne - Fixe au sommet de la zone de contenu sur mobile */}
      <div className="sticky top-0 px-3 lg:px-8 py-2.5 lg:py-4 bg-white/95 backdrop-blur border-b border-stone-200 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-2 lg:gap-3 min-w-0">
          <div className="hidden lg:flex w-10 h-10 rounded-xl bg-orange-500 items-center justify-center text-white shadow-sm">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10a9.96 9.96 0 0 1-5.06-1.37L2 22l1.37-4.94A9.96 9.96 0 0 1 2 12C2 6.48 6.48 2 12 2z"/>
              <path d="M8 10h.01M12 10h.01M16 10h.01" strokeLinecap="round" strokeWidth="2.5"/>
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-xs lg:text-sm font-black text-stone-900 truncate">Galineo Assistant</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
               <span className="flex h-1.5 w-1.5 rounded-full bg-green-500"></span>
               <p className="text-[9px] text-stone-400 uppercase tracking-widest font-bold">Actif</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            <button 
              onClick={handleResetHistory}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-500 hover:text-red-500 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Réinitialiser"
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="text-[9px] font-black uppercase tracking-wider">Reset</span>
            </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-8 pt-4 lg:py-6 pb-36 lg:pb-6 space-y-4 lg:space-y-6 relative">
        {aiSettings?.allow_delete === 1 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 animate-pulse">
            <span className="text-xl">⚠️</span>
            <div className="text-xs text-red-800 font-medium">
              <span className="font-bold uppercase tracking-wider">Mode Expérimental :</span> 
              L'Assistant IA est autorisé à supprimer des éléments dans ce projet. Soyez précis dans vos demandes.
            </div>
          </div>
        )}

        {fetchingHistory && (
          <div className="absolute inset-0 bg-stone-50/80 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Synchronisation de l'historique...</p>
          </div>
        )}

        {messages.map((m, i) => {
          const isUser = m.role === 'user';
          const senderName = isUser ? (m.user_name || 'Moi') : 'Galineo Room';
          const avatar = isUser ? m.user_avatar : null;

          return (
            <div key={i} className={`flex w-full group ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[95%] lg:max-w-[75%] gap-2 lg:gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar - Masqué sur mobile pour l'IA, visible pour l'utilisateur */}
                <div className={`shrink-0 pt-1 ${isUser ? '' : 'hidden lg:block'}`}>
                  <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs shadow-sm overflow-hidden border ${
                    isUser ? 'bg-stone-100 border-stone-200' : 'bg-orange-500 border-orange-400 text-white'
                  }`}>
                    {isUser ? (
                      avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-stone-400">👤</span>
                    ) : (
                      <svg width="20" height="20" fill="white" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 1-10 10A10 10 0 0 1 12 2zm0 2a8 8 0 1 0 8 8 8 8 0 0 0-8-8zm-1 3h2v2h-2zm0 4h2v6h-2z"/></svg>
                    )}
                  </div>
                </div>

                {/* Message Content */}
                <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 px-1 mb-1.5">
                    <span className="text-[11px] font-black text-stone-900 uppercase tracking-tight">{senderName}</span>
                    <span className="text-[9px] font-bold text-stone-300 uppercase tracking-tighter">
                      {m.created_at ? formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: fr }) : 'À l\'instant'}
                    </span>
                  </div>
                  
                  <div className={`px-5 py-3.5 rounded-[22px] shadow-sm text-sm leading-relaxed ${
                    isUser 
                      ? 'bg-orange-500 text-white rounded-tr-none shadow-orange-200/50' 
                      : 'bg-white text-stone-800 border border-stone-100 rounded-tl-none'
                  }`}>
                    {m.role === 'assistant' ? renderMarkdown(m.content) : m.content}
                    {m.role === 'user' && (m as any).attachment_url && (
                      <AttachmentBubble url={(m as any).attachment_url} name={(m as any).attachment_name} type={(m as any).attachment_type} isMe />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="flex max-w-[800px] gap-4">
              <div className="w-9 h-9 rounded-2xl shrink-0 flex items-center justify-center bg-orange-500 text-white shadow-md">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 1-10 10A10 10 0 0 1 12 2zm0 2a8 8 0 1 0 8 8 8 8 0 0 0-8-8zm-1 3h2v2h-2zm0 4h2v6h-2z"/></svg>
              </div>
              <div className="px-6 py-4 rounded-2xl bg-white border border-orange-100 text-stone-500 text-sm flex items-center gap-3 shadow-sm italic">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" />
                </div>
                Galineo réfléchit...
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Input - Fixé et Flottant sur mobile */}
      <div className="fixed lg:relative bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] lg:bottom-0 inset-x-0 px-4 lg:px-8 pb-4 lg:pb-8 pt-3 bg-white/60 backdrop-blur-md border-t border-stone-100 shrink-0 z-10">
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.txt,.csv,.md,.docx,.xlsx" onChange={handleFileChange} />
        <div className="max-w-4xl mx-auto">
          {pendingFile && (
            <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-700 font-medium">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
              <span className="truncate max-w-[200px]">{pendingFile.name}</span>
              <button type="button" onClick={() => setPendingFile(null)} className="ml-auto text-orange-400 hover:text-orange-600">✕</button>
            </div>
          )}
          <div className="flex gap-2.5">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="w-10 h-10 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-500 rounded-xl flex items-center justify-center transition-all shrink-0">
              {uploading
                ? <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                : <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
              }
            </button>
            <textarea
              value={input}
              rows={1}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="Échange avec l'IA..."
              className="flex-1 resize-none bg-stone-50 border border-stone-200 rounded-2xl px-5 py-2.5 shadow-inner text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 overflow-hidden transition-all"
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
            <button
              onClick={send}
              disabled={(!input.trim() && !pendingFile) || loading}
              className="w-10 h-10 bg-orange-500 hover:bg-orange-600 text-white rounded-xl flex items-center justify-center transition-all shrink-0 active:scale-90 shadow-lg shadow-orange-500/20"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
