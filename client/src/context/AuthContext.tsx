import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthenticatedUser, LoginRequest, RegisterRequest } from '@nexora/shared';
import { authService } from '../services/auth.service';
import { getStoredToken } from '../services/api';
import { reconnectSocketWithAuth } from '../services/socket';

export interface AuthContextType {
  user: AuthenticatedUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;

  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check initial authentication state on mount
  useEffect(() => {
    async function loadUser() {
      const storedToken = getStoredToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await authService.getMe();
        setUser(currentUser);
        setToken(storedToken);
        reconnectSocketWithAuth(storedToken);
      } catch (err) {
        // Token expired or invalid
        authService.logout();
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = async (data: LoginRequest) => {
    const res = await authService.login(data);
    setUser(res.user);
    setToken(res.token);
    reconnectSocketWithAuth(res.token);
  };



  const register = async (data: RegisterRequest) => {
    const res = await authService.register(data);
    setUser(res.user);
    setToken(res.token);
    reconnectSocketWithAuth(res.token);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setToken(null);
    reconnectSocketWithAuth(undefined);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,

        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
