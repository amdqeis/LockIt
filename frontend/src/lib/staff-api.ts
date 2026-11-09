import { ApiError } from "./api";

let refreshing: Promise<boolean> | null = null;
async function refreshSession() {
  if (!refreshing) refreshing = fetch("/api/auth/refresh", { method: "POST", credentials: "include" }).then(r => r.ok).catch(() => false).finally(() => { refreshing = null; });
  return refreshing;
}
export async function staffApi<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { ...options, credentials: "include", cache: "no-store" }); }
  catch { throw new ApiError("Tidak dapat terhubung. Periksa koneksi Anda.", "NETWORK_ERROR"); }
  if (response.status === 401 && retry && !["/api/auth/login", "/api/auth/logout", "/api/auth/refresh"].includes(path)) {
    if (await refreshSession()) return staffApi<T>(path, options, false);
    throw new ApiError("Sesi berakhir. Silakan masuk kembali.", "UNAUTHORIZED", 401);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) throw new ApiError(body?.error?.message || "Permintaan tidak dapat diproses.", body?.error?.code || "", response.status);
  return body.data as T;
}
export function staffSend<T>(path: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown) {
  return staffApi<T>(path, { method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
}

export async function staffDownload(path: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: "include", cache: "no-store" });
    if (response.status === 401 && await refreshSession()) response = await fetch(path, { credentials: "include", cache: "no-store" });
  } catch { throw new ApiError("Tidak dapat terhubung. Periksa koneksi Anda.", "NETWORK_ERROR"); }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.error?.message || "Unduhan belum dapat diproses.", body?.error?.code || "", response.status);
  }
  return response.blob();
}
