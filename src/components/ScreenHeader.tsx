import type { ReactNode } from 'react';

interface Props {
  left?: ReactNode;
  right?: ReactNode;
  center?: ReactNode;
}

export default function ScreenHeader({ left, right, center }: Props) {
  return (
    <header
      className="shrink-0 flex items-center justify-between px-4 pb-6"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
    >
      <div className="min-w-[60px] flex items-center justify-start">
        {left}
      </div>
      {center && (
        <div className="flex-1 flex items-center justify-center">
          {center}
        </div>
      )}
      <div className="min-w-[60px] flex items-center justify-end">
        {right}
      </div>
    </header>
  );
}
