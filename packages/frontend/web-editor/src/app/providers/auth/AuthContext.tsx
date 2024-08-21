import React from "react";

export type JwtToken = string | null;

export interface AuthContextProps {
  token: JwtToken;
  isAuthenticated: boolean;
  login: (token: JwtToken) => void;
  logout: () => void;
}

export const DefaultAuthContextProps: AuthContextProps = {
  token: null,
  isAuthenticated: false,
  login: () => {
    throw new Error("stub login method remains unimplemented");
  },
  logout: () => {
    throw new Error("stub logout method remains unimplemented");
  },
};

const AuthContext = React.createContext<AuthContextProps>(DefaultAuthContextProps);

export interface AuthState {
  token: JwtToken;
  isAuthenticated: boolean;
}

interface AuthProviderProps {
  children?: React.ReactNode;
}

export const AuthProvider = (props: AuthProviderProps): React.ReactElement => {
  const defaultState: AuthState = { token: null, isAuthenticated: false };

  const [authState, setAuthState] = React.useState<AuthState>(defaultState);

  const login = (token: JwtToken): void => {
    setAuthState({ token, isAuthenticated: true });
  };

  const logout = (): void => {
    setAuthState({ token: null, isAuthenticated: false });
  };

  const { children } = props;

  return <AuthContext.Provider value={{ ...authState, login, logout }}>{children}</AuthContext.Provider>;
};

export const UseAuth = (): AuthContextProps => React.useContext<AuthContextProps>(AuthContext);
