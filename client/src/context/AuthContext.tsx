import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthenticatedUser, LoginRequest, RegisterRequest } from '@nexora/shared';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { authService } from '../services/auth.service';
import { getStoredToken, setStoredToken, clearStoredToken } from '../services/api';
import { reconnectSocketWithAuth } from '../services/socket';

export interface AuthContextType {
  user: AuthenticatedUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          setStoredToken(idToken);
          setToken(idToken);

          // Verify with backend to get rich operative profile & role
          const syncRes = await authService.verifySession(idToken);
          setUser(syncRes.user);
          reconnectSocketWithAuth(idToken);
        } catch (err) {
          console.warn('Backend session verification failed, using Firebase credentials:', err);
          // Fallback to basic user identity from Firebase Auth
          const fallbackUser: AuthenticatedUser = {
            id: firebaseUser.uid,
            username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Operative',
            email: firebaseUser.email || '',
            role: 'PLAYER',
          };
          setUser(fallbackUser);
        }
      } else {
        clearStoredToken();
        setUser(null);
        setToken(null);
        reconnectSocketWithAuth(undefined);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
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

  const loginWithGoogle = async () => {
    const res = await authService.loginWithGoogle();
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
        loginWithGoogle,
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
