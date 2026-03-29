import { useState, useEffect, useRef } from 'react';
import type { ReactNode, MutableRefObject } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEnterFromBottomSnap } from '../hooks/useEnterFromBottomSnap';

const COLLAGES = ['/solaire-collage.png', '/solaire-collage-2.png'];
const CYCLE_MS = 4000;
/** Fixed height for stacked headline lines (36px × 1.1 × 2) */
const AUTH_HEADLINE_H = 86;

const AUTH_HEADLINE_SLIDES: ReactNode[] = [
  <>
    Made for people
    <br />
    who notice
  </>,
  <>
    Your 24/7 film lab
    <br />
    in-browser
  </>,
];

function AuthHeadline({
  frame,
  prevFrameRef,
  className,
}: {
  frame: number;
  prevFrameRef: MutableRefObject<number>;
  className?: string;
}) {
  const enterSnap = useEnterFromBottomSnap(frame);

  return (
    <div
      className={`grid overflow-hidden ${className ?? ''}`}
      style={{ height: AUTH_HEADLINE_H }}
    >
      {AUTH_HEADLINE_SLIDES.map((content, i) => {
        const active = i === frame;
        const leaving = i === prevFrameRef.current && i !== frame;
        let cls = '';
        if (active) {
          cls = enterSnap
            ? 'transition-none opacity-100 translate-y-full'
            : 'transition-all duration-500 ease-out opacity-100 translate-y-0';
        } else {
          cls = 'transition-all duration-500 ease-out ';
          if (leaving) {
            cls += 'opacity-0 -translate-y-full';
          } else {
            cls += 'opacity-0 translate-y-full pointer-events-none';
          }
        }
        return (
          <div
            key={i}
            style={{ height: AUTH_HEADLINE_H, gridArea: '1 / 1' }}
            className={cls}
          >
            <h1
              className="text-[36px] leading-[1.1] font-medium text-accent uppercase lg:whitespace-nowrap"
              style={{ letterSpacing: '-0.04em' }}
            >
              {content}
            </h1>
          </div>
        );
      })}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function AuthScreen() {
  const navigate = useNavigate();
  const { signInWithGoogle, skip, isGuest } = useAuth();
  const [busy, setBusy] = useState(false);
  const [visualFrame, setVisualFrame] = useState(0);
  const prevFrameRef = useRef(0);

  /** One layout at a time so a single AuthHeadline mounts (two instances broke enter snap / rAF on desktop). */
  const [isDesktopLayout, setIsDesktopLayout] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = () => setIsDesktopLayout(mq.matches);
    setIsDesktopLayout(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisualFrame((prev) => {
        prevFrameRef.current = prev;
        return (prev + 1) % COLLAGES.length;
      });
    }, CYCLE_MS);
    return () => clearInterval(timer);
  }, []);

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
    <div className="h-full w-full bg-surface overflow-hidden">
      {/* ─── Mobile / Tablet (< 1024px) ─── */}
      {!isDesktopLayout ? (
      <div className="h-full w-full flex justify-center">
        <div className="h-full w-full max-w-[430px] flex flex-col relative">
          <div
            className="absolute top-0 inset-x-0 z-10 pointer-events-none"
            style={{
              height: 60,
              background:
                'linear-gradient(180deg, #212421cc 0%, #21242166 40%, transparent 100%)',
            }}
          />

          <div className="relative w-full flex-1 min-h-0">
            {COLLAGES.map((src, i) => (
              <img
                key={src}
                src={src}
                alt=""
                className="absolute inset-0 w-full h-full object-cover object-left-top transition-opacity duration-1000 ease-in-out"
                style={{ opacity: visualFrame === i ? 1 : 0 }}
                draggable={false}
              />
            ))}
            <div
              className="absolute inset-x-0 bottom-0 pointer-events-none"
              style={{
                height: '70%',
                background:
                  'linear-gradient(0deg, #212421 0%, #212421f2 30%, #212421cc 50%, #21242180 70%, #21242140 85%, transparent 100%)',
              }}
            />

            <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
              <img
                src="/logo-solaire.png"
                alt="Solaire"
                className="h-9 mb-0.5"
                draggable={false}
              />
              <AuthHeadline frame={visualFrame} prevFrameRef={prevFrameRef} />
              <p
                className="mt-0.5 text-[14px] leading-snug text-white font-light uppercase text-right"
                style={{ letterSpacing: '0.5px' }}
              >
                Cinematic color science
                <br />
                for your images instantly
              </p>
            </div>
          </div>

          <div className="shrink-0 px-4 pt-6">
            <button
              onClick={handleGoogle}
              disabled={busy}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-full bg-white text-[#1f1f1f] font-semibold text-sm disabled:opacity-60 transition-opacity"
              style={{ textTransform: 'none', letterSpacing: 0 }}
            >
              <GoogleIcon />
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
                paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
                textTransform: 'uppercase',
                letterSpacing: 0,
              }}
            >
              By signing in, you agree to our
              <br />
              <Link to="/terms" className="underline text-muted/80">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="underline text-muted/80">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
      ) : (
      /* ─── Desktop (>= 1024px) ─── */
      <div className="flex h-full w-full">
        {/* Left 65% — collages */}
        <div className="w-[65%] relative h-full overflow-hidden">
          <img
            src={COLLAGES[0]}
            alt=""
            className="absolute top-0 left-0 w-[42%] max-w-[480px]"
            draggable={false}
          />
          <img
            src={COLLAGES[1]}
            alt=""
            className="absolute bottom-0 right-[8%] w-[42%] max-w-[480px]"
            style={{ marginBottom: '-1px' }}
            draggable={false}
          />

          <div
            className="absolute top-0 inset-x-0 h-[18%] pointer-events-none z-10"
            style={{
              background:
                'linear-gradient(to bottom, #212421 0%, #212421cc 40%, transparent 100%)',
            }}
          />
          <div
            className="absolute bottom-0 inset-x-0 h-[18%] pointer-events-none z-10"
            style={{
              background:
                'linear-gradient(to top, #212421 0%, #212421cc 40%, transparent 100%)',
            }}
          />
        </div>

        {/* Right 35% — content */}
        <div className="w-[35%] shrink-0 h-full flex flex-col justify-center items-start px-12">
          <img
            src="/logo-solaire.png"
            alt="Solaire"
            className="h-9 mb-0.5"
            draggable={false}
          />
          <AuthHeadline frame={visualFrame} prevFrameRef={prevFrameRef} />
          <p
            className="mt-0.5 text-[14px] leading-snug text-white font-light uppercase self-end text-right whitespace-nowrap"
            style={{ letterSpacing: '0.5px' }}
          >
            Cinematic color science
            <br />
            for your images instantly
          </p>

          <div className="w-full mt-10">
            <button
              onClick={handleGoogle}
              disabled={busy}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-full bg-white text-[#1f1f1f] font-semibold text-sm whitespace-nowrap disabled:opacity-60 transition-opacity"
              style={{ textTransform: 'none', letterSpacing: 0 }}
            >
              <GoogleIcon />
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
              className="text-center text-[10px] text-muted/60 whitespace-nowrap"
              style={{ textTransform: 'uppercase', letterSpacing: 0 }}
            >
              By signing in, you agree to our
              <br />
              <Link to="/terms" className="underline text-muted/80">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="underline text-muted/80">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
