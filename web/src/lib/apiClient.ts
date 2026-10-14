const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('authToken');
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let body: { error?: { code?: string; message?: string } } | null = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    // Gecersiz/suresi dolmus token: oturumu temizle ve giris sayfasina yonlendir.
    // auth/login ve auth/register uc noktalari haric tutulur; aksi halde basarisiz
    // bir giris denemesi LoginPage'in kendi hata gosterimini engelleyip
    // dogrudan global yonlendirmeyi tetikler.
    const isAuthEndpoint = path === '/api/v1/auth/login' || path === '/api/v1/auth/register';
    if (response.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('authToken');
      if (window.location.pathname !== '/giris') {
        window.location.assign('/giris');
      }
    }

    throw new ApiError(
      body?.error?.code ?? 'UNKNOWN',
      body?.error?.message ?? 'Bilinmeyen bir hata oluştu.',
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}
