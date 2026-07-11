// JitterVideo — wrapper padrão do projeto para vídeos exportados do Jitter (jitter.video)
// Copie para src/components/animations/JitterVideo.tsx · Sem dependências externas
// Convenção de arquivos em /public/animations/jitter/:
//   normal: {srcBase}.mp4 + {srcBase}.poster.jpg
//   alpha:  {srcBase}.webm (VP9 alpha) + {srcBase}.hevc.mp4 (HEVC alpha p/ Safari)
'use client';

import { useEffect, useRef, useState } from 'react';

interface JitterVideoProps {
  /** Caminho base SEM extensão, ex.: /animations/jitter/hero-copa */
  srcBase: string;
  /** true = vídeo com fundo transparente (par webm + hevc.mp4) */
  alpha?: boolean;
  width?: number | string;
  /** ex.: "16/9", "1/1" — evita layout shift */
  aspectRatio?: string;
  loop?: boolean;
  className?: string;
  /** Vídeo significativo recebe rótulo; decorativo fica aria-hidden */
  ariaLabel?: string;
  poster?: string;
}

export function JitterVideo({
  srcBase,
  alpha = false,
  width = '100%',
  aspectRatio = '16/9',
  loop = true,
  className,
  ariaLabel,
  poster,
}: JitterVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Toca quando visível, pausa fora da tela (economia de bateria/CPU)
  useEffect(() => {
    const el = videoRef.current;
    if (!el || reduced) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {}); // autoplay pode ser bloqueado; poster cobre
        } else {
          el.pause();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  const posterSrc = poster ?? `${srcBase}.poster.jpg`;

  // Reduced motion: imagem estática no lugar do vídeo
  if (reduced) {
    return (
      <img
        src={posterSrc}
        alt={ariaLabel ?? ''}
        aria-hidden={ariaLabel ? undefined : true}
        className={className}
        style={{ width, aspectRatio, objectFit: 'cover', display: 'block' }}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      className={className}
      style={{ width, aspectRatio, objectFit: 'cover', display: 'block' }}
      muted
      playsInline
      loop={loop}
      preload="metadata"
      poster={alpha ? undefined : posterSrc}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      {alpha ? (
        <>
          {/* Ordem importa: Safari ignora webm e cai no HEVC alpha */}
          <source src={`${srcBase}.webm`} type="video/webm" />
          <source src={`${srcBase}.hevc.mp4`} type='video/mp4; codecs="hvc1"' />
        </>
      ) : (
        <source src={`${srcBase}.mp4`} type="video/mp4" />
      )}
    </video>
  );
}
