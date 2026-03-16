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

/*
 * The concept: A cube made of mechanical pieces sits at center.
 * Each piece transforms (moves + rotates) to become part of a video player frame.
 * The frame is built from the SAME pieces that formed the cube.
 *
 * Cube decomposition → Frame assembly:
 *   - Top face    → top bar of frame
 *   - Bottom face → bottom bar of frame
 *   - Left face   → left bar of frame
 *   - Right face  → right bar of frame
 *   - Front face  → dissolves/fades (reveals screen)
 *   - Back face   → back panel behind screen
 *   - Corner bolts → move to frame corners
 *   - Center gears → spin during transform, then fade
 */

export default function TransformPlayer({ episode, seasonNum, seriesTitle, onClose }) {
  const canvasRef = useRef(null);
  const iframeRef = useRef(null);
  const threeRef = useRef(null);
  const [showVideo, setShowVideo] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const videoData = episode?.video || {};
  const youtubeId = extractYouTubeId(videoData.youtube);
  const searchQuery = encodeURIComponent(
    `${episode?.title || ''} ${seriesTitle || 'Transformers'} full episode`
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = window.innerWidth;
    const H = window.innerHeight;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 2.2;

    // ── Scene ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a14);

    // ── Camera ──
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
    camera.position.set(0, 0, 8);

    // ── Env map ──
    const pmrem = new THREE.PMREMGenerator(renderer);
    const es = new THREE.Scene();
    es.add(new THREE.HemisphereLight(0x6688cc, 0x332211, 3));
    scene.environment = pmrem.fromScene(es, 0.04).texture;
    pmrem.dispose();

    // ── Lights ──
    scene.add(new THREE.AmbientLight(0x9999bb, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(3, 4, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x4477ff, 1.0);
    fill.position.set(-4, 2, 4);
    scene.add(fill);

    // ── Materials ──
    const redMetal = new THREE.MeshPhysicalMaterial({
      color: 0xcc2222, metalness: 0.8, roughness: 0.2,
      clearcoat: 0.4, clearcoatRoughness: 0.1,
    });
    const blueMetal = new THREE.MeshPhysicalMaterial({
      color: 0x2233aa, metalness: 0.8, roughness: 0.25,
    });
    const darkMetal = new THREE.MeshPhysicalMaterial({
      color: 0x222233, metalness: 0.85, roughness: 0.2,
    });
    const boltMat = new THREE.MeshPhysicalMaterial({
      color: 0x888899, metalness: 0.9, roughness: 0.15,
    });
    const gearMat = new THREE.MeshPhysicalMaterial({
      color: 0x666677, metalness: 0.9, roughness: 0.1,
    });
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x0088ff, transparent: true, opacity: 0,
    });

    const allMats = [redMetal, blueMetal, darkMetal, boltMat, gearMat, glowMat];

    // ── Frame target dimensions (what the pieces transform INTO) ──
    const frameW = 6.4;  // 16:9 ratio frame
    const frameH = 4.0;
    const barThick = 0.28;
    const barDepth = 0.3;

    // ── Cube size (starting shape) ──
    const cubeSize = 1.2;
    const cs = cubeSize;

    // ── BUILD PIECES ──
    // Each piece starts as part of the cube, ends as part of the frame
    const pieces = [];
    const allGeos = [];

    function makePiece(geo, mat, startPos, startRot, startScale, endPos, endRot, endScale) {
      allGeos.push(geo);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(startPos.x, startPos.y, startPos.z);
      mesh.rotation.set(startRot.x, startRot.y, startRot.z);
      mesh.scale.set(startScale.x, startScale.y, startScale.z);
      scene.add(mesh);
      pieces.push({
        mesh,
        end: { pos: endPos, rot: endRot, scale: endScale },
      });
      return mesh;
    }

    // ── TOP BAR: starts as top face of cube → stretches into top bar ──
    makePiece(
      new THREE.BoxGeometry(1, 0.15, 1),
      redMetal,
      { x: 0, y: cs / 2, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: cs, y: 1, z: cs },
      { x: 0, y: frameH / 2 - barThick / 2, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: frameW, y: 1, z: barDepth / 0.15 }
    );

    // ── BOTTOM BAR: starts as bottom face → stretches into bottom bar ──
    makePiece(
      new THREE.BoxGeometry(1, 0.15, 1),
      redMetal,
      { x: 0, y: -cs / 2, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: cs, y: 1, z: cs },
      { x: 0, y: -frameH / 2 + barThick / 2, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: frameW, y: 1, z: barDepth / 0.15 }
    );

    // ── LEFT BAR: starts as left face (rotated) → becomes left bar ──
    makePiece(
      new THREE.BoxGeometry(0.15, 1, 1),
      blueMetal,
      { x: -cs / 2, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 1, y: cs, z: cs },
      { x: -frameW / 2 + barThick / 2, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 1, y: frameH - barThick * 2, z: barDepth / 1 }
    );

    // ── RIGHT BAR: starts as right face → becomes right bar ──
    makePiece(
      new THREE.BoxGeometry(0.15, 1, 1),
      blueMetal,
      { x: cs / 2, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 1, y: cs, z: cs },
      { x: frameW / 2 - barThick / 2, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 1, y: frameH - barThick * 2, z: barDepth / 1 }
    );

    // ── BACK PANEL: starts as back face → expands behind the screen ──
    makePiece(
      new THREE.BoxGeometry(1, 1, 0.08),
      darkMetal,
      { x: 0, y: 0, z: -cs / 2 },
      { x: 0, y: 0, z: 0 },
      { x: cs, y: cs, z: 1 },
      { x: 0, y: 0, z: -barDepth / 2 },
      { x: 0, y: 0, z: 0 },
      { x: frameW - barThick, y: frameH - barThick, z: 1 }
    );

    // ── FRONT FACE: dissolves during transform ──
    const frontGeo = new THREE.BoxGeometry(1, 1, 0.08);
    allGeos.push(frontGeo);
    const frontFace = new THREE.Mesh(frontGeo, darkMetal.clone());
    allMats.push(frontFace.material);
    frontFace.material.transparent = true;
    frontFace.position.set(0, 0, cs / 2);
    frontFace.scale.set(cs, cs, 1);
    scene.add(frontFace);

    // ── 4 CORNER BOLTS: small cylinders at cube corners → move to frame corners ──
    const boltGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.15, 8);
    allGeos.push(boltGeo);
    const boltRadius = cs * 0.45;
    const boltCorners = [
      { sx: -boltRadius, sy: boltRadius, ex: -frameW / 2 + 0.15, ey: frameH / 2 - 0.15 },
      { sx: boltRadius, sy: boltRadius, ex: frameW / 2 - 0.15, ey: frameH / 2 - 0.15 },
      { sx: -boltRadius, sy: -boltRadius, ex: -frameW / 2 + 0.15, ey: -frameH / 2 + 0.15 },
      { sx: boltRadius, sy: -boltRadius, ex: frameW / 2 - 0.15, ey: -frameH / 2 + 0.15 },
    ];
    const bolts = boltCorners.map(({ sx, sy, ex, ey }) => {
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.position.set(sx, sy, cs / 2 + 0.05);
      bolt.rotation.x = Math.PI / 2;
      scene.add(bolt);
      return { mesh: bolt, endX: ex, endY: ey };
    });

    // ── 2 GEARS: spin during transform for mechanical feel ──
    const gearGeo = new THREE.TorusGeometry(0.2, 0.04, 6, 16);
    allGeos.push(gearGeo);
    const gear1 = new THREE.Mesh(gearGeo, gearMat);
    gear1.position.set(-0.25, 0, cs / 2 + 0.1);
    scene.add(gear1);
    const gear2 = new THREE.Mesh(gearGeo, gearMat);
    gear2.position.set(0.25, 0, cs / 2 + 0.1);
    scene.add(gear2);

    // ── GLOW STRIPS: appear on frame bars after transform ──
    const glowGeos = [];
    const glows = [];
    [[0, frameH / 2 - barThick / 2, frameW * 0.8, 0.05],
     [0, -frameH / 2 + barThick / 2, frameW * 0.8, 0.05],
     [-frameW / 2 + barThick / 2, 0, 0.05, (frameH - barThick * 2) * 0.8],
     [frameW / 2 - barThick / 2, 0, 0.05, (frameH - barThick * 2) * 0.8],
    ].forEach(([x, y, w, h]) => {
      const g = new THREE.BoxGeometry(w, h, 0.01);
      glowGeos.push(g);
      allGeos.push(g);
      const m = glowMat.clone();
      allMats.push(m);
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, barDepth / 2 + 0.01);
      scene.add(mesh);
      glows.push(mesh);
    });

    // ── Store refs ──
    threeRef.current = {
      renderer, scene, camera, pieces, frontFace, bolts, gear1, gear2, glows,
      allGeos, allMats, frameW, frameH, barThick,
      screenW: frameW - barThick * 2 - 0.1,
      screenH: frameH - barThick * 2 - 0.1,
      animId: null, tl: null,
    };

    // ── Render loop ──
    let running = true;
    let time = 0;
    function animate() {
      if (!running) return;
      threeRef.current.animId = requestAnimationFrame(animate);
      time += 0.016;
      gear1.rotation.z = time * 8;
      gear2.rotation.z = -time * 10;
      renderer.render(scene, camera);
      updateIframe();
    }

    function updateIframe() {
      const el = iframeRef.current;
      if (!el || !showVideo) return;
      const sw = threeRef.current.screenW;
      const sh = threeRef.current.screenH;
      const tl = new THREE.Vector3(-sw / 2, sh / 2, 0).project(camera);
      const br = new THREE.Vector3(sw / 2, -sh / 2, 0).project(camera);
      el.style.left = ((tl.x * 0.5 + 0.5) * W) + 'px';
      el.style.top = ((-tl.y * 0.5 + 0.5) * H) + 'px';
      el.style.width = ((br.x - tl.x) * 0.5 * W) + 'px';
      el.style.height = ((tl.y - br.y) * 0.5 * H) + 'px';
    }

    animate();

    // ── Sound ──
    try {
      const audio = new Audio(assetUrl('sounds/transform.ogg'));
      audio.volume = 0.7;
      audio.play().catch(() => {});
    } catch {}

    // ── TRANSFORM ANIMATION (1 second) ──
    const tl = gsap.timeline({
      onComplete: () => setShowVideo(true),
    });
    threeRef.current.tl = tl;

    // Phase 1 (0-0.15s): Cube sits, camera pulls back slightly
    tl.to(camera.position, { z: 9, duration: 1.0, ease: 'power2.out' }, 0);

    // Phase 2 (0.15-0.8s): All pieces transform simultaneously
    pieces.forEach(({ mesh, end }, i) => {
      const delay = 0.15 + i * 0.03;
      tl.to(mesh.position, {
        x: end.pos.x, y: end.pos.y, z: end.pos.z,
        duration: 0.65, ease: 'power2.inOut',
      }, delay);
      tl.to(mesh.rotation, {
        x: end.rot.x, y: end.rot.y, z: end.rot.z,
        duration: 0.65, ease: 'power2.inOut',
      }, delay);
      tl.to(mesh.scale, {
        x: end.scale.x, y: end.scale.y, z: end.scale.z,
        duration: 0.65, ease: 'power2.inOut',
      }, delay);
    });

    // Front face dissolves
    tl.to(frontFace.material, {
      opacity: 0, duration: 0.4, ease: 'power2.in',
    }, 0.2);
    tl.to(frontFace.scale, {
      x: frameW * 0.5, y: frameH * 0.5,
      duration: 0.4, ease: 'power2.in',
    }, 0.2);

    // Bolts fly to corners
    bolts.forEach(({ mesh, endX, endY }, i) => {
      tl.to(mesh.position, {
        x: endX, y: endY, z: barDepth / 2 + 0.08,
        duration: 0.5, ease: 'back.out(1.5)',
      }, 0.3 + i * 0.04);
      // Bolt spins during flight
      tl.to(mesh.rotation, {
        z: Math.PI * 3,
        duration: 0.5, ease: 'power2.out',
      }, 0.3 + i * 0.04);
    });

    // Gears spin fast then fade
    tl.to(gear1.material, { opacity: 0, transparent: true, duration: 0.3 }, 0.5);
    tl.to(gear2.material, { opacity: 0, transparent: true, duration: 0.3 }, 0.5);
    tl.to(gear1.scale, { x: 2, y: 2, duration: 0.3 }, 0.5);
    tl.to(gear2.scale, { x: 2, y: 2, duration: 0.3 }, 0.5);

    // Glow strips power on
    glows.forEach((g, i) => {
      tl.to(g.material, {
        opacity: 0.8, duration: 0.2, ease: 'power2.out',
      }, 0.7 + i * 0.04);
    });

    // Glow pulse loop
    tl.call(() => {
      glows.forEach(g => {
        gsap.to(g.material, {
          opacity: 0.3, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut',
        });
      });
    }, [], 0.95);

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
      allGeos.forEach(g => g.dispose());
      allMats.forEach(m => m.dispose());
      if (scene.environment) scene.environment.dispose();
      renderer.dispose();
    };
  }, []); // eslint-disable-line

  // Position iframe when video shows
  useEffect(() => {
    if (!showVideo || !iframeRef.current || !threeRef.current) return;
    const { screenW, screenH, camera } = threeRef.current;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const tl = new THREE.Vector3(-screenW / 2, screenH / 2, 0).project(camera);
    const br = new THREE.Vector3(screenW / 2, -screenH / 2, 0).project(camera);
    const el = iframeRef.current;
    el.style.left = ((tl.x * 0.5 + 0.5) * W) + 'px';
    el.style.top = ((-tl.y * 0.5 + 0.5) * H) + 'px';
    el.style.width = ((br.x - tl.x) * 0.5 * W) + 'px';
    el.style.height = ((tl.y - br.y) * 0.5 * H) + 'px';
  }, [showVideo]);

  // Close
  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setShowVideo(false);

    const three = threeRef.current;
    if (!three) { onClose(); return; }
    if (three.tl) three.tl.kill();

    // Kill glow loops
    three.glows.forEach(g => gsap.killTweensOf(g.material));

    try {
      const audio = new Audio(assetUrl('sounds/transform.ogg'));
      audio.volume = 0.4;
      audio.playbackRate = 1.5;
      audio.play().catch(() => {});
    } catch {}

    const closeTl = gsap.timeline({ onComplete: onClose });

    // Glows off
    three.glows.forEach(g => {
      closeTl.to(g.material, { opacity: 0, duration: 0.15 }, 0);
    });

    // Pieces transform back to cube
    three.pieces.forEach(({ mesh }, i) => {
      const s = mesh.userData;
      closeTl.to(mesh.position, { x: 0, y: (i < 2 ? 1 : i < 4 ? -1 : 0) * 0.6, z: 0, duration: 0.5, ease: 'power2.in' }, 0.1);
      closeTl.to(mesh.scale, { x: 1.2, y: 1.2, z: 1.2, duration: 0.5, ease: 'power2.in' }, 0.1);
    });

    // Bolts back
    three.bolts.forEach(({ mesh }) => {
      closeTl.to(mesh.position, { x: 0, y: 0, z: 0.7, duration: 0.4, ease: 'power2.in' }, 0.1);
    });

    // Camera push in
    closeTl.to(three.camera.position, { z: 6, duration: 0.5, ease: 'power2.in' }, 0.1);

    // Fade
    closeTl.to(canvasRef.current, { opacity: 0, duration: 0.2 }, 0.5);
  }, [isClosing, onClose]);

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
    <div className={`tfp-overlay ${isClosing ? 'tfp-closing' : ''}`}>
      <canvas className="tfp-canvas" ref={canvasRef} />
      <button className="tfp-close" onClick={handleClose} aria-label="Close">&#10005;</button>

      {showVideo && (
        <div className="tfp-iframe-wrap" ref={iframeRef}>
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
              <span>&#9654;</span>
              {videoData.dailymotion ? (
                <a href={videoData.dailymotion} target="_blank" rel="noopener noreferrer">Watch on Dailymotion</a>
              ) : (
                <a href={`https://www.youtube.com/results?search_query=${searchQuery}`} target="_blank" rel="noopener noreferrer">Search YouTube</a>
              )}
            </div>
          )}
        </div>
      )}

      {showVideo && (
        <div className="tfp-info">
          <h2>{episode.title}</h2>
          <p>{seriesTitle && `${seriesTitle} — `}S{seasonNum} E{episode.number}</p>
          {youtubeId && (
            <p className="tfp-search">
              Video not working? <a href={`https://www.youtube.com/results?search_query=${searchQuery}`} target="_blank" rel="noopener noreferrer">Search YouTube</a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
