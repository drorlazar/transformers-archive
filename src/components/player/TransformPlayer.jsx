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

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 2.5;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08080f);

    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
    camera.position.set(0, 0, 8);

    // Env map
    const pmrem = new THREE.PMREMGenerator(renderer);
    const es = new THREE.Scene();
    es.add(new THREE.HemisphereLight(0x6688cc, 0x332211, 3));
    scene.environment = pmrem.fromScene(es, 0.04).texture;
    pmrem.dispose();

    // Lights
    scene.add(new THREE.AmbientLight(0xaaaacc, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(3, 4, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x4477ff, 1.2);
    fill.position.set(-4, 2, 4);
    scene.add(fill);
    const rim = new THREE.PointLight(0xff4400, 1.5, 15);
    rim.position.set(0, -3, 5);
    scene.add(rim);

    // Materials
    const redMetal = new THREE.MeshPhysicalMaterial({
      color: 0xcc2222, metalness: 0.8, roughness: 0.2,
      clearcoat: 0.5, clearcoatRoughness: 0.1,
    });
    const blueMetal = new THREE.MeshPhysicalMaterial({
      color: 0x2838aa, metalness: 0.8, roughness: 0.2,
      clearcoat: 0.3,
    });
    const darkMetal = new THREE.MeshPhysicalMaterial({
      color: 0x1a1a2a, metalness: 0.9, roughness: 0.15,
    });
    const boltMat = new THREE.MeshPhysicalMaterial({
      color: 0x999aaa, metalness: 0.95, roughness: 0.1,
    });
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x0099ff, transparent: true, opacity: 0,
    });

    const allMats = [redMetal, blueMetal, darkMetal, boltMat, glowMat];
    const allGeos = [];

    // Frame dimensions — BIGGER
    const frameW = 7.5;
    const frameH = 4.6;
    const barW = 0.35; // bar thickness
    const barD = 0.4;  // bar depth (z)

    // Cube size
    const cs = 1.3;

    // Helper
    const pieces = [];
    function addPiece(geo, mat, sPos, sRot, sScale, ePos, eRot, eScale) {
      allGeos.push(geo);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(sPos[0], sPos[1], sPos[2]);
      mesh.rotation.set(sRot[0], sRot[1], sRot[2]);
      mesh.scale.set(sScale[0], sScale[1], sScale[2]);
      scene.add(mesh);
      pieces.push({ mesh, ePos, eRot, eScale });
      return mesh;
    }

    // ── TOP BAR: cube top face → rotates forward and stretches wide ──
    addPiece(
      new THREE.BoxGeometry(1, barW, barD),
      redMetal,
      [0, cs * 0.5, 0],          // start: top of cube
      [0, 0, 0],
      [cs, 1, cs * 0.8],
      [0, frameH / 2 - barW / 2, 0], // end: top of frame
      [0, 0, 0],
      [frameW, 1, 1]
    );

    // ── BOTTOM BAR: cube bottom → rotates and stretches ──
    addPiece(
      new THREE.BoxGeometry(1, barW, barD),
      redMetal,
      [0, -cs * 0.5, 0],
      [0, 0, 0],
      [cs, 1, cs * 0.8],
      [0, -frameH / 2 + barW / 2, 0],
      [0, 0, 0],
      [frameW, 1, 1]
    );

    // ── LEFT BAR: starts rotated 90° on Z, unfolds to vertical ──
    addPiece(
      new THREE.BoxGeometry(barW, 1, barD),
      blueMetal,
      [-cs * 0.5, 0, 0],
      [0, 0, Math.PI / 2],      // starts rotated 90°
      [1, cs, cs * 0.8],
      [-frameW / 2 + barW / 2, 0, 0],
      [0, 0, 0],                 // ends upright
      [1, frameH - barW * 2, 1]
    );

    // ── RIGHT BAR: starts rotated -90° on Z, unfolds ──
    addPiece(
      new THREE.BoxGeometry(barW, 1, barD),
      blueMetal,
      [cs * 0.5, 0, 0],
      [0, 0, -Math.PI / 2],
      [1, cs, cs * 0.8],
      [frameW / 2 - barW / 2, 0, 0],
      [0, 0, 0],
      [1, frameH - barW * 2, 1]
    );

    // ── BACK PANEL: flips from front face of cube to behind screen ──
    addPiece(
      new THREE.BoxGeometry(1, 1, 0.06),
      darkMetal,
      [0, 0, cs * 0.5],          // starts as front face
      [0, Math.PI, 0],           // facing us, will flip
      [cs, cs, 1],
      [0, 0, -barD * 0.5],       // ends behind screen
      [0, 0, 0],
      [frameW - barW * 2, frameH - barW * 2, 1]
    );

    // ── FRONT FACE: dissolves ──
    const frontGeo = new THREE.BoxGeometry(cs, cs, 0.06);
    allGeos.push(frontGeo);
    const frontMat = darkMetal.clone();
    frontMat.transparent = true;
    allMats.push(frontMat);
    const frontFace = new THREE.Mesh(frontGeo, frontMat);
    frontFace.position.set(0, 0, cs * 0.5);
    scene.add(frontFace);

    // ── 4 CORNER BRACKETS: L-shaped pieces at cube edges → frame corners ──
    const bracketSize = 0.5;
    const brackets = [];
    const bracketTargets = [
      { ex: -frameW / 2 + bracketSize / 2, ey: frameH / 2 - bracketSize / 2, sx: -cs * 0.35, sy: cs * 0.35, sRotZ: Math.PI * 0.5 },
      { ex: frameW / 2 - bracketSize / 2, ey: frameH / 2 - bracketSize / 2, sx: cs * 0.35, sy: cs * 0.35, sRotZ: -Math.PI * 0.5 },
      { ex: -frameW / 2 + bracketSize / 2, ey: -frameH / 2 + bracketSize / 2, sx: -cs * 0.35, sy: -cs * 0.35, sRotZ: -Math.PI * 0.5 },
      { ex: frameW / 2 - bracketSize / 2, ey: -frameH / 2 + bracketSize / 2, sx: cs * 0.35, sy: -cs * 0.35, sRotZ: Math.PI * 0.5 },
    ];

    bracketTargets.forEach(({ ex, ey, sx, sy, sRotZ }) => {
      const group = new THREE.Group();
      const h = new THREE.Mesh(new THREE.BoxGeometry(bracketSize, 0.12, barD * 0.8), redMetal);
      h.position.y = bracketSize / 2 - 0.06;
      group.add(h);
      allGeos.push(h.geometry);
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.12, bracketSize, barD * 0.8), redMetal);
      v.position.x = -bracketSize / 2 + 0.06;
      group.add(v);
      allGeos.push(v.geometry);

      group.position.set(sx, sy, cs * 0.5 + 0.05);
      group.rotation.z = sRotZ;
      scene.add(group);
      brackets.push({ mesh: group, ex, ey, sRotZ });
    });

    // ── 8 BOLTS: tiny cylinders on cube → scatter to frame positions ──
    const boltGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.18, 6);
    allGeos.push(boltGeo);
    const boltPositions = [
      // On cube face
      { sx: -cs * 0.3, sy: cs * 0.3 },
      { sx: cs * 0.3, sy: cs * 0.3 },
      { sx: -cs * 0.3, sy: -cs * 0.3 },
      { sx: cs * 0.3, sy: -cs * 0.3 },
      { sx: 0, sy: cs * 0.3 },
      { sx: 0, sy: -cs * 0.3 },
      { sx: -cs * 0.3, sy: 0 },
      { sx: cs * 0.3, sy: 0 },
    ];
    // End positions along frame bars
    const boltEnds = [
      { ex: -frameW * 0.35, ey: frameH / 2 - barW / 2 },
      { ex: frameW * 0.35, ey: frameH / 2 - barW / 2 },
      { ex: -frameW * 0.35, ey: -frameH / 2 + barW / 2 },
      { ex: frameW * 0.35, ey: -frameH / 2 + barW / 2 },
      { ex: 0, ey: frameH / 2 - barW / 2 },
      { ex: 0, ey: -frameH / 2 + barW / 2 },
      { ex: -frameW / 2 + barW / 2, ey: 0 },
      { ex: frameW / 2 - barW / 2, ey: 0 },
    ];
    const bolts = boltPositions.map(({ sx, sy }, i) => {
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.position.set(sx, sy, cs * 0.5 + 0.1);
      bolt.rotation.x = Math.PI / 2;
      scene.add(bolt);
      return { mesh: bolt, ...boltEnds[i] };
    });

    // ── GLOW STRIPS on final frame ──
    const glows = [];
    [
      [0, frameH / 2 - barW / 2, frameW * 0.85, 0.06],
      [0, -frameH / 2 + barW / 2, frameW * 0.85, 0.06],
      [-frameW / 2 + barW / 2, 0, 0.06, (frameH - barW * 2) * 0.85],
      [frameW / 2 - barW / 2, 0, 0.06, (frameH - barW * 2) * 0.85],
    ].forEach(([x, y, w, h]) => {
      const g = new THREE.BoxGeometry(w, h, 0.01);
      allGeos.push(g);
      const m = glowMat.clone();
      allMats.push(m);
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, barD / 2 + 0.01);
      scene.add(mesh);
      glows.push(mesh);
    });

    // Store
    const screenW = frameW - barW * 2 - 0.15;
    const screenH = frameH - barW * 2 - 0.15;
    threeRef.current = {
      renderer, scene, camera, pieces, frontFace, frontMat, brackets, bolts, glows,
      allGeos, allMats, screenW, screenH, animId: null, tl: null,
    };

    // Render
    let running = true;
    function animate() {
      if (!running) return;
      threeRef.current.animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
      // Keep iframe aligned
      if (iframeRef.current && showVideo) {
        const tlv = new THREE.Vector3(-screenW / 2, screenH / 2, 0).project(camera);
        const brv = new THREE.Vector3(screenW / 2, -screenH / 2, 0).project(camera);
        const el = iframeRef.current;
        el.style.left = ((tlv.x * 0.5 + 0.5) * W) + 'px';
        el.style.top = ((-tlv.y * 0.5 + 0.5) * H) + 'px';
        el.style.width = ((brv.x - tlv.x) * 0.5 * W) + 'px';
        el.style.height = ((tlv.y - brv.y) * 0.5 * H) + 'px';
      }
    }
    animate();

    // Sound
    try {
      const a = new Audio(assetUrl('sounds/transform.ogg'));
      a.volume = 0.7; a.play().catch(() => {});
    } catch {}

    // ── ANIMATION ──
    const tl = gsap.timeline({ onComplete: () => setShowVideo(true) });
    threeRef.current.tl = tl;

    // Camera pull back
    tl.to(camera.position, { z: 10, duration: 1.1, ease: 'power2.out' }, 0);

    // Pieces transform with ROTATION
    pieces.forEach(({ mesh, ePos, eRot, eScale }, i) => {
      const d = 0.15 + i * 0.04;
      tl.to(mesh.position, { x: ePos[0], y: ePos[1], z: ePos[2], duration: 0.7, ease: 'power3.inOut' }, d);
      tl.to(mesh.rotation, { x: eRot[0], y: eRot[1], z: eRot[2], duration: 0.7, ease: 'power3.inOut' }, d);
      tl.to(mesh.scale, { x: eScale[0], y: eScale[1], z: eScale[2], duration: 0.7, ease: 'power3.inOut' }, d);
    });

    // Front face dissolves
    tl.to(frontMat, { opacity: 0, duration: 0.35 }, 0.15);

    // Corner brackets rotate into place
    brackets.forEach(({ mesh, ex, ey, sRotZ }, i) => {
      tl.to(mesh.position, { x: ex, y: ey, z: barD / 2, duration: 0.6, ease: 'back.out(1.3)' }, 0.25 + i * 0.04);
      tl.to(mesh.rotation, { z: 0, duration: 0.6, ease: 'power3.out' }, 0.25 + i * 0.04);
    });

    // Bolts spin and fly to frame
    bolts.forEach(({ mesh, ex, ey }, i) => {
      tl.to(mesh.position, { x: ex, y: ey, z: barD / 2 + 0.1, duration: 0.5, ease: 'back.out(1.2)' }, 0.3 + i * 0.025);
      tl.to(mesh.rotation, { z: Math.PI * 4, duration: 0.5, ease: 'power2.out' }, 0.3 + i * 0.025);
    });

    // Glow strips on
    glows.forEach((g, i) => {
      tl.to(g.material, { opacity: 0.9, duration: 0.2, ease: 'power2.out' }, 0.75 + i * 0.04);
    });
    tl.call(() => {
      glows.forEach(g => {
        gsap.to(g.material, { opacity: 0.35, duration: 1.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      });
    }, [], 1.0);

    // Resize
    function onResize() {
      const w = window.innerWidth; const h = window.innerHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    return () => {
      running = false;
      if (threeRef.current?.animId) cancelAnimationFrame(threeRef.current.animId);
      tl.kill(); window.removeEventListener('resize', onResize);
      allGeos.forEach(g => g.dispose()); allMats.forEach(m => m.dispose());
      if (scene.environment) scene.environment.dispose();
      renderer.dispose();
    };
  }, []); // eslint-disable-line

  // Iframe position on show
  useEffect(() => {
    if (!showVideo || !iframeRef.current || !threeRef.current) return;
    const { screenW, screenH, camera } = threeRef.current;
    const W = window.innerWidth; const H = window.innerHeight;
    const tlv = new THREE.Vector3(-screenW / 2, screenH / 2, 0).project(camera);
    const brv = new THREE.Vector3(screenW / 2, -screenH / 2, 0).project(camera);
    const el = iframeRef.current;
    el.style.left = ((tlv.x * 0.5 + 0.5) * W) + 'px';
    el.style.top = ((-tlv.y * 0.5 + 0.5) * H) + 'px';
    el.style.width = ((brv.x - tlv.x) * 0.5 * W) + 'px';
    el.style.height = ((tlv.y - brv.y) * 0.5 * H) + 'px';
  }, [showVideo]);

  // Close
  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true); setShowVideo(false);
    const three = threeRef.current;
    if (!three) { onClose(); return; }
    if (three.tl) three.tl.kill();
    three.glows.forEach(g => gsap.killTweensOf(g.material));

    try { const a = new Audio(assetUrl('sounds/transform.ogg')); a.volume = 0.4; a.playbackRate = 1.5; a.play().catch(() => {}); } catch {}

    const closeTl = gsap.timeline({ onComplete: onClose });
    // Glows off
    three.glows.forEach(g => closeTl.to(g.material, { opacity: 0, duration: 0.12 }, 0));
    // Pieces back to cube positions with rotation
    three.pieces.forEach(({ mesh }, i) => {
      closeTl.to(mesh.position, { x: 0, y: (i < 2 ? (i === 0 ? 0.65 : -0.65) : 0), z: 0, duration: 0.5, ease: 'power3.in' }, 0.05 + i * 0.03);
      closeTl.to(mesh.scale, { x: 1.3, y: 1.3, z: 1.3, duration: 0.5, ease: 'power3.in' }, 0.05 + i * 0.03);
      closeTl.to(mesh.rotation, { x: 0, y: i === 4 ? Math.PI : 0, z: i >= 2 && i < 4 ? (i === 2 ? Math.PI / 2 : -Math.PI / 2) : 0, duration: 0.5, ease: 'power3.in' }, 0.05 + i * 0.03);
    });
    // Brackets + bolts back
    three.brackets.forEach(({ mesh, sRotZ }) => closeTl.to(mesh.position, { x: 0, y: 0, z: 0.7, duration: 0.4, ease: 'power3.in' }, 0.1));
    three.bolts.forEach(({ mesh }) => closeTl.to(mesh.position, { x: 0, y: 0, z: 0.7, duration: 0.4, ease: 'power3.in' }, 0.1));
    // Camera
    closeTl.to(three.camera.position, { z: 6, duration: 0.5, ease: 'power2.in' }, 0.1);
    closeTl.to(canvasRef.current, { opacity: 0, duration: 0.15 }, 0.5);
  }, [isClosing, onClose]);

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [handleClose]);

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
            <iframe className="tfp-iframe"
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&autoplay=1`}
              title={episode.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen />
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
            <p className="tfp-search">Video not working? <a href={`https://www.youtube.com/results?search_query=${searchQuery}`} target="_blank" rel="noopener noreferrer">Search YouTube</a></p>
          )}
        </div>
      )}
    </div>
  );
}
