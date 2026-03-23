'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  Auth
} from 'firebase/auth';
import { ref, get, Database } from 'firebase/database';
import { auth, database, isFirebaseConfigured, initFirebase, initError } from '@/lib/firebase';

interface AdminUser {
  uid: string;
  email: string;
  name: string;
  role: 'admin';
}

interface AuthContextType {
  user: User | null;
  adminData: AdminUser | null;
  loading: boolean;
  signIn: (email: string, password: string, remember?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
  firebaseError: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [adminData, setAdminData] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [firebaseError, setFirebaseError] = useState(false);

  useEffect(() => {
    // Check if Firebase is properly configured
    if (!isFirebaseConfigured() || initError) {
      setFirebaseError(true);
      setLoading(false);
      return;
    }

    if (!auth) {
      setFirebaseError(true);
      setLoading(false);
      return;
    }

    let unsubscribe = () => {};
    
    try {
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        setUser(user);
        if (user && database) {
          try {
            const adminRef = ref(database, `users/${user.uid}`);
            const snapshot = await get(adminRef);
            if (snapshot.exists()) {
              setAdminData(snapshot.val() as AdminUser);
            }
          } catch (err) {
            console.error('Error fetching admin data:', err);
          }
        } else {
          setAdminData(null);
        }
        setLoading(false);
      }, (error) => {
        console.error('Auth state error:', error);
        setFirebaseError(true);
        setLoading(false);
      });
    } catch (err) {
      console.error('Firebase initialization error:', err);
      setFirebaseError(true);
      setLoading(false);
    }

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string, remember: boolean = true) => {
    if (!auth || !database) {
      setError('Firebase tidak terkonfigurasi');
      return;
    }

    setError(null);
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      const adminRef = ref(database, `users/${result.user.uid}`);
      const snapshot = await get(adminRef);
      
      if (!snapshot.exists()) {
        await firebaseSignOut(auth);
        throw new Error('Email tidak terdaftar sebagai admin');
      }
      
      const userData = snapshot.val() as AdminUser;
      if (userData.role !== 'admin') {
        await firebaseSignOut(auth);
        throw new Error('Anda tidak memiliki akses admin');
      }
      
      setAdminData(userData);
    } catch (err: any) {
      console.error('Sign in error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('Email tidak terdaftar');
      } else if (err.code === 'auth/wrong-password') {
        setError('Password salah');
      } else if (err.code === 'auth/invalid-email') {
        setError('Format email tidak valid');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Email atau password salah');
      } else {
        setError(err.message || 'Terjadi kesalahan server');
      }
      throw err;
    }
  };

  const signOut = async () => {
    if (!auth) return;
    
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setAdminData(null);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, adminData, loading, signIn, signOut, error, firebaseError }}>
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
