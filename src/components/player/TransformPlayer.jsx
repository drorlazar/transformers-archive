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
  const audioRef = useRef(null);
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

    const W = canvas.clientWidth;
    const H = canvas.clientHeight;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 2.0;

    // ── Scene ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e0e18);

    // ── Camera ──
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
    camera.position.set(0, 0, 7);

    // ── Env map for reflections ──
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.HemisphereLight(0x6688cc, 0x334422, 3.0));
    envScene.add(new THREE.PointLight(0xff6600, 2, 20));
    const envMap = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = envMap;
    pmrem.dispose();

    // ── Lights — much brighter ──
    scene.add(new THREE.AmbientLight(0x8888aa, 1.2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x6688ff, 1.0);
    fillLight.position.set(-3, 2, 4);
    scene.add(fillLight);
    const rimLight = new THREE.PointLight(0xff4400, 1.5, 15);
    rimLight.position.set(0, -2, 4);
    scene.add(rimLight);

    // ── Materials — brighter, more vivid ──
    const redMat = new THREE.MeshPhysicalMaterial({
      color: 0xcc2222, metalness: 0.7, roughness: 0.25,
      emissive: new THREE.Color(0x440000), emissiveIntensity: 0.3,
    });
    const frameMat = new THREE.MeshPhysicalMaterial({
      color: 0x2a2a5e, metalness: 0.7, roughness: 0.3,
      emissive: new THREE.Color(0x1155cc), emissiveIntensity: 0,
    });
    const ledMat = new THREE.MeshBasicMaterial({
      color: 0x33aaff, transparent: true, opacity: 0,
    });
    const screenMat = new THREE.MeshBasicMaterial({
      color: 0x050510,
    });

    // ── Dimensions ──
    // The video frame (what's revealed behind the corners)
    const frameW = 5.8;
    const frameH = 3.8;
    const frameD = 0.35;
    const barThick = 0.4;
    const cornerSize = frameW / 2; // each corner covers half width
    const cornerH = frameH / 2;
    const cornerD = 0.35;

    // ── VIDEO FRAME (hidden behind corners initially) ──
    const frameGroup = new THREE.Group();

    // Top bar
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(frameW, barThick, frameD), frameMat);
    topBar.position.set(0, frameH / 2 - barThick / 2, 0);
    frameGroup.add(topBar);

    // Bottom bar
    const botBar = new THREE.Mesh(new THREE.BoxGeometry(frameW, barThick, frameD), frameMat);
    botBar.position.set(0, -frameH / 2 + barThick / 2, 0);
    frameGroup.add(botBar);

    // Left bar
    const leftBar = new THREE.Mesh(new THREE.BoxGeometry(barThick, frameH - barThick * 2, frameD), frameMat);
    leftBar.position.set(-frameW / 2 + barThick / 2, 0, 0);
    frameGroup.add(leftBar);

    // Right bar
    const rightBar = new THREE.Mesh(new THREE.BoxGeometry(barThick, frameH - barThick * 2, frameD), frameMat);
    rightBar.position.set(frameW / 2 - barThick / 2, 0, 0);
    frameGroup.add(rightBar);

    // LED strips on bars (thin glowing lines)
    const ledPositions = [
      [0, frameH / 2 - barThick / 2, frameD / 2 + 0.02, frameW - 0.6, 0.1], // top
      [0, -frameH / 2 + barThick / 2, frameD / 2 + 0.02, frameW - 0.6, 0.1], // bottom
      [-frameW / 2 + barThick / 2, 0, frameD / 2 + 0.02, 0.1, frameH - barThick * 2 - 0.4], // left
      [frameW / 2 - barThick / 2, 0, frameD / 2 + 0.02, 0.1, frameH - barThick * 2 - 0.4], // right
    ];
    const leds = [];
    ledPositions.forEach(([x, y, z, w, h]) => {
      const led = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), ledMat.clone());
      led.position.set(x, y, z);
      frameGroup.add(led);
      leds.push(led);
    });

    // Screen (black plane behind the bars)
    const screenW = frameW - barThick * 2 - 0.05;
    const screenH = frameH - barThick * 2 - 0.05;
    const screen = new THREE.Mesh(new THREE.BoxGeometry(screenW, screenH, 0.02), screenMat);
    screen.position.set(0, 0, -frameD / 2);
    screen.name = 'screen';
    frameGroup.add(screen);

    // Back plate
    const backPlate = new THREE.Mesh(
      new THREE.BoxGeometry(frameW + 0.1, frameH + 0.1, 0.08),
      new THREE.MeshPhysicalMaterial({ color: 0x151520, metalness: 0.8, roughness: 0.4 })
    );
    backPlate.position.z = -frameD / 2 - 0.05;
    frameGroup.add(backPlate);

    scene.add(frameGroup);

    // ── FOUR RED CORNER PIECES ──
    // These start merged at center forming one red block, then split to corners
    const cornerGeo = new THREE.BoxGeometry(cornerSize, cornerH, cornerD);
    const corners = [];

    // TL, TR, BL, BR — final positions at frame corners
    const cornerTargets = [
      { x: -cornerSize / 2, y: cornerH / 2 },
      { x: cornerSize / 2, y: cornerH / 2 },
      { x: -cornerSize / 2, y: -cornerH / 2 },
      { x: cornerSize / 2, y: -cornerH / 2 },
    ];

    cornerTargets.forEach((target) => {
      const mesh = new THREE.Mesh(cornerGeo, redMat);
      // Start at center (all four overlap = one solid red block)
      mesh.position.set(0, 0, frameD / 2 + 0.01);
      mesh.userData.target = target;
      scene.add(mesh);
      corners.push(mesh);
    });

    // ── Store refs ──
    const allMats = [redMat, frameMat, ledMat, screenMat, backPlate.material];
    leds.forEach(l => allMats.push(l.material));
    const allGeos = [];
    scene.traverse(c => { if (c.isMesh) allGeos.push(c.geometry); });

    threeRef.current = {
      renderer, scene, camera, corners, frameGroup, leds, screen,
      frameMat, ledMat, screenMat, allMats, allGeos, envMap,
      screenW, screenH, animId: null,
    };

    // ── Render loop ──
    let running = true;
    function animate() {
      if (!running) return;
      threeRef.current.animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);

      // Keep iframe aligned to screen
      if (iframeRef.current && showVideo) {
        updateIframePosition();
      }
    }

    function updateIframePosition() {
      if (!iframeRef.current) return;
      const corners3d = [
        new THREE.Vector3(-screenW / 2, screenH / 2, 0),
        new THREE.Vector3(screenW / 2, -screenH / 2, 0),
      ];
      corners3d.forEach(v => {
        screen.localToWorld(v);
        v.project(camera);
      });
      const x1 = (corners3d[0].x * 0.5 + 0.5) * W;
      const y1 = (-corners3d[0].y * 0.5 + 0.5) * H;
      const x2 = (corners3d[1].x * 0.5 + 0.5) * W;
      const y2 = (-corners3d[1].y * 0.5 + 0.5) * H;
      const el = iframeRef.current;
      el.style.left = x1 + 'px';
      el.style.top = y1 + 'px';
      el.style.width = (x2 - x1) + 'px';
      el.style.height = (y2 - y1) + 'px';
    }

    animate();

    // ── Sound ──
    try {
      const audio = new Audio(assetUrl('sounds/transform.ogg'));
      audio.volume = 0.7;
      audio.play().catch(() => {});
      audioRef.current = audio;
    } catch {}

    // ── ANIMATION ──
    const tl = gsap.timeline({
      onComplete: () => {
        setShowVideo(true);
        // Force one iframe position update
        setTimeout(updateIframePosition, 50);
      },
    });
    threeRef.current.tl = tl;

    // Phase 1 (0-0.6s): Red block sits at center, slight pulse
    // All corners at (0,0) = solid red block
    // Nothing moves yet, just a brief hold

    // Phase 2 (0.3-1.2s): Corners split and slide to their positions
    // Offset: each corner slides with a slight diagonal stagger
    corners.forEach((mesh, i) => {
      const t = mesh.userData.target;
      // Slight rotation during split for mechanical feel
      const rotZ = i < 2 ? 0.05 : -0.05;

      tl.to(mesh.position, {
        x: t.x, y: t.y,
        duration: 0.9,
        ease: 'power2.out',
      }, 0.3 + i * 0.06);

      // Slight Z rotation that settles back to 0
      tl.to(mesh.rotation, {
        z: rotZ, duration: 0.4, ease: 'power2.out',
      }, 0.3 + i * 0.06);
      tl.to(mesh.rotation, {
        z: 0, duration: 0.3, ease: 'power2.inOut',
      }, 0.7 + i * 0.06);
    });

    // Phase 3 (0.8-1.2s): Frame bars become visible (emissive glow fades in)
    tl.to(frameMat, {
      emissiveIntensity: 0.6, duration: 0.4, ease: 'power2.out',
    }, 0.8);

    // Phase 4 (1.0-1.3s): LED strips pulse on
    leds.forEach((led, i) => {
      tl.to(led.material, {
        opacity: 1, duration: 0.2, ease: 'power2.out',
      }, 1.0 + i * 0.08);
    });

    // LED pulse animation (looping after initial power-on)
    tl.call(() => {
      leds.forEach(led => {
        gsap.to(led.material, {
          opacity: 0.4, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut',
        });
      });
    }, [], 1.4);

    // Phase 5 (1.3-1.5s): Screen powers on
    tl.to(screenMat, {
      color: new THREE.Color(0x111122), duration: 0.2,
    }, 1.3);

    // ── Resize ──
    function onResize() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
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
      envMap.dispose();
      renderer.dispose();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, []); // eslint-disable-line

  // Update iframe position when showVideo changes
  useEffect(() => {
    if (!showVideo || !iframeRef.current || !threeRef.current) return;
    const { screen, camera, screenW, screenH } = threeRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !screen) return;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;

    const tl = new THREE.Vector3(-screenW / 2, screenH / 2, 0);
    const br = new THREE.Vector3(screenW / 2, -screenH / 2, 0);
    screen.localToWorld(tl); tl.project(camera);
    screen.localToWorld(br); br.project(camera);

    const x1 = (tl.x * 0.5 + 0.5) * W;
    const y1 = (-tl.y * 0.5 + 0.5) * H;
    const x2 = (br.x * 0.5 + 0.5) * W;
    const y2 = (-br.y * 0.5 + 0.5) * H;

    const el = iframeRef.current;
    el.style.left = x1 + 'px';
    el.style.top = y1 + 'px';
    el.style.width = (x2 - x1) + 'px';
    el.style.height = (y2 - y1) + 'px';
  }, [showVideo]);

  // Close
  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setShowVideo(false);

    const three = threeRef.current;
    if (!three) { onClose(); return; }
    if (three.tl) three.tl.kill();

    try {
      const audio = new Audio(assetUrl('sounds/transform.ogg'));
      audio.volume = 0.4;
      audio.playbackRate = 1.5;
      audio.play().catch(() => {});
    } catch {}

    const closeTl = gsap.timeline({ onComplete: onClose });

    // LEDs off
    three.leds.forEach(led => {
      gsap.killTweensOf(led.material);
      closeTl.to(led.material, { opacity: 0, duration: 0.15 }, 0);
    });

    // Frame glow off
    closeTl.to(three.frameMat, { emissiveIntensity: 0, duration: 0.2 }, 0.05);

    // Corners slide back to center
    three.corners.forEach((mesh, i) => {
      closeTl.to(mesh.position, {
        x: 0, y: 0, duration: 0.6, ease: 'power2.in',
      }, 0.15 + i * 0.04);
      closeTl.to(mesh.rotation, {
        z: (i < 2 ? -0.05 : 0.05), duration: 0.3,
      }, 0.15);
    });

    // Fade out
    closeTl.to(canvasRef.current, { opacity: 0, duration: 0.2 }, 0.7);
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
    <div className="tfp-overlay">
      <canvas className="tfp-canvas" ref={canvasRef} />
      <button className="tfp-close" onClick={handleClose} aria-label="Close">&#10005;</button>

      {showVideo && (
        <div className="tfp-iframe-wrap" ref={iframeRef}>
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
                <><p>Available on Dailymotion</p><a href={videoData.dailymotion} target="_blank" rel="noopener noreferrer">Watch on Dailymotion</a></>
              ) : videoData.other ? (
                <><p>Available externally</p><a href={videoData.other} target="_blank" rel="noopener noreferrer">Watch Episode</a></>
              ) : (
                <><p>No video available</p><a href={`https://www.youtube.com/results?search_query=${searchQuery}`} target="_blank" rel="noopener noreferrer">Search YouTube</a></>
              )}
            </div>
          )}
        </div>
      )}

      {showVideo && (
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
      )}
    </div>
  );
}
