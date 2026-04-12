const getApiBase = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('localhost')) return envUrl.replace(/\/$/, '');
  
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return 'https://galineo-api.onrender.com';
  }
  return 'http://localhost:3001';
};

const API_URL = getApiBase();

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('galineo_token');
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const cleanApiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');
  const finalUrl = `${cleanApiUrl}/${cleanPath}`;
  console.log('📡 Appel API vers :', finalUrl);
  const res = await fetch(finalUrl, { cache: 'no-store', ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Erreur serveur');
  return data;
}

export const api = {
  get:    (path: string)                  => request(path),
  post:   (path: string, body: unknown)   => request(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (path: string, body: unknown)   => request(path, { method: 'PUT',    body: JSON.stringify(body) }),
  patch:  (path: string, body: unknown)   => request(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: (path: string)                  => request(path, { method: 'DELETE' }),
};
