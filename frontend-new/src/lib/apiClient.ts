/**
 * EduQuas API Client — Fetch wrapper with silent token refresh & in-memory token store
 */

type TokenGetter = () => string | null;
type TokenSetter = (token: string | null) => void;
type LogoutHandler = () => void;

let getAccessToken: TokenGetter = () => null;
let setAccessToken: TokenSetter = () => {};
let onUnauthorized: LogoutHandler = () => {};

export function configureAuthBindings(bindings: {
  getToken: TokenGetter;
  setToken: TokenSetter;
  onLogout: LogoutHandler;
}) {
  getAccessToken = bindings.getToken;
  setAccessToken = bindings.setToken;
  onUnauthorized = bindings.onLogout;
}

let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        setAccessToken(null);
        onUnauthorized();
        return null;
      }

      const json = await res.json();
      const newToken = json?.data?.accessToken;
      if (newToken) {
        setAccessToken(newToken);
        return newToken;
      }
      setAccessToken(null);
      onUnauthorized();
      return null;
    } catch {
      setAccessToken(null);
      onUnauthorized();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const { skipAuth = false, headers = {}, ...rest } = options;
  const url = endpoint.startsWith("http") ? endpoint : endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has("Content-Type") && !(rest.body instanceof FormData)) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  const fetchOptions: RequestInit = {
    ...rest,
    headers: requestHeaders,
    credentials: "include",
  };

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: err?.message || "Gagal terhubung ke server",
      },
    };
  }

  // Silent refresh on 401
  if (response.status === 401 && !skipAuth && !url.includes("/api/auth/refresh") && !url.includes("/api/auth/login")) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      requestHeaders.set("Authorization", `Bearer ${newToken}`);
      try {
        response = await fetch(url, { ...fetchOptions, headers: requestHeaders });
      } catch (err: any) {
        return {
          success: false,
          error: {
            code: "NETWORK_ERROR",
            message: err?.message || "Gagal terhubung ke server setelah refresh token",
          },
        };
      }
    }
  }

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      success: false,
      error: {
        code: json?.error?.code || `HTTP_${response.status}`,
        message: json?.error?.message || response.statusText || "Terjadi kesalahan pada server",
        details: json?.error?.details,
      },
    };
  }

  return json ?? { success: true };
}

export const apiClient = {
  get: <T = any>(endpoint: string, options?: ApiRequestOptions) =>
    apiFetch<T>(endpoint, { ...options, method: "GET" }),
  post: <T = any>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: "POST",
      body: body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    }),
  put: <T = any>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    }),
  patch: <T = any>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    }),
  delete: <T = any>(endpoint: string, options?: ApiRequestOptions) =>
    apiFetch<T>(endpoint, { ...options, method: "DELETE" }),
};
