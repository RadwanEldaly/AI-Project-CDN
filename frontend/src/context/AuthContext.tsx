import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, UserSummary } from '../api/client';

interface AuthContextType {
  user: UserSummary | null;
  profile: any | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  setUserState: (user: UserSummary | null, profile: any | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshUser: async () => {},
  logout: async () => {},
  setUserState: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const data = await api.auth.getMe();
      if (data && data.user) {
        setUser(data.user);
        setProfile(data.profile);
      } else {
        setUser(null);
        setProfile(null);
      }
    } catch {
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    } finally {
      setUser(null);
      setProfile(null);
    }
  };

  const setUserState = (u: UserSummary | null, p: any | null) => {
    setUser(u);
    setProfile(p);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshUser, logout, setUserState }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
