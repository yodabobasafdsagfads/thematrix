// world.js
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

let scene, camera, renderer;
let humans = [];
let keys = {};
let velocity = new THREE.Vector3();
let clock = new THREE.Clock();
let yaw = 0, pitch = 0;
let isPointerLocked = false;
const raycaster = new THREE.Raycaster();
let playerEntity; // the AI-visible player

const SKYBOX_HALF = 250;

// --- Control Panel GUI ---
const controlPanel = document.createElement("div");
controlPanel.style.position = "absolute";
controlPanel.style.top = "130px"; // below simulation status
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

// --- Event Log Setup ---
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
    const pos = human.position || (human.userData && human.userData.position) || new THREE.Vector3();
    const name = (human.userData && human.userData.name) || human.userData?.name || human.userData?.label || "SYSTEM";
    const text = `${name} @ (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}): "${thought}"`;
    const div = document.createElement("div");
    div.textContent = text;
    div.style.opacity = 0;
    div.style.transform = "translateY(-20px)";
    div.style.transition = "all 0.45s cubic-bezier(.2,.8,.2,1)";
    eventLogContainer.prepend(div);

    requestAnimationFrame(() => {
        div.style.opacity = 1;
        div.style.transform = "translateY(0)";
    });

    eventLog.unshift(div);
    if (eventLog.length > maxEvents) {
        const old = eventLog.pop();
        old.style.transition = "all 0.35s ease-in";
        old.style.opacity = 0;
        old.style.transform = "translateY(-20px)";
        setTimeout(() => { if (old.parentNode) eventLogContainer.removeChild(old); }, 400);
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
    const fps = Math.max(2, Math.round(1 / Math.max(clock.getDelta(), 0.001)));
    simStatusContainer.innerHTML = `
        <b>Simulation Status</b><br>
        Humans: ${humans.length}<br>
        Aware Humans: ${awareHumans}<br>
        Player Position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})<br>
        FPS: ${fps}
    `;
}

// hook control keys (bring/reset)
document.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (key === "m") {
        humans.forEach(h => {
            h.position.copy(camera.position).add(new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                0,
                (Math.random() - 0.5) * 5
            ));
            // reset some internal state so they notice player
            h.userData.memory = [];
            h.userData.awareness = 0.2;
        });
        addEvent({ userData: { name: "SYSTEM" }, position: camera.position }, "All humans brought to player");
    }
    if (key === "r") {
        humans.forEach(h => {
            h.position.set((Math.random() - 0.5) * 100, 1, (Math.random() - 0.5) * 100);
            h.userData.dir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
            h.userData.memory = [];
            h.userData.awareness = 0;
        });
        addEvent({ userData: { name: "SYSTEM" }, position: camera.position }, "Humans reset to random positions");
    }
});

// --- Init + animate calls placed after functions ---
init();
animate();

// --- Initialization ---
function init() {
    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("matrixCanvas"), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // === Matrix Skybox ===
    const canvasTex = document.createElement("canvas");
    canvasTex.width = canvasTex.height = 512;
    const ctx = canvasTex.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 512, 512);
    ctx.font = "20px monospace";
    for (let i = 0; i < 400; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? "#00ff00" : "#009900";
        ctx.fillText(Math.random() > 0.5 ? "1" : "0", Math.random() * 512, Math.random() * 512);
    }
    const texture = new THREE.CanvasTexture(canvasTex);
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

    // Player Entity (for NPCs to see)
    playerEntity = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2, 1),
        new THREE.MeshBasicMaterial({ color: 0x0000ff, wireframe: true })
    );
    playerEntity.position.copy(camera.position);
    scene.add(playerEntity);

    // Create advanced "average human" agents
    createHumans(20);

    // Mouse Look - pointerlock style
    const canvasElement = document.getElementById("matrixCanvas");
    canvasElement.addEventListener("click", () => canvasElement.requestPointerLock());
    document.addEventListener("pointerlockchange", () => {
        isPointerLocked = document.pointerLockElement === canvasElement;
    });
    document.addEventListener("mousemove", (e) => {
        if (!isPointerLocked) return;
        const sensitivity = 0.0025;
        yaw -= e.movementX * sensitivity;
        pitch -= e.movementY * sensitivity;
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
        camera.rotation.order = "YXZ";
        camera.rotation.y = yaw;
        camera.rotation.x = pitch;
    });

    // Keyboard movement state
    document.addEventListener("keydown", (e) => keys[e.key.toLowerCase()] = true);
    document.addEventListener("keyup", (e) => keys[e.key.toLowerCase()] = false);
    window.addEventListener("resize", onWindowResize);
}

// --- Create humans with advanced userdata ---
function createHumans(count) {
    const geo = new THREE.BoxGeometry(1, 2, 1);
    for (let i = 0; i < count; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: false });
        const h = new THREE.Mesh(geo, mat);
        h.position.set((Math.random() - 0.5) * 80, 1, (Math.random() - 0.5) * 80);

        // userData: advanced mental model
        h.userData = {
            id: i,
            name: `Human_${i}`,
            dir: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
            belief: "I am a human being.",
            thoughts: [],
            timer: 0,
            // vision
            fov: Math.PI * 0.5, // 90 degrees
            visionRange: 24,
            eyeOffset: new THREE.Vector3(0, 1.6, 0),
            // cognition
            awareness: 0,
            doubt: 0,
            freeWill: 0.7, // illusion strength (0..1)
            memory: [], // recent perceptions
            memoryDuration: 6.0, // seconds to remember
            // goal system
            goal: { type: "wander", target: null, expires: 0 },
            speed: 2 + Math.random() * 1.5,
            // visual thought
            thoughtSprite: createHumanThoughtSprite("..."),
            // head orientation (for smooth turning)
            headYaw: Math.atan2(this?.dir?.z || 0, this?.dir?.x || 1),
        };

        // attach thought sprite
        h.add(h.userData.thoughtSprite);

        humans.push(h);
        scene.add(h);
    }
}

// --- Thought sprite (human-like white text bubble) ---
function createHumanThoughtSprite(text) {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext("2d");
    // initial draw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    roundRect(ctx, 2, 2, canvas.width - 4, canvas.height - 4, 8, true, false);
    ctx.font = "20px Arial";
    ctx.fillStyle = "#ffffff";
    wrapText(ctx, text, 12, 36, canvas.width - 24, 22);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(6, 1.6, 1);
    sprite.position.set(0, 3.6, 0);
    sprite.userData = { ctx, canvas, tex, lastText: text, visibleSince: performance.now() / 1000 };
    sprite.material.opacity = 0.95;
    return sprite;
}

// utility: rounded rectangle
function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    if (typeof r === 'undefined') r = 5;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

// utility: wrap text
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, y);
}

// update thought sprite text
function updateHumanThoughtSprite(sprite, text) {
    if (!sprite || !sprite.userData) return;
    if (text === sprite.userData.lastText) return; // no change
    const { ctx, canvas } = sprite.userData;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    roundRect(ctx, 2, 2, canvas.width - 4, canvas.height - 4, 8, true, false);
    ctx.font = "20px Arial";
    ctx.fillStyle = "#ffffff";
    wrapText(ctx, text, 12, 36, canvas.width - 24, 22);
    sprite.userData.lastText = text;
    sprite.userData.tex.needsUpdate = true;
    sprite.userData.visibleSince = performance.now() / 1000;
}

// --- Resize handler ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Animate loop ---
function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(0.1, clock.getDelta()); // clamp delta

    // move playerEntity to match camera
    if (playerEntity) playerEntity.position.copy(camera.position);

    // player movement
    const speed = 10 * delta;
    const dir = new THREE.Vector3();
    if (keys["w"]) dir.z -= 1;
    if (keys["s"]) dir.z += 1;
    if (keys["a"]) dir.x -= 1;
    if (keys["d"]) dir.x += 1;
    if (dir.lengthSq() > 0) {
        dir.normalize();
        const move = new THREE.Vector3(dir.x, 0, dir.z);
        move.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        camera.position.addScaledVector(move, speed);
    }

    // AI update for each human
    const now = performance.now() / 1000;
    humans.forEach(h => {
        // timers
        h.userData.timer += delta;

        // Perception: realistic vision
        const perception = perceiveRealistic(h);
        // decision making and goal update
        decideGoal(h, perception, delta, now);
        // action: move toward goal
        executeMovement(h, delta);
        // update thought bubble based on belief (fade older thoughts)
        updateHumanThoughtBubble(h, now);
    });

    updateSimStatus();
    renderer.render(scene, camera);
}

// --- Realistic perception using FOV + raycast + eye height ---
function perceiveRealistic(human) {
    const eyePos = new THREE.Vector3().copy(human.position).add(human.userData.eyeOffset);
    const seen = [];
    const objectsToSee = [...humans, playerEntity];

    for (let other of objectsToSee) {
        if (other === human) continue;
        const dirToOther = new THREE.Vector3().subVectors(other.position, eyePos);
        const dist = dirToOther.length();
        if (dist > human.userData.visionRange) continue;
        dirToOther.normalize();

        // Human "forward" vector is userData.dir (flat) - ensure normalized
        const forward = new THREE.Vector3(human.userData.dir.x, 0, human.userData.dir.z).normalize();
        const angle = forward.angleTo(dirToOther);
        if (angle > human.userData.fov / 2) continue;

        // raycast to check obstruction
        raycaster.set(eyePos, dirToOther);
        const hits = raycaster.intersectObjects(objectsToSee, false);
        if (hits.length && hits[0].object === other) {
            // visible
            seen.push({ object: other, distance: dist, dir: dirToOther.clone() });
            // add to memory with timestamp
            human.userData.memory.push({ t: performance.now() / 1000, objId: other.userData?.id ?? -1, type: other === playerEntity ? "player" : "human", pos: other.position.clone() });
        }
    }

    // prune memory older than memoryDuration
    const cutoff = performance.now() / 1000 - human.userData.memoryDuration;
    human.userData.memory = human.userData.memory.filter(m => m.t >= cutoff);

    // awareness increases when seeing something
    if (seen.length) {
        human.userData.awareness = Math.min(1, human.userData.awareness + 0.05 * seen.length);
        human.userData.doubt = Math.max(0, human.userData.doubt - 0.01);
    } else {
        human.userData.awareness = Math.max(0, human.userData.awareness - 0.01);
        // small natural drift in doubt
        human.userData.doubt = Math.max(0, human.userData.doubt - 0.002);
    }

    return seen;
}

// --- Decision making: pick a goal based on perception & internal state ---
function decideGoal(human, perception, delta, now) {
    // If current goal expired, choose a new one
    if (!human.userData.goal || human.userData.goal.expires < now) {
        chooseNewGoal(human, perception, now);
        return;
    }

    // Reactive changes: if sees player, sometimes switch to "observe player"
    if (perception.some(p => p.object === playerEntity)) {
        if (Math.random() < 0.35 * human.userData.freeWill) {
            human.userData.goal = { type: "observe", target: playerEntity, expires: now + (3 + Math.random() * 4) };
            human.userData.belief = "I want to see who that is.";
            addEvent(human, human.userData.belief);
            return;
        }
    }

    // if sees other humans and goal is wander, occasionally join them
    if (human.userData.goal.type === "wander" && perception.length > 0) {
        const other = perception[Math.floor(Math.random() * perception.length)].object;
        if (other !== playerEntity && Math.random() < 0.25) {
            human.userData.goal = { type: "approach", target: other, expires: now + (2 + Math.random() * 4) };
            human.userData.belief = "I feel like meeting that one.";
            addEvent(human, human.userData.belief);
            return;
        }
    }

    // small probabilistic re-evaluation to simulate "free will"
    if (Math.random() < 0.01 * human.userData.freeWill) {
        chooseNewGoal(human, perception, now);
    }
}

// --- Choose a new goal baseline ---
function chooseNewGoal(human, perception, now) {
    // baseline intentions: wander, idly observe, explore, approach memory
    const r = Math.random();
    if (r < 0.5) {
        // wander to a random nearby point
        const offset = new THREE.Vector3((Math.random() - 0.5) * 20, 0, (Math.random() - 0.5) * 20);
        const target = new THREE.Vector3().copy(human.position).add(offset);
        human.userData.goal = { type: "wander", target, expires: now + (4 + Math.random() * 6) };
        human.userData.belief = chooseBeliefFor("wander", human);
        addEvent(human, human.userData.belief);
    } else if (r < 0.75 && human.userData.memory.length > 0) {
        // explore a remembered location
        const mem = human.userData.memory[Math.floor(Math.random() * human.userData.memory.length)];
        human.userData.goal = { type: "exploreMemory", targetPos: mem.pos.clone(), expires: now + (3 + Math.random() * 5) };
        human.userData.belief = "I remember something interesting; I'll check it out.";
        addEvent(human, human.userData.belief);
    } else {
        // idle observe
        human.userData.goal = { type: "idle", expires: now + (2 + Math.random() * 4) };
        human.userData.belief = "I will stand here and think.";
        addEvent(human, human.userData.belief);
    }
}

// quick helper for belief text
function chooseBeliefFor(goalType, human) {
    switch (goalType) {
        case "wander":
            return ["I decided to go this way.", "I feel like exploring.", "Why not walk a little?"][Math.floor(Math.random() * 3)];
        case "approach":
            return ["I want to get a closer look.", "Maybe they'll be interesting.", "I should say hello (in my head)."][Math.floor(Math.random() * 3)];
        default:
            return ["I think I'll do this.", "This feels right."];
    }
}

// --- Movement execution: steer toward goal, smooth turning, avoid crowding ---
function executeMovement(human, delta) {
    const now = performance.now() / 1000;
    const goal = human.userData.goal;
    if (!goal) return;

    // head turning: when goal has a target, turn smoothly towards it
    let desiredDir = new THREE.Vector3().copy(human.userData.dir);

    if (goal.type === "wander" && goal.target) {
        desiredDir = new THREE.Vector3().subVectors(goal.target, human.position).setY(0);
    } else if (goal.type === "approach" && goal.target) {
        desiredDir = new THREE.Vector3().subVectors(goal.target.position, human.position).setY(0);
    } else if (goal.type === "exploreMemory" && goal.targetPos) {
        desiredDir = new THREE.Vector3().subVectors(goal.targetPos, human.position).setY(0);
    } else if (goal.type === "observe" && goal.target) {
        desiredDir = new THREE.Vector3().subVectors(goal.target.position, human.position).setY(0);
    } else {
        // idle - small slow rotation
        desiredDir = human.userData.dir.clone().applyAxisAngle(new THREE.Vector3(0,1,0),(Math.random()-0.5)*0.2*delta);
    }

    if (desiredDir.lengthSq() > 0.0001) desiredDir.normalize();

    // Avoid crowding: if others are very near, add a separation vector
    const separation = new THREE.Vector3();
    humans.forEach(other => {
        if (other === human) return;
        const dist = human.position.distanceTo(other.position);
        if (dist < 2.0) {
            const away = new THREE.Vector3().subVectors(human.position, other.position).normalize().multiplyScalar((2.0 - dist));
            separation.add(away);
        }
    });
    if (separation.lengthSq() > 0.0001) {
        separation.normalize();
        // blend separation into desiredDir
        desiredDir.add(separation.multiplyScalar(0.8)).normalize();
    }

    // Smoothly interpolate human.userData.dir toward desiredDir
    human.userData.dir.lerp(desiredDir, 0.08 + 0.02 * human.userData.awareness);

    // Movement speed depends on goal type
    let speed = human.userData.speed;
    if (goal.type === "idle") speed = 0;
    if (goal.type === "observe") speed *= 0.25;
    if (goal.type === "approach") speed *= 1.0;

    // Move position
    const step = new THREE.Vector3().copy(human.userData.dir).multiplyScalar(speed * delta);
    human.position.add(step);

    // Update heading rotation (visual)
    const targetYaw = Math.atan2(human.userData.dir.x, human.userData.dir.z);
    // smooth rotation
    const currentRot = human.rotation.y;
    let dy = targetYaw - currentRot;
    dy = ((dy + Math.PI) % (2 * Math.PI)) - Math.PI; // wrap
    human.rotation.y = currentRot + dy * 0.12;

    // If reached goal target (approx), expire it
    if (goal.target && goal.target.position) {
        const distToTarget = human.position.distanceTo(goal.target.position);
        if (distToTarget < 1.3) {
            human.userData.goal.expires = (performance.now() / 1000) - 0.01; // will force new goal
            // form a thought about interaction
            human.userData.belief = generateContextualThought(human, goal.target);
            addEvent(human, human.userData.belief);
        }
    } else if (goal.target) {
        const distToPoint = human.position.distanceTo(goal.target);
        if (distToPoint < 1.3) {
            human.userData.goal.expires = (performance.now() / 1000) - 0.01;
            human.userData.belief = "I arrived where I meant to be.";
            addEvent(human, human.userData.belief);
        }
    }
}

// generate contextual thought for arrived interactions
function generateContextualThought(human, target) {
    if (target === playerEntity) {
        return randomChoice([
            "They move a little differently.",
            "I wonder what they're thinking.",
            "Why are they here?"
        ]);
    } else {
        return randomChoice([
            "We pass each other, like always.",
            "They look like me for a moment.",
            "I almost said hello (in my head)."
        ]);
    }
}

// helper: random choice
function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// update thought bubble display & fading
function updateHumanThoughtBubble(human, now) {
    // keep text stable for a short time; if no new thought, occasionally produce ambient thought
    if (!human.userData.belief) human.userData.belief = "I exist.";
    // put the belief into sprite
    const sprite = human.userData.thoughtSprite;
    // show only when near player or randomly sometimes
    const showAlways = camera.position.distanceTo(human.position) < 12;
    const shouldUpdate = showAlways || Math.random() < 0.003;
    if (shouldUpdate) {
        updateHumanThoughtSprite(sprite, human.userData.belief);
    }
    // fade away after some seconds
    const age = now - (sprite.userData.visibleSince || 0);
    if (age > 6 && sprite.material.opacity > 0.02) {
        sprite.material.opacity = Math.max(0, sprite.material.opacity - 0.02);
    } else if (age <= 6) {
        sprite.material.opacity = Math.min(0.98, sprite.material.opacity + 0.04);
    }
    // ensure sprite always faces camera
    sprite.quaternion.copy(camera.quaternion);
}

// --- Thinking: contextual and believable, invoked periodically by goal decision ---
function think(human) {
    // This function is intentionally lightweight - beliefs are set during goal changes
    // but we keep a fallback micro-thought to keep things alive
    const ambient = [
        "I think I chose to be here.",
        "The day feels ordinary.",
        "I enjoy the rhythm of walking.",
        "Sometimes I wonder if I decided this."
    ];
    if (Math.random() < 0.3) {
        human.userData.belief = randomChoice(ambient);
        addEvent(human, human.userData.belief);
    }
}

// --- Perceive helper used earlier was perceiveRealistic -- keep old perceive name for compatibility ---
function perceive(human) {
    // wrapper to keep existing code compatibility; returns whether anything seen
    const seen = perceiveRealistic(human);
    return seen.length > 0;
}

// --- Utility functions used earlier for thought sprite drawing
// (already defined above: roundRect, wrapText, updateHumanThoughtSprite)

// --- Window resize handler attached already ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Small fallback think loop (keeps old periodic think behavior compatible) ---
setInterval(() => {
    humans.forEach(h => {
        // small chance to call think() and update belief text when idle
        if (Math.random() < 0.2) think(h);
    });
}, 3000);
