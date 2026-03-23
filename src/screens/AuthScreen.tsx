import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthScreen() {
  const navigate = useNavigate();
  const { signInWithGoogle, skip, isGuest } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleGoogle = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
      if (isGuest) navigate('/');
    } catch (err) {
      console.error('Google sign-in failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = () => {
    if (isGuest) {
      navigate(-1);
    } else {
      skip();
    }
  };

  return (
    <div className="h-full w-full bg-surface flex justify-center overflow-hidden">
      <div className="h-full w-full max-w-[430px] flex flex-col relative">
        {/* Subtle top fade */}
        <div
          className="absolute top-0 inset-x-0 z-10 pointer-events-none"
          style={{
            height: 60,
            background: 'linear-gradient(180deg, #212421cc 0%, #21242166 40%, transparent 100%)',
          }}
        />

        {/* Collage image — flex-1 takes available space */}
        <div className="relative w-full flex-1 min-h-0">
          <img
            src="/kaptura-collage.png"
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-left-top"
            draggable={false}
          />
          <div
            className="absolute inset-x-0 bottom-0 pointer-events-none"
            style={{
              height: '60%',
              background:
                'linear-gradient(0deg, #212421 0%, #212421e6 25%, #21242199 55%, #21242140 75%, transparent 100%)',
            }}
          />

          <div className="absolute inset-x-0 bottom-0 px-6 pb-4">
            <h1 className="text-[28px] leading-[1.1] font-bold text-accent uppercase">
              Your in browser
              <br />
              free luts filter
            </h1>
            <p className="mt-3 text-[13px] leading-relaxed text-accent/60 font-medium max-w-[280px] uppercase">
              Your in browser free luts filter your in browser free luts filter
            </p>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="shrink-0 px-6 pt-6">
          <button
            onClick={handleGoogle}
            disabled={busy}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-full bg-white text-[#1f1f1f] font-semibold text-sm disabled:opacity-60 transition-opacity"
            style={{ textTransform: 'none', letterSpacing: 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>

          <button
            onClick={handleSkip}
            className="w-full py-4 text-center text-sm font-semibold text-accent/80"
            style={{ letterSpacing: 0 }}
          >
            {isGuest ? 'Back' : 'Skip'}
          </button>

          <p
            className="text-center text-[10px] text-muted/60"
            style={{
              paddingBottom: `max(24px, env(safe-area-inset-bottom, 24px))`,
              textTransform: 'uppercase',
              letterSpacing: 0,
            }}
          >
            By signing in, you agree to our{' '}
            <span className="underline text-muted/80">Terms of Service</span>{' '}
            and{' '}
            <span className="underline text-muted/80">Privacy Policy</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
