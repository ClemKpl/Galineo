type Props = {
  url: string;
  name: string;
  type: string;
  isMe?: boolean;
};

export default function AttachmentBubble({ url, name, type, isMe }: Props) {
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
  
  // Résolution de l'URL pour gérer localhost en prod/réseau local
  let finalUrl = url;
  if (url.startsWith('/')) {
    finalUrl = `${API_URL}${url}`;
  } else if (url.startsWith('http://localhost') && typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    // Si on accède depuis le réseau local (IP), remplacer localhost par l'IP du serveur
    finalUrl = url.replace('localhost', window.location.hostname);
  }

  const isImage = type?.startsWith('image/');
  const isPdf = type === 'application/pdf';

  if (isImage) {
    return (
      <a href={finalUrl} target="_blank" rel="noopener noreferrer" className="block mt-1">
        <img src={finalUrl} alt={name} className="max-w-[240px] max-h-[200px] rounded-xl object-cover border border-white/20 shadow" />
      </a>
    );
  }

  return (
    <a
      href={finalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-1 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors max-w-[240px] ${
        isMe
          ? 'bg-white/20 text-white hover:bg-white/30'
          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
      }`}
    >
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="shrink-0">
        {isPdf ? (
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1v5h5M9 13h6M9 17h4" />
        ) : (
          <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z" />
        )}
      </svg>
      <span className="truncate">{name}</span>
    </a>
  );
}
