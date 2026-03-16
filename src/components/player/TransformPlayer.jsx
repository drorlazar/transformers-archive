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

// Beveled box — chunky chamfered edges that catch light like real machined metal
function bevelBox(w, h, d, bevel = 0.06) {
  const shape = new THREE.Shape();
  const hw = w / 2 - bevel;
  const hh = h / 2 - bevel;
  // Chamfered rectangle — 45° cuts at corners
  shape.moveTo(-hw, -h / 2);
  shape.lineTo(hw, -h / 2);
  shape.lineTo(w / 2, -hh);
  shape.lineTo(w / 2, hh);
  shape.lineTo(hw, h / 2);
  shape.lineTo(-hw, h / 2);
  shape.lineTo(-w / 2, hh);
  shape.lineTo(-w / 2, -hh);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: true,
    bevelThickness: bevel * 0.7,
    bevelSize: bevel * 0.7,
    bevelSegments: 4,
  });
}

// Gear shape with teeth
function gearGeo(outerR, innerR, teeth, thickness) {
  const shape = new THREE.Shape();
  const steps = teeth * 2;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  // Center hole
  const hole = new THREE.Path();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const x = Math.cos(a) * innerR * 0.4;
    const y = Math.sin(a) * innerR * 0.4;
    if (i === 0) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  }
  shape.holes.push(hole);
  return new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2,
  });
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
    renderer.toneMappingExposure = 2.8;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06060c);

    const aspect = W / H;
    const camZ = aspect < 1.2 ? 8 + (1.2 - aspect) * 8 : 8;
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
    camera.position.set(0, 0, camZ);

    // Rich env map
    const pmrem = new THREE.PMREMGenerator(renderer);
    const es = new THREE.Scene();
    es.add(new THREE.HemisphereLight(0x8899cc, 0x443322, 4));
    const ep1 = new THREE.PointLight(0xff5500, 3, 25); ep1.position.set(6, 4, 6); es.add(ep1);
    const ep2 = new THREE.PointLight(0x0055ff, 2, 25); ep2.position.set(-6, -3, 6); es.add(ep2);
    scene.environment = pmrem.fromScene(es, 0.04).texture;
    pmrem.dispose();

    // Animated lights — will orbit during animation
    scene.add(new THREE.AmbientLight(0x666688, 0.6));
    const keyLight = new THREE.DirectionalLight(0xffeedd, 4);
    keyLight.position.set(4, 5, 8);
    scene.add(keyLight);

    const orbitLight1 = new THREE.PointLight(0xff3300, 2.5, 18);
    orbitLight1.position.set(3, 2, 5);
    scene.add(orbitLight1);
    const orbitLight2 = new THREE.PointLight(0x0044ff, 2.0, 18);
    orbitLight2.position.set(-3, -2, 5);
    scene.add(orbitLight2);
    const orbitLight3 = new THREE.PointLight(0xff8800, 1.5, 12);
    orbitLight3.position.set(0, 4, 4);
    scene.add(orbitLight3);

    // ── MATERIALS — textured when available, rich fallbacks ──
    const allMats = [];
    const allGeos = [];
    const loader = new THREE.TextureLoader();

    // Try loading textures (graceful fallback if missing)
    function loadTex(path) {
      const tex = loader.load(assetUrl(path), undefined, undefined, () => {});
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    let redTex, blueTex, darkTex, circuitTex;
    try {
      redTex = loadTex('textures/red-metal.jpg');
      redTex.repeat.set(2, 2);
      blueTex = loadTex('textures/blue-metal.jpg');
      blueTex.repeat.set(2, 3);
      darkTex = loadTex('textures/dark-metal.jpg');
      darkTex.repeat.set(3, 3);
      circuitTex = loadTex('textures/circuit-glow.jpg');
      circuitTex.repeat.set(4, 1);
    } catch {}

    // Crimson — weathered red armor plating
    const crimson = new THREE.MeshPhysicalMaterial({
      color: 0xcc3333,
      map: redTex || null,
      metalness: 0.85, roughness: 0.18,
      clearcoat: 0.7, clearcoatRoughness: 0.06,
    });
    // Navy — deep indigo-blue panels
    const navy = new THREE.MeshPhysicalMaterial({
      color: 0x2a3088,
      map: blueTex || null,
      metalness: 0.85, roughness: 0.18,
      clearcoat: 0.5, clearcoatRoughness: 0.08,
    });
    // Gunmetal — back panels
    const gunmetal = new THREE.MeshPhysicalMaterial({
      color: 0x2a2a38,
      map: darkTex || null,
      metalness: 0.95, roughness: 0.08,
      clearcoat: 0.4,
    });
    // Chrome bolts — mirror finish
    const chrome = new THREE.MeshPhysicalMaterial({
      color: 0xbbbbcc, metalness: 1.0, roughness: 0.03,
      clearcoat: 1.0, clearcoatRoughness: 0.01,
    });
    // Gear steel
    const steel = new THREE.MeshPhysicalMaterial({
      color: 0x607080, metalness: 0.95, roughness: 0.08,
      clearcoat: 0.4,
    });
    // LED glow
    const ledGlow = new THREE.MeshBasicMaterial({
      color: 0x22aaff, transparent: true, opacity: 0,
    });
    // Orange glow
    const orangeGlow = new THREE.MeshBasicMaterial({
      color: 0xff6600, transparent: true, opacity: 0,
    });

    allMats.push(crimson, navy, gunmetal, chrome, steel, ledGlow, orangeGlow);

    // ── DIMENSIONS ──
    const frameW = 7.5, frameH = 4.6;
    const barW = 0.38, barD = 0.4;
    const cs = 1.3; // cube size

    // ── HELPER ──
    const pieces = [];
    function addPiece(geo, mat, sPos, sRot, sScale, ePos, eRot, eScale) {
      allGeos.push(geo);
      const mesh = new THREE.Mesh(geo, mat);
      // Center extruded geometry
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      const cx = -(bb.max.x + bb.min.x) / 2;
      const cy = -(bb.max.y + bb.min.y) / 2;
      const cz = -(bb.max.z + bb.min.z) / 2;
      geo.translate(cx, cy, cz);

      mesh.position.set(sPos[0], sPos[1], sPos[2]);
      mesh.rotation.set(sRot[0], sRot[1], sRot[2]);
      mesh.scale.set(sScale[0], sScale[1], sScale[2]);
      scene.add(mesh);
      pieces.push({ mesh, ePos, eRot, eScale, startPos: [...sPos], startRot: [...sRot], startScale: [...sScale] });
      return mesh;
    }

    // ── FRAME PIECES (beveled) ──
    // Top bar — chunky bevel
    addPiece(bevelBox(frameW, barW, barD, 0.08), crimson,
      [0, cs * 0.5, 0], [0, 0, 0], [cs / frameW, 1, cs / barD * 0.6],
      [0, frameH / 2 - barW / 2, 0], [0, 0, 0], [1, 1, 1]);
    // Bottom bar
    addPiece(bevelBox(frameW, barW, barD, 0.08), crimson,
      [0, -cs * 0.5, 0], [0, 0, 0], [cs / frameW, 1, cs / barD * 0.6],
      [0, -frameH / 2 + barW / 2, 0], [0, 0, 0], [1, 1, 1]);
    // Left bar — starts rotated
    addPiece(bevelBox(barW, frameH - barW * 2, barD, 0.08), navy,
      [-cs * 0.5, 0, 0], [0, 0, Math.PI / 2], [1, cs / (frameH - barW * 2), cs / barD * 0.6],
      [-frameW / 2 + barW / 2, 0, 0], [0, 0, 0], [1, 1, 1]);
    // Right bar — starts rotated
    addPiece(bevelBox(barW, frameH - barW * 2, barD, 0.08), navy,
      [cs * 0.5, 0, 0], [0, 0, -Math.PI / 2], [1, cs / (frameH - barW * 2), cs / barD * 0.6],
      [frameW / 2 - barW / 2, 0, 0], [0, 0, 0], [1, 1, 1]);
    // Back panel — flips from front
    addPiece(bevelBox(frameW - barW * 2, frameH - barW * 2, 0.08, 0.03), gunmetal,
      [0, 0, cs * 0.5], [0, Math.PI, 0], [cs / (frameW - barW * 2), cs / (frameH - barW * 2), 1],
      [0, 0, -barD * 0.5], [0, 0, 0], [1, 1, 1]);

    // Front face — dissolves
    const frontGeo = bevelBox(cs, cs, 0.06, 0.03);
    allGeos.push(frontGeo);
    const frontMat = gunmetal.clone();
    frontMat.transparent = true;
    allMats.push(frontMat);
    const frontFace = new THREE.Mesh(frontGeo, frontMat);
    frontFace.position.set(0, 0, cs * 0.5);
    scene.add(frontFace);

    // ── 4 CORNER BRACKETS (beveled L-shapes) ──
    const brkSize = 0.55;
    const brackets = [];
    const brkTargets = [
      { ex: -frameW / 2 + brkSize / 2, ey: frameH / 2 - brkSize / 2, sx: -cs * 0.35, sy: cs * 0.35, sRz: Math.PI * 0.5 },
      { ex: frameW / 2 - brkSize / 2, ey: frameH / 2 - brkSize / 2, sx: cs * 0.35, sy: cs * 0.35, sRz: -Math.PI * 0.5 },
      { ex: -frameW / 2 + brkSize / 2, ey: -frameH / 2 + brkSize / 2, sx: -cs * 0.35, sy: -cs * 0.35, sRz: -Math.PI * 0.5 },
      { ex: frameW / 2 - brkSize / 2, ey: -frameH / 2 + brkSize / 2, sx: cs * 0.35, sy: -cs * 0.35, sRz: Math.PI * 0.5 },
    ];
    brkTargets.forEach(({ ex, ey, sx, sy, sRz }) => {
      const grp = new THREE.Group();
      const hGeo = bevelBox(brkSize, 0.16, barD * 0.85, 0.04);
      allGeos.push(hGeo);
      const hM = new THREE.Mesh(hGeo, crimson);
      hM.position.y = brkSize / 2 - 0.08;
      grp.add(hM);
      const vGeo = bevelBox(0.16, brkSize, barD * 0.85, 0.04);
      allGeos.push(vGeo);
      const vM = new THREE.Mesh(vGeo, crimson);
      vM.position.x = -brkSize / 2 + 0.08;
      grp.add(vM);
      grp.position.set(sx, sy, cs * 0.5 + 0.05);
      grp.rotation.z = sRz;
      scene.add(grp);
      brackets.push({ mesh: grp, ex, ey, sRz });
    });

    // ── 8 CHROME BOLTS ──
    const boltGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.2, 8);
    allGeos.push(boltGeo);
    const boltStarts = [
      { sx: -cs * 0.3, sy: cs * 0.3 }, { sx: cs * 0.3, sy: cs * 0.3 },
      { sx: -cs * 0.3, sy: -cs * 0.3 }, { sx: cs * 0.3, sy: -cs * 0.3 },
      { sx: 0, sy: cs * 0.3 }, { sx: 0, sy: -cs * 0.3 },
      { sx: -cs * 0.3, sy: 0 }, { sx: cs * 0.3, sy: 0 },
    ];
    const boltEnds = [
      { ex: -frameW * 0.35, ey: frameH / 2 - barW / 2 }, { ex: frameW * 0.35, ey: frameH / 2 - barW / 2 },
      { ex: -frameW * 0.35, ey: -frameH / 2 + barW / 2 }, { ex: frameW * 0.35, ey: -frameH / 2 + barW / 2 },
      { ex: 0, ey: frameH / 2 - barW / 2 }, { ex: 0, ey: -frameH / 2 + barW / 2 },
      { ex: -frameW / 2 + barW / 2, ey: 0 }, { ex: frameW / 2 - barW / 2, ey: 0 },
    ];
    const bolts = boltStarts.map(({ sx, sy }, i) => {
      const bolt = new THREE.Mesh(boltGeo, chrome);
      bolt.position.set(sx, sy, cs * 0.5 + 0.1);
      bolt.rotation.x = Math.PI / 2;
      scene.add(bolt);
      return { mesh: bolt, ...boltEnds[i] };
    });

    // ── 4 VISIBLE GEARS at corners (proper gear shape with teeth) ──
    const gearPositions = [
      { x: -frameW / 2 + 0.05, y: frameH / 2 - 0.05, r: 0.22, t: 10, spd: 2.0 },
      { x: frameW / 2 - 0.05, y: frameH / 2 - 0.05, r: 0.18, t: 8, spd: -2.8 },
      { x: -frameW / 2 + 0.05, y: -frameH / 2 + 0.05, r: 0.18, t: 8, spd: -2.5 },
      { x: frameW / 2 - 0.05, y: -frameH / 2 + 0.05, r: 0.22, t: 10, spd: 2.2 },
    ];
    const gears = gearPositions.map(({ x, y, r, t, spd }) => {
      const geo = gearGeo(r, r * 0.75, t, 0.1);
      allGeos.push(geo);
      const mesh = new THREE.Mesh(geo, steel);
      mesh.position.set(x, y, barD / 2 + 0.06);
      mesh.scale.set(0, 0, 0);
      scene.add(mesh);
      return { mesh, speed: spd };
    });

    // ── 2 PISTONS on sides ──
    const pistonGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.7, 8);
    allGeos.push(pistonGeo);
    const pistonMat = chrome.clone();
    allMats.push(pistonMat);
    const pistons = [
      { x: -frameW / 2 + barW + 0.08, baseY: 0.7 },
      { x: frameW / 2 - barW - 0.08, baseY: -0.7 },
    ].map(({ x, baseY }) => {
      const m = new THREE.Mesh(pistonGeo, pistonMat);
      m.position.set(x, baseY, barD / 2 + 0.04);
      m.scale.set(0, 0, 0);
      scene.add(m);
      return { mesh: m, baseY };
    });

    // ── GLOW STRIPS (blue) ──
    const glows = [];
    [[0, frameH / 2 - barW / 2, frameW * 0.85, 0.07],
     [0, -frameH / 2 + barW / 2, frameW * 0.85, 0.07],
     [-frameW / 2 + barW / 2, 0, 0.07, (frameH - barW * 2) * 0.85],
     [frameW / 2 - barW / 2, 0, 0.07, (frameH - barW * 2) * 0.85],
    ].forEach(([x, y, w, h]) => {
      const g = new THREE.BoxGeometry(w, h, 0.01);
      allGeos.push(g);
      const m = ledGlow.clone();
      allMats.push(m);
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, barD / 2 + 0.02);
      scene.add(mesh);
      glows.push(mesh);
    });

    // ── ORANGE ACCENT STRIPS (on side bars) ──
    const orangeStrips = [];
    [[-frameW / 2 + barW / 2, 0.8, 0.04, 0.5],
     [-frameW / 2 + barW / 2, -0.8, 0.04, 0.5],
     [frameW / 2 - barW / 2, 0.8, 0.04, 0.5],
     [frameW / 2 - barW / 2, -0.8, 0.04, 0.5],
    ].forEach(([x, y, w, h]) => {
      const g = new THREE.BoxGeometry(w, h, 0.01);
      allGeos.push(g);
      const m = orangeGlow.clone();
      allMats.push(m);
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, barD / 2 + 0.02);
      scene.add(mesh);
      orangeStrips.push(mesh);
    });

    // ── STORE ──
    const screenW = frameW - barW * 2 - 0.15;
    const screenH = frameH - barW * 2 - 0.15;
    threeRef.current = {
      renderer, scene, camera, pieces, frontFace, frontMat, brackets, bolts, gears, pistons,
      glows, orangeStrips, orbitLight1, orbitLight2, orbitLight3,
      allGeos, allMats, screenW, screenH, animId: null, tl: null,
    };

    // ── RENDER LOOP ──
    let running = true;
    let time = 0;
    function animate() {
      if (!running) return;
      threeRef.current.animId = requestAnimationFrame(animate);
      time += 0.016;

      // Spin gears
      gears.forEach(({ mesh, speed }) => { mesh.rotation.z += speed * 0.016; });

      // Oscillate pistons
      pistons.forEach(({ mesh, baseY }, i) => {
        mesh.position.y = baseY + Math.sin(time * 2.5 + i * Math.PI) * 0.18;
      });

      // Orbit lights slowly around the frame
      orbitLight1.position.x = Math.cos(time * 0.4) * 5;
      orbitLight1.position.y = Math.sin(time * 0.4) * 3;
      orbitLight2.position.x = Math.cos(time * 0.3 + 2) * 5;
      orbitLight2.position.y = Math.sin(time * 0.3 + 2) * 3;
      orbitLight3.position.x = Math.cos(time * 0.5 + 4) * 3;
      orbitLight3.position.y = Math.sin(time * 0.5 + 4) * 4;

      renderer.render(scene, camera);

      // Iframe align
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
      a.volume = 0.35; a.play().catch(() => {});
    } catch {}

    // ── ANIMATION — Step by step, revealing internal parts ──
    const tl = gsap.timeline({ onComplete: () => setShowVideo(true) });
    threeRef.current.tl = tl;

    // 0. Cube sits visible for a beat (0-0.25s)
    // Already visible from start positions

    // 1. Front face dissolves first, revealing internals (0.2-0.5s)
    tl.to(frontMat, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 0.2);

    // 2. Frame pieces start expanding outward step by step (0.3-1.0s)
    // Top bar first
    tl.to(pieces[0].mesh.position, { x: 0, y: frameH / 2 - barW / 2, z: 0, duration: 0.6, ease: 'power3.out' }, 0.3);
    tl.to(pieces[0].mesh.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'power3.out' }, 0.3);
    // Bottom bar
    tl.to(pieces[1].mesh.position, { x: 0, y: -frameH / 2 + barW / 2, z: 0, duration: 0.6, ease: 'power3.out' }, 0.38);
    tl.to(pieces[1].mesh.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'power3.out' }, 0.38);
    // Left bar — unrotates
    tl.to(pieces[2].mesh.position, { x: -frameW / 2 + barW / 2, y: 0, z: 0, duration: 0.6, ease: 'power3.out' }, 0.42);
    tl.to(pieces[2].mesh.rotation, { z: 0, duration: 0.6, ease: 'power3.out' }, 0.42);
    tl.to(pieces[2].mesh.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'power3.out' }, 0.42);
    // Right bar — unrotates
    tl.to(pieces[3].mesh.position, { x: frameW / 2 - barW / 2, y: 0, z: 0, duration: 0.6, ease: 'power3.out' }, 0.46);
    tl.to(pieces[3].mesh.rotation, { z: 0, duration: 0.6, ease: 'power3.out' }, 0.46);
    tl.to(pieces[3].mesh.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'power3.out' }, 0.46);
    // Back panel flips
    tl.to(pieces[4].mesh.position, { x: 0, y: 0, z: -barD * 0.5, duration: 0.6, ease: 'power3.out' }, 0.35);
    tl.to(pieces[4].mesh.rotation, { y: 0, duration: 0.6, ease: 'power3.out' }, 0.35);
    tl.to(pieces[4].mesh.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'power3.out' }, 0.35);

    // 3. Camera pulls back as frame expands
    tl.to(camera.position, { z: camZ + 2, duration: 1.2, ease: 'power2.out' }, 0.2);

    // 4. Gears appear and start spinning as bars arrive (0.5-0.8s)
    gears.forEach(({ mesh }, i) => {
      tl.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 0.35, ease: 'back.out(2.5)' }, 0.5 + i * 0.05);
    });

    // 5. Corner brackets rotate into place (0.55-0.9s)
    brackets.forEach(({ mesh, ex, ey }, i) => {
      tl.to(mesh.position, { x: ex, y: ey, z: barD / 2, duration: 0.5, ease: 'back.out(1.5)' }, 0.55 + i * 0.04);
      tl.to(mesh.rotation, { z: 0, duration: 0.5, ease: 'power3.out' }, 0.55 + i * 0.04);
    });

    // 6. Bolts spin and scatter to positions (0.6-0.9s)
    bolts.forEach(({ mesh, ex, ey }, i) => {
      tl.to(mesh.position, { x: ex, y: ey, z: barD / 2 + 0.11, duration: 0.45, ease: 'back.out(1.3)' }, 0.6 + i * 0.02);
      tl.to(mesh.rotation, { z: Math.PI * 5, duration: 0.45, ease: 'power2.out' }, 0.6 + i * 0.02);
    });

    // 7. Pistons appear (0.7-0.85s)
    pistons.forEach(({ mesh }, i) => {
      tl.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 0.25, ease: 'back.out(2)' }, 0.7 + i * 0.06);
    });

    // 8. LED glow strips power on (0.8-1.0s)
    glows.forEach((g, i) => {
      tl.to(g.material, { opacity: 0.9, duration: 0.15, ease: 'power2.out' }, 0.8 + i * 0.04);
    });
    // Orange accents
    orangeStrips.forEach((g, i) => {
      tl.to(g.material, { opacity: 0.7, duration: 0.15, ease: 'power2.out' }, 0.85 + i * 0.03);
    });

    // 9. Start glow pulsing
    tl.call(() => {
      glows.forEach(g => gsap.to(g.material, { opacity: 0.35, duration: 1.5, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
      orangeStrips.forEach(g => gsap.to(g.material, { opacity: 0.25, duration: 2.0, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
    }, [], 1.0);

    // 10. Flip iframe to front
    tl.call(() => {
      if (canvasRef.current) canvasRef.current.style.zIndex = '1';
    }, [], 1.05);

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

  // Iframe position
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
    three.orangeStrips.forEach(g => gsap.killTweensOf(g.material));

    try { const a = new Audio(assetUrl('sounds/transform.ogg')); a.volume = 0.2; a.playbackRate = 1.5; a.play().catch(() => {}); } catch {}

    // Put canvas back on top for close animation
    if (canvasRef.current) canvasRef.current.style.zIndex = '3';

    const closeTl = gsap.timeline({ onComplete: onClose });
    // Glows off
    three.glows.forEach(g => closeTl.to(g.material, { opacity: 0, duration: 0.1 }, 0));
    three.orangeStrips.forEach(g => closeTl.to(g.material, { opacity: 0, duration: 0.1 }, 0));
    // Gears shrink
    three.gears.forEach(({ mesh }) => closeTl.to(mesh.scale, { x: 0, y: 0, z: 0, duration: 0.2 }, 0.05));
    // Pistons shrink
    three.pistons.forEach(({ mesh }) => closeTl.to(mesh.scale, { x: 0, y: 0, z: 0, duration: 0.2 }, 0.05));
    // Pieces collapse back
    three.pieces.forEach(({ mesh, startPos, startRot, startScale }, i) => {
      closeTl.to(mesh.position, { x: startPos[0], y: startPos[1], z: startPos[2], duration: 0.45, ease: 'power3.in' }, 0.1 + i * 0.03);
      closeTl.to(mesh.rotation, { x: startRot[0], y: startRot[1], z: startRot[2], duration: 0.45, ease: 'power3.in' }, 0.1 + i * 0.03);
      closeTl.to(mesh.scale, { x: startScale[0], y: startScale[1], z: startScale[2], duration: 0.45, ease: 'power3.in' }, 0.1 + i * 0.03);
    });
    three.brackets.forEach(({ mesh }) => closeTl.to(mesh.position, { x: 0, y: 0, z: 0.7, duration: 0.35, ease: 'power3.in' }, 0.1));
    three.bolts.forEach(({ mesh }) => closeTl.to(mesh.position, { x: 0, y: 0, z: 0.7, duration: 0.35, ease: 'power3.in' }, 0.1));
    closeTl.to(three.camera.position, { z: camZ - 2, duration: 0.4, ease: 'power2.in' }, 0.1);
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
