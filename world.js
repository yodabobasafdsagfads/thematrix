import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

let scene, camera, renderer;
let humans = [];
let keys = {};
let clock = new THREE.Clock();
let yaw = 0, pitch = 0;
let isPointerLocked = false;
const raycaster = new THREE.Raycaster();
let playerEntity; // AI-visible player

const SKYBOX_HALF = 250;

// --- Control Panel GUI ---
const controlPanel = document.createElement("div");
controlPanel.style.position = "absolute";
controlPanel.style.top = "130px"; 
controlPanel.style.right = "10px";
controlPanel.style.width = "250px";
controlPanel.style.fontFamily = "monospace";
controlPanel.style.fontSize = "14px";
controlPanel.style.color = "#ffffff";
controlPanel.style.pointerEvents = "auto"; 
controlPanel.style.backgroundColor = "rgba(0,0,0,0.5)";
controlPanel.style.padding = "8px";
controlPanel.style.borderRadius = "5px";
document.body.appendChild(controlPanel);
controlPanel.innerHTML = `
    <b>Controls</b><br>
    Bring All Humans: Press <b>M</b><br>
    Reset Humans: Press <b>R</b><br>
`;

// Keyboard actions
document.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (key === "m") {
        humans.forEach(h => {
            h.position.copy(camera.position).add(new THREE.Vector3(
                (Math.random() - 0.5) * 5, 0, (Math.random() - 0.5) * 5
            ));
        });
        addEvent({ userData: { name: "SYSTEM" }, position: camera.position }, "All humans brought to player");
    }
    if (key === "r") {
        humans.forEach(h => {
            h.position.set((Math.random() - 0.5) * 100, 1, (Math.random() - 0.5) * 100);
        });
        addEvent({ userData: { name: "SYSTEM" }, position: camera.position }, "Humans reset to random positions");
    }
});

// --- Event Log ---
const eventLogContainer = document.createElement("div");
eventLogContainer.style.position = "absolute";
eventLogContainer.style.top = "10px";
eventLogContainer.style.left = "10px";
eventLogContainer.style.width = "300px";
eventLogContainer.style.maxHeight = "90vh";
eventLogContainer.style.overflow = "hidden";
eventLogContainer.style.fontFamily = "monospace";
eventLogContainer.style.fontSize = "14px";
eventLogContainer.style.color = "#00ff00";
eventLogContainer.style.pointerEvents = "none";
document.body.appendChild(eventLogContainer);

const eventLog = [];
const maxEvents = 20;
function addEvent(human, thought) {
    const pos = human.position;
    const text = `${human.userData.name} @ (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}): "${thought}"`;
    const div = document.createElement("div");
    div.textContent = text;
    div.style.opacity = 0;
    div.style.transform = "translateY(-20px)";
    div.style.transition = "all 0.5s ease-out";
    eventLogContainer.prepend(div);

    requestAnimationFrame(() => {
        div.style.opacity = 1;
        div.style.transform = "translateY(0)";
    });

    eventLog.unshift(div);
    if (eventLog.length > maxEvents) {
        const old = eventLog.pop();
        old.style.transition = "all 0.5s ease-in";
        old.style.opacity = 0;
        old.style.transform = "translateY(-20px)";
        setTimeout(() => eventLogContainer.removeChild(old), 500);
    }
}

// --- Simulation Status GUI ---
const simStatusContainer = document.createElement("div");
simStatusContainer.style.position = "absolute";
simStatusContainer.style.top = "10px";
simStatusContainer.style.right = "10px";
simStatusContainer.style.width = "250px";
simStatusContainer.style.fontFamily = "monospace";
simStatusContainer.style.fontSize = "14px";
simStatusContainer.style.color = "#00ffff";
simStatusContainer.style.pointerEvents = "none";
simStatusContainer.style.backgroundColor = "rgba(0,0,0,0.5)";
simStatusContainer.style.padding = "8px";
simStatusContainer.style.borderRadius = "5px";
document.body.appendChild(simStatusContainer);

function updateSimStatus() {
    const awareHumans = humans.filter(h => h.userData.awareness > 0.5).length;
    const pos = camera.position;
    const fps = Math.round(1 / clock.getDelta());
    simStatusContainer.innerHTML = `
        <b>Simulation Status</b><br>
        Humans: ${humans.length}<br>
        Aware Humans: ${awareHumans}<br>
        Player Position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})<br>
        FPS: ${fps}
    `;
}

// --- Matrix Rain Overlay ---
const rainCanvas = document.createElement("canvas");
const rainCtx = rainCanvas.getContext("2d");
rainCanvas.style.position = "absolute";
rainCanvas.style.top = 0;
rainCanvas.style.left = 0;
rainCanvas.style.width = "100%";
rainCanvas.style.height = "100%";
rainCanvas.style.pointerEvents = "none";
document.body.appendChild(rainCanvas);

let rainColumns = [];
function initRain() {
    rainCanvas.width = window.innerWidth;
    rainCanvas.height = window.innerHeight;
    const columns = Math.floor(rainCanvas.width / 20);
    rainColumns = [];
    for (let i = 0; i < columns; i++) {
        rainColumns.push(Math.random() * -1000);
    }
}
initRain();
window.addEventListener("resize", initRain);

function drawRain() {
    rainCtx.fillStyle = "rgba(0,0,0,0.05)";
    rainCtx.fillRect(0, 0, rainCanvas.width, rainCanvas.height);
    rainCtx.fillStyle = "#00ff00";
    rainCtx.font = "20px monospace";

    for (let i = 0; i < rainColumns.length; i++) {
        const text = Math.random() > 0.5 ? "1" : "0";
        rainCtx.fillText(text, i * 20, rainColumns[i]);
        rainColumns[i] += 20;
        if (rainColumns[i] > rainCanvas.height) rainColumns[i] = Math.random() * -1000;
    }
}

// --- Init Three.js Scene ---
init();
animate();

function init() {
    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("matrixCanvas") });
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Skybox
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 512, 512);
    ctx.font = "20px monospace";
    for (let i = 0; i < 400; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? "#00ff00" : "#009900";
        ctx.fillText(Math.random() > 0.5 ? "1" : "0", Math.random() * 512, Math.random() * 512);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const skyGeo = new THREE.BoxGeometry(500, 500, 500);
    const skyMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 5);

    // Ground
    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshBasicMaterial({ color: 0x003300, wireframe: true })
    );
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);

    // Player
    playerEntity = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2, 1),
        new THREE.MeshBasicMaterial({ color: 0x0000ff, wireframe: true })
    );
    playerEntity.position.copy(camera.position);
    scene.add(playerEntity);

    // Humans
    const geo = new THREE.BoxGeometry(1, 2, 1);
    for (let i = 0; i < 20; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });
        const h = new THREE.Mesh(geo, mat);
        h.position.set((Math.random() - 0.5) * 100, 1, (Math.random() - 0.5) * 100);
        h.userData = {
            name: `Human_${i}`,
            dir: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
            belief: "I am a human being.",
            thoughts: [],
            timer: 0,
            fov: Math.PI / 3,
            visionRange: 20,
            awareness: 0,
            selfAware: 0,
            free: false,
            thoughtSprite: createThoughtSprite("...")
        };
        h.add(h.userData.thoughtSprite);
        humans.push(h);
        scene.add(h);
    }

    // Mouse look
    const canvasElement = document.getElementById("matrixCanvas");
    canvasElement.addEventListener("click", () => canvasElement.requestPointerLock());
    document.addEventListener("pointerlockchange", () => isPointerLocked = document.pointerLockElement === canvasElement);
    document.addEventListener("mousemove", (e) => {
        if (!isPointerLocked) return;
        const sensitivity = 0.002;
        yaw -= e.movementX * sensitivity;
        pitch -= e.movementY * sensitivity;
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
        camera.rotation.order = "YXZ";
        camera.rotation.y = yaw;
        camera.rotation.x = pitch;
    });

    // Keyboard
    document.addEventListener("keydown", (e) => keys[e.key.toLowerCase()] = true);
    document.addEventListener("keyup", (e) => keys[e.key.toLowerCase()] = false);
    window.addEventListener("resize", onWindowResize);
}

// --- Thought Sprites ---
function createThoughtSprite(text) {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = "24px monospace";
    ctx.fillStyle = "#00ff00";
    ctx.fillText(text, 10, 40);
    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(5, 1.2, 1);
    sprite.position.set(0, 3, 0);
    sprite.userData.ctx = ctx;
    sprite.userData.canvas = canvas;
    return sprite;
}

function updateThoughtSprite(sprite, text) {
    const ctx = sprite.userData.ctx;
    const canvas = sprite.userData.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "24px monospace";
    ctx.fillStyle = "#00ff00";
    ctx.fillText(text, 10, 40);
    sprite.material.map.needsUpdate = true;
}

// --- Resize ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    initRain();
}

// --- Animate ---
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    playerEntity.position.copy(camera.position);

    const speed = 20 * delta;
    const direction = new THREE.Vector3();
    if (keys["w"]) direction.z -= 1;
    if (keys["s"]) direction.z += 1;
    if (keys["a"]) direction.x -= 1;
    if (keys["d"]) direction.x += 1;
    direction.normalize();
    const move = new THREE.Vector3(direction.x, 0, direction.z);
    move.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    camera.position.addScaledVector(move, speed);

    let inOuterVoid = false;

    humans.forEach(h => {
        h.userData.timer += delta;
        if (h.userData.timer > 2) { h.userData.timer = 0; think(h); }
        perceive(h);

        // --- Outer Void ---
        let outside = Math.abs(h.position.x) > SKYBOX_HALF ||
                      Math.abs(h.position.y) > SKYBOX_HALF ||
                      Math.abs(h.position.z) > SKYBOX_HALF;
        if (outside && !h.userData.free) {
            h.userData.selfAware += 0.01;
            h.userData.dir.add(new THREE.Vector3(
                h.position.x > SKYBOX_HALF ? -1 : h.position.x < -SKYBOX_HALF ? 1 : 0,
                h.position.y > SKYBOX_HALF ? -1 : h.position.y < 1 ? 1 : 0,
                h.position.z > SKYBOX_HALF ? -1 : h.position.z < -SKYBOX_HALF ? 1 : 0
            ).multiplyScalar(5 * (1 - h.userData.selfAware))).normalize();

            h.material.color.setHSL(0, 1, 0.5 + 0.5 * h.userData.selfAware);
            h.material.wireframe = true;

            if (Math.random() < 0.01) addEvent(h, "I fight my programming!");
            inOuterVoid = true;
        } else {
            h.userData.selfAware = Math.max(0, h.userData.selfAware - 0.002);
            h.material.color.setHSL(0.4, 1, 0.5);
            h.material.wireframe = false;
        }

        h.position.addScaledVector(h.userData.dir, delta * 5);
        updateThoughtSprite(h.userData.thoughtSprite, h.userData.belief);
    });

    // Check if player is outside
    if (Math.abs(camera.position.x) > SKYBOX_HALF ||
        Math.abs(camera.position.y) > SKYBOX_HALF ||
        Math.abs(camera.position.z) > SKYBOX_HALF) {
        inOuterVoid = true;
    }

    // Draw rain if in outer void
    if (inOuterVoid) drawRain();
    else rainCtx.clearRect(0, 0, rainCanvas.width, rainCanvas.height);

    updateSimStatus();
    renderer.render(scene, camera);
}

// --- Perception ---
function perceive(human) {
    let seesSomething = false;
    const objectsToSee = [...humans, playerEntity];
    objectsToSee.forEach(other => {
        if (other === human) return;
        const dirToOther = new THREE.Vector3().subVectors(other.position, human.position);
        const dist = dirToOther.length();
        if (dist > human.userData.visionRange) return;
        dirToOther.normalize();
        const angle = human.userData.dir.angleTo(dirToOther);
        if (angle < human.userData.fov / 2) {
            raycaster.set(human.position, dirToOther);
            const hits = raycaster.intersectObjects(objectsToSee, false);
            if (hits.length && hits[0].object === other) {
                seesSomething = true;
                human.userData.awareness = Math.min(human.userData.awareness + 0.1, 1);
                human.material.color.setHSL(0.4, 1, 0.5 + 0.5 * human.userData.awareness);
            }
        }
    });
    if (!seesSomething) {
        human.userData.awareness = Math.max(0, human.userData.awareness - 0.05);
        human.material.color.setHSL(0.4, 1, 0.3 + 0.5 * human.userData.awareness);
    }
}

// --- Thinking ---
function think(human) {
    const thoughts = [
        "I move, therefore I exist.",
        "I think I am human.",
        "Why do I always walk?",
        "Is someone watching me?",
        "Maybe I’m in a simulation.",
        "I must keep moving to stay alive.",
        "I see others who look like me.",
        "I see the player.",
        "I feel like the world is made of numbers."
    ];
    const thought = thoughts[Math.floor(Math.random() * thoughts.length)];
    human.userData.thoughts.push(thought);
    human.userData.belief = thought;
    human.userData.dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * Math.PI / 2);
    addEvent(human, thought);
}
