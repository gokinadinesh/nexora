import { auth } from '../config/firebase';

const TOKEN_KEY = 'nexora_auth_token';
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Returns fresh Firebase ID token if available, otherwise cached token.
 */
export async function getIdToken(): Promise<string | null> {
  if (auth.currentUser) {
    try {
      const freshToken = await auth.currentUser.getIdToken();
      setStoredToken(freshToken);
      return freshToken;
    } catch {
      return getStoredToken();
    }
  }
  return getStoredToken();
}

export function getApiUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
}

export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getIdToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const url = getApiUrl(endpoint);
  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data = null;
  const contentType = response.headers.get('content-type');

  try {
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      // If the response is ok but not JSON (like an HTML fallback from a SPA router), it's an error for an API
      if (response.ok && text.trim().startsWith('<')) {
        throw new Error('API route not found. Received HTML instead of JSON. Ensure the backend is deployed and VITE_API_URL is set.');
      }
      data = { message: text };
    }
  } catch (err: any) {
    if (err.name !== 'Error') {
      data = { message: 'Invalid JSON response from server' };
    } else {
      throw err;
    }
  }

  if (!response.ok) {
    const errorMessage = data?.message || data?.error || `Request failed with status ${response.status}`;
    const error: any = new Error(errorMessage);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data as T;
}
