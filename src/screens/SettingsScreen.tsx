import { useState, useEffect } from 'react';
import { ArrowLeft, SignOut, Crown } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import ScreenShell from '../components/ScreenShell';
import ScreenHeader from '../components/ScreenHeader';
import { initLUTs, getAllCategoryNames, getCategoryLutCount } from '../engine/lutManager';
import { useCategoryPrefs } from '../hooks/useCategoryPrefs';
import { useWatermarkPref, canRemoveWatermark } from '../hooks/useWatermarkPref';
import { useAuth } from '../context/AuthContext';

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { user, isGuest, isAdmin, signOut } = useAuth();
  const [lutsReady, setLutsReady] = useState(false);
  const { disabledCategories, toggleCategory, loaded } = useCategoryPrefs();
  const { watermarkEnabled, toggleWatermark } = useWatermarkPref();

  useEffect(() => {
    initLUTs().then(() => setLutsReady(true));
  }, []);

  const categories = lutsReady ? getAllCategoryNames() : [];
  const showWatermarkToggle = canRemoveWatermark(user?.email);

  return (
    <ScreenShell>
      <ScreenHeader
        left={
          <button onClick={() => navigate(-1)} className="text-accent">
            <ArrowLeft size={24} weight="bold" />
          </button>
        }
        center={<span className="text-sm font-medium tracking-wider">Settings</span>}
      />
      <div className="flex-1 overflow-y-auto px-5 pb-10">

        {/* Profile / Guest CTA */}
        <section className="mt-2 mb-6">
          {user ? (
            <div className="flex items-center gap-3 py-3 px-1">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-surface-lighter flex items-center justify-center text-sm font-bold text-accent">
                  {(user.displayName?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-[13px] font-medium tracking-wider text-accent">
                  {user.displayName ?? 'User'}
                </span>
                <span className="text-[10px] tracking-wider text-muted">
                  {user.email}
                </span>
              </div>
            </div>
          ) : (
            <button
              onClick={() => navigate('/auth')}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-white text-[#1f1f1f] font-semibold text-sm tracking-wide transition-opacity"
              style={{ textTransform: 'none' }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Sign in with Google
            </button>
          )}
        </section>

        {/* Remove Ads — signed-in only */}
        {user && (
          <section className="mb-6">
            <h2 className="text-[13px] tracking-widest text-muted mb-4">Subscription</h2>
            <div className="flex items-center justify-between py-3 px-1 border-b border-white/5">
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-[13px] tracking-wider font-medium text-accent flex items-center gap-2">
                  <Crown size={16} weight="fill" className="text-amber-400/60" />
                  Remove Ads
                </span>
                <span className="text-[10px] tracking-wider text-muted">
                  Coming soon
                </span>
              </div>
              <div className="w-10 h-[22px] rounded-full relative bg-surface-lighter">
                <div className="absolute top-[3px] translate-x-[3px] w-4 h-4 rounded-full bg-white/40 shadow" />
              </div>
            </div>
          </section>
        )}

        {/* Watermark — admin only */}
        {showWatermarkToggle && (
          <section className="mb-6">
            <h2 className="text-[13px] tracking-widest text-muted mb-4">Watermark</h2>
            <button
              onClick={toggleWatermark}
              className="flex items-center justify-between w-full py-3 px-1 border-b border-white/5"
            >
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-[13px] tracking-wider font-medium text-accent">
                  Remove watermark
                </span>
                <span className="text-[10px] tracking-wider text-muted">
                  Admin override
                </span>
              </div>
              <div
                className={`w-10 h-[22px] rounded-full relative transition-colors duration-200 ${
                  !watermarkEnabled ? 'bg-amber-400' : 'bg-surface-lighter'
                }`}
              >
                <div
                  className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    !watermarkEnabled ? 'translate-x-[21px]' : 'translate-x-[3px]'
                  }`}
                />
              </div>
            </button>
          </section>
        )}

        {/* LUT Packs */}
        <section>
          <h2 className="text-[13px] tracking-widest text-muted mb-4">Lut Packs</h2>

          {!lutsReady || !loaded ? (
            <p className="text-[11px] text-muted tracking-wider animate-pulse">Loading categories...</p>
          ) : categories.length === 0 ? (
            <p className="text-[11px] text-muted tracking-wider">No LUT packs found</p>
          ) : (
            <div className="flex flex-col gap-1">
              {categories.map((cat) => {
                const enabled = !disabledCategories.has(cat);
                const count = getCategoryLutCount(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className="flex items-center justify-between py-3 px-1 border-b border-white/5"
                  >
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="text-[13px] tracking-wider font-medium capitalize text-accent">
                        {cat}
                      </span>
                      <span className="text-[10px] tracking-wider text-muted">
                        {count} {count === 1 ? 'filter' : 'filters'}
                      </span>
                    </div>
                    <div
                      className={`w-10 h-[22px] rounded-full relative transition-colors duration-200 ${
                        enabled ? 'bg-amber-400' : 'bg-surface-lighter'
                      }`}
                    >
                      <div
                        className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                          enabled ? 'translate-x-[21px]' : 'translate-x-[3px]'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Sign Out */}
        {user && (
          <button
            onClick={signOut}
            className="mt-8 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 text-red-400 text-sm tracking-wider font-medium"
          >
            <SignOut size={18} weight="bold" />
            Sign Out
          </button>
        )}
      </div>
    </ScreenShell>
  );
}
