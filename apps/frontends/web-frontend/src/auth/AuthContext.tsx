import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { type LoginRequest } from "interfaces-shared-types";
import { signIn } from "./authApi";
import { isLoggedIn, removeToken, getTokenRemainingSeconds, getRoles, decodeToken } from "./authStorage";

interface AuthUser {
  username?: string;
  email?: string;
  roles: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (payload: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (!isLoggedIn()) return null;
    const payload = decodeToken();
    return payload ? { username: payload.username, email: payload.email, roles: payload.roles ?? ["member-role"] } : null;
  });

  const login = useCallback(async (payload: LoginRequest): Promise<void> => {
    await signIn(payload);
    const decoded = decodeToken();
    setUser(decoded ? { username: decoded.username, email: decoded.email, roles: decoded.roles ?? ["member-role"] } : null);
  }, []);

  const logout = useCallback((): void => {
    removeToken();
    setUser(null);
  }, []);

  useEffect(() => {
    const remaining = getTokenRemainingSeconds();
    if (remaining > 0) {
      const id = setTimeout(() => { logout(); }, remaining * 1000);
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

export { getRoles };
