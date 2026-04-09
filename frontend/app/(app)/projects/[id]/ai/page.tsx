'use client';
import { useState, useRef, useEffect, use } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  const bottomRef = useRef<HTMLDivElement>(null);

  // Ref vers le dernier message model affiché — pour détecter une nouvelle réponse IA
  const lastModelContentRef = useRef<string>('');

  useEffect(() => {
    const lastModel = [...messages].reverse().find(m => m.role === 'assistant' || m.role === 'model');
    lastModelContentRef.current = lastModel?.content ?? '';
  }, [messages]);

  useEffect(() => {
    loadHistory();
    checkActiveTask();
  }, [projectId]);

  // Recharge l'historique quand une nouvelle notification arrive (ex: réponse IA prête)
  useEffect(() => {
    function onNewNotification() {
      setLoading(false);
      loadHistory();
    }
    window.addEventListener('new-notification', onNewNotification);
    return () => window.removeEventListener('new-notification', onNewNotification);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Polling direct sur l'historique : détecte quand une nouvelle réponse IA apparaît
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(async () => {
      try {
        const data = await api.get(`/ai/history/${projectId}`);
        if (data?.history?.length > 0) {
          const lastDbMsg = data.history[data.history.length - 1];
          if (lastDbMsg.role === 'model' && lastDbMsg.content !== lastModelContentRef.current) {
            setMessages(data.history.map((h: any) => ({
              role: h.role === 'model' ? 'assistant' : 'user',
              content: h.content,
              user_name: h.user_name,
              user_avatar: h.user_avatar,
              created_at: h.created_at,
            })));
            setLoading(false);
          }
        }
      } catch {
        // silencieux, on réessaie au prochain tick
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [loading, projectId]);

  async function checkActiveTask() {
    try {
      const res = await api.get(`/ai/active-task/${projectId}`);
      if (res && res.active) {
        setLoading(true);
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
        setMessages(data.history.map((h: any) => ({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.content,
          user_name: h.user_name,
          user_avatar: h.user_avatar,
          created_at: h.created_at
        })));
      }
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setFetchingHistory(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

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
    setLoading(true);

    try {
      const history = next.map(m => ({ 
        role: m.role === 'assistant' ? 'assistant' : 'user', 
        content: m.content 
      }));

      const res = await api.post('/ai/chat', { 
        messages: history,
        projectId: projectId,
        mode: 'project'
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
    <div className="flex flex-col h-full bg-stone-50 overflow-hidden">
      {/* Header Interne (Optionnel car déjà dans Layout) */}
      <div className="px-8 py-4 bg-white border-b border-stone-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-sm">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10a9.96 9.96 0 0 1-5.06-1.37L2 22l1.37-4.94A9.96 9.96 0 0 1 2 12C2 6.48 6.48 2 12 2z"/>
              <path d="M8 10h.01M12 10h.01M16 10h.01" strokeLinecap="round" strokeWidth="2.5"/>
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-stone-900">Galineo Room</h2>
            <p className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold">Assistant IA du Projet</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <button 
             onClick={handleResetHistory}
             className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-500 hover:text-red-500 hover:border-red-100 transition-all cursor-pointer group"
             title="Réinitialiser la conversation"
           >
             <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
               <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
             </svg>
             <span className="text-[10px] font-bold uppercase tracking-wider">Réinitialiser</span>
           </button>
           <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">En ligne</span>
           </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 relative">
        {fetchingHistory && (
          <div className="absolute inset-0 bg-stone-50/80 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Synchronisation de l'historique...</p>
          </div>
        )}

        {messages.map((m, i) => {
          const isUser = m.role === 'user';
          const senderName = isUser ? (m.user_name || 'Moi') : (m.user_name || 'Galineo Room');
          const avatar = isUser ? m.user_avatar : null;

          return (
            <div key={i} className={`flex w-full group ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[85%] sm:max-w-[70%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className="shrink-0 pt-1">
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

      {/* Input */}
      <div className="p-8 bg-white border-t border-stone-200 shrink-0">
        <div className="max-w-[1000px] mx-auto relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Échange avec l'IA pour gérer ton projet..."
            className="w-full pl-5 pr-14 py-4 bg-stone-50 border border-stone-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all resize-none min-h-[60px] max-h-[200px]"
            rows={1}
            style={{ height: 'auto' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${target.scrollHeight}px`;
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-orange-500 text-white rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center hover:bg-orange-600 disabled:bg-stone-200 disabled:shadow-none transition-all cursor-pointer"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
        <p className="text-center text-[10px] text-stone-400 mt-4 uppercase tracking-[0.2em] font-bold">
          Entrée pour envoyer · Shift+Entrée pour passer à la ligne
        </p>
      </div>
    </div>
  );
}
