/* world.js
Requires:
  - three (module)
  - PointerLockControls (module)
Place <canvas id="matrixCanvas"></canvas> in your HTML.
*/

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { PointerLockControls } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/PointerLockControls.js";

let scene, camera, renderer, controls;
let humans = [];
let keys = {};
let clock = new THREE.Clock();

const HUMAN_COUNT = 20;
const WORLD_RADIUS = 30; // boundary radius
let voidMode = false; // whether the world has gone to the void overlay

// Matrix rain overlay canvas (2D) — created and controlled below
let matrixCanvas, matrixCtx, matrixCols = [], matrixAnimationId;

init();
animate();

/* ---------- INIT ---------- */
function init() {
  // Renderer & canvas
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("matrixCanvas"), antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 2.5, 8);
  camera.lookAt(0, 0, 0);

  // Controls (pointer lock for mouse look)
  controls = new PointerLockControls(camera, document.body);
  document.body.addEventListener("click", () => {
    // clicking the page locks the pointer for FPS look
    controls.lock();
  });

  // Build world (ground + subtle sky)
  createWorld();

  // Create humans with floating labels
  createHumans(HUMAN_COUNT);

  // Event listeners
  document.addEventListener("keydown", (e) => keys[e.key.toLowerCase()] = true);
  document.addEventListener("keyup", (e) => keys[e.key.toLowerCase()] = false);
  window.addEventListener("resize", onWindowResize);

  // Create matrix overlay (hidden initially)
  createMatrixOverlay();
}

/* ---------- WORLD ---------- */
function createWorld() {
  // Ground (bright so it's visible)
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.MeshBasicMaterial({ color: 0x113311, wireframe: false })
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0;
  scene.add(plane);

  // A soft ambient light for visibility (MeshBasicMaterial doesn't require it,
  // but we may later add emissive or standard materials)
  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);

  // Skybox interior: a cube with a canvas texture showing 1s/0s (static)
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = skyCanvas.height = 1024;
  const skyCtx = skyCanvas.getContext("2d");
  skyCtx.fillStyle = "black";
  skyCtx.fillRect(0, 0, skyCanvas.width, skyCanvas.height);
  skyCtx.font = "20px monospace";
  for (let i = 0; i < 2500; i++) {
    skyCtx.fillStyle = Math.random() > 0.4 ? "#00ff44" : "#007733";
    skyCtx.fillText(Math.random() > 0.5 ? "1" : "0", Math.random() * skyCanvas.width, Math.random() * skyCanvas.height);
  }
  const skyTexture = new THREE.CanvasTexture(skyCanvas);
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide });
  const skyGeo = new THREE.BoxGeometry(WORLD_RADIUS * 2 + 20, WORLD_RADIUS * 2 + 20, WORLD_RADIUS * 2 + 20);
  const skyBox = new THREE.Mesh(skyGeo, skyMat);
  skyBox.position.set(0, WORLD_RADIUS, 0); // center the box above ground so floor is at y=0
  scene.add(skyBox);
}

/* ---------- HUMANS (AI) ---------- */
function createHumans(count) {
  const geo = new THREE.BoxGeometry(0.9, 1.8, 0.9);
  // We'll use MeshStandardMaterial so labels and shading look nicer if lights are added
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });

  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((Math.random() - 0.5) * WORLD_RADIUS * 0.6, 0.9, (Math.random() - 0.5) * WORLD_RADIUS * 0.6);

    mesh.userData = {
      id: i,
      name: `Human_${i}`,
      dir: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
      belief: "I exist.",
      thoughts: [],
      timer: Math.random() * 2, // stagger thinking times
      memory: [], // what they've seen
      state: "idle", // idle, approaching, avoiding, curious
    };

    // Create and attach a 2D sprite label (canvas texture) to show belief
    mesh.userData.label = createLabelSprite(mesh.userData.belief);
    mesh.userData.label.position.set(0, 1.4, 0);
    mesh.add(mesh.userData.label);

    // Add to list and scene
    humans.push(mesh);
    scene.add(mesh);
  }
}

/* Create a sprite containing text (canvas texture) */
function createLabelSprite(initialText) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  function drawText(text) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "18px monospace";
    ctx.fillStyle = "#00ff88";
    ctx.textAlign = "center";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 6);
  }
  drawText(initialText);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.2, 0.6, 1);

  // expose an update function
  sprite.userData = {
    canvas,
    ctx,
    tex,
    drawText
  };
  return sprite;
}

/* Update label text for a human */
function updateLabel(sprite, text) {
  sprite.userData.drawText(text);
  sprite.userData.tex.needsUpdate = true;
}

/* ---------- PERCEPTION & AI ---------- */

/* For simple vision, each human casts multiple rays in a cone in front of them */
function perceiveAndReact(human) {
  const origin = human.position.clone();
  origin.y += 0.9; // eye height

  const forward = human.userData.dir.clone().setY(0).normalize();
  const fwdAngle = Math.PI / 6; // 30° cone
  const rayCount = 7;
  const rc = new THREE.Raycaster();
  const closeThreshold = 1.5;
  const seeDist = 8;

  let sawHuman = null;
  let sawWall = false;

  for (let i = 0; i < rayCount; i++) {
    const t = (i / (rayCount - 1)) * 2 - 1; // -1 .. 1
    const angle = t * fwdAngle;
    const dir = forward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).normalize();

    rc.set(origin, dir);
    rc.far = seeDist;

    // Check intersection with other humans
    const others = humans.filter(h => h !== human);
    const intersects = rc.intersectObjects(others, true);
    if (intersects.length > 0) {
      // sees another human
      sawHuman = intersects[0].object;
      break;
    }

    // Also check the skybox boundary (we approximate by distance)
    const futurePos = human.position.clone().add(dir.clone().multiplyScalar(seeDist));
    if (futurePos.length() > WORLD_RADIUS) sawWall = true;
  }

  // React to perception
  if (sawHuman) {
    // Approach curiously but don't overlap; change belief
    human.userData.state = "curious";
    human.userData.belief = `I see ${sawHuman.userData.name}`;
    human.userData.memory.unshift({ t: Date.now(), note: `saw ${sawHuman.userData.name}` });
    // steer toward with gentle turn
    const to = sawHuman.position.clone().sub(human.position); to.y = 0;
    human.userData.dir.lerp(to.normalize(), 0.08);
    // if very close, stop and "interact"
    if (human.position.distanceTo(sawHuman.position) < closeThreshold) {
      human.userData.state = "interacting";
      // pause moving for a bit
    }
  } else if (sawWall) {
    // see the edge — be startled and turn away (or contemplate)
    human.userData.state = "startled";
    human.userData.belief = "The world ends there...";
    human.userData.dir.applyAxisAngle(new THREE.Vector3(0,1,0), Math.PI * (0.4 + Math.random() * 0.6)); // big turn
  } else {
    // nothing special: wander
    human.userData.state = "idle";
    // occasional thought update
    if (Math.random() < 0.02) {
      const thoughts = ["I exist.", "I must move.", "Who watches?", "Am I code?", "What is purpose?"];
      human.userData.belief = thoughts[Math.floor(Math.random() * thoughts.length)];
    }
    // small random wanderiness
    human.userData.dir.applyAxisAngle(new THREE.Vector3(0,1,0), (Math.random() - 0.5) * 0.06);
  }
}

/* ---------- MATRIX VOID OVERLAY (2D) ---------- */
function createMatrixOverlay() {
  matrixCanvas = document.createElement("canvas");
  matrixCanvas.style.position = "fixed";
  matrixCanvas.style.left = "0";
  matrixCanvas.style.top = "0";
  matrixCanvas.style.width = "100%";
  matrixCanvas.style.height = "100%";
  matrixCanvas.style.pointerEvents = "none";
  matrixCanvas.width = window.innerWidth;
  matrixCanvas.height = window.innerHeight;
  matrixCanvas.style.display = "none"; // hidden initially
  matrixCtx = matrixCanvas.getContext("2d");
  document.body.appendChild(matrixCanvas);

  // initialize columns for rain
  const fontSize = 16;
  const cols = Math.floor(matrixCanvas.width / fontSize);
  matrixCols = new Array(cols).fill(0).map(() => Math.floor(Math.random() * matrixCanvas.height));
}

function updateMatrixOverlay() {
  if (!matrixCanvas) return;
  matrixCanvas.width = window.innerWidth;
  matrixCanvas.height = window.innerHeight;
  const ctx = matrixCtx;
  const fontSize = 16;
  const cols = Math.floor(matrixCanvas.width / fontSize);
  const alphaFade = 0.05;

  ctx.fillStyle = `rgba(0, 0, 0, ${alphaFade})`;
  ctx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);

  ctx.font = `${fontSize}px monospace`;
  for (let i = 0; i < cols; i++) {
    if (!matrixCols[i]) matrixCols[i] = Math.floor(Math.random() * matrixCanvas.height);
    const x = i * fontSize;
    const y = matrixCols[i] * fontSize;

    // draw random 1 or 0
    ctx.fillStyle = i % 2 === 0 ? "#00ff88" : "#007733";
    ctx.fillText(Math.random() > 0.5 ? "1" : "0", x, matrixCols[i] * fontSize);

    // advance drop
    if (matrixCols[i] * fontSize > matrixCanvas.height && Math.random() > 0.975) {
      matrixCols[i] = 0;
    }
    matrixCols[i]++;
  }
}

/* Show or hide matrix overlay and fade scene */
function enterVoidMode() {
  if (voidMode) return;
  voidMode = true;
  // reveal overlay
  matrixCanvas.style.display = "block";
  // fade scene objects (reduce color intensity)
  scene.traverse(o => {
    if (o.isMesh && o.material && o.material.color) {
      // desaturate / darken
      o.userData._origColor = o.material.color.clone();
      o.material.color.setHex(0x444444);
      if (o.material.opacity !== undefined) o.material.opacity = 0.85;
    }
  });
  // pause humans (stop movement)
}

/* Optional: exit the void (restore)
function exitVoidMode() {
  voidMode = false;
  matrixCanvas.style.display = "none";
  scene.traverse(o => {
    if (o.isMesh && o.material && o.userData._origColor) {
      o.material.color.copy(o.userData._origColor);
      delete o.userData._origColor;
    }
  });
}
*/

/* ---------- BOUNDARY CHECK & PLAYER VOID ENTRY ---------- */
function checkBoundaries() {
  // Player
  const playerPos = camera.position.clone();
  const playerDistance = Math.sqrt(playerPos.x * playerPos.x + playerPos.z * playerPos.z);
  if (playerDistance > WORLD_RADIUS && !voidMode) {
    console.log("Player entered the void.");
    enterVoidMode();
  }

  // Humans
  for (const h of humans) {
    const d = Math.sqrt(h.position.x * h.position.x + h.position.z * h.position.z);
    if (d > WORLD_RADIUS) {
      console.log(`${h.userData.name} left the world -> VOID triggered.`);
      enterVoidMode();
      // clamp them back slightly so they don't wander forever outside (cosmetic)
      const back = h.position.clone().setY(0);
      back.normalize().multiplyScalar(WORLD_RADIUS * 0.98);
      h.position.set(back.x, h.position.y, back.z);
    }
  }
}

/* ---------- RESIZE ---------- */
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  if (matrixCanvas) {
    matrixCanvas.width = window.innerWidth;
    matrixCanvas.height = window.innerHeight;
    // reinit columns
    const fontSize = 16;
    const cols = Math.floor(matrixCanvas.width / fontSize);
    matrixCols = new Array(cols).fill(0).map(() => Math.floor(Math.random() * matrixCanvas.height));
  }
}

/* ---------- PLAYER MOVEMENT ---------- */
function movePlayer(delta) {
  // only move when pointer locked (FPS style)
  if (!controls.isLocked) return;
  const speed = 6 * delta; // meters per second scaled
  const dir = new THREE.Vector3();
  if (keys["w"]) dir.z -= 1;
  if (keys["s"]) dir.z += 1;
  if (keys["a"]) dir.x -= 1;
  if (keys["d"]) dir.x += 1;
  dir.normalize();
  // move relative to camera direction
  controls.moveRight(dir.x * speed);
  controls.moveForward(dir.z * speed);
}

/* ---------- ANIMATION LOOP ---------- */
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // Player movement
  movePlayer(delta);

  // Update humans: perception, update label, move or pause
  for (const h of humans) {
    // perception & reaction
    perceiveAndReact(h);

    // update label text
    updateLabel(h.userData.label, h.userData.belief);

    // if not void mode, move humans according to state
    if (!voidMode && h.userData.state !== "interacting") {
      // movement speed depends on state
      let speed = 1.4;
      if (h.userData.state === "curious") speed = 1.6;
      if (h.userData.state === "startled") speed = 2.0;
      // step
      h.position.addScaledVector(h.userData.dir, speed * delta);
    }
  }

  // keep humans inside the skybox interior (soft boundary)
  for (const h of humans) {
    const dist = Math.sqrt(h.position.x * h.position.x + h.position.z * h.position.z);
    if (dist > WORLD_RADIUS * 0.98) {
      // nudge inward
      const inward = new THREE.Vector3(-h.position.x, 0, -h.position.z).normalize();
      h.userData.dir.lerp(inward, 0.12);
    }
  }

  // boundary check -> possibly enter void
  checkBoundaries();

  // render scene
  renderer.render(scene, camera);

  // update matrix overlay if active
  if (voidMode) {
    updateMatrixOverlay();
  }
}

/* ---------- END ---------- */
