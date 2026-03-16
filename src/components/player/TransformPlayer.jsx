import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { assetUrl } from '../../utils/assetUrl';
import './TransformPlayer.css';

function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export default function TransformPlayer({ episode, seasonNum, seriesTitle, onClose }) {
  const canvasRef = useRef(null);
  const threeRef = useRef(null);
  const audioRef = useRef(null);
  const [phase, setPhase] = useState('animating'); // 'animating' | 'player' | 'closing'

  const videoData = episode?.video || {};
  const youtubeId = extractYouTubeId(videoData.youtube);
  const searchQuery = encodeURIComponent(
    `${episode?.title || ''} ${seriesTitle || 'Transformers'} full episode`
  );

  // ── 3D opening animation ──
  useEffect(() => {
    if (phase !== 'animating') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = window.innerWidth;
    const H = window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 2.5;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
    camera.position.set(0, 0, 6);

    // Bright lighting
    scene.add(new THREE.AmbientLight(0xaaaacc, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(2, 3, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x4488ff, 1.2);
    fill.position.set(-3, 1, 3);
    scene.add(fill);
    const rim = new THREE.PointLight(0xff4400, 2, 12);
    rim.position.set(0, -1, 4);
    scene.add(rim);

    // Env map
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envS = new THREE.Scene();
    envS.add(new THREE.HemisphereLight(0x6688cc, 0x443322, 3));
    const envMap = pmrem.fromScene(envS, 0.04).texture;
    scene.environment = envMap;
    pmrem.dispose();

    // Red metallic material — vivid
    const redMat = new THREE.MeshPhysicalMaterial({
      color: 0xdd2222,
      metalness: 0.75,
      roughness: 0.2,
      emissive: new THREE.Color(0x551111),
      emissiveIntensity: 0.4,
      clearcoat: 0.3,
    });

    // 4 corner blocks — together they form one solid block
    const blockW = 2.4;
    const blockH = 1.6;
    const blockD = 0.5;
    const halfW = blockW / 2;
    const halfH = blockH / 2;

    const geo = new THREE.BoxGeometry(halfW, halfH, blockD, 2, 2, 1);
    const corners = [];
    const targets = [
      { x: -halfW / 2, y: halfH / 2 },   // TL
      { x: halfW / 2, y: halfH / 2 },     // TR
      { x: -halfW / 2, y: -halfH / 2 },   // BL
      { x: halfW / 2, y: -halfH / 2 },    // BR
    ];
    // Final spread positions (far apart to clear the screen)
    const spreads = [
      { x: -4.5, y: 3.0, rz: -0.3 },
      { x: 4.5, y: 3.0, rz: 0.3 },
      { x: -4.5, y: -3.0, rz: 0.3 },
      { x: 4.5, y: -3.0, rz: -0.3 },
    ];

    targets.forEach((t, i) => {
      const mesh = new THREE.Mesh(geo, redMat);
      mesh.position.set(t.x, t.y, 0); // Start assembled as one block
      scene.add(mesh);
      corners.push({ mesh, spread: spreads[i] });
    });

    threeRef.current = { renderer, scene, camera, corners, envMap, geo, redMat, animId: null };

    // Render loop
    let running = true;
    function animate() {
      if (!running) return;
      threeRef.current.animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    // Sound
    try {
      const audio = new Audio(assetUrl('sounds/transform.ogg'));
      audio.volume = 0.7;
      audio.play().catch(() => {});
      audioRef.current = audio;
    } catch {}

    // Animation: block holds, then splits and corners fly off screen
    const tl = gsap.timeline({
      onComplete: () => setPhase('player'),
    });

    // Hold as solid block for 0.4s
    tl.to({}, { duration: 0.4 });

    // Split: corners fly outward to clear the view
    corners.forEach(({ mesh, spread }, i) => {
      tl.to(mesh.position, {
        x: spread.x, y: spread.y, z: -1,
        duration: 0.8, ease: 'power3.out',
      }, 0.4 + i * 0.05);
      tl.to(mesh.rotation, {
        z: spread.rz, x: 0.2 * (i < 2 ? 1 : -1),
        duration: 0.8, ease: 'power3.out',
      }, 0.4 + i * 0.05);
      tl.to(mesh.scale, {
        x: 0.6, y: 0.6, z: 0.6,
        duration: 0.8, ease: 'power3.out',
      }, 0.4 + i * 0.05);
    });

    // Fade canvas out as player fades in
    tl.to(canvas, { opacity: 0, duration: 0.3 }, 1.0);

    // Resize
    function onResize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    return () => {
      running = false;
      if (threeRef.current?.animId) cancelAnimationFrame(threeRef.current.animId);
      tl.kill();
      window.removeEventListener('resize', onResize);
      geo.dispose();
      redMat.dispose();
      envMap.dispose();
      renderer.dispose();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, [phase]);

  // Close handler
  const handleClose = useCallback(() => {
    if (phase === 'closing') return;
    setPhase('closing');

    try {
      const audio = new Audio(assetUrl('sounds/transform.ogg'));
      audio.volume = 0.4;
      audio.playbackRate = 1.5;
      audio.play().catch(() => {});
    } catch {}

    // Simple fade out, then call onClose
    setTimeout(onClose, 500);
  }, [phase, onClose]);

  // Escape
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [handleClose]);

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className={`tfp-overlay ${phase === 'closing' ? 'tfp-closing' : ''}`}>
      {/* 3D canvas — only during animation phase */}
      {phase === 'animating' && (
        <canvas className="tfp-canvas" ref={canvasRef} />
      )}

      {/* Close button */}
      <button className="tfp-close" onClick={handleClose} aria-label="Close">&#10005;</button>

      {/* Video player with image frame — appears after 3D animation */}
      {(phase === 'player' || phase === 'closing') && (
        <div className={`tfp-player ${phase === 'closing' ? 'tfp-player-closing' : ''}`}>
          <div className="tfp-frame-wrapper">
            {/* The reference image as the frame border */}
            <img
              src={assetUrl('images/player-frame.jpg')}
              alt=""
              className="tfp-frame-image"
              draggable={false}
            />
            {/* Video sits inside the frame's screen area */}
            <div className="tfp-screen">
              {youtubeId ? (
                <iframe
                  className="tfp-iframe"
                  src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&autoplay=1`}
                  title={episode.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="tfp-fallback">
                  <span className="tfp-fallback-icon">&#9654;</span>
                  {videoData.dailymotion ? (
                    <><p>Available on Dailymotion</p><a href={videoData.dailymotion} target="_blank" rel="noopener noreferrer">Watch on Dailymotion</a></>
                  ) : videoData.other ? (
                    <><p>Available externally</p><a href={videoData.other} target="_blank" rel="noopener noreferrer">Watch Episode</a></>
                  ) : (
                    <><p>No video available</p><a href={`https://www.youtube.com/results?search_query=${searchQuery}`} target="_blank" rel="noopener noreferrer">Search YouTube</a></>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Episode info */}
          <div className="tfp-info">
            <h2 className="tfp-title">{episode.title}</h2>
            <p className="tfp-meta">
              {seriesTitle && `${seriesTitle} — `}Season {seasonNum}, Episode {episode.number}
            </p>
            {youtubeId && (
              <p className="tfp-search">
                Video not working?{' '}
                <a href={`https://www.youtube.com/results?search_query=${searchQuery}`} target="_blank" rel="noopener noreferrer">Search on YouTube</a>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
