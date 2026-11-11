'use client';


import type { CSSProperties } from 'react';

const WORD = 'AES-CERT';
const SLOGAN = 'VOIR PLUS TÔT · AGIR PLUS VITE · RESTER SOUVERAIN';

export default function AesTitleIntro({ onSkip }: { onSkip?: () => void }) {
  return (
    <div
      className="aesi-root"
      onClick={onSkip}
      role="presentation"
      title="Cliquer pour passer"
    >
      <div className="aesi-bg" />
      <div className="aesi-grid" />

      <div className="aesi-tag">SYSTÈME DE CYBERRENSEIGNEMENT</div>

      <div className="aesi-word">
        {[...WORD].map((ch, i) => (
          <span
            key={i}
            className="aesi-letter"
            data-ch={ch}
            style={{ '--i': i } as CSSProperties}
          >
            {ch}
          </span>
        ))}
        <span className="aesi-sweep" />
      </div>

      <div className="aesi-line" />

      <div className="aesi-slogan">
        {[...SLOGAN].map((ch, i) => (
          <span
            key={i}
            className="aesi-sglyph"
            style={{ '--i': i } as CSSProperties}
          >
            {ch === ' ' ? '\u00A0' : ch}
          </span>
        ))}
      </div>

      <div className="aesi-flash" />
      <div className="aesi-skip">CLIC · PASSER</div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .aesi-root {
          position: fixed;
          inset: 0;
          z-index: 10000;
          background: #020509;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          overflow: hidden;
          user-select: none;
          -webkit-user-select: none;
        }
        .aesi-bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(58% 46% at 50% 42%, rgba(23,58,86,0.55), transparent 72%),
            radial-gradient(90% 70% at 50% 112%, rgba(10,22,34,0.85), transparent);
        }
        .aesi-grid {
          position: absolute;
          inset: -45% -30%;
          background-image:
            linear-gradient(rgba(120,200,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(120,200,255,0.05) 1px, transparent 1px);
          background-size: 44px 44px;
          transform: perspective(640px) rotateX(58deg);
          animation: aesi-gridmove 3s linear infinite;
          opacity: 0.55;
          pointer-events: none;
        }
        @keyframes aesi-gridmove {
          from { background-position: 0 0; }
          to { background-position: 0 44px; }
        }
        .aesi-tag {
          position: relative;
          font-size: clamp(8px, 1.1vw, 10px);
          letter-spacing: 0.52em;
          color: #6f9cb5;
          font-family: var(--font-geist-mono), ui-monospace, monospace;
          margin-bottom: clamp(14px, 2.6vh, 26px);
          opacity: 0;
          animation: aesi-glyph 0.6s ease-out 1.28s both;
        }
        .aesi-word {
          position: relative;
          display: flex;
          align-items: baseline;
          font-weight: 800;
          font-size: clamp(44px, 9.5vw, 104px);
          letter-spacing: 0.05em;
          line-height: 1;
          color: #f2fbff;
          font-family: var(--font-geist-sans), var(--font-geist-mono), sans-serif;
        }
        .aesi-letter {
          display: inline-block;
          opacity: 0;
          animation: aesi-slam 0.5s cubic-bezier(0.17, 1.1, 0.28, 1) both;
          animation-delay: calc(0.22s + var(--i) * 0.085s);
        }
        .aesi-letter[data-ch='-'] {
          color: #35e0ff;
          text-shadow: 0 0 30px rgba(53, 224, 255, 0.95);
          padding: 0 0.045em;
        }
        @keyframes aesi-slam {
          0% {
            opacity: 0;
            transform: translateY(-0.38em) scale(2.6);
            filter: blur(14px);
          }
          60% {
            opacity: 1;
            transform: translateY(0) scale(0.94);
            filter: blur(0);
          }
          78% { transform: scale(1.05); }
          100% {
            opacity: 1;
            transform: scale(1);
            filter: drop-shadow(0 0 14px rgba(53,224,255,0.35));
          }
        }
        .aesi-sweep {
          position: absolute;
          inset: -10px -34px;
          background: linear-gradient(
            105deg,
            transparent 42%,
            rgba(255, 255, 255, 0.8) 50%,
            transparent 58%
          );
          transform: translateX(-130%) skewX(-8deg);
          animation: aesi-sweep 0.7s ease-out 1.34s both;
          mix-blend-mode: screen;
          pointer-events: none;
        }
        @keyframes aesi-sweep {
          to { transform: translateX(130%) skewX(-8deg); }
        }
        .aesi-line {
          width: min(430px, 62vw);
          height: 2px;
          margin-top: clamp(16px, 2.8vh, 26px);
          border-radius: 2px;
          background: linear-gradient(90deg, transparent, #35e0ff, transparent);
          box-shadow: 0 0 14px rgba(53, 224, 255, 0.65);
          transform: scaleX(0);
          animation: aesi-line 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) 1.2s both;
        }
        @keyframes aesi-line {
          to { transform: scaleX(1); }
        }
        .aesi-slogan {
          margin-top: clamp(12px, 2.2vh, 20px);
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          font-size: clamp(9px, 1.55vw, 13px);
          letter-spacing: 0.32em;
          color: #9fd7ee;
          font-family: var(--font-geist-mono), ui-monospace, monospace;
          text-shadow: 0 0 12px rgba(53, 224, 255, 0.25);
          max-width: min(88vw, 1080px);
        }
        .aesi-sglyph {
          opacity: 0;
          animation: aesi-glyph 0.4s ease-out both;
          animation-delay: calc(1.52s + var(--i) * 0.012s);
        }
        @keyframes aesi-glyph {
          from {
            opacity: 0;
            filter: blur(6px);
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            filter: blur(0);
            transform: none;
          }
        }
        .aesi-flash {
          position: absolute;
          inset: 0;
          background: #dff6ff;
          opacity: 0;
          animation: aesi-flash 0.26s ease-out 1.1s both;
          pointer-events: none;
        }
        @keyframes aesi-flash {
          0% { opacity: 0; }
          16% { opacity: 0.22; }
          100% { opacity: 0; }
        }
        .aesi-skip {
          position: absolute;
          bottom: 26px;
          right: 30px;
          font-size: 8px;
          letter-spacing: 0.24em;
          color: rgba(159, 215, 238, 0.42);
          font-family: var(--font-geist-mono), ui-monospace, monospace;
          opacity: 0;
          animation: aesi-glyph 0.6s ease-out 2.3s both;
        }
      `,
        }}
      />
    </div>
  );
}
