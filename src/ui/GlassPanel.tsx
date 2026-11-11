

'use client';

import { useState, type ReactNode } from 'react';

type Props = {
  title: string;
  side: 'tl' | 'tr' | 'bl' | 'br' | 'stack';
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
};

export default function GlassPanel({
  title,
  side,
  defaultOpen = false,
  badge,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className={`glass panel panel--${side} ${open ? 'is-open' : 'is-closed'}`}
    >
      <header
        className="panel__head"
        onClick={() => setOpen((o) => !o)}
        role="button"
        aria-expanded={open}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        <span className="panel__dot" />
        <h3 className="panel__title">{title}</h3>
        {badge}
        <span className="panel__chev">{open ? '–' : '+'}</span>
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}
