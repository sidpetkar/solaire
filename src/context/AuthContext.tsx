import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { syncFromCloud, uploadAllLocalToCloud, syncEditStatesFromCloud } from '../services/cloudSync';

const ADMIN_EMAIL = 'siddhantpetkar@gmail.com';
const GUEST_KEY = 'solaire_guest';
const SYNCED_KEY = 'solaire_cloud_synced';

interface AuthState {
  user: User | null;
  isGuest: boolean;
  isAdmin: boolean;
  loading: boolean;
  syncing: boolean;
  signInWithGoogle: () => Promise<void>;
  skip: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem(GUEST_KEY) === '1');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const syncedRef = useRef(false);

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

  useEffect(() => {
    if (!user || syncedRef.current) return;
    syncedRef.current = true;

    async function doSync() {
      setSyncing(true);
      try {
        const hasSyncedBefore = localStorage.getItem(`${SYNCED_KEY}_${user!.uid}`);

        if (!hasSyncedBefore) {
          await uploadAllLocalToCloud(user!.uid);
          localStorage.setItem(`${SYNCED_KEY}_${user!.uid}`, '1');
        }

        const count = await syncFromCloud(user!.uid);
        await syncEditStatesFromCloud(user!.uid);
        if (count > 0) {
          window.dispatchEvent(new Event('solaire-cloud-sync'));
        }
      } catch (err) {
        console.error('Cloud sync error:', err);
      } finally {
        setSyncing(false);
      }
    }

    doSync();
  }, [user]);

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
    syncedRef.current = false;
    localStorage.removeItem(GUEST_KEY);
    setIsGuest(false);
  }, []);

  const isAdmin = user?.email === ADMIN_EMAIL;

  return (
    <AuthContext.Provider
      value={{ user, isGuest, isAdmin, loading, syncing, signInWithGoogle, skip, signOut }}
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
