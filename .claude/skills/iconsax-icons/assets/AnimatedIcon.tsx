// AnimatedIcon — wrapper padrão do projeto para ícones animados do Iconsax (Lottie JSON)
// Copie para src/components/icons/AnimatedIcon.tsx · Dependência: npm i lottie-react
'use client';

import { useEffect, useRef, useState } from 'react';
import Lottie, { type LottieRefCurrentProps } from 'lottie-react';

type Trigger = 'loop' | 'once' | 'hover';

interface AnimatedIconProps {
  /** Caminho público do JSON, ex.: /icons/animated/wallet-check.json */
  src: string;
  size?: number;
  /** loop = repete sempre (LIVE) · once = toca 1x ao montar (sucesso) · hover = toca no mouse */
  trigger?: Trigger;
  className?: string;
  'aria-label'?: string;
}

export function AnimatedIcon({
  src,
  size = 24,
  trigger = 'once',
  className,
  'aria-label': ariaLabel,
}: AnimatedIconProps) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const [data, setData] = useState<object | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(src)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Lottie ${r.status}`))))
      .then((json) => alive && setData(json))
      .catch(() => alive && setData(null)); // caller deve ter fallback estático
    return () => {
      alive = false;
    };
  }, [src]);

  useEffect(() => {
    if (reduced && lottieRef.current) {
      lottieRef.current.goToAndStop(0, true); // primeiro frame parado
    }
  }, [reduced, data]);

  if (!data) return null;

  const interactive = trigger === 'hover' && !reduced;

  return (
    <span
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={className}
      style={{ display: 'inline-flex', width: size, height: size }}
      onMouseEnter={interactive ? () => lottieRef.current?.goToAndPlay(0) : undefined}
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={data}
        autoplay={!reduced && trigger !== 'hover'}
        loop={!reduced && trigger === 'loop'}
        style={{ width: size, height: size }}
      />
    </span>
  );
}
