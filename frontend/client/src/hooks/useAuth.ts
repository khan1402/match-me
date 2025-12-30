import { useState, useEffect } from "react";
import api from "@/lib/api";

interface User {
  id: number;
  email: string;
  name: string;
  profilePicture: string | null;
  hasProfile: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      setLoading(true);
      const data: any = await api.auth.me();
      setUser(data);
      setError(null);
    } catch (err: any) {
      if (err.status !== 401) {
        setError(err.message);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    try {
      await api.auth.login(email, password);
      await checkAuth();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async function register(email: string, password: string, name?: string) {
    try {
      await api.auth.register(email, password, name);
      await login(email, password);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async function logout() {
    try {
      await api.auth.logout();
      setUser(null);
      // Close WebSocket connection explicitly on logout
      const { ws } = await import("@/lib/websocket");
      ws.disconnect();
    } catch (err) {
      console.error("Logout error:", err);
      // Even if logout fails, try to close WebSocket
      try {
        const { ws } = await import("@/lib/websocket");
        ws.disconnect();
      } catch {
        // Ignore
      }
    }
  }

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refetch: checkAuth,
  };
}
