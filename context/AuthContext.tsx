import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type UserContextType = {
  username: string | null;
  login: (name: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
};

const AuthContext = createContext<UserContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const storedUser = await AsyncStorage.getItem('panaderia_user');
      if (storedUser) {
        setUsername(storedUser);
      }
    } catch (e) {
      console.error('Failed to load user', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(name: string) {
    try {
      await AsyncStorage.setItem('panaderia_user', name);
      // Optional: Create profile in Supabase if not exists, but for now just local persist + name usage
      // We can also upsert to profiles table to track users
      await supabase.from('profiles').upsert({ username: name }, { onConflict: 'username' });
      
      setUsername(name);
    } catch (e) {
      console.error('Failed to login', e);
      throw e;
    }
  }

  async function logout() {
    try {
      await AsyncStorage.removeItem('panaderia_user');
      setUsername(null);
    } catch (e) {
      console.error('Failed to logout', e);
    }
  }

  return (
    <AuthContext.Provider value={{ username, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
