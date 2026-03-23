import { Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import EditScreen from './screens/EditScreen';
import CameraScreen from './screens/CameraScreen';
import SettingsScreen from './screens/SettingsScreen';

export default function App() {
  const { user, isGuest, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-full w-full bg-surface flex items-center justify-center">
        <span className="text-xs text-muted tracking-widest animate-pulse">KAPTURA</span>
      </div>
    );
  }

  if (!user && !isGuest) {
    return <AuthScreen />;
  }

  return (
    <div className="h-full w-full bg-surface overflow-hidden relative">
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/edit" element={<EditScreen />} />
        <Route path="/camera" element={<CameraScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/auth" element={<AuthScreen />} />
      </Routes>
    </div>
  );
}
