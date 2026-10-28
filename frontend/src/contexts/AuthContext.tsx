"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { apiFetch, configureAuthBindings, refreshAccessToken } from "@/lib/apiClient";

export interface Teacher {
  id: string;
  email: string;
  fullName: string;
  role: "TEACHER" | "ADMIN";  // RBAC
  isActive: boolean;
  phone?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
}

interface AuthContextType {
  teacher: Teacher | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const tokenRef = useRef<string | null>(null);
  tokenRef.current = accessToken;

  const setToken = useCallback((newToken: string | null) => {
    tokenRef.current = newToken;
    setAccessTokenState(newToken);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST", skipAuth: true });
    } catch {
      // Ignore network errors on logout
    } finally {
      tokenRef.current = null;
      setAccessTokenState(null);
      setTeacher(null);
    }
  }, []);

  useEffect(() => {
    configureAuthBindings({
      getToken: () => tokenRef.current,
      setToken: (t) => {
        tokenRef.current = t;
        setAccessTokenState(t);
      },
      onLogout: () => {
        tokenRef.current = null;
        setAccessTokenState(null);
        setTeacher(null);
      },
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    const res = await apiFetch<Teacher>("/api/auth/me");
    if (res.success && res.data) {
      setTeacher(res.data);
    } else {
      setTeacher(null);
      setToken(null);
    }
  }, [setToken]);

  // Initial silent auth check via refresh token cookie
  useEffect(() => {
    let mounted = true;
    async function initAuth() {
      try {
        const token = await refreshAccessToken();
        if (token && mounted) {
          setToken(token);
          const meRes = await apiFetch<Teacher>("/api/auth/me");
          if (meRes.success && meRes.data && mounted) {
            setTeacher(meRes.data);
          }
        }
      } catch {
        // User not logged in, ignore
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    initAuth();
    return () => {
      mounted = false;
    };
  }, [setToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const res = await apiFetch<{ accessToken: string; teacher: Teacher }>("/api/auth/login", {
          method: "POST",
          skipAuth: true,
          body: JSON.stringify({ email, password }),
        });

        if (res.success && res.data) {
          setToken(res.data.accessToken);
          setTeacher(res.data.teacher);
          setIsLoading(false);
          return { success: true };
        } else {
          setIsLoading(false);
          return {
            success: false,
            error: res.error?.message || "Email atau password salah.",
          };
        }
      } catch (err: any) {
        setIsLoading(false);
        return {
          success: false,
          error: err?.message || "Terjadi kesalahan saat login",
        };
      }
    },
    [setToken]
  );

  return (
    <AuthContext.Provider
      value={{
        teacher,
        accessToken,
        isLoading,
        isAuthenticated: !!teacher && !!accessToken,
        login,
        logout: handleLogout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useTeacherAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useTeacherAuth must be used within an AuthProvider");
  }
  return context;
}
