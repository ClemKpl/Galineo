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

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const cleanPath = path.replace(/^\//, '');
  const finalUrl = `${API_URL}/${cleanPath}`;
  
  console.log('📡 Appel API vers :', finalUrl);
  const res = await fetch(finalUrl, { cache: 'no-store', ...options, headers });
  
  // Certains terminaux renvoient du vide en cas de 204 No Content
  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message || data.error || 'Erreur serveur', res.status);
  }
  return data;
}

export const api = {
  get:    (path: string)                  => request(path),
  post:   (path: string, body: unknown)   => request(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (path: string, body: unknown)   => request(path, { method: 'PUT',    body: JSON.stringify(body) }),
  patch:  (path: string, body: unknown)   => request(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: (path: string)                  => request(path, { method: 'DELETE' }),
};
