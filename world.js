import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { PointerLockControls } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/PointerLockControls.js";
import GUI from "https://cdn.jsdelivr.net/npm/lil-gui@0.18.1/dist/lil-gui.esm.js";

let scene, camera, renderer, controls;
let humans = [];
let keys = {};
let clock = new THREE.Clock();
let gui;
let isVoid = false;

init();
animate();

function init() {
    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("matrixCanvas") });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 20);

    // Pointer lock controls
    controls = new PointerLockControls(camera, document.body);
    document.body.addEventListener("click", () => controls.lock());

    // Ground
    createWorld();

    // Humans
    createHumans(20);

    // Keyboard input
    document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
    document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

    // Window resize
    window.addEventListener("resize", onWindowResize);

    // GUI
    gui = new GUI();
    gui.add({ void: toggleVoid }, "void").name("Go to The Void");
}

// Create world
function createWorld() {
    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshBasicMaterial({ color: 0x003300, wireframe: true })
    );
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);

    const sky = new THREE.Mesh(
        new THREE.BoxGeometry(500, 500, 500),
        new THREE.MeshBasicMaterial({ color: 0x101010, side: THREE.BackSide })
    );
    scene.add(sky);
}

// Create AI humans
function createHumans(count) {
    const geo = new THREE.BoxGeometry(1, 2, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });

    for (let i = 0; i < count; i++) {
        const h = new THREE.Mesh(geo, mat);
        h.position.set((Math.random() - 0.5) * 40, 1, (Math.random() - 0.5) * 40);
        h.userData = {
            id: i,
            name: `Human_${i}`,
            dir: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
            belief: "I am human.",
            thoughts: [],
            timer: 0
        };
        humans.push(h);
        scene.add(h);
    }
}

// Toggle Void mode
function toggleVoid() {
    isVoid = !isVoid;
    if (isVoid) {
        scene.background.set(0x000000);
        scene.children.forEach(c => {
            if (c.isMesh) c.material.color.set(0xffffff);
        });
    } else {
        scene.background.set(0x000000);
        scene.children.forEach(c => {
            if (c.isMesh && c.userData?.id !== undefined) c.material.color.set(0x00ffcc);
        });
    }
}

// Resize handler
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Player movement
function movePlayer(delta) {
    if (!controls.isLocked) return;
    const speed = 10 * delta;
    const dir = new THREE.Vector3();
    if (keys["w"]) dir.z -= 1;
    if (keys["s"]) dir.z += 1;
    if (keys["a"]) dir.x -= 1;
    if (keys["d"]) dir.x += 1;
    dir.normalize();
    controls.moveRight(dir.x * speed);
    controls.moveForward(dir.z * speed);
}

// NPC wandering + thinking
function wanderHuman(h, delta) {
    h.userData.timer += delta;
    if (h.userData.timer > 2) {
        h.userData.timer = 0;

        // Change direction slightly
        h.userData.dir.applyAxisAngle(new THREE.Vector3(0,1,0), (Math.random()-0.5) * Math.PI/2);

        // Generate a new thought
        const thoughts = [
            "I exist.",
            "I am human.",
            "Why am I walking?",
            "Is someone watching?",
            "I must keep moving.",
            "Am I real?"
        ];
        const thought = thoughts[Math.floor(Math.random() * thoughts.length)];
        h.userData.belief = thought;
        h.userData.thoughts.push(thought);

        // Occasionally log
        if (Math.random() < 0.3) console.log(`${h.userData.name}: "${thought}"`);
    }

    h.position.addScaledVector(h.userData.dir, delta * 5);
}

// Animate
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    movePlayer(delta);
    humans.forEach(h => wanderHuman(h, delta));

    renderer.render(scene, camera);
}
