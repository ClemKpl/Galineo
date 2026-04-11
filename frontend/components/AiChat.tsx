import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AttachmentBubble from '@/components/AttachmentBubble';

type Role = 'user' | 'assistant';
type Message = { role: Role; content: string; attachment_url?: string; attachment_name?: string; attachment_type?: string };

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
        <ul key={i} className="list-disc list-inside space-y-0.5 my-1">
          {items.map((it, k) => <li key={k}>{formatInline(it)}</li>)}
        </ul>
      );
    } else if (line.trim() === '') {
      result.push(<br key={i} />);
      i++;
    } else {
      result.push(<p key={i} className="leading-relaxed">{formatInline(line)}</p>);
      i++;
    }
  }
  return result;
}

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export default function AiChat() {
  const { user } = useAuth();
  const params = useParams();
  const currentProjectId = params?.id;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Bonjour ! Je suis **Galineo AI**, ton conseiller stratégique.\n\nJe suis là pour t'apporter des conseils en gestion de projet, t'aider à t'organiser ou répondre à tes questions méthodologiques.\n\n*Note : Pour agir directement sur un projet (créer des tâches, changer des dates), utilise l'Assistant dans la 'Galineo Room' de ton projet !*",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages]);

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
      const msg = err instanceof Error ? err.message : 'Erreur upload';
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${msg}` }]);
    } finally { setUploading(false); }
  };

  async function send() {
    const text = input.trim();
    if (!text && !pendingFile || loading) return;

    const userMsg: Message = { role: 'user', content: text, ...(pendingFile ?? {}) };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    const sentFile = pendingFile;
    setPendingFile(null);
    setLoading(true);

    try {
      const history = next
        .slice(1)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({
          messages: history,
          mode: 'global',
          ...(sentFile ? { attachment_url: sentFile.url, attachment_name: sentFile.name, attachment_type: sentFile.type } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* ── Bulle flottante ─────────────────────────────────────────────── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 lg:bottom-6 right-4 lg:right-6 z-40 w-14 h-14 bg-stone-900 hover:bg-stone-800 active:scale-95 text-white flex items-center justify-center rounded-2xl shadow-2xl shadow-stone-900/20 transition-all duration-300 cursor-pointer group"
          title="Galineo AI Advisor"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="relative z-10">
            <path d="M22 10L12 5L2 10L12 15L22 10z" />
            <path d="M6 12V17c0 0 3 2 6 2s6-2 6-2V12" />
          </svg>
        </button>
      )}

      {/* ── Fenêtre de chat ──────────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 lg:inset-auto lg:bottom-6 lg:right-6 z-[60] flex flex-col lg:w-[400px] lg:h-[640px] bg-white lg:rounded-3xl shadow-2xl lg:border border-stone-200 overflow-hidden animate-fadeUp">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-stone-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10a9.96 9.96 0 0 1-5.06-1.37L2 22l1.37-4.94A9.96 9.96 0 0 1 2 12C2 6.48 6.48 2 12 2z"/>
                  <path d="M8 10h.01M12 10h.01M16 10h.01" strokeLinecap="round" strokeWidth="3"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-widest leading-tight">Galineo AI</p>
                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-tighter leading-tight mt-0.5">Conseiller stratégique</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center transition-all active:scale-90"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 pt-6 pb-32 lg:pb-6 space-y-6 bg-stone-50/50 scrollbar-none relative">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeUp`}>
                {m.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-stone-900 border border-stone-800 text-white flex items-center justify-center text-[10px] font-black shrink-0 mr-3 mt-1 shadow-sm uppercase">
                    AI
                  </div>
                )}
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                    m.role === 'user'
                      ? 'bg-orange-500 text-white rounded-br-none shadow-orange-500'
                      : 'bg-white text-stone-700 border border-stone-100 rounded-bl-none'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <div className="space-y-1">{renderMarkdown(m.content)}</div>
                  ) : (
                    <>
                      {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
                      {m.attachment_url && <AttachmentBubble url={m.attachment_url} name={m.attachment_name!} type={m.attachment_type!} isMe />}
                    </>
                  )}
                </div>
                {m.role === 'user' && (
                  <div className="hidden lg:flex w-8 h-8 rounded-xl bg-orange-100 border border-orange-200 text-orange-600 items-center justify-center text-[10px] font-black shrink-0 ml-3 mt-1 shadow-sm overflow-hidden">
                    {user?.avatar ? (
                      <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      user?.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex justify-start animate-pulse">
                <div className="w-8 h-8 rounded-xl bg-stone-900 border border-stone-800 text-white flex items-center justify-center text-[10px] font-black shrink-0 mr-3 mt-1 uppercase">
                  AI
                </div>
                <div className="bg-white border border-stone-100 rounded-2xl rounded-bl-none px-5 py-4 shadow-sm">
                  <div className="flex gap-1.5 items-center">
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.3s]"/>
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.15s]"/>
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce"/>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input - Fixé au dessus de la nav mobile */}
          <div className="fixed lg:relative bottom-[93px] lg:bottom-0 inset-x-0 mx-auto w-full lg:w-auto px-4 py-4 lg:py-5 border-t border-stone-100 bg-white/95 backdrop-blur shrink-0 z-[70] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.txt,.csv,.md,.docx,.xlsx" onChange={handleFileChange} />
            {pendingFile && (
              <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-700 font-medium">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                <span className="truncate max-w-[180px]">{pendingFile.name}</span>
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
                ref={inputRef}
                rows={1}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                }}
                onKeyDown={handleKeyDown}
                placeholder="Décris ton projet…"
                disabled={loading}
                className="flex-1 resize-none bg-stone-50 border border-stone-200 rounded-2xl px-5 py-2.5 shadow-inner text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 disabled:opacity-50 overflow-hidden transition-all"
                style={{ minHeight: '40px', maxHeight: '100px' }}
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
      )}
    </>
  );
}
