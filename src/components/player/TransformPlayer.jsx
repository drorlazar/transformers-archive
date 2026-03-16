import { useEffect, useRef, useCallback, useState } from 'react';
import gsap from 'gsap';
import './TransformPlayer.css';

/* ── Utility: extract YouTube video ID ── */
function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/
  );
  return m ? m[1] : null;
}

/* ── Synthetic sound via Web Audio API ── */
function createAudioCtx() {
  return new (window.AudioContext || window.webkitAudioContext)();
}

function playTransformSound(audioCtx) {
  try {
    // Sweep oscillator: 200 Hz -> 800 Hz in 0.3s, then drop
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.3);
    osc1.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.8);
    gain1.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.0);
    osc1.connect(gain1).connect(audioCtx.destination);
    osc1.start(audioCtx.currentTime);
    osc1.stop(audioCtx.currentTime + 1.0);

    // Click/clank noise burst at T=0
    const bufferSize = audioCtx.sampleRate * 0.08;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    noiseSource.connect(noiseGain).connect(audioCtx.destination);
    noiseSource.start(audioCtx.currentTime);

    // Mechanical gear whir: second oscillator
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(60, audioCtx.currentTime);
    osc2.frequency.linearRampToValueAtTime(120, audioCtx.currentTime + 0.5);
    osc2.frequency.linearRampToValueAtTime(40, audioCtx.currentTime + 1.2);
    gain2.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
    osc2.connect(gain2).connect(audioCtx.destination);
    osc2.start(audioCtx.currentTime);
    osc2.stop(audioCtx.currentTime + 1.2);
  } catch {
    // Audio not available — silently continue
  }
}

function playCloseSound(audioCtx) {
  try {
    // Short metallic clunk
    const bufferSize = audioCtx.sampleRate * 0.12;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 4);
    }
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    src.connect(gain).connect(audioCtx.destination);
    src.start(audioCtx.currentTime);

    // Low thud tone
    const osc = audioCtx.createOscillator();
    const oscGain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.15);
    oscGain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.connect(oscGain).connect(audioCtx.destination);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.15);
  } catch {
    // Audio not available — silently continue
  }
}

/* ── Canvas spark burst ── */
function fireSparkBurst(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  const particles = Array.from({ length: 50 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 7;
    return {
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.03 + Math.random() * 0.04,
      size: 2 + Math.random() * 3,
      color: Math.random() > 0.5 ? '#FF8C00' : '#FFE066',
    };
  });

  let animId;
  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      if (p.life <= 0) continue;
      alive = true;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.vx *= 0.97;
      p.life -= p.decay;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    if (alive) {
      animId = requestAnimationFrame(tick);
    }
  }
  tick();
  return () => cancelAnimationFrame(animId);
}

/* ── SVG gear path generators ── */
function gearPath(cx, cy, outerR, innerR, teeth) {
  const step = (Math.PI * 2) / teeth;
  const halfStep = step / 4;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    if (i === 0) {
      d += `M ${cx + Math.cos(a - halfStep) * innerR} ${cy + Math.sin(a - halfStep) * innerR}`;
    }
    d += ` L ${cx + Math.cos(a - halfStep) * outerR} ${cy + Math.sin(a - halfStep) * outerR}`;
    d += ` L ${cx + Math.cos(a + halfStep) * outerR} ${cy + Math.sin(a + halfStep) * outerR}`;
    d += ` L ${cx + Math.cos(a + halfStep) * innerR} ${cy + Math.sin(a + halfStep) * innerR}`;
    const nextA = (i + 1) * step;
    d += ` L ${cx + Math.cos(nextA - halfStep) * innerR} ${cy + Math.sin(nextA - halfStep) * innerR}`;
  }
  d += ' Z';
  // Add center hole
  const holeR = innerR * 0.35;
  d += ` M ${cx + holeR} ${cy}`;
  d += ` A ${holeR} ${holeR} 0 1 0 ${cx - holeR} ${cy}`;
  d += ` A ${holeR} ${holeR} 0 1 0 ${cx + holeR} ${cy}`;
  return d;
}

/* ── Iris polygon strings ── */
const IRIS_CLOSED = 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%, 50% 50%, 50% 50%)';
const IRIS_OPEN = 'polygon(50% -60%, 160% 20%, 160% 80%, 50% 160%, -60% 80%, -60% 20%)';

/* ── Component ── */
export default function TransformPlayer({ episode, seasonNum, seriesTitle, onClose }) {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const timelineRef = useRef(null);
  const [animDone, setAnimDone] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const videoData = episode?.video || {};
  const youtubeUrl = videoData.youtube;
  const youtubeId = extractYouTubeId(youtubeUrl);
  const searchQuery = encodeURIComponent(
    `${episode?.title || ''} ${seriesTitle || 'Transformers'} full episode`
  );

  /* ── OPEN animation ── */
  useEffect(() => {
    if (!rootRef.current) return;

    // Init audio context on user gesture (the click that opened this)
    if (!audioCtxRef.current) {
      audioCtxRef.current = createAudioCtx();
    }

    // Sound fires at T=0
    playTransformSound(audioCtxRef.current);

    const root = rootRef.current;
    const tl = gsap.timeline({
      onComplete: () => setAnimDone(true),
    });

    tl
      // T=0: Flash burst
      .fromTo(root.querySelector('.tf-flash'),
        { opacity: 0.7 },
        { opacity: 0, duration: 0.08 },
        0
      )
      // T=0-200ms: Gears fade in
      .fromTo(root.querySelector('.tf-gears'),
        { opacity: 0, scale: 0.6 },
        { opacity: 1, scale: 1, duration: 0.2, transformOrigin: 'center center' },
        0
      )
      // T=0-420ms: Large gear rotates
      .to(root.querySelector('.tf-gear-large'),
        { rotation: 720, duration: 0.42, ease: 'power2.in', transformOrigin: 'center center' },
        0
      )
      // T=0-420ms: Small gear counter-rotates
      .to(root.querySelector('.tf-gear-small'),
        { rotation: -1080, duration: 0.42, ease: 'power2.in', transformOrigin: 'center center' },
        0
      )
      // T=200-500ms: Panels slide in (staggered 40ms)
      .fromTo(root.querySelector('.tf-panel--tl'),
        { y: '-100%' }, { y: '0%', duration: 0.3, ease: 'expo.out' }, 0.2)
      .fromTo(root.querySelector('.tf-panel--tr'),
        { x: '100%' }, { x: '0%', duration: 0.3, ease: 'expo.out' }, 0.24)
      .fromTo(root.querySelector('.tf-panel--ml'),
        { x: '-100%' }, { x: '0%', duration: 0.3, ease: 'expo.out' }, 0.28)
      .fromTo(root.querySelector('.tf-panel--mr'),
        { x: '100%' }, { x: '0%', duration: 0.3, ease: 'expo.out' }, 0.32)
      .fromTo(root.querySelector('.tf-panel--bl'),
        { y: '100%' }, { y: '0%', duration: 0.3, ease: 'expo.out' }, 0.36)
      .fromTo(root.querySelector('.tf-panel--br'),
        { x: '100%', y: '100%' }, { x: '0%', y: '0%', duration: 0.3, ease: 'expo.out' }, 0.4)

      // T=350-750ms: Scanlines
      .fromTo(root.querySelector('.tf-scanlines'),
        { opacity: 0 },
        { opacity: 0.6, duration: 0.15 },
        0.35
      )
      .to(root.querySelector('.tf-scanlines'),
        { opacity: 0, duration: 0.25 },
        0.5
      )

      // T=500-900ms: Iris opens
      .to(root.querySelector('.tf-iris'),
        { clipPath: IRIS_OPEN, duration: 0.4, ease: 'power4.inOut' },
        0.5
      )

      // T=700-900ms: Gears decelerate and fade
      .to(root.querySelector('.tf-gears'),
        { opacity: 0, duration: 0.2, ease: 'power4.out' },
        0.7
      )

      // T=750ms: Spark burst
      .call(() => fireSparkBurst(canvasRef.current), [], 0.75)

      // T=700-900ms: Panels slide back out (they served as the "assembly" visual)
      .to(root.querySelector('.tf-panel--tl'), { y: '-100%', duration: 0.2, ease: 'power2.in' }, 0.7)
      .to(root.querySelector('.tf-panel--tr'), { x: '100%', duration: 0.2, ease: 'power2.in' }, 0.72)
      .to(root.querySelector('.tf-panel--ml'), { x: '-100%', duration: 0.2, ease: 'power2.in' }, 0.74)
      .to(root.querySelector('.tf-panel--mr'), { x: '100%', duration: 0.2, ease: 'power2.in' }, 0.76)
      .to(root.querySelector('.tf-panel--bl'), { y: '100%', duration: 0.2, ease: 'power2.in' }, 0.78)
      .to(root.querySelector('.tf-panel--br'), { x: '100%', y: '100%', duration: 0.2, ease: 'power2.in' }, 0.8)

      // T=900-1200ms: Player border draw-on
      .fromTo(root.querySelector('.tf-border-svg rect'),
        { strokeDashoffset: 3000 },
        { strokeDashoffset: 0, duration: 0.3, ease: 'power2.out' },
        0.9
      )

      // T=1100-1300ms: Content fades in
      .fromTo(root.querySelector('.tf-player-content'),
        { y: 15, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.2, ease: 'power2.out' },
        1.1
      )
      // Close button fades in
      .fromTo(root.querySelector('.tf-close-btn'),
        { opacity: 0 },
        { opacity: 1, duration: 0.15 },
        1.15
      );

    timelineRef.current = tl;

    return () => {
      tl.kill();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── CLOSE animation ── */
  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);

    if (timelineRef.current) {
      timelineRef.current.kill();
    }

    const root = rootRef.current;
    if (!root) {
      onClose();
      return;
    }

    // Sound
    if (audioCtxRef.current) {
      playCloseSound(audioCtxRef.current);
    }

    const tl = gsap.timeline({
      onComplete: () => {
        if (audioCtxRef.current) {
          audioCtxRef.current.close().catch(() => {});
          audioCtxRef.current = null;
        }
        onClose();
      },
    });

    tl
      // T=0: Close button fades
      .to(root.querySelector('.tf-close-btn'), { opacity: 0, duration: 0.08 }, 0)
      // T=0-100ms: Player border un-draws
      .to(root.querySelector('.tf-border-svg rect'),
        { strokeDashoffset: 3000, duration: 0.1, ease: 'power2.in' },
        0
      )
      // T=0-100ms: Content fades out
      .to(root.querySelector('.tf-player-content'),
        { y: -10, opacity: 0, duration: 0.1 },
        0
      )
      // T=50-300ms: Iris closes
      .to(root.querySelector('.tf-iris'),
        { clipPath: IRIS_CLOSED, duration: 0.25, ease: 'power4.in' },
        0.05
      )
      // T=200-500ms: Panels slide in then out
      .fromTo(root.querySelector('.tf-panel--tl'),
        { y: '-100%' }, { y: '0%', duration: 0.15, ease: 'expo.out' }, 0.2)
      .fromTo(root.querySelector('.tf-panel--tr'),
        { x: '100%' }, { x: '0%', duration: 0.15, ease: 'expo.out' }, 0.23)
      .fromTo(root.querySelector('.tf-panel--bl'),
        { y: '100%' }, { y: '0%', duration: 0.15, ease: 'expo.out' }, 0.26)
      .fromTo(root.querySelector('.tf-panel--br'),
        { x: '100%' }, { x: '0%', duration: 0.15, ease: 'expo.out' }, 0.29)

      // T=400-600ms: Gears spin up and fade
      .fromTo(root.querySelector('.tf-gears'),
        { opacity: 0 },
        { opacity: 0.6, duration: 0.1 },
        0.4
      )
      .to(root.querySelector('.tf-gear-large'),
        { rotation: '+=360', duration: 0.2, ease: 'power2.in', transformOrigin: 'center center' },
        0.4
      )
      .to(root.querySelector('.tf-gear-small'),
        { rotation: '-=540', duration: 0.2, ease: 'power2.in', transformOrigin: 'center center' },
        0.4
      )
      .to(root.querySelector('.tf-gears'),
        { opacity: 0, duration: 0.1 },
        0.55
      )

      // T=600-800ms: Flash burst, overlay fades
      .fromTo(root.querySelector('.tf-flash'),
        { opacity: 0 },
        { opacity: 0.5, duration: 0.05 },
        0.6
      )
      .to(root.querySelector('.tf-flash'),
        { opacity: 0, duration: 0.15 },
        0.65
      )
      .to(root, { opacity: 0, duration: 0.1 }, 0.7);
  }, [isClosing, onClose]);

  /* ── Escape key to close ── */
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') handleClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  /* ── Prevent body scroll ── */
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const perimeter = 960 * 2 + (960 * 0.5625) * 2 + 100; // approximate

  return (
    <div className="transform-player" ref={rootRef}>
      {/* Flash layer */}
      <div className="tf-flash" />

      {/* Scanlines */}
      <div className="tf-scanlines" />

      {/* Gears */}
      <div className="tf-gears">
        <svg className="tf-gear-large" viewBox="0 0 260 260">
          <path d={gearPath(130, 130, 120, 95, 12)} />
        </svg>
        <svg className="tf-gear-small" viewBox="0 0 160 160">
          <path d={gearPath(80, 80, 70, 55, 8)} />
        </svg>
      </div>

      {/* Metal panels */}
      <div className="tf-panel tf-panel--tl" />
      <div className="tf-panel tf-panel--tr" />
      <div className="tf-panel tf-panel--ml" />
      <div className="tf-panel tf-panel--mr" />
      <div className="tf-panel tf-panel--bl" />
      <div className="tf-panel tf-panel--br" />

      {/* Iris overlay */}
      <div className="tf-iris" />

      {/* Spark canvas */}
      <canvas className="tf-spark-canvas" ref={canvasRef} />

      {/* Player layer */}
      <div className="tf-player-layer">
        {/* SVG border frame */}
        <svg
          className="tf-border-svg"
          style={{
            width: '100%',
            maxWidth: '976px', /* 960 + 16 padding */
            aspectRatio: '16 / 10',
          }}
          viewBox={`0 0 976 ${976 * 0.625}`}
          preserveAspectRatio="none"
        >
          <rect
            x="2"
            y="2"
            width="972"
            height={976 * 0.625 - 4}
            rx="4"
            ry="4"
            stroke="#ff6b00"
            strokeWidth="2"
            fill="none"
            strokeDasharray={perimeter}
            strokeDashoffset={perimeter}
          />
        </svg>

        {/* Close button */}
        <button className="tf-close-btn" onClick={handleClose} aria-label="Close player">
          &#10005;
        </button>

        {/* Content: video + info */}
        <div className="tf-player-content">
          {youtubeId ? (
            <div className="tf-video-wrap">
              {animDone && (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&autoplay=1`}
                  title={episode.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          ) : (
            <div className="tf-video-fallback">
              <div>
                <span className="tf-video-fallback__icon">&#9654;</span>
                {videoData.dailymotion ? (
                  <>
                    <p>This episode is available on Dailymotion</p>
                    <a href={videoData.dailymotion} target="_blank" rel="noopener noreferrer">
                      Watch on Dailymotion
                    </a>
                  </>
                ) : videoData.other ? (
                  <>
                    <p>This episode is available externally</p>
                    <a href={videoData.other} target="_blank" rel="noopener noreferrer">
                      Watch Episode
                    </a>
                  </>
                ) : (
                  <>
                    <p>No video embed available for this episode.</p>
                    <a
                      href={`https://www.youtube.com/results?search_query=${searchQuery}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Search on YouTube
                    </a>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="tf-episode-info">
            <h2 className="tf-episode-info__title">{episode.title}</h2>
            <p className="tf-episode-info__number">
              {seriesTitle && `${seriesTitle} — `}
              Season {seasonNum}, Episode {episode.number}
            </p>
            {youtubeId && (
              <p className="tf-episode-info__search">
                Video not working?{' '}
                <a
                  href={`https://www.youtube.com/results?search_query=${searchQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Search on YouTube
                </a>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
