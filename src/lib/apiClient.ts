const SESSION_TOKEN_KEY = 'sub_trafficker_session_token';

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // Ignore storage restriction
  }
}

export function clearSessionToken() {
  setSessionToken(null);
}

export interface ApiResponse<T = any> {
  ok: boolean;
  statusCode: number;
  data: T & { status?: boolean; message?: string };
}

export async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const resp = await fetch(url, {
    ...options,
    headers,
  });

  const data = await resp.json().catch(() => ({
    status: false,
    message: `Unexpected server response (${resp.status})`,
  }));

  return {
    ok: resp.ok,
    statusCode: resp.status,
    data,
  };
}
