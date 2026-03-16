import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { assetUrl } from '../../utils/assetUrl';
import './TransformPlayer.css';

/* ── Utility: extract YouTube video ID ── */
function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/
  );
  return m ? m[1] : null;
}

/* ── Component ── */
export default function TransformPlayer({ episode, seasonNum, seriesTitle, onClose }) {
  const overlayRef = useRef(null);
  const canvasRef = useRef(null);
  const threeRef = useRef(null);    // holds scene, camera, renderer, meshes, etc.
  const timelineRef = useRef(null);
  const rafRef = useRef(null);
  const audioRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const videoData = episode?.video || {};
  const youtubeUrl = videoData.youtube;
  const youtubeId = extractYouTubeId(youtubeUrl);
  const searchQuery = encodeURIComponent(
    `${episode?.title || ''} ${seriesTitle || 'Transformers'} full episode`
  );

  /* ── Initialize Three.js scene and run OPEN animation ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // ── Scene ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    // ── Camera ──
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
    camera.position.z = 5;

    // ── Lights ──
    const ambient = new THREE.AmbientLight(0x333333, 1);
    scene.add(ambient);

    const redLight = new THREE.PointLight(0xff2200, 3, 10);
    redLight.position.set(0, 0, 3);
    scene.add(redLight);

    const blueLight = new THREE.PointLight(0x0088ff, 0, 10);
    blueLight.position.set(0, 0, 2);
    scene.add(blueLight);

    const orangeLight1 = new THREE.PointLight(0xff6600, 0, 8);
    orangeLight1.position.set(-2.5, 0, 2);
    scene.add(orangeLight1);

    const orangeLight2 = new THREE.PointLight(0xff6600, 0, 8);
    orangeLight2.position.set(2.5, 0, 2);
    scene.add(orangeLight2);

    // ── Load corner textures ──
    const loader = new THREE.TextureLoader();

    // Calculate frame dimensions to match 16:9 video area in 3D space
    // The assembled frame should be ~4 units wide, ~2.25 tall (16:9)
    // Each corner piece is half-width, half-height
    const frameW = 4.0;
    const frameH = frameW * (9 / 16) + 0.6; // extra for frame border
    const pieceW = frameW / 2;
    const pieceH = frameH / 2;

    const geometry = new THREE.PlaneGeometry(pieceW, pieceH);

    // Materials — start with red emissive for the collapsed cube look
    const createMaterial = (texturePath) => {
      const tex = loader.load(assetUrl(texturePath));
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({
        map: tex,
        emissive: new THREE.Color(0xff0000),
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 1,
        metalness: 0.6,
        roughness: 0.3,
        side: THREE.DoubleSide,
      });
    };

    const matTL = createMaterial('images/frame-tl.png');
    const matTR = createMaterial('images/frame-tr.png');
    const matBL = createMaterial('images/frame-bl.png');
    const matBR = createMaterial('images/frame-br.png');

    const meshTL = new THREE.Mesh(geometry, matTL);
    const meshTR = new THREE.Mesh(geometry, matTR);
    const meshBL = new THREE.Mesh(geometry, matBL);
    const meshBR = new THREE.Mesh(geometry, matBR);

    // All start at center, scaled tiny
    [meshTL, meshTR, meshBL, meshBR].forEach((m) => {
      m.position.set(0, 0, 0);
      m.scale.set(0.1, 0.1, 0.1);
      scene.add(m);
    });

    // Final positions for each corner
    const finalPositions = {
      tl: { x: -pieceW / 2, y: pieceH / 2, z: 0 },
      tr: { x: pieceW / 2, y: pieceH / 2, z: 0 },
      bl: { x: -pieceW / 2, y: -pieceH / 2, z: 0 },
      br: { x: pieceW / 2, y: -pieceH / 2, z: 0 },
    };

    // ── Particle sparks system ──
    const particleCount = 50;
    const particleGeom = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities = [];
    const particleLifetimes = new Float32Array(particleCount);
    const particleSizes = new Float32Array(particleCount);
    const particleColors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = 0;
      particlePositions[i * 3 + 1] = 0;
      particlePositions[i * 3 + 2] = 0.1;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.02 + Math.random() * 0.06;
      particleVelocities.push({
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
        z: (Math.random() - 0.5) * 0.02,
      });
      particleLifetimes[i] = 0; // will be activated later
      particleSizes[i] = 3 + Math.random() * 5;
      // Orange/gold colors
      const isGold = Math.random() > 0.5;
      particleColors[i * 3] = isGold ? 1.0 : 1.0;
      particleColors[i * 3 + 1] = isGold ? 0.85 : 0.55;
      particleColors[i * 3 + 2] = isGold ? 0.3 : 0.0;
    }

    particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeom.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    particleGeom.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(particleGeom, particleMat);
    scene.add(particles);

    // ── CRT power-on plane ──
    const crtGeom = new THREE.PlaneGeometry(frameW - 0.3, frameH - 0.3);
    const crtMat = new THREE.MeshBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0,
    });
    const crtMesh = new THREE.Mesh(crtGeom, crtMat);
    crtMesh.position.z = 0.05;
    crtMesh.scale.y = 0.003; // starts as thin horizontal line
    scene.add(crtMesh);

    // ── Store references ──
    const threeState = {
      renderer,
      scene,
      camera,
      meshTL,
      meshTR,
      meshBL,
      meshBR,
      matTL,
      matTR,
      matBL,
      matBR,
      redLight,
      blueLight,
      orangeLight1,
      orangeLight2,
      ambient,
      particles,
      particleMat,
      particlePositions,
      particleVelocities,
      particleLifetimes,
      particleGeom,
      crtMesh,
      crtMat,
      crtGeom,
      geometry,
      finalPositions,
      sparksActive: false,
      time: 0,
    };
    threeRef.current = threeState;

    // ── Render loop ──
    function animate() {
      rafRef.current = requestAnimationFrame(animate);
      threeState.time += 0.016;

      // Red pulse on the light during Phase 1
      redLight.intensity = 3 + Math.sin(threeState.time * 12) * 1.5;

      // Animate spark particles when active
      if (threeState.sparksActive) {
        const pos = particleGeom.attributes.position.array;
        let anyAlive = false;
        for (let i = 0; i < particleCount; i++) {
          if (particleLifetimes[i] <= 0) continue;
          anyAlive = true;
          particleLifetimes[i] -= 0.02;
          pos[i * 3] += particleVelocities[i].x;
          pos[i * 3 + 1] += particleVelocities[i].y;
          pos[i * 3 + 2] += particleVelocities[i].z;
          // Gravity
          particleVelocities[i].y -= 0.001;
        }
        particleGeom.attributes.position.needsUpdate = true;
        particleMat.opacity = anyAlive ? Math.max(0, particleMat.opacity - 0.005) : 0;
        if (!anyAlive) threeState.sparksActive = false;
      }

      renderer.render(scene, camera);
    }
    animate();

    // ── Play transform sound ──
    try {
      const audio = new Audio(assetUrl('sounds/transform.ogg'));
      audio.volume = 0.6;
      audio.play().catch(() => {});
      audioRef.current = audio;
    } catch {
      // Audio not available
    }

    // ── GSAP OPEN Timeline ──
    const tl = gsap.timeline({
      onComplete: () => setIsReady(true),
    });

    // Phase 1 (0-300ms): Red Cube glows, pieces at center, pulsing
    tl.to({}, { duration: 0.3 }) // hold for red cube

      // Phase 2 (300-900ms): Corners unfold outward
      // TL: rotate and move to upper-left
      .to(meshTL.position, {
        x: finalPositions.tl.x,
        y: finalPositions.tl.y,
        duration: 0.6,
        ease: 'power3.out',
      }, 0.3)
      .to(meshTL.rotation, {
        z: -Math.PI * 1.5,
        duration: 0.6,
        ease: 'power3.out',
      }, 0.3)
      .to(meshTL.scale, {
        x: 1, y: 1, z: 1,
        duration: 0.6,
        ease: 'power3.out',
      }, 0.3)

      // TR: rotate and move to upper-right
      .to(meshTR.position, {
        x: finalPositions.tr.x,
        y: finalPositions.tr.y,
        duration: 0.6,
        ease: 'power3.out',
      }, 0.32)
      .to(meshTR.rotation, {
        z: Math.PI * 1.5,
        duration: 0.6,
        ease: 'power3.out',
      }, 0.32)
      .to(meshTR.scale, {
        x: 1, y: 1, z: 1,
        duration: 0.6,
        ease: 'power3.out',
      }, 0.32)

      // BL: rotate and move to lower-left
      .to(meshBL.position, {
        x: finalPositions.bl.x,
        y: finalPositions.bl.y,
        duration: 0.6,
        ease: 'power3.out',
      }, 0.34)
      .to(meshBL.rotation, {
        z: Math.PI * 1.5,
        duration: 0.6,
        ease: 'power3.out',
      }, 0.34)
      .to(meshBL.scale, {
        x: 1, y: 1, z: 1,
        duration: 0.6,
        ease: 'power3.out',
      }, 0.34)

      // BR: rotate and move to lower-right
      .to(meshBR.position, {
        x: finalPositions.br.x,
        y: finalPositions.br.y,
        duration: 0.6,
        ease: 'power3.out',
      }, 0.36)
      .to(meshBR.rotation, {
        z: -Math.PI * 1.5,
        duration: 0.6,
        ease: 'power3.out',
      }, 0.36)
      .to(meshBR.scale, {
        x: 1, y: 1, z: 1,
        duration: 0.6,
        ease: 'power3.out',
      }, 0.36)

      // Reduce red emissive during unfold
      .to([matTL, matTR, matBL, matBR], {
        emissiveIntensity: 0.05,
        duration: 0.5,
        ease: 'power2.out',
      }, 0.4)

      // Activate spark particles when corners start separating
      .call(() => {
        threeState.sparksActive = true;
        particleMat.opacity = 1.0;
        for (let i = 0; i < particleCount; i++) {
          particleLifetimes[i] = 0.5 + Math.random() * 0.5;
          const pos = particleGeom.attributes.position.array;
          pos[i * 3] = (Math.random() - 0.5) * 0.3;
          pos[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
          pos[i * 3 + 2] = 0.1;
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.02 + Math.random() * 0.06;
          particleVelocities[i].x = Math.cos(angle) * speed;
          particleVelocities[i].y = Math.sin(angle) * speed;
        }
        particleGeom.attributes.position.needsUpdate = true;
      }, [], 0.35)

      // Phase 3 (900-1300ms): Frame assembles — lights power on
      // Snap into final position (already there from phase 2, add a tiny overshoot settle)
      .to(meshTL.position, { x: finalPositions.tl.x, y: finalPositions.tl.y, duration: 0.1, ease: 'back.out(2)' }, 0.9)
      .to(meshTR.position, { x: finalPositions.tr.x, y: finalPositions.tr.y, duration: 0.1, ease: 'back.out(2)' }, 0.9)
      .to(meshBL.position, { x: finalPositions.bl.x, y: finalPositions.bl.y, duration: 0.1, ease: 'back.out(2)' }, 0.9)
      .to(meshBR.position, { x: finalPositions.br.x, y: finalPositions.br.y, duration: 0.1, ease: 'back.out(2)' }, 0.9)

      // Camera shake on lock
      .to(camera.position, { x: 0.03, duration: 0.04, yoyo: true, repeat: 3 }, 0.9)
      .set(camera.position, { x: 0 }, 1.1)

      // Blue energon glow lines illuminate
      .to(blueLight, { intensity: 2.5, duration: 0.3, ease: 'power2.out' }, 0.95)
      // Fade red light down
      .to(redLight, { intensity: 0.3, duration: 0.3, ease: 'power2.out' }, 0.95)

      // Add blue emissive tint to materials
      .to([matTL.emissive, matTR.emissive, matBL.emissive, matBR.emissive], {
        r: 0, g: 0.3, b: 0.8,
        duration: 0.3,
        ease: 'power2.out',
      }, 0.95)
      .to([matTL, matTR, matBL, matBR], {
        emissiveIntensity: 0.15,
        duration: 0.3,
        ease: 'power2.out',
      }, 0.95)

      // Orange side lights power on
      .to(orangeLight1, { intensity: 2, duration: 0.3, ease: 'power2.out' }, 1.0)
      .to(orangeLight2, { intensity: 2, duration: 0.3, ease: 'power2.out' }, 1.0)

      // Phase 4 (1300-1500ms): CRT power-on effect
      .to(crtMat, { opacity: 0.8, duration: 0.05 }, 1.3)
      .to(crtMesh.scale, { y: 1, duration: 0.15, ease: 'power4.out' }, 1.3)
      .to(crtMat, { opacity: 0, duration: 0.1 }, 1.45);

    timelineRef.current = tl;

    // ── Handle window resize ──
    function onResize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    // ── Cleanup ──
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      tl.kill();
      // Dispose Three.js resources
      geometry.dispose();
      matTL.dispose();
      matTR.dispose();
      matBL.dispose();
      matBR.dispose();
      if (matTL.map) matTL.map.dispose();
      if (matTR.map) matTR.map.dispose();
      if (matBL.map) matBL.map.dispose();
      if (matBR.map) matBR.map.dispose();
      particleGeom.dispose();
      particleMat.dispose();
      crtGeom.dispose();
      crtMat.dispose();
      renderer.dispose();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── CLOSE handler ── */
  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);

    if (timelineRef.current) {
      timelineRef.current.kill();
    }

    const three = threeRef.current;
    if (!three) {
      onClose();
      return;
    }

    const {
      meshTL, meshTR, meshBL, meshBR,
      matTL, matTR, matBL, matBR,
      redLight, blueLight, orangeLight1, orangeLight2,
      crtMesh, crtMat, camera,
    } = three;

    // Play close sound — reuse the audio element with a short reverse-ish clip
    try {
      const closeAudio = new Audio(assetUrl('sounds/transform.ogg'));
      closeAudio.volume = 0.4;
      closeAudio.playbackRate = 1.5;
      closeAudio.play().catch(() => {});
    } catch {
      // Audio not available
    }

    const closeTl = gsap.timeline({
      onComplete: () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        onClose();
      },
    });

    closeTl
      // Screen powers off — CRT shrink
      .to(crtMat, { opacity: 0.8, duration: 0.05 }, 0)
      .to(crtMesh.scale, { y: 0.003, duration: 0.12, ease: 'power4.in' }, 0)
      .to(crtMat, { opacity: 0, duration: 0.05 }, 0.12)

      // Hide the YouTube iframe area
      .call(() => setIsReady(false), [], 0.15)

      // Orange lights off
      .to(orangeLight1, { intensity: 0, duration: 0.15 }, 0.1)
      .to(orangeLight2, { intensity: 0, duration: 0.15 }, 0.1)

      // Blue light fades, red returns
      .to(blueLight, { intensity: 0, duration: 0.2 }, 0.15)
      .to(redLight, { intensity: 3, duration: 0.2 }, 0.2)

      // Materials go red emissive again
      .to([matTL.emissive, matTR.emissive, matBL.emissive, matBR.emissive], {
        r: 1, g: 0, b: 0,
        duration: 0.2,
      }, 0.2)
      .to([matTL, matTR, matBL, matBR], {
        emissiveIntensity: 0.5,
        duration: 0.2,
      }, 0.2)

      // Corners fold back to center
      .to([meshTL.position, meshTR.position, meshBL.position, meshBR.position], {
        x: 0, y: 0,
        duration: 0.35,
        ease: 'power3.in',
      }, 0.25)
      .to([meshTL.rotation, meshTR.rotation, meshBL.rotation, meshBR.rotation], {
        z: 0,
        duration: 0.35,
        ease: 'power3.in',
      }, 0.25)
      .to([meshTL.scale, meshTR.scale, meshBL.scale, meshBR.scale], {
        x: 0.1, y: 0.1, z: 0.1,
        duration: 0.35,
        ease: 'power3.in',
      }, 0.25)

      // Collapse to point and fade the overlay
      .to([meshTL.scale, meshTR.scale, meshBL.scale, meshBR.scale], {
        x: 0, y: 0, z: 0,
        duration: 0.15,
        ease: 'power2.in',
      }, 0.6)
      .to(redLight, { intensity: 0, duration: 0.15 }, 0.65)

      // Camera subtle retreat
      .to(camera.position, { z: 6, duration: 0.2, ease: 'power2.in' }, 0.6)

      // Overlay fade
      .to(overlayRef.current, { opacity: 0, duration: 0.1 }, 0.7);
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

  return (
    <div className="tf3d-overlay" ref={overlayRef}>
      {/* Three.js canvas */}
      <canvas className="tf3d-canvas" ref={canvasRef} />

      {/* Close button */}
      <button
        className="tf3d-close-btn"
        onClick={handleClose}
        aria-label="Close player"
      >
        &#10005;
      </button>

      {/* YouTube iframe — positioned over the center "screen" area after animation */}
      {isReady && (
        <div className="tf3d-screen">
          {youtubeId ? (
            <div className="tf3d-video-wrap">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&autoplay=1`}
                title={episode.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="tf3d-video-fallback">
              <div>
                <span className="tf3d-fallback-icon">&#9654;</span>
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

          {/* Episode info below video */}
          <div className="tf3d-episode-info">
            <h2 className="tf3d-episode-title">{episode.title}</h2>
            <p className="tf3d-episode-number">
              {seriesTitle && `${seriesTitle} \u2014 `}
              Season {seasonNum}, Episode {episode.number}
            </p>
            {youtubeId && (
              <p className="tf3d-episode-search">
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
      )}
    </div>
  );
}
