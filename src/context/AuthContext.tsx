import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

const ADMIN_EMAIL = 'siddhantpetkar@gmail.com';
const GUEST_KEY = 'kaptura_guest';

interface AuthState {
  user: User | null;
  isGuest: boolean;
  isAdmin: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  skip: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem(GUEST_KEY) === '1');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        localStorage.removeItem(GUEST_KEY);
        setIsGuest(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!auth) {
      console.warn('Firebase auth not initialized');
      return;
    }
    await signInWithPopup(auth, googleProvider);
  }, []);

  const skip = useCallback(() => {
    localStorage.setItem(GUEST_KEY, '1');
    setIsGuest(true);
  }, []);

  const signOut = useCallback(async () => {
    if (auth) await fbSignOut(auth);
    setUser(null);
    localStorage.removeItem(GUEST_KEY);
    setIsGuest(false);
  }, []);

  const isAdmin = user?.email === ADMIN_EMAIL;

  return (
    <AuthContext.Provider
      value={{ user, isGuest, isAdmin, loading, signInWithGoogle, skip, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
