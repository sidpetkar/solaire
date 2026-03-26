import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Crown, Check } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { startSubscription } from '../services/razorpay';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PLANS = [
  {
    id: 'monthly' as const,
    name: 'Monthly',
    price: '₹99',
    period: '/month',
    badge: null,
  },
  {
    id: 'annual' as const,
    name: 'Annual',
    price: '₹799',
    period: '/year',
    badge: 'Save 33%',
  },
];

const FEATURES = [
  'No watermark on exports',
  'All LUT filter packs',
  'Full adjustment tools',
  'Priority AI editing',
];

export default function PricingModal({ open, onClose }: Props) {
  const { user, signInWithGoogle } = useAuth();
  const { refresh } = useSubscription();
  const [selected, setSelected] = useState<'monthly' | 'annual'>('annual');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [sheetIn, setSheetIn] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (open) {
      setVisible(true);
      setError(null);
      timerRef.current = setTimeout(() => setSheetIn(true), 20);
    } else {
      setSheetIn(false);
      timerRef.current = setTimeout(() => setVisible(false), 350);
    }
    return () => clearTimeout(timerRef.current);
  }, [open]);

  const handleSubscribe = useCallback(async () => {
    let currentUser = user;

    if (!currentUser) {
      try {
        setProcessing(true);
        setError(null);
        currentUser = await signInWithGoogle();
        if (!currentUser) {
          setProcessing(false);
          return;
        }
      } catch {
        setError('Sign in failed. Please try again.');
        setProcessing(false);
        return;
      }
    }

    setProcessing(true);
    setError(null);

    try {
      await startSubscription(selected, currentUser);
      await refresh();
      onClose();
    } catch (err: any) {
      if (err.message === 'Payment cancelled') {
        setProcessing(false);
        return;
      }
      setError(err.message || 'Something went wrong');
    } finally {
      setProcessing(false);
    }
  }, [user, selected, refresh, onClose, signInWithGoogle]);

  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !processing) onClose();
    },
    [onClose, processing],
  );

  if (!visible) return null;

  return (
    <>
      {/* Mobile: bottom sheet */}
      <div
        className="md:hidden fixed inset-0 z-50 flex items-end justify-center"
        style={{
          backgroundColor: sheetIn ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
          transition: 'background-color 0.35s ease',
        }}
        onClick={handleBackdrop}
      >
        <div
          className="w-full max-w-md bg-surface rounded-t-2xl px-5 pt-6 pb-8 will-change-transform"
          style={{
            transform: sheetIn ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <PricingContent
            selected={selected}
            onSelect={setSelected}
            onSubscribe={handleSubscribe}
            processing={processing}
            error={error}
            needsSignIn={!user}
          />
        </div>
      </div>

      {/* Desktop: centered popup */}
      <div
        className="hidden md:flex fixed inset-0 z-50 items-center justify-center"
        style={{
          backgroundColor: sheetIn ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
          transition: 'background-color 0.3s ease',
        }}
        onClick={handleBackdrop}
      >
        <div
          className="w-[420px] bg-surface rounded-2xl px-6 pt-5 pb-6 shadow-2xl"
          style={{
            transform: sheetIn ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(12px)',
            opacity: sheetIn ? 1 : 0,
            transition: 'transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.25s ease',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Crown size={20} weight="fill" className="text-amber-400" />
              <h3 className="text-sm font-medium tracking-wider text-accent uppercase">
                Solaire Pro
              </h3>
            </div>
            <button
              onClick={onClose}
              disabled={processing}
              className="text-accent/60 hover:text-accent p-1"
            >
              <X size={18} weight="bold" />
            </button>
          </div>
          <PricingContent
            selected={selected}
            onSelect={setSelected}
            onSubscribe={handleSubscribe}
            processing={processing}
            error={error}
            needsSignIn={!user}
          />
        </div>
      </div>
    </>
  );
}

function PricingContent({
  selected,
  onSelect,
  onSubscribe,
  processing,
  error,
  needsSignIn,
}: {
  selected: 'monthly' | 'annual';
  onSelect: (plan: 'monthly' | 'annual') => void;
  onSubscribe: () => void;
  processing: boolean;
  error: string | null;
  needsSignIn: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 md:hidden justify-center mb-1">
        <Crown size={20} weight="fill" className="text-amber-400" />
        <h3 className="text-sm font-medium tracking-wider text-accent uppercase">
          Solaire Pro
        </h3>
      </div>

      {/* Plan selector */}
      <div className="flex gap-3">
        {PLANS.map((plan) => (
          <button
            key={plan.id}
            onClick={() => onSelect(plan.id)}
            disabled={processing}
            className={`flex-1 relative rounded-xl border-2 px-4 py-4 text-left transition-all duration-200 ${
              selected === plan.id
                ? 'border-amber-400 bg-amber-400/10'
                : 'border-white/10 bg-surface-lighter hover:border-white/20'
            }`}
          >
            {plan.badge && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-400 text-surface text-[9px] font-bold tracking-wider px-2.5 py-0.5 rounded-full uppercase whitespace-nowrap">
                {plan.badge}
              </span>
            )}
            <span className="block text-[12px] tracking-wider text-muted/80 mb-1.5 normal-case">
              {plan.name}
            </span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-xl font-bold text-accent">
                {plan.price}
              </span>
              <span className="text-[11px] text-muted/70 tracking-wider normal-case">
                {plan.period}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Features list */}
      <div className="flex flex-col gap-2.5 py-2">
        {FEATURES.map((feature) => (
          <div key={feature} className="flex items-center gap-3">
            <Check size={15} weight="bold" className="text-amber-400 shrink-0" />
            <span className="text-[13px] tracking-wide text-accent/90 normal-case">
              {feature}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <p className="text-[12px] tracking-wide text-red-400 text-center normal-case px-2">
          {error}
        </p>
      )}

      {/* Subscribe button */}
      <button
        onClick={onSubscribe}
        disabled={processing}
        className={`w-full py-4 rounded-xl font-semibold text-[15px] tracking-wide transition-all duration-200 ${
          processing
            ? 'bg-amber-400/50 text-surface/70 cursor-wait'
            : 'bg-amber-400 text-surface hover:bg-amber-300 active:scale-[0.98]'
        }`}
      >
        {processing
          ? 'Processing...'
          : needsSignIn
            ? `Sign in & Subscribe — ${selected === 'monthly' ? '₹99/mo' : '₹799/yr'}`
            : `Subscribe — ${selected === 'monthly' ? '₹99/mo' : '₹799/yr'}`}
      </button>

      <div className="flex items-center justify-center gap-1.5 pt-0.5">
        <span className="text-[11px] tracking-wide text-white/40 normal-case">
          Cancel anytime. Powered by
        </span>
        <img
          src="/razorpay-logo.png"
          alt="Razorpay"
          className="h-[14px] inline-block"
          style={{ mixBlendMode: 'screen' }}
        />
      </div>
    </div>
  );
}
