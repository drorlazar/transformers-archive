import { useEffect, useRef, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import gsap from 'gsap';
import { assetUrl } from '../../utils/assetUrl';
import './TransformPlayer.css';

function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// Beveled box with chunky 45° chamfers
function bevelBox(w, h, d, bevel = 0.07) {
  const shape = new THREE.Shape();
  const hw = w / 2 - bevel, hh = h / 2 - bevel;
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
    depth: d, bevelEnabled: true,
    bevelThickness: bevel * 0.8, bevelSize: bevel * 0.8, bevelSegments: 3,
  });
}

// Gear with proper teeth
function makeGearGeo(outerR, innerR, teeth, thickness) {
  const shape = new THREE.Shape();
  const steps = teeth * 2;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = i % 2 === 0 ? outerR : innerR;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  const hole = new THREE.Path();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    if (i === 0) hole.moveTo(Math.cos(a) * innerR * 0.35, Math.sin(a) * innerR * 0.35);
    else hole.lineTo(Math.cos(a) * innerR * 0.35, Math.sin(a) * innerR * 0.35);
  }
  shape.holes.push(hole);
  return new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: true,
    bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2,
  });
}

// Greeble strip — row of tiny mechanical details
function addGreebleStrip(parent, x, y, z, length, vertical, mat, allGeos) {
  const count = Math.floor(length / 0.25);
  for (let i = 0; i < count; i++) {
    const type = Math.random();
    let geo;
    if (type < 0.3) {
      // Small hex bolt
      geo = new THREE.CylinderGeometry(0.035, 0.035, 0.05, 6);
    } else if (type < 0.6) {
      // Tiny vent
      geo = new THREE.BoxGeometry(0.12, 0.04, 0.04);
    } else if (type < 0.8) {
      // Small pipe segment
      geo = new THREE.CylinderGeometry(0.02, 0.02, 0.15, 6);
    } else {
      // Sensor dot
      geo = new THREE.SphereGeometry(0.025, 6, 4);
    }
    allGeos.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    const offset = -length / 2 + (i + 0.5) * (length / count);
    if (vertical) {
      mesh.position.set(x, y + offset, z);
      if (type >= 0.6 && type < 0.8) mesh.rotation.z = Math.PI / 2;
    } else {
      mesh.position.set(x + offset, y, z);
    }
    if (type < 0.3) mesh.rotation.x = Math.PI / 2;
    parent.add(mesh);
  }
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
    const W = window.innerWidth, H = window.innerHeight;
    const aspect = W / H;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.95;

    // ── Scene ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x09090c);

    // ── Camera ──
    const camZ = aspect < 1.2 ? 9 + (1.2 - aspect) * 8 : 9;
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.set(0, 0, camZ);

    // ── Environment map — rich for reflections ──
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envS = new THREE.Scene();
    envS.add(new THREE.HemisphereLight(0x7799cc, 0x443322, 3.5));
    const ep1 = new THREE.PointLight(0xff4400, 2, 30); ep1.position.set(8, 5, 8); envS.add(ep1);
    const ep2 = new THREE.PointLight(0x0044cc, 1.5, 30); ep2.position.set(-8, -3, 8); envS.add(ep2);
    scene.environment = pmrem.fromScene(envS, 0.04).texture;
    pmrem.dispose();

    // ── Lighting — directional key/fill/rim + gentle orbiting accents ──
    scene.add(new THREE.AmbientLight(0x555566, 0.01));

    const keyDir = new THREE.DirectionalLight(0xffeedd, 3.6);
    keyDir.position.set(-1.3, 3.1, -2.7);
    scene.add(keyDir);

    const fillDir = new THREE.DirectionalLight(0x3355aa, 1.2);
    fillDir.position.set(0.7, 1.3, -12.6);
    scene.add(fillDir);

    const rimDir = new THREE.DirectionalLight(0xff6633, 2.3);
    rimDir.position.set(-5.4, -5.9, -15.0);
    scene.add(rimDir);

    // Orbiting accent lights
    const orb1 = new THREE.PointLight(0xff3300, 0.7, 30);
    orb1.position.set(7.8, -4.5, 13.8);
    scene.add(orb1);
    const orb2 = new THREE.PointLight(0x3700ff, 4.8, 30);
    orb2.position.set(-3.7, -2.2, -0.2);
    scene.add(orb2);

    // ── Texture Loading ──
    const loader = new THREE.TextureLoader();
    const allMats = [], allGeos = [];

    function loadTex(path, repeatX = 1, repeatY = 1) {
      const tex = loader.load(assetUrl(path), undefined, undefined, () => {});
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.repeat.set(repeatX, repeatY);
      return tex;
    }

    // Color maps — reduced tiling for less repetition
    const redTex = loadTex('textures/red-metal.jpg', 0.09, 0.25);
    redTex.offset.set(0, 0.26);
    const blueTex = loadTex('textures/blue-metal.jpg', 0.56, 0.29);
    const darkTex = loadTex('textures/dark-metal.jpg', 0.45, 0.55);
    const circuitTex = loadTex('textures/circuit-glow.jpg', 2, 0.5);

    // Normal maps (loaded if available)
    let redNorm, blueNorm, greebleNorm;
    try {
      redNorm = loadTex('textures/red-normal.jpg', 0.09, 0.25);
      redNorm.offset.set(0, 0.26);
      blueNorm = loadTex('textures/blue-normal.jpg', 0.56, 0.29);
      greebleNorm = loadTex('textures/greeble-normal.jpg', 0.1, 0.1 );
    } catch {}

    // ── Materials ──
    const crimson = new THREE.MeshPhysicalMaterial({
      color: 0xca2f47, map: redTex, normalMap: redNorm || null, normalScale: new THREE.Vector2(0.4, 0.4),
      metalness: 0.34, roughness: 0.37, clearcoat: 0.19, clearcoatRoughness: 0.06,
    });
    const navy = new THREE.MeshPhysicalMaterial({
      color: 0x2a3090, map: blueTex, normalMap: blueNorm || null, normalScale: new THREE.Vector2(0.7, 0.7),
      metalness: 0.45, roughness: 0.31, clearcoat: 0.5, clearcoatRoughness: 0.08,
    });
    const gunmetal = new THREE.MeshPhysicalMaterial({
      color: 0x2a2a38, map: darkTex, normalMap: redNorm || null, normalScale: new THREE.Vector2(-0.1, -0.1),
      metalness: 0.89, roughness: 0.29, clearcoat: 0.3,
    });
    const chrome = new THREE.MeshPhysicalMaterial({
      color: 0xbbbbcc, metalness: 1.0, roughness: 0.03, clearcoat: 1.0, clearcoatRoughness: 0.01,
    });
    const steel = new THREE.MeshPhysicalMaterial({
      color: 0x607080, metalness: 0.95, roughness: 0.1, clearcoat: 0.4,
    });
    const greebMat = new THREE.MeshPhysicalMaterial({
      color: 0x444455, metalness: 0.9, roughness: 0.15, clearcoat: 0.3,
    });
    const ledGlow = new THREE.MeshBasicMaterial({ color: 0x22aaff, transparent: true, opacity: 0 });
    const orangeGlow = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0 });

    allMats.push(crimson, navy, gunmetal, chrome, steel, greebMat, ledGlow, orangeGlow);

    // ── Dimensions ──
    const frameW = 7.5, frameH = 4.6, barW = 0.4, barD = 0.45;
    const cs = 0.68; // Condensed starting cube

    // ── PIECES — each has a two-part animation: first detach from cube, then stretch/rotate to frame position ──
    const pieces = [];
    function addPiece(geo, mat, sPos, sRot, sScale, midPos, midRot, midScale, ePos, eRot, eScale) {
      allGeos.push(geo);
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      geo.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, -(bb.max.z + bb.min.z) / 2);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(sPos[0], sPos[1], sPos[2]);
      mesh.rotation.set(sRot[0], sRot[1], sRot[2]);
      mesh.scale.set(sScale[0], sScale[1], sScale[2]);
      scene.add(mesh);
      pieces.push({ mesh, mid: { p: midPos, r: midRot, s: midScale }, end: { p: ePos, r: eRot, s: eScale }, start: { p: [...sPos], r: [...sRot], s: [...sScale] } });
      return mesh;
    }

    // Top bar: cube top → detach upward → stretch to full width
    addPiece(bevelBox(frameW, barW, barD, 0.08), crimson,
      [0, cs * 0.4, 0], [0, 0, 0], [cs / frameW, 0.8, cs / barD * 0.5],
      [0, cs * 1.2, 0.3], [0.15, 0, 0], [cs / frameW * 2, 1, cs / barD * 0.7],
      [0, frameH / 2 - barW / 2, 0], [0, 0, 0], [1, 1, 1]);

    // Bottom bar
    addPiece(bevelBox(frameW, barW, barD, 0.08), crimson,
      [0, -cs * 0.4, 0], [0, 0, 0], [cs / frameW, 0.8, cs / barD * 0.5],
      [0, -cs * 1.2, 0.3], [-0.15, 0, 0], [cs / frameW * 2, 1, cs / barD * 0.7],
      [0, -frameH / 2 + barW / 2, 0], [0, 0, 0], [1, 1, 1]);

    // Left bar: starts rotated, detaches left, then unfolds
    addPiece(bevelBox(barW, frameH - barW * 2, barD, 0.08), navy,
      [-cs * 0.4, 0, 0], [0, 0, Math.PI / 2], [0.8, cs / (frameH - barW * 2), cs / barD * 0.5],
      [-cs * 1.5, 0, 0.2], [0, 0.2, Math.PI / 4], [0.9, cs / (frameH - barW * 2) * 1.5, cs / barD * 0.7],
      [-frameW / 2 + barW / 2, 0, 0], [0, 0, 0], [1, 1, 1]);

    // Right bar
    addPiece(bevelBox(barW, frameH - barW * 2, barD, 0.08), navy,
      [cs * 0.4, 0, 0], [0, 0, -Math.PI / 2], [0.8, cs / (frameH - barW * 2), cs / barD * 0.5],
      [cs * 1.5, 0, 0.2], [0, -0.2, -Math.PI / 4], [0.9, cs / (frameH - barW * 2) * 1.5, cs / barD * 0.7],
      [frameW / 2 - barW / 2, 0, 0], [0, 0, 0], [1, 1, 1]);

    // Back panel: flips from front through mid rotation
    addPiece(bevelBox(frameW - barW * 2, frameH - barW * 2, 0.1, 0.04), gunmetal,
      [0, 0, cs * 0.4], [0, Math.PI, 0], [cs / (frameW - barW * 2), cs / (frameH - barW * 2), 0.8],
      [0, 0, 0], [0, Math.PI / 2, 0], [cs / (frameW - barW * 2) * 1.5, cs / (frameH - barW * 2) * 1.5, 1],
      [0, 0, -barD * 0.5], [0, 0, 0], [1, 1, 1]);

    // Front face dissolves
    const frontGeo = bevelBox(cs, cs, 0.06, 0.04);
    allGeos.push(frontGeo);
    const frontMat = gunmetal.clone(); frontMat.transparent = true; allMats.push(frontMat);
    const frontFace = new THREE.Mesh(frontGeo, frontMat);
    frontFace.position.set(0, 0, cs * 0.4);
    scene.add(frontFace);

    // ── GREEBLE DETAILS on frame bars ──
    // Add greeble to each piece after it's created (they move with the parent mesh via groups would be ideal,
    // but since pieces are individual meshes, we add greeble as separate meshes at final positions)
    // Top bar greeble
    addGreebleStrip(scene, 0, frameH / 2 - barW / 2, barD / 2 + 0.03, frameW * 0.6, false, greebMat, allGeos);
    // Bottom bar greeble
    addGreebleStrip(scene, 0, -frameH / 2 + barW / 2, barD / 2 + 0.03, frameW * 0.6, false, greebMat, allGeos);
    // Left bar greeble
    addGreebleStrip(scene, -frameW / 2 + barW / 2, 0, barD / 2 + 0.03, (frameH - barW * 2) * 0.6, true, greebMat, allGeos);
    // Right bar greeble
    addGreebleStrip(scene, frameW / 2 - barW / 2, 0, barD / 2 + 0.03, (frameH - barW * 2) * 0.6, true, greebMat, allGeos);

    // ── CORNER BRACKETS ──
    const brkSize = 0.6;
    const brackets = [];
    [
      { ex: -frameW / 2 + brkSize / 2, ey: frameH / 2 - brkSize / 2, sx: -cs * 0.3, sy: cs * 0.3, sRz: Math.PI * 0.6 },
      { ex: frameW / 2 - brkSize / 2, ey: frameH / 2 - brkSize / 2, sx: cs * 0.3, sy: cs * 0.3, sRz: -Math.PI * 0.6 },
      { ex: -frameW / 2 + brkSize / 2, ey: -frameH / 2 + brkSize / 2, sx: -cs * 0.3, sy: -cs * 0.3, sRz: -Math.PI * 0.6 },
      { ex: frameW / 2 - brkSize / 2, ey: -frameH / 2 + brkSize / 2, sx: cs * 0.3, sy: -cs * 0.3, sRz: Math.PI * 0.6 },
    ].forEach(({ ex, ey, sx, sy, sRz }) => {
      const grp = new THREE.Group();
      const hGeo = bevelBox(brkSize, 0.18, barD * 0.85, 0.05);
      allGeos.push(hGeo);
      grp.add(new THREE.Mesh(hGeo, crimson));
      grp.children[0].position.y = brkSize / 2 - 0.09;
      const vGeo = bevelBox(0.18, brkSize, barD * 0.85, 0.05);
      allGeos.push(vGeo);
      const vM = new THREE.Mesh(vGeo, crimson);
      vM.position.x = -brkSize / 2 + 0.09;
      grp.add(vM);
      // Start at center of cube, scaled small, heavily rotated
      grp.position.set(0, 0, cs * 0.4 + 0.05);
      grp.rotation.z = sRz + Math.PI;
      grp.scale.set(0.3, 0.3, 0.3);
      scene.add(grp);
      brackets.push({ mesh: grp, ex, ey, sRz });
    });

    // ── BOLTS ──
    const boltGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.22, 8);
    allGeos.push(boltGeo);
    const boltStarts = [
      [-cs * 0.25, cs * 0.25], [cs * 0.25, cs * 0.25],
      [-cs * 0.25, -cs * 0.25], [cs * 0.25, -cs * 0.25],
      [0, cs * 0.25], [0, -cs * 0.25],
      [-cs * 0.25, 0], [cs * 0.25, 0],
    ];
    const boltEnds = [
      [-frameW * 0.35, frameH / 2 - barW / 2], [frameW * 0.35, frameH / 2 - barW / 2],
      [-frameW * 0.35, -frameH / 2 + barW / 2], [frameW * 0.35, -frameH / 2 + barW / 2],
      [0, frameH / 2 - barW / 2], [0, -frameH / 2 + barW / 2],
      [-frameW / 2 + barW / 2, 0], [frameW / 2 - barW / 2, 0],
    ];
    const bolts = boltStarts.map(([sx, sy], i) => {
      const bolt = new THREE.Mesh(boltGeo, chrome);
      // Start clustered near center for more dramatic spread
      bolt.position.set(sx * 0.5, sy * 0.5, cs * 0.4 + 0.12);
      bolt.rotation.x = Math.PI / 2;
      bolt.scale.set(0.5, 0.5, 0.5);
      scene.add(bolt);
      return { mesh: bolt, ex: boltEnds[i][0], ey: boltEnds[i][1] };
    });

    // ── GEARS — visible, spinning ──
    const gearPositions = [
      { x: -frameW / 2 + 0.1, y: frameH / 2 - 0.1, r: 0.25, t: 12, spd: 1.2 },
      { x: frameW / 2 - 0.1, y: frameH / 2 - 0.1, r: 0.2, t: 10, spd: -1.8 },
      { x: -frameW / 2 + 0.1, y: -frameH / 2 + 0.1, r: 0.2, t: 10, spd: -1.5 },
      { x: frameW / 2 - 0.1, y: -frameH / 2 + 0.1, r: 0.25, t: 12, spd: 1.3 },
    ];
    const gears = gearPositions.map(({ x, y, r, t, spd }) => {
      const geo = makeGearGeo(r, r * 0.72, t, 0.12);
      allGeos.push(geo);
      const mesh = new THREE.Mesh(geo, steel);
      mesh.position.set(x, y, barD / 2 + 0.07);
      mesh.scale.set(0, 0, 0);
      scene.add(mesh);
      return { mesh, speed: spd };
    });

    // ── PISTONS ──
    const pistonGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8);
    allGeos.push(pistonGeo);
    const pistons = [
      { x: -frameW / 2 + barW + 0.1, baseY: 0.7 },
      { x: frameW / 2 - barW - 0.1, baseY: -0.7 },
    ].map(({ x, baseY }) => {
      const m = new THREE.Mesh(pistonGeo, chrome);
      m.position.set(x, baseY, barD / 2 + 0.04);
      m.scale.set(0, 0, 0);
      scene.add(m);
      return { mesh: m, baseY };
    });

    // ── GLOW STRIPS — pushed forward, start scaled to 0 ──
    const glows = [];
    [[0, frameH / 2 - barW / 2, frameW * 0.85, 0.1],
     [0, -frameH / 2 + barW / 2, frameW * 0.85, 0.1],
     [-frameW / 2 + barW / 2, 0, 0.1, (frameH - barW * 2) * 0.85],
     [frameW / 2 - barW / 2, 0, 0.1, (frameH - barW * 2) * 0.85],
    ].forEach(([x, y, w, h]) => {
      const g = new THREE.BoxGeometry(w, h, 0.04); allGeos.push(g);
      const m = ledGlow.clone(); allMats.push(m);
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, barD / 2 + 0.06);
      mesh.scale.set(0.01, 0.01, 0.01); // start invisible, animate in
      scene.add(mesh); glows.push(mesh);
    });

    // Orange accents — also start scaled to 0
    const orangeStrips = [];
    [[-frameW / 2 + barW / 2, 0.8, 0.06, 0.5],
     [-frameW / 2 + barW / 2, -0.8, 0.06, 0.5],
     [frameW / 2 - barW / 2, 0.8, 0.06, 0.5],
     [frameW / 2 - barW / 2, -0.8, 0.06, 0.5],
    ].forEach(([x, y, w, h]) => {
      const g = new THREE.BoxGeometry(w, h, 0.04); allGeos.push(g);
      const m = orangeGlow.clone(); allMats.push(m);
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, barD / 2 + 0.06);
      mesh.scale.set(0.01, 0.01, 0.01);
      scene.add(mesh); orangeStrips.push(mesh);
    });

    // ── STORE ──
    const screenW = frameW - barW * 2 - 0.15, screenH = frameH - barW * 2 - 0.15;
    threeRef.current = {
      renderer, scene, camera, pieces, frontFace, frontMat, brackets, bolts, gears, pistons,
      glows, orangeStrips, orb1, orb2,
      allGeos, allMats, screenW, screenH, camZ, animId: null, tl: null,
    };

    // ── RENDER LOOP ──
    let running = true, time = 0;
    function animate() {
      if (!running) return;
      threeRef.current.animId = requestAnimationFrame(animate);
      time += 0.016;

      // Gears spin
      gears.forEach(({ mesh, speed }) => { mesh.rotation.z += speed * 0.016; });
      // Pistons bob
      pistons.forEach(({ mesh, baseY }, i) => { mesh.position.y = baseY + Math.sin(time * 1.8 + i * Math.PI) * 0.15; });
      // Orbiting lights — slow, far away
      orb1.position.x = Math.cos(time * 0.50) * 11;
      orb1.position.y = Math.sin(time * 0.50) * 5.5;
      orb2.position.x = Math.cos(time * 0.40 + 3) * 11;
      orb2.position.y = Math.sin(time * 0.40 + 3) * 5.5;

      renderer.render(scene, camera);

      if (iframeRef.current && showVideo) {
        const tl = new THREE.Vector3(-screenW / 2, screenH / 2, 0).project(camera);
        const br = new THREE.Vector3(screenW / 2, -screenH / 2, 0).project(camera);
        const el = iframeRef.current;
        el.style.left = ((tl.x * 0.5 + 0.5) * W) + 'px';
        el.style.top = ((-tl.y * 0.5 + 0.5) * H) + 'px';
        el.style.width = ((br.x - tl.x) * 0.5 * W) + 'px';
        el.style.height = ((tl.y - br.y) * 0.5 * H) + 'px';
      }
    }
    animate();

    // Sound
    try { const a = new Audio(assetUrl('sounds/transform.ogg')); a.volume = 0.35; a.play().catch(() => {}); } catch {}

    // ── TWO-PART ANIMATION ──
    const tl = gsap.timeline({ onComplete: () => setShowVideo(true) });
    threeRef.current.tl = tl;

    // 0. Cube holds visible (0-0.3s)

    // 1. Front face dissolves (0.2-0.5s)
    tl.to(frontMat, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 0.2);

    // 2. PART ONE: Pieces detach from cube to intermediate positions (0.3-0.7s)
    pieces.forEach(({ mesh, mid }, i) => {
      const d = 0.3 + i * 0.05;
      tl.to(mesh.position, { x: mid.p[0], y: mid.p[1], z: mid.p[2], duration: 0.4, ease: 'power2.out' }, d);
      tl.to(mesh.rotation, { x: mid.r[0], y: mid.r[1], z: mid.r[2], duration: 0.4, ease: 'power2.out' }, d);
      tl.to(mesh.scale, { x: mid.s[0], y: mid.s[1], z: mid.s[2], duration: 0.4, ease: 'power2.out' }, d);
    });

    // 3. PART TWO: Pieces stretch/rotate to final frame positions (0.6-1.1s)
    pieces.forEach(({ mesh, end }, i) => {
      const d = 0.6 + i * 0.05;
      tl.to(mesh.position, { x: end.p[0], y: end.p[1], z: end.p[2], duration: 0.5, ease: 'power3.inOut' }, d);
      tl.to(mesh.rotation, { x: end.r[0], y: end.r[1], z: end.r[2], duration: 0.5, ease: 'power3.inOut' }, d);
      tl.to(mesh.scale, { x: end.s[0], y: end.s[1], z: end.s[2], duration: 0.5, ease: 'power3.inOut' }, d);
    });

    // Camera pulls back
    tl.to(camera.position, { z: camZ + 2.5, duration: 1.3, ease: 'power2.out' }, 0.2);

    // 4. Gears appear (0.7-1.0s)
    gears.forEach(({ mesh }, i) => {
      tl.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'back.out(2.5)' }, 0.7 + i * 0.05);
    });

    // 5. Brackets fly out from center, rotate, snap into corners (0.55-0.95s)
    brackets.forEach(({ mesh, ex, ey }, i) => {
      tl.to(mesh.position, { x: ex, y: ey, z: barD / 2, duration: 0.5, ease: 'back.out(1.8)' }, 0.55 + i * 0.06);
      tl.to(mesh.rotation, { z: 0, duration: 0.5, ease: 'power3.out' }, 0.55 + i * 0.06);
      tl.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(1.5)' }, 0.55 + i * 0.06);
    });

    // 6. Bolts spin out from center (0.65-0.95s)
    bolts.forEach(({ mesh, ex, ey }, i) => {
      tl.to(mesh.position, { x: ex, y: ey, z: barD / 2 + 0.12, duration: 0.45, ease: 'back.out(1.3)' }, 0.65 + i * 0.025);
      tl.to(mesh.rotation, { z: Math.PI * 6, duration: 0.45, ease: 'power2.out' }, 0.65 + i * 0.025);
      tl.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 0.35, ease: 'power2.out' }, 0.65 + i * 0.025);
    });

    // 7. Pistons pop in (0.9s)
    pistons.forEach(({ mesh }, i) => {
      tl.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 0.25, ease: 'back.out(2)' }, 0.9 + i * 0.06);
    });

    // 8. Glows scale in and power on (0.85-1.1s)
    glows.forEach((g, i) => {
      tl.to(g.scale, { x: 1, y: 1, z: 1, duration: 0.25, ease: 'back.out(2)' }, 0.85 + i * 0.04);
      tl.to(g.material, { opacity: 0.78, duration: 0.2, ease: 'power2.out' }, 0.9 + i * 0.04);
    });
    orangeStrips.forEach((g, i) => {
      tl.to(g.scale, { x: 1, y: 1, z: 1, duration: 0.25, ease: 'back.out(2)' }, 0.9 + i * 0.03);
      tl.to(g.material, { opacity: 0.8, duration: 0.2, ease: 'power2.out' }, 0.95 + i * 0.03);
    });

    // 9. Start glow pulse + flip iframe to front
    tl.call(() => {
      glows.forEach(g => gsap.to(g.material, { opacity: 0.45, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
      orangeStrips.forEach(g => gsap.to(g.material, { opacity: 0.35, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
      if (canvasRef.current) canvasRef.current.style.zIndex = '1';
    }, [], 1.15);

    // Resize
    function onResize() {
      const w = window.innerWidth, h = window.innerHeight;
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
    const W = window.innerWidth, H = window.innerHeight;
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
    if (canvasRef.current) canvasRef.current.style.zIndex = '3';

    const closeTl = gsap.timeline({ onComplete: onClose });
    three.glows.forEach(g => {
      closeTl.to(g.material, { opacity: 0, duration: 0.1 }, 0);
      closeTl.to(g.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.15 }, 0);
    });
    three.orangeStrips.forEach(g => {
      closeTl.to(g.material, { opacity: 0, duration: 0.1 }, 0);
      closeTl.to(g.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.15 }, 0);
    });
    three.gears.forEach(({ mesh }) => closeTl.to(mesh.scale, { x: 0, y: 0, z: 0, duration: 0.2 }, 0.05));
    three.pistons.forEach(({ mesh }) => closeTl.to(mesh.scale, { x: 0, y: 0, z: 0, duration: 0.2 }, 0.05));
    three.brackets.forEach(({ mesh }) => closeTl.to(mesh.position, { x: 0, y: 0, z: 0.5, duration: 0.3, ease: 'power3.in' }, 0.1));
    three.bolts.forEach(({ mesh }) => closeTl.to(mesh.position, { x: 0, y: 0, z: 0.5, duration: 0.3, ease: 'power3.in' }, 0.1));
    three.pieces.forEach(({ mesh, start }, i) => {
      closeTl.to(mesh.position, { x: start.p[0], y: start.p[1], z: start.p[2], duration: 0.4, ease: 'power3.in' }, 0.1 + i * 0.03);
      closeTl.to(mesh.rotation, { x: start.r[0], y: start.r[1], z: start.r[2], duration: 0.4, ease: 'power3.in' }, 0.1 + i * 0.03);
      closeTl.to(mesh.scale, { x: start.s[0], y: start.s[1], z: start.s[2], duration: 0.4, ease: 'power3.in' }, 0.1 + i * 0.03);
    });
    closeTl.to(three.camera.position, { z: three.camZ - 2, duration: 0.4, ease: 'power2.in' }, 0.1);
    closeTl.to(canvasRef.current, { opacity: 0, duration: 0.15 }, 0.45);
  }, [isClosing, onClose]);

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn);
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
              src={`https://www.youtube.com/embed/${youtubeId}?rel=0&autoplay=1`}
              title={episode.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen />
          ) : (
            <div className="tfp-fallback"><span>&#9654;</span>
              {videoData.dailymotion ? <a href={videoData.dailymotion} target="_blank" rel="noopener noreferrer">Watch on Dailymotion</a>
              : <a href={`https://www.youtube.com/results?search_query=${searchQuery}`} target="_blank" rel="noopener noreferrer">Search YouTube</a>}
            </div>
          )}
        </div>
      )}
      {showVideo && (
        <div className="tfp-info">
          <h2>{episode.title}</h2>
          <p>{seriesTitle && `${seriesTitle} — `}S{seasonNum} E{episode.number}</p>
          {youtubeId && <p className="tfp-search">Video blocked or asking to verify? <a href={`https://www.youtube.com/watch?v=${youtubeId}`} target="_blank" rel="noopener noreferrer">Open on YouTube</a> · <a href={`https://www.youtube.com/results?search_query=${searchQuery}`} target="_blank" rel="noopener noreferrer">Search</a></p>}
          {youtubeId && <p className="tfp-search">Ads? Install an ad blocker — <Link to="/about#ad-blockers">recommendations</Link></p>}
        </div>
      )}
    </div>
  );
}
