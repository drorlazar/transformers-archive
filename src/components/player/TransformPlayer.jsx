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

// ── Build the 3D Cybertronian frame model ─────────────────────────────
function buildFrameModel() {
  const root = new THREE.Group();
  root.name = 'cybertronian-frame';

  // ── Material palette ──
  const matCorner = new THREE.MeshPhysicalMaterial({
    color: 0x7B1818, metalness: 0.85, roughness: 0.25,
  });
  const matBody = new THREE.MeshPhysicalMaterial({
    color: 0x1A1A3E, metalness: 0.75, roughness: 0.35,
  });
  const matTube = new THREE.MeshPhysicalMaterial({
    color: 0x332200, metalness: 0.7, roughness: 0.4,
    emissive: new THREE.Color(0xFF6600), emissiveIntensity: 0,
  });
  const matCircuit = new THREE.MeshPhysicalMaterial({
    color: 0x001133, metalness: 0.6, roughness: 0.3,
    emissive: new THREE.Color(0x0088FF), emissiveIntensity: 0,
  });
  const matScreen = new THREE.MeshPhysicalMaterial({
    color: 0x000000, metalness: 0.1, roughness: 0.8,
    emissive: new THREE.Color(0x88CCFF), emissiveIntensity: 0,
  });
  const matBack = new THREE.MeshPhysicalMaterial({
    color: 0x0A0A12, metalness: 0.9, roughness: 0.2,
  });
  const matBadge = new THREE.MeshPhysicalMaterial({
    color: 0xCC2222, metalness: 0.8, roughness: 0.3,
    emissive: new THREE.Color(0xFF0000), emissiveIntensity: 0,
  });

  // Collect all materials for disposal
  const allMaterials = [matCorner, matBody, matTube, matCircuit, matScreen, matBack, matBadge];

  // Collect named groups for animation
  const parts = {
    corners: [],      // 4 corner bracket groups
    sidePanels: [],   // 4 side panel meshes
    tubes: [],        // 2 side tube meshes
    circuits: [],     // circuit trace meshes
    leds: [],         // LED segment meshes
    screen: null,     // screen mesh
    badge: null,      // top badge
    materials: allMaterials,
    matTube,
    matCircuit,
    matScreen,
    matBadge,
  };

  // ── Dimensions ──
  const W = 6, H = 5.5, D = 0.4;
  const cornerSize = 1.2;
  const cornerThick = 0.35;

  // ── Helper: create an L-shaped corner bracket ──
  function createCornerBracket(flipX, flipY) {
    const group = new THREE.Group();
    // Horizontal arm
    const hGeo = new THREE.BoxGeometry(cornerSize, cornerThick, D);
    const hMesh = new THREE.Mesh(hGeo, matCorner);
    hMesh.position.set(
      flipX * (cornerSize / 2),
      flipY * (cornerThick / 2),
      0
    );
    group.add(hMesh);

    // Vertical arm
    const vGeo = new THREE.BoxGeometry(cornerThick, cornerSize, D);
    const vMesh = new THREE.Mesh(vGeo, matCorner);
    vMesh.position.set(
      flipX * (cornerThick / 2),
      flipY * (cornerSize / 2),
      0
    );
    group.add(vMesh);

    // Chamfer block at the outer corner for that chunky look
    const cGeo = new THREE.BoxGeometry(cornerThick * 1.3, cornerThick * 1.3, D * 1.1);
    const cMesh = new THREE.Mesh(cGeo, matCorner);
    cMesh.position.set(
      flipX * cornerThick * 0.15,
      flipY * cornerThick * 0.15,
      0
    );
    group.add(cMesh);

    return group;
  }

  // ── 4 Corner Brackets ──
  const positions = [
    { x: -W / 2 + cornerSize / 2, y: H / 2 - cornerSize / 2, fx: 1, fy: 1 },   // TL
    { x: W / 2 - cornerSize / 2, y: H / 2 - cornerSize / 2, fx: -1, fy: 1 },    // TR
    { x: -W / 2 + cornerSize / 2, y: -H / 2 + cornerSize / 2, fx: 1, fy: -1 },  // BL
    { x: W / 2 - cornerSize / 2, y: -H / 2 + cornerSize / 2, fx: -1, fy: -1 },  // BR
  ];

  positions.forEach((pos) => {
    const bracket = createCornerBracket(pos.fx, pos.fy);
    bracket.position.set(pos.x, pos.y, 0);
    bracket.userData.homePos = { x: pos.x, y: pos.y, z: 0 };
    root.add(bracket);
    parts.corners.push(bracket);
  });

  // ── 4 Side Panels ──
  const panelThick = 0.28;
  // Top panel
  const topPanelGeo = new THREE.BoxGeometry(W - cornerSize * 2 + 0.2, panelThick, D * 0.9);
  const topPanel = new THREE.Mesh(topPanelGeo, matBody);
  topPanel.position.set(0, H / 2 - panelThick / 2, 0);
  topPanel.userData.homePos = { x: 0, y: H / 2 - panelThick / 2, z: 0 };
  root.add(topPanel);
  parts.sidePanels.push(topPanel);

  // Bottom panel
  const bottomPanelGeo = new THREE.BoxGeometry(W - cornerSize * 2 + 0.2, panelThick * 1.5, D * 0.9);
  const bottomPanel = new THREE.Mesh(bottomPanelGeo, matBody);
  bottomPanel.position.set(0, -H / 2 + panelThick * 0.75, 0);
  bottomPanel.userData.homePos = { x: 0, y: -H / 2 + panelThick * 0.75, z: 0 };
  root.add(bottomPanel);
  parts.sidePanels.push(bottomPanel);

  // Left panel
  const leftPanelGeo = new THREE.BoxGeometry(panelThick, H - cornerSize * 2 + 0.2, D * 0.9);
  const leftPanel = new THREE.Mesh(leftPanelGeo, matBody);
  leftPanel.position.set(-W / 2 + panelThick / 2, 0, 0);
  leftPanel.userData.homePos = { x: -W / 2 + panelThick / 2, y: 0, z: 0 };
  root.add(leftPanel);
  parts.sidePanels.push(leftPanel);

  // Right panel
  const rightPanelGeo = new THREE.BoxGeometry(panelThick, H - cornerSize * 2 + 0.2, D * 0.9);
  const rightPanel = new THREE.Mesh(rightPanelGeo, matBody);
  rightPanel.position.set(W / 2 - panelThick / 2, 0, 0);
  rightPanel.userData.homePos = { x: W / 2 - panelThick / 2, y: 0, z: 0 };
  root.add(rightPanel);
  parts.sidePanels.push(rightPanel);

  // ── Back plate (fills the whole frame behind the screen) ──
  const backGeo = new THREE.BoxGeometry(W - 0.3, H - 0.3, D * 0.3);
  const backPlate = new THREE.Mesh(backGeo, matBack);
  backPlate.position.set(0, 0, -D * 0.4);
  root.add(backPlate);

  // ── 2 Side Tubes (orange glowing cylinders) ──
  const tubeHeight = H - cornerSize * 2 - 0.3;
  const tubeRadius = 0.1;

  const leftTubeGeo = new THREE.CylinderGeometry(tubeRadius, tubeRadius, tubeHeight, 12);
  const leftTube = new THREE.Mesh(leftTubeGeo, matTube);
  leftTube.position.set(-W / 2 + panelThick + tubeRadius + 0.05, 0, D * 0.35);
  leftTube.userData.fullHeight = tubeHeight;
  root.add(leftTube);
  parts.tubes.push(leftTube);

  const rightTubeGeo = new THREE.CylinderGeometry(tubeRadius, tubeRadius, tubeHeight, 12);
  const rightTube = new THREE.Mesh(rightTubeGeo, matTube);
  rightTube.position.set(W / 2 - panelThick - tubeRadius - 0.05, 0, D * 0.35);
  rightTube.userData.fullHeight = tubeHeight;
  root.add(rightTube);
  parts.tubes.push(rightTube);

  // ── Circuit Traces (blue glowing lines on the frame surface) ──
  function addCircuit(x, y, w, h) {
    const geo = new THREE.BoxGeometry(w, h, 0.02);
    const mesh = new THREE.Mesh(geo, matCircuit);
    mesh.position.set(x, y, D * 0.5 + 0.01);
    root.add(mesh);
    parts.circuits.push(mesh);
  }

  // Horizontal traces on top panel
  addCircuit(0, H / 2 - panelThick * 0.5, W * 0.5, 0.04);
  addCircuit(-0.6, H / 2 - panelThick * 0.3, 0.04, 0.15);
  addCircuit(0.6, H / 2 - panelThick * 0.3, 0.04, 0.15);

  // Vertical traces on left side
  addCircuit(-W / 2 + panelThick * 0.5, 0.5, 0.04, 1.5);
  addCircuit(-W / 2 + panelThick * 0.5, -0.5, 0.04, 1.2);
  addCircuit(-W / 2 + panelThick * 0.7, 0, 0.06, 0.04);

  // Vertical traces on right side
  addCircuit(W / 2 - panelThick * 0.5, 0.5, 0.04, 1.5);
  addCircuit(W / 2 - panelThick * 0.5, -0.5, 0.04, 1.2);
  addCircuit(W / 2 - panelThick * 0.7, 0, 0.06, 0.04);

  // Horizontal traces on bottom
  addCircuit(0, -H / 2 + panelThick * 1.8, W * 0.5, 0.04);
  addCircuit(-0.8, -H / 2 + panelThick * 1.5, 0.04, 0.2);
  addCircuit(0.8, -H / 2 + panelThick * 1.5, 0.04, 0.2);

  // Corner area traces
  addCircuit(-W / 2 + cornerSize * 0.5, H / 2 - cornerSize * 0.7, 0.5, 0.04);
  addCircuit(W / 2 - cornerSize * 0.5, H / 2 - cornerSize * 0.7, 0.5, 0.04);
  addCircuit(-W / 2 + cornerSize * 0.5, -H / 2 + cornerSize * 0.7, 0.5, 0.04);
  addCircuit(W / 2 - cornerSize * 0.5, -H / 2 + cornerSize * 0.7, 0.5, 0.04);

  // ── Top Badge (Autobot insignia area) ──
  const badgeGeo = new THREE.BoxGeometry(0.35, 0.35, D * 0.3);
  const badge = new THREE.Mesh(badgeGeo, matBadge);
  badge.position.set(0, H / 2 - 0.05, D * 0.4);
  root.add(badge);
  parts.badge = badge;

  // Badge detail - small diamond shape using rotated box
  const badgeDetail = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.2, D * 0.15),
    matBadge
  );
  badgeDetail.rotation.z = Math.PI / 4;
  badgeDetail.position.set(0, H / 2 - 0.05, D * 0.55);
  root.add(badgeDetail);

  // ── Bottom LED Bar ──
  const ledCount = 16;
  const ledBarWidth = W - cornerSize * 2 - 0.4;
  const ledSpacing = ledBarWidth / ledCount;
  const ledY = -H / 2 + panelThick * 0.4;

  // LED bar housing
  const ledHousingGeo = new THREE.BoxGeometry(ledBarWidth + 0.15, 0.12, D * 0.4);
  const ledHousing = new THREE.Mesh(ledHousingGeo, matBack);
  ledHousing.position.set(0, ledY, D * 0.3);
  root.add(ledHousing);

  // Rainbow gradient colors
  const ledColors = [];
  for (let i = 0; i < ledCount; i++) {
    const hue = (i / ledCount) * 0.8; // red through blue
    const col = new THREE.Color().setHSL(hue, 1, 0.5);
    ledColors.push(col);
  }

  for (let i = 0; i < ledCount; i++) {
    const ledMat = new THREE.MeshPhysicalMaterial({
      color: 0x111111,
      emissive: ledColors[i],
      emissiveIntensity: 0,
      metalness: 0.3,
      roughness: 0.5,
    });
    allMaterials.push(ledMat);

    const ledGeo = new THREE.BoxGeometry(ledSpacing * 0.7, 0.06, D * 0.2);
    const ledMesh = new THREE.Mesh(ledGeo, ledMat);
    const xPos = -ledBarWidth / 2 + ledSpacing * 0.5 + i * ledSpacing;
    ledMesh.position.set(xPos, ledY, D * 0.45);
    ledMesh.userData.ledMat = ledMat;
    root.add(ledMesh);
    parts.leds.push(ledMesh);
  }

  // ── Bottom tube (horizontal, below LED bar) ──
  const bottomTubeGeo = new THREE.CylinderGeometry(0.06, 0.06, ledBarWidth + 0.3, 8);
  const bottomTube = new THREE.Mesh(bottomTubeGeo, matTube);
  bottomTube.rotation.z = Math.PI / 2;
  bottomTube.position.set(0, -H / 2 + panelThick * 0.15, D * 0.3);
  root.add(bottomTube);

  // ── Screen Plane ──
  const screenW = 4.0, screenH = 3.0;
  const screenGeo = new THREE.BoxGeometry(screenW, screenH, 0.05);
  const screen = new THREE.Mesh(screenGeo, matScreen);
  screen.position.set(0, 0.15, D * 0.1);
  screen.name = 'screen';
  root.add(screen);
  parts.screen = screen;
  parts.screenWidth = screenW;
  parts.screenHeight = screenH;

  // ── Inner frame border around screen ──
  const innerBorderMat = new THREE.MeshPhysicalMaterial({
    color: 0x111122, metalness: 0.85, roughness: 0.3,
  });
  allMaterials.push(innerBorderMat);

  const borderThick = 0.12;
  // Top inner border
  const ibTop = new THREE.Mesh(
    new THREE.BoxGeometry(screenW + borderThick * 2, borderThick, D * 0.5),
    innerBorderMat
  );
  ibTop.position.set(0, 0.15 + screenH / 2 + borderThick / 2, D * 0.2);
  root.add(ibTop);

  // Bottom inner border
  const ibBot = new THREE.Mesh(
    new THREE.BoxGeometry(screenW + borderThick * 2, borderThick, D * 0.5),
    innerBorderMat
  );
  ibBot.position.set(0, 0.15 - screenH / 2 - borderThick / 2, D * 0.2);
  root.add(ibBot);

  // Left inner border
  const ibLeft = new THREE.Mesh(
    new THREE.BoxGeometry(borderThick, screenH, D * 0.5),
    innerBorderMat
  );
  ibLeft.position.set(-screenW / 2 - borderThick / 2, 0.15, D * 0.2);
  root.add(ibLeft);

  // Right inner border
  const ibRight = new THREE.Mesh(
    new THREE.BoxGeometry(borderThick, screenH, D * 0.5),
    innerBorderMat
  );
  ibRight.position.set(screenW / 2 + borderThick / 2, 0.15, D * 0.2);
  root.add(ibRight);

  return { root, parts };
}

// ── Project 3D screen corners to 2D viewport coords ──
function getScreenRect(screenMesh, camera, canvas) {
  const sw = screenMesh.parent
    ? screenMesh.parent.userData?.screenWidth || 4.0
    : 4.0;
  const sh = screenMesh.parent
    ? screenMesh.parent.userData?.screenHeight || 3.0
    : 3.0;

  // Use the parts stored values
  const hw = sw / 2;
  const hh = sh / 2;

  const corners3D = [
    new THREE.Vector3(-hw, -hh, 0),
    new THREE.Vector3(hw, -hh, 0),
    new THREE.Vector3(hw, hh, 0),
    new THREE.Vector3(-hw, hh, 0),
  ];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  corners3D.forEach((c) => {
    const world = c.clone();
    screenMesh.localToWorld(world);
    world.project(camera);
    const sx = (world.x * 0.5 + 0.5) * canvas.clientWidth;
    const sy = (-world.y * 0.5 + 0.5) * canvas.clientHeight;
    if (sx < minX) minX = sx;
    if (sy < minY) minY = sy;
    if (sx > maxX) maxX = sx;
    if (sy > maxY) maxY = sy;
  });

  return {
    left: minX,
    top: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}


// ── Create environment map for metallic reflections ──
function createEnvMap(renderer) {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileCubemapShader();

  const envScene = new THREE.Scene();
  const hemiLight = new THREE.HemisphereLight(0x4466aa, 0x112244, 1.0);
  envScene.add(hemiLight);

  const envPoint = new THREE.PointLight(0xff6600, 0.5, 20);
  envPoint.position.set(2, 2, 3);
  envScene.add(envPoint);

  const envRT = pmremGenerator.fromScene(envScene, 0.04);
  pmremGenerator.dispose();
  return envRT.texture;
}


export default function TransformPlayer({ episode, seasonNum, seriesTitle, onClose }) {
  const overlayRef = useRef(null);
  const canvasRef = useRef(null);
  const iframeWrapRef = useRef(null);
  const threeRef = useRef(null);     // stores renderer, scene, camera, etc.
  const audioRef = useRef(null);
  const [showVideo, setShowVideo] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [screenRect, setScreenRect] = useState(null);

  const videoData = episode?.video || {};
  const youtubeId = extractYouTubeId(videoData.youtube);
  const searchQuery = encodeURIComponent(
    `${episode?.title || ''} ${seriesTitle || 'Transformers'} full episode`
  );

  // ── Initialize Three.js scene and run open animation ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // ── Scene ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050508);
    scene.fog = new THREE.Fog(0x050508, 6, 16);

    // ── Camera ──
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.set(0, 0.2, 8);
    camera.lookAt(0, 0, 0);

    // ── Environment map ──
    const envMap = createEnvMap(renderer);
    scene.environment = envMap;

    // ── Lights ──
    const ambientLight = new THREE.AmbientLight(0x222244, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(3, 4, 5);
    scene.add(dirLight);

    const fillBlue = new THREE.PointLight(0x3366ff, 0.4, 15);
    fillBlue.position.set(-4, 2, 3);
    scene.add(fillBlue);

    const fillOrange = new THREE.PointLight(0xff6600, 0.3, 15);
    fillOrange.position.set(4, -1, 3);
    scene.add(fillOrange);

    // Red center pulse light (for phase 1)
    const redPulse = new THREE.PointLight(0xff2200, 0, 8);
    redPulse.position.set(0, 0, 2);
    scene.add(redPulse);

    // ── Build frame model ──
    const { root, parts } = buildFrameModel();
    // Store screen dimensions on root for getScreenRect
    root.userData.screenWidth = parts.screenWidth;
    root.userData.screenHeight = parts.screenHeight;
    scene.add(root);

    // ── Hide everything initially ──
    root.visible = false;

    // ── Collect all geometries for disposal ──
    const allGeometries = [];
    root.traverse((child) => {
      if (child.isMesh && child.geometry) {
        allGeometries.push(child.geometry);
      }
    });

    // ── Store refs ──
    threeRef.current = {
      renderer, scene, camera, root, parts, redPulse,
      allGeometries, envMap, animationId: null, tl: null,
    };

    // ── Render loop ──
    let running = true;
    function animate() {
      if (!running) return;
      threeRef.current.animationId = requestAnimationFrame(animate);
      renderer.render(scene, camera);

      // Update iframe position when video is showing
      if (parts.screen && iframeWrapRef.current) {
        const rect = getScreenRect(parts.screen, camera, canvas);
        // Use a small margin inset
        const margin = 2;
        iframeWrapRef.current.style.left = (rect.left + margin) + 'px';
        iframeWrapRef.current.style.top = (rect.top + margin) + 'px';
        iframeWrapRef.current.style.width = (rect.width - margin * 2) + 'px';
        iframeWrapRef.current.style.height = (rect.height - margin * 2) + 'px';
      }
    }
    animate();

    // ── Handle resize ──
    function onResize() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    // ── Play sound ──
    try {
      const audio = new Audio(assetUrl('sounds/transform.ogg'));
      audio.volume = 0.7;
      audio.play().catch(() => {});
      audioRef.current = audio;
    } catch { /* ignore */ }

    // ── Animation sequence ──
    const tl = gsap.timeline({
      onComplete: () => {
        setShowVideo(true);
        // Calculate screen rect for iframe positioning
        const rect = getScreenRect(parts.screen, camera, canvas);
        setScreenRect(rect);
      },
    });
    threeRef.current.tl = tl;

    // Make root visible
    tl.call(() => { root.visible = true; }, [], 0);

    // ── Phase 1 (0-0.3s): Red glow appears ──
    tl.fromTo(redPulse, { intensity: 0 }, {
      intensity: 3, duration: 0.3, ease: 'power2.out',
      yoyo: true, repeat: 1,
    }, 0);

    // ── Phase 2 (0.3-1.0s): Corners fly in ──
    const cornerStarts = [
      { x: -8, y: 6, z: -5, rx: 2, ry: -3, rz: 1 },   // TL from upper-left behind
      { x: 8, y: 6, z: -5, rx: -1, ry: 3, rz: -2 },    // TR from upper-right behind
      { x: -8, y: -6, z: -4, rx: -2, ry: -2, rz: 2 },  // BL from lower-left behind
      { x: 8, y: -6, z: -4, rx: 1, ry: 2, rz: -1 },    // BR from lower-right behind
    ];

    parts.corners.forEach((corner, i) => {
      const home = corner.userData.homePos;
      const start = cornerStarts[i];

      // Set initial off-screen position
      corner.position.set(start.x, start.y, start.z);
      corner.rotation.set(start.rx, start.ry, start.rz);
      corner.scale.setScalar(0.5);

      tl.to(corner.position, {
        x: home.x, y: home.y, z: home.z,
        duration: 0.7, ease: 'power3.out',
      }, 0.3 + i * 0.05);

      tl.to(corner.rotation, {
        x: 0, y: 0, z: 0,
        duration: 0.7, ease: 'power3.out',
      }, 0.3 + i * 0.05);

      tl.to(corner.scale, {
        x: 1, y: 1, z: 1,
        duration: 0.7, ease: 'power3.out',
      }, 0.3 + i * 0.05);
    });

    // ── Phase 3 (0.7-1.2s): Side panels slide in ──
    parts.sidePanels.forEach((panel, i) => {
      const home = panel.userData.homePos;
      // Top slides from above, bottom from below, left from left, right from right
      const offsets = [
        { x: 0, y: 5 },   // top
        { x: 0, y: -5 },  // bottom
        { x: -5, y: 0 },  // left
        { x: 5, y: 0 },   // right
      ];
      const off = offsets[i];

      panel.position.set(home.x + off.x, home.y + off.y, home.z);
      panel.material.opacity = 0;
      panel.material.transparent = true;

      tl.to(panel.position, {
        x: home.x, y: home.y,
        duration: 0.5, ease: 'expo.out',
      }, 0.7 + i * 0.05);

      tl.to(panel.material, {
        opacity: 1,
        duration: 0.3, ease: 'power2.out',
      }, 0.7 + i * 0.05);
    });

    // ── Phase 4 (1.0-1.3s): Side tubes extend ──
    parts.tubes.forEach((tube) => {
      tube.scale.y = 0.01;

      tl.to(tube.scale, {
        y: 1, duration: 0.3, ease: 'power3.out',
      }, 1.0);
    });

    tl.to(parts.matTube, {
      emissiveIntensity: 1.0, duration: 0.4, ease: 'power2.out',
    }, 1.05);

    // ── Phase 5 (1.2-1.6s): Circuits illuminate ──
    parts.circuits.forEach((circuit, i) => {
      circuit.material = parts.matCircuit;
    });
    tl.to(parts.matCircuit, {
      emissiveIntensity: 1.2, duration: 0.4, ease: 'power2.out',
    }, 1.2);

    // Create a sequential circuit glow by animating individual circuits
    // We reuse the shared material but add a brightness pulse via the light
    parts.circuits.forEach((circuit, i) => {
      // Briefly scale each circuit for a "flowing electricity" look
      tl.fromTo(circuit.scale, { x: 0.3 }, {
        x: 1, duration: 0.15, ease: 'power2.out',
      }, 1.2 + i * 0.025);
    });

    // ── Phase 6 (1.4-1.7s): LEDs power on ──
    parts.leds.forEach((led, i) => {
      const ledMat = led.userData.ledMat;
      tl.to(ledMat, {
        emissiveIntensity: 1.5,
        duration: 0.1,
        ease: 'power2.out',
      }, 1.4 + i * 0.015);
    });

    // Badge glow
    tl.to(parts.matBadge, {
      emissiveIntensity: 0.6, duration: 0.3, ease: 'power2.out',
    }, 1.4);

    // ── Phase 7 (1.6-1.9s): Screen powers on ──
    // CRT effect: thin line expands
    parts.screen.scale.y = 0.005;
    tl.to(parts.screen.scale, {
      y: 1, duration: 0.25, ease: 'power4.out',
    }, 1.6);

    tl.to(parts.matScreen, {
      emissiveIntensity: 0.5, duration: 0.3, ease: 'power2.out',
    }, 1.65);

    // ── Cleanup ──
    return () => {
      running = false;
      if (threeRef.current?.animationId) {
        cancelAnimationFrame(threeRef.current.animationId);
      }
      tl.kill();
      window.removeEventListener('resize', onResize);

      // Dispose Three.js resources
      allGeometries.forEach((g) => g.dispose());
      parts.materials.forEach((m) => m.dispose());
      if (envMap) envMap.dispose();
      renderer.dispose();

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Close handler ──
  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setShowVideo(false);

    const three = threeRef.current;
    if (!three) { onClose(); return; }

    const { parts, camera, renderer, redPulse } = three;
    const canvas = canvasRef.current;

    if (three.tl) three.tl.kill();

    // Play close sound
    try {
      const audio = new Audio(assetUrl('sounds/transform.ogg'));
      audio.volume = 0.4;
      audio.playbackRate = 1.8;
      audio.play().catch(() => {});
    } catch { /* ignore */ }

    const closeTl = gsap.timeline({ onComplete: onClose });

    // Screen off
    closeTl.to(parts.screen.scale, {
      y: 0.005, duration: 0.15, ease: 'power4.in',
    }, 0);
    closeTl.to(parts.matScreen, {
      emissiveIntensity: 0, duration: 0.15,
    }, 0);

    // LEDs off
    parts.leds.forEach((led, i) => {
      closeTl.to(led.userData.ledMat, {
        emissiveIntensity: 0, duration: 0.1,
      }, 0.05 + i * 0.01);
    });

    // Circuits off
    closeTl.to(parts.matCircuit, {
      emissiveIntensity: 0, duration: 0.15,
    }, 0.1);

    // Tubes retract
    parts.tubes.forEach((tube) => {
      closeTl.to(tube.scale, {
        y: 0.01, duration: 0.2, ease: 'power3.in',
      }, 0.15);
    });
    closeTl.to(parts.matTube, {
      emissiveIntensity: 0, duration: 0.2,
    }, 0.15);

    // Panels slide out
    const panelOffsets = [
      { x: 0, y: 5 }, { x: 0, y: -5 }, { x: -5, y: 0 }, { x: 5, y: 0 },
    ];
    parts.sidePanels.forEach((panel, i) => {
      const home = panel.userData.homePos;
      const off = panelOffsets[i];
      closeTl.to(panel.position, {
        x: home.x + off.x, y: home.y + off.y,
        duration: 0.3, ease: 'power3.in',
      }, 0.25);
    });

    // Corners fly away
    const cornerEnds = [
      { x: -8, y: 6, z: -5, rx: 2, ry: -3, rz: 1 },
      { x: 8, y: 6, z: -5, rx: -1, ry: 3, rz: -2 },
      { x: -8, y: -6, z: -4, rx: -2, ry: -2, rz: 2 },
      { x: 8, y: -6, z: -4, rx: 1, ry: 2, rz: -1 },
    ];
    parts.corners.forEach((corner, i) => {
      const end = cornerEnds[i];
      closeTl.to(corner.position, {
        x: end.x, y: end.y, z: end.z,
        duration: 0.4, ease: 'power3.in',
      }, 0.35 + i * 0.03);
      closeTl.to(corner.rotation, {
        x: end.rx, y: end.ry, z: end.rz,
        duration: 0.4, ease: 'power3.in',
      }, 0.35 + i * 0.03);
      closeTl.to(corner.scale, {
        x: 0.5, y: 0.5, z: 0.5,
        duration: 0.4, ease: 'power3.in',
      }, 0.35 + i * 0.03);
    });

    // Badge off
    closeTl.to(parts.matBadge, {
      emissiveIntensity: 0, duration: 0.2,
    }, 0.2);
  }, [isClosing, onClose]);

  // ── Escape key ──
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  // ── Lock body scroll ──
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="tfp-overlay" ref={overlayRef}>
      <canvas className="tfp-canvas" ref={canvasRef} />

      <button className="tfp-close" onClick={handleClose} aria-label="Close">
        &#10005;
      </button>

      {/* YouTube iframe overlay — positioned over the 3D screen */}
      {showVideo && (
        <div className="tfp-iframe-wrap" ref={iframeWrapRef}>
          {youtubeId ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&autoplay=1`}
              title={episode.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="tfp-fallback">
              <span className="tfp-fallback-icon">&#9654;</span>
              {videoData.dailymotion ? (
                <>
                  <p>Available on Dailymotion</p>
                  <a href={videoData.dailymotion} target="_blank" rel="noopener noreferrer">
                    Watch on Dailymotion
                  </a>
                </>
              ) : videoData.other ? (
                <>
                  <p>Available externally</p>
                  <a href={videoData.other} target="_blank" rel="noopener noreferrer">
                    Watch Episode
                  </a>
                </>
              ) : (
                <>
                  <p>No video available</p>
                  <a
                    href={`https://www.youtube.com/results?search_query=${searchQuery}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Search YouTube
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Episode info */}
      {showVideo && (
        <div className={`tfp-info ${showVideo ? 'visible' : ''}`}>
          <h2 className="tfp-title">{episode.title}</h2>
          <p className="tfp-meta">
            {seriesTitle && `${seriesTitle} \u2014 `}Season {seasonNum}, Episode {episode.number}
          </p>
          {youtubeId && (
            <p className="tfp-search">
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
      )}
    </div>
  );
}
