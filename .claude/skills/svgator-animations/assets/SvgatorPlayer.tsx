// SvgatorPlayer — wrapper padrão do projeto para SVGs animados com motor JavaScript (SVGator)
// Copie para src/components/animations/SvgatorPlayer.tsx · Sem dependências externas
// Exporte no SVGator com: Animation type JavaScript · Start "Programmatic" · Unique IDs · Responsive
'use client';

import { useEffect, useRef, useState } from 'react';

// API exposta em svgElement.svgatorPlayer após o script interno do SVG rodar
export interface SvgatorPlayerApi {
  play(): void;
  pause(): void;
  restart(): void;
  reverse(): void;
  toggle(): void;
  seek(percent: number): void;
  setSpeed(speed: number): void;
  ready(cb: (player: SvgatorPlayerApi) => void): void;
}

type Trigger = 'load' | 'hover' | 'click' | 'visible' | 'manual';

interface SvgatorPlayerProps {
  /** Caminho público, ex.: /animations/svgator/pagamento-sucesso--js.svg */
  src: string;
  width?: number | string;
  height?: number | string;
  /** load = toca ao montar · visible = toca ao entrar na tela (pausa ao sair) ·
   *  hover/click = interação · manual = você controla via onReady */
  trigger?: Trigger;
  className?: string;
  ariaLabel?: string;
  onReady?: (player: SvgatorPlayerApi) => void;
}

export function SvgatorPlayer({
  src,
  width = '100%',
  height = 'auto',
  trigger = 'load',
  className,
  ariaLabel,
  onReady,
}: SvgatorPlayerProps) {
  const objectRef = useRef<HTMLObjectElement>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const playerRef = useRef<SvgatorPlayerApi | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const handleLoad = () => {
    // same-origin (/public) permite acessar o documento interno do <object>
    const doc = objectRef.current?.contentDocument;
    const svg = doc?.querySelector('svg') as (SVGSVGElement & { svgatorPlayer?: SvgatorPlayerApi }) | null;
    svg?.svgatorPlayer?.ready((player) => {
      playerRef.current = player;
      onReady?.(player);
      if (reduced) return; // primeiro frame estático
      if (trigger === 'load') player.play();
    });
  };

  // trigger="visible": toca ao entrar no viewport, pausa ao sair
  useEffect(() => {
    if (trigger !== 'visible' || reduced || !wrapperRef.current) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const p = playerRef.current;
        if (!p) return;
        entry.isIntersecting ? p.play() : p.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(wrapperRef.current);
    return () => io.disconnect();
  }, [trigger, reduced]);

  const interactive = !reduced && (trigger === 'hover' || trigger === 'click');

  return (
    <span
      ref={wrapperRef}
      className={className}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      style={{ display: 'inline-block', width, height, lineHeight: 0 }}
      onMouseEnter={interactive && trigger === 'hover' ? () => playerRef.current?.restart() : undefined}
      onClick={interactive && trigger === 'click' ? () => playerRef.current?.toggle() : undefined}
    >
      <object
        ref={objectRef}
        data={src}
        type="image/svg+xml"
        onLoad={handleLoad}
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        aria-hidden="true"
      />
    </span>
  );
}
