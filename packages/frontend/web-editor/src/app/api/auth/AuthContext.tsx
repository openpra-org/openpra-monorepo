import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AuthToken } from "shared-types";
import { ApiManager } from "shared-sdk/lib/api/ApiManager";
import { AuthService } from "shared-sdk/lib/api/AuthService";
interface AuthContextValue {
  user: AuthToken | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthToken | null>(() => {
    return ApiManager.isLoggedIn() ? AuthService.getProfile() : null;
  });
  const login = useCallback(async (username: string, password: string): Promise<void> => {
    await ApiManager.signInWithUsernameAndPassword(username, password);
    setUser(AuthService.getProfile());
  }, []);
  const logout = useCallback((): void => {
    ApiManager.logout();
    setUser(null);
  }, []);
  useEffect(() => {
    const timer = ApiManager.getTokenTimer();
    if (timer > 0) {
      const id = setTimeout(() => {
        logout();
      }, timer * 1000);
      return () => clearTimeout(id);
    }
  }, [user, logout]);
  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
