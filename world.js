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
    camera.position.set(0, 3, 15);
    camera.lookAt(0, 0, 0);

    // Controls
    controls = new PointerLockControls(camera, document.body);
    document.body.addEventListener("click", () => controls.lock());

    // World + Humans
    createWorld();
    createHumans(20);

    // Debug cube (always visible)
    const cube = new THREE.Mesh(
        new THREE.BoxGeometry(2, 2, 2),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    cube.position.set(0, 1, 0);
    scene.add(cube);

    // Events
    document.addEventListener("keydown", (e) => keys[e.key.toLowerCase()] = true);
    document.addEventListener("keyup", (e) => keys[e.key.toLowerCase()] = false);
    window.addEventListener("resize", onWindowResize);

    // GUI
    gui = new GUI();
    gui.add({ toggleVoid }, "toggleVoid").name("Enter The Void");
}

function createWorld() {
    // Ground plane
    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
    );
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);

    // Sky box
    const sky = new THREE.Mesh(
        new THREE.BoxGeometry(500, 500, 500),
        new THREE.MeshBasicMaterial({ color: 0x101010, side: THREE.BackSide })
    );
    scene.add(sky);
}

function createHumans(count) {
    const geo = new THREE.BoxGeometry(1, 2, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });

    for (let i = 0; i < count; i++) {
        const h = new THREE.Mesh(geo, mat);
        h.position.set((Math.random() - 0.5) * 10, 1, (Math.random() - 0.5) * 10);
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

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

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

function wanderHuman(h, delta) {
    h.userData.timer += delta;
    if (h.userData.timer > 2) {
        h.userData.timer = 0;

        // Slight turn
        h.userData.dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * Math.PI / 2);

        // Generate new thought
        const thoughts = [
            "I exist.",
            "I am human.",
            "Why am I walking?",
            "Is someone watching?",
            "I must keep moving.",
            "Am I real?",
            "Do I have purpose?",
            "Maybe I am code."
        ];
        const thought = thoughts[Math.floor(Math.random() * thoughts.length)];
        h.userData.belief = thought;
        h.userData.thoughts.push(thought);

        if (Math.random() < 0.3) console.log(`${h.userData.name}: "${thought}"`);
    }

    h.position.addScaledVector(h.userData.dir, delta * 5);
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    movePlayer(delta);
    humans.forEach(h => wanderHuman(h, delta));

    renderer.render(scene, camera);
}
