import * as THREE from 'three';
import './style.css';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import Stats from 'stats.js';


/**
 * Constants & Settings
 */
const CONFIG = {
    WALK_SPEED: 12,
    SPRINT_SPEED: 30,
    JUMP_POWER: 36,
    GRAVITY: 90,
    SMOOTH_FACTOR: 0.1,
    CAMERA_OFFSET: new THREE.Vector3(0, 4.5, 10.5),
    MIN_ZOOM: 0.2,
    MAX_ZOOM: 5.0,
    ZOOM_SPEED: 0.5
};

const CHARACTERS = {
    Avo: { 
        path: '/models/Avo.glb',
        scale: 2.0, 
        yOffset: 0,
        speed: 14, 
        jumpPower: 30,
        anims: { idle: 'Idle', walk: 'Walk' }
    },
    EGG: { 
        path: '/models/EGG.glb',
        yOffset: 0, // Lifted for legs
        scale: 2.0, 
        speed: 10, 
        jumpPower:20,
        anims: { idle: 'Idle', walk: 'Walk' }
    }
};


let currentZoom = 1.0;



/**
 * State Management
 */
let currentState = 'MENU';
let currentChar = 'Avo';
let playerHealth = 100;
let player = null;
let playerModel = null;
let mixer = null;
let animations = {};
let currentAction = null;

// Controls
const keys = { w: false, a: false, s: false, d: false, Shift: false, ' ': false };
const mouse = { x: 0, y: 0 };
let rotationY = 0;
let rotationX = 0;

// Collisions
const collidables = [];
const spawnPlatformBounds = []; // Boxes for the 100y area

/**
 * Base Setup
 */
const canvas = document.querySelector('#app');
const scene = new THREE.Scene();



const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
};

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 2000);
camera.position.set(0, 5, 10);

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Tone Mapping helps handle high-range lighting without "burning out" whites
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6; // Lower global exposure

/**
 * Post-Processing
 */
const renderScene = new RenderPass(scene, camera);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(sizes.width, sizes.height), 0.02, 0.4, 0.85);
bloomPass.threshold = 1.0; 
bloomPass.exposure = 1.0;

const outputPass = new OutputPass();

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);
composer.addPass(outputPass);

/**
 * Lighting & Sky
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.02); // Almost nothing for strong shadows
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.5); // Stronger sun for crisp shadows
sunLight.position.set(100, 100, 100);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 4096;
sunLight.shadow.mapSize.height = 4096;
sunLight.shadow.camera.left = -200;
sunLight.shadow.camera.right = 200;
sunLight.shadow.camera.top = 200;
sunLight.shadow.camera.bottom = -200;
scene.add(sunLight);

/**
 * Skybox (Equirectangular Sphere)
 */
const textureLoader = new THREE.TextureLoader();
let skyboxMesh;

textureLoader.load('/skybox/skybox-kitchen.webp', (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    scene.environment = tex;    // PBR reflections

    // Skybox sphere with mipmap blur to hide compression artifacts
    const skyboxGeo = new THREE.SphereGeometry(900, 64, 32);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.wrapS = THREE.RepeatWrapping;
    const skyboxMat = new THREE.ShaderMaterial({
        uniforms: { map: { value: tex }, lodBias: { value: 2.5 } },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D map;
            uniform float lodBias;
            varying vec2 vUv;
            void main() {
                gl_FragColor = texture2D(map, vec2(vUv.x * 2.0, vUv.y), lodBias);
            }
        `,
        side: THREE.BackSide
    });
    skyboxMesh = new THREE.Mesh(skyboxGeo, skyboxMat);
    skyboxMesh.scale.y = 0.7;
    scene.add(skyboxMesh);

    console.log('Skybox loaded.');
});


/**
 * Environment
 */
// Grid removed.

/**
 * Kitchen Table (Arena Floor)
 */
const tableGeo = new THREE.BoxGeometry(600, 2, 600); // 600x600 Kitchen Table
const tableMat = new THREE.MeshStandardMaterial({ 
    color: 0x2c1e14, // Dark wood
    roughness: 0.1,
    metalness: 0.2
});

const table = new THREE.Mesh(tableGeo, tableMat);
table.position.y = -1; // Top is at 0
table.receiveShadow = true;
scene.add(table);

// No Lava, No Grid

/**
 * Spawn Platforms & Rectangles (100y Area)
 */
function createSpawnArea() {
    const platformGeo = new THREE.BoxGeometry(70, 1, 30);
    const platformMat = new THREE.MeshPhongMaterial({ color: 0x333333, shininess: 100 });
    
    // Thinner carpet in the dead-center
    const carpetGeo = new THREE.BoxGeometry(70, 0.1, 4); 
    const carpetMat = new THREE.MeshPhongMaterial({ color: 0x880000 });
    
    const buttonGeo = new THREE.BoxGeometry(4, 0.2, 4);
    const podiumGeo = new THREE.BoxGeometry(4, 0.4, 4);
    const podiumMat = new THREE.MeshPhongMaterial({ color: 0x555555 });
    
    // Platform 1
    const p1 = new THREE.Mesh(platformGeo, platformMat);
    p1.position.set(0, 100, 0);
    p1.receiveShadow = true;
    scene.add(p1);
    spawnPlatformBounds.push(new THREE.Box3().setFromObject(p1));

    const carpet1 = new THREE.Mesh(carpetGeo, carpetMat);
    carpet1.position.set(0, 100.56, 0); // Exactly in the middle
    scene.add(carpet1);

    const pod1 = new THREE.Mesh(podiumGeo, podiumMat);
    pod1.position.set(30, 100.7, 10); // Far right side
    pod1.castShadow = true;
    scene.add(pod1);

    const btn1 = new THREE.Mesh(buttonGeo, new THREE.MeshPhongMaterial({ color: 0x00ff88 }));
    btn1.position.set(30, 100.6, 4); 
    btn1.name = "spawnButton";
    scene.add(btn1);

    // Platform 2
    const p2OffsetZ = -45;
    const p2 = new THREE.Mesh(platformGeo, platformMat);
    p2.position.set(0, 100, p2OffsetZ);
    p2.receiveShadow = true;
    scene.add(p2);
    spawnPlatformBounds.push(new THREE.Box3().setFromObject(p2));

    const carpet2 = new THREE.Mesh(carpetGeo, carpetMat);
    carpet2.position.set(0, 100.56, p2OffsetZ);
    scene.add(carpet2);

    const pod2 = new THREE.Mesh(podiumGeo, podiumMat);
    pod2.position.set(30, 100.7, p2OffsetZ + 10);
    pod2.castShadow = true;
    scene.add(pod2);

    const btn2 = new THREE.Mesh(buttonGeo, new THREE.MeshPhongMaterial({ color: 0x00ff88 }));
    btn2.position.set(30, 100.6, p2OffsetZ + 4);
    btn2.name = "spawnButton";
    scene.add(btn2);

    // Bridge
    const bridgeGeo = new THREE.BoxGeometry(15, 1.0, 20);
    const bridge = new THREE.Mesh(bridgeGeo, platformMat);
    bridge.position.set(0, 100, -22.5);
    scene.add(bridge);
    spawnPlatformBounds.push(new THREE.Box3().setFromObject(bridge));
}

createSpawnArea();

/**
 * Burning Particles (Lava)
 */
const fireGeometry = new THREE.BufferGeometry();
const fireCount = 40;
const firePositions = new Float32Array(fireCount * 3);
for (let i = 0; i < fireCount * 3; i++) firePositions[i] = 0;
fireGeometry.setAttribute('position', new THREE.BufferAttribute(firePositions, 3));
const fireMaterial = new THREE.PointsMaterial({ size: 0.5, color: 0xff4400, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
const fireParticles = new THREE.Points(fireGeometry, fireMaterial);
fireParticles.visible = false;
scene.add(fireParticles);

function updateFireEffect(pos, isActive) {
    fireParticles.visible = isActive;
    if (!isActive) return;
    
    const positions = fireParticles.geometry.attributes.position.array;
    for (let i = 0; i < fireCount; i++) {
        const i3 = i * 3;
        if (Math.random() > 0.9 || positions[i3+1] > 3) {
            positions[i3] = pos.x + (Math.random() - 0.5) * 2;
            positions[i3+1] = pos.y + Math.random();
            positions[i3+2] = pos.z + (Math.random() - 0.5) * 2;
        } else {
            positions[i3+1] += 0.1;
        }
    }
    fireParticles.geometry.attributes.position.needsUpdate = true;
}
const particles = [];
const particleCount = 40;
const particleGeo = new THREE.SphereGeometry(0.15, 8, 8);

function createJuiceExplosion(pos, color) {
    for(let i = 0; i < particleCount; i++) {
        const mat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 1 });
        const p = new THREE.Mesh(particleGeo, mat);
        p.position.copy(pos);
        
        // Random velocity
        const v = new THREE.Vector3(
            (Math.random() - 0.5) * 40,
            Math.random() * 40,
            (Math.random() - 0.5) * 40
        );
        
        scene.add(p);
        particles.push({ mesh: p, vel: v, life: 1.0 });
    }
}

function updateParticles(dt) {
    for(let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if(p.life <= 0) {
            scene.remove(p.mesh);
            particles.splice(i, 1);
            continue;
        }
        p.vel.y -= 50 * dt; // Gravity
        p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
        p.mesh.scale.setScalar(p.life);
    }
}

// Legacy decorations removed.

/**
 * Asset Loading
 */
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

async function startGame(charType) {
    currentState = 'GAME';
    console.log(`Starting game with: ${charType}`);
    
    // Hide menus
    document.getElementById('char-selection')?.classList.add('hidden');
    document.getElementById('game-menu')?.classList.add('hidden');
    
    // Show HUD
    const hud = document.getElementById('game-hud');
    const controls = document.getElementById('game-controls');
    if (hud) hud.classList.add('visible');
    if (controls) controls.classList.add('visible');

    currentChar = charType;
    
    // Clear previous
    if(player) scene.remove(player);
    
    player = new THREE.Group();
    scene.add(player);

    const settings = CHARACTERS[charType] || CHARACTERS.Avo;
    const path = settings.path;
    const statusVal = document.getElementById('status-char');
    if (statusVal) statusVal.innerText = 'LOADING...';
    
    try {
        const gltf = await gltfLoader.loadAsync(path);
        if (statusVal) statusVal.innerText = charType.toUpperCase();

        playerModel = gltf.scene;
        playerModel.traverse(node => {
            if(node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });
        
        playerModel.scale.setScalar(settings.scale);
        playerModel.position.y = settings.yOffset || 0;
        player.add(playerModel);

        mixer = new THREE.AnimationMixer(playerModel);
        animations = {};

        gltf.animations.forEach(clip => {
            const rawName = clip.name.toLowerCase();
            const action = mixer.clipAction(clip);
            animations[rawName] = action;
            if (rawName.includes('idle')) animations['_idle'] = action;
            if (rawName.includes('walk')) animations['_walk'] = action;
        });

        const idleAction = animations['_idle'] || animations[Object.keys(animations)[0]];
        if(idleAction) {
            currentAction = idleAction;
            currentAction.play();
        }
        
        respawnPlayer();
    } catch (error) {
        console.warn(`Could not load ${charType}.glb, using placeholder.`, error);
        if (statusVal) statusVal.innerText = `${charType.toUpperCase()} (ERROR)`;
        createPlaceholder();
    }
}

function createPlaceholder() {
    const geo = new THREE.CapsuleGeometry(0.5, 1, 4, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0x00f2ff });
    playerModel = new THREE.Mesh(geo, mat);
    playerModel.scale.set(3, 3, 3);
    playerModel.position.y = 3; // Adjusted for 3x scale
    playerModel.castShadow = true;
    player.add(playerModel);
}

/**
 * Controller Logic
 */
let velocity = new THREE.Vector3();
let onGround = true;

function updateController(dt) {
    if (!player) return;

    const settings = CHARACTERS[currentChar] || CHARACTERS.Avo;
    const speed = keys.Shift ? settings.speed * 4 : settings.speed;
    const direction = new THREE.Vector3();

    if (keys.w) direction.z -= 1;
    if (keys.s) direction.z += 1;
    if (keys.a) direction.x -= 1;
    if (keys.d) direction.x += 1;

    direction.normalize();
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);

    velocity.x = THREE.MathUtils.lerp(velocity.x, direction.x * speed, CONFIG.SMOOTH_FACTOR);
    velocity.z = THREE.MathUtils.lerp(velocity.z, direction.z * speed, CONFIG.SMOOTH_FACTOR);

    // Gravity & Jump
    if (!onGround) {
        velocity.y -= CONFIG.GRAVITY * dt;
    } else if (keys[' ']) {
        velocity.y = settings.jumpPower;
        onGround = false;
    }

    // Apply movement
    let nextPos = player.position.clone().add(velocity.clone().multiplyScalar(dt));
    
    // Invisible Walls around spawn platforms (radius/bounds check)
    if (player.position.y > 90) {
        let inside = false;
        for (const box of spawnPlatformBounds) {
            if (box.containsPoint(nextPos)) {
                inside = true;
                break;
            }
        }
        // If they try to step outside, block them (fake wall)
        if (!inside) {
            velocity.x = 0;
            velocity.z = 0;
            nextPos.copy(player.position);
        }
    }

    // Simple Collision Check (AABB)
    let collision = false;
    const playerRadius = 1.0;
    
    for (const obj of collidables) {
        if (nextPos.x + playerRadius > obj.min.x && nextPos.x - playerRadius < obj.max.x &&
            nextPos.z + playerRadius > obj.min.z && nextPos.z - playerRadius < obj.max.z &&
            nextPos.y < obj.max.y) {
            
            collision = true;
            break;
        }
    }

    // Table Boundary Check (Prevent walking off)
    if (player.position.y < 5) {
        const tableLimit = 298; // Half of 600 minus player radius
        if (Math.abs(nextPos.x) > tableLimit || Math.abs(nextPos.z) > tableLimit) {
            velocity.x = 0;
            velocity.z = 0;
            nextPos.copy(player.position);
        }
    }

    // Simple Collision Check (AABB)

    if (!collision) {
        player.position.copy(nextPos);
    } else {
        // Slide or stop
        velocity.set(0, velocity.y, 0); 
    }

    // Restricted Ground check
    let groundLevel = -100; // Floor of the world
    const dist = Math.sqrt(player.position.x ** 2 + player.position.z ** 2);
    
    onGround = false;

    // Check if on spawn platforms (AABB check)
    if (player.position.y > 90) {
        for (const box of spawnPlatformBounds) {
            if (player.position.x >= box.min.x && player.position.x <= box.max.x &&
                player.position.z >= box.min.z && player.position.z <= box.max.z) {
                groundLevel = 100;
                break;
            }
        }
    } 
    else { 
        groundLevel = 0;
    }

    if (player.position.y <= groundLevel) {
        player.position.y = groundLevel;
        velocity.y = 0;
        onGround = true;
    }

    // No Lava, No Damage
    playerHealth = 100;
    
    // Update HUD Health Bar
    const healthBar = document.getElementById('health-bar-fill');
    if (healthBar) healthBar.style.width = `${Math.max(0, playerHealth)}%`;

    // Match visuals to movement and animate
    const isMoving = direction.lengthSq() > 0.001;
    const targetAnimGroup = isMoving ? '_walk' : '_idle';

    if (mixer) {
        const nextAction = animations[targetAnimGroup] || animations[targetAnimGroup.substring(1)];
        if (nextAction && currentAction !== nextAction) {
            console.log(`Switching animation to: ${targetAnimGroup}`);
            if (currentAction) currentAction.fadeOut(0.2);
            currentAction = nextAction;
            currentAction.reset().fadeIn(0.2).play();
        }
        
        if (currentAction) {
            currentAction.timeScale = (keys.Shift && isMoving) ? 2.5 : 1.0; 
        }
    } else if (playerModel) {
        // Fallback or un-animated bob
        playerModel.position.y = Math.sin(clock.getElapsedTime() * 3) * 0.1 + (onGround ? 0 : playerModel.position.y);
    }

    if (isMoving) {
        const targetRotation = Math.atan2(direction.x, direction.z);
        playerModel.rotation.y = THREE.MathUtils.lerp(playerModel.rotation.y, targetRotation, 0.2);
    }

    // Spawn Button Triggers
    if (player.position.y > 90) {
        scene.traverse(obj => {
            if (obj.name === "spawnButton" && player.position.distanceTo(obj.position) < 3) {
                console.log('Stepped on spawn button!');
                player.position.set((Math.random() - 0.5) * 80, 40, (Math.random() - 0.5) * 80);
                velocity.set(0, 0, 0);
            }
        });
    }

    // Camera follow
    updateCamera();
}

function respawnPlayer() {
    if (!player) return;
    playerHealth = 100;
    player.position.set(0, 101, 0); // Above platform
    velocity.set(0, 0, 0);
    onGround = false;
}

function updateAnimation(name) {
    let action = findAnimation(name);
    
    // Fallback: If 'run' is requested but missing, try 'walk'
    if (!action && name === 'run') {
        action = findAnimation('walk');
    }
    
    if (!action || currentAction === action) return;
    
    action.reset().fadeIn(0.2).play();
    if (currentAction) currentAction.fadeOut(0.2);
    currentAction = action;
}

function findAnimation(name) {
    const lowerName = name.toLowerCase();
    
    // 1. Exact match (all keys are lowercase from loader)
    if (animations[lowerName]) return animations[lowerName];
    
    // 2. Partial match (in case track names are "Armature|Walk", etc.)
    const keys = Object.keys(animations);
    const fuzzyKey = keys.find(k => k.includes(lowerName));
    return animations[fuzzyKey];
}

function updateCamera() {
    const offset = new THREE.Vector3(0, 5, 10);
    // Apply horizontal rotation
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
    // Apply vertical rotation
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
    offset.applyAxisAngle(right, rotationX);
    
    camera.position.copy(player.position).add(offset);
    camera.lookAt(player.position.clone().add(new THREE.Vector3(0, 2, 0)));
}



/**
 * Interactions
 */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

window.addEventListener('keydown', (e) => { if(keys.hasOwnProperty(e.key)) keys[e.key] = true; });
window.addEventListener('keyup', (e) => { if(keys.hasOwnProperty(e.key)) keys[e.key] = false; });

canvas.addEventListener('mousedown', (e) => {
    if (currentState === 'GAME') {
        canvas.requestPointerLock();
    }
});

window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas || currentState === 'GAME') {
        rotationY -= e.movementX * 0.002;
        rotationX -= e.movementY * 0.002;
        
        // Clamp vertical look
        rotationX = THREE.MathUtils.clamp(rotationX, -Math.PI / 3, Math.PI / 4);
    }
});

window.addEventListener('wheel', (e) => {
    if (currentState === 'GAME') {
        currentZoom += e.deltaY * 0.001 * CONFIG.ZOOM_SPEED;
        currentZoom = THREE.MathUtils.clamp(currentZoom, CONFIG.MIN_ZOOM, CONFIG.MAX_ZOOM);
    }
}, { passive: true });


// Menu State Switching
function switchMenu(fromId, toId) {
    const from = document.getElementById(fromId);
    const to = document.getElementById(toId);
    if (from && to) {
        from.classList.add('hidden');
        to.classList.remove('hidden');
        console.log(`Menu switch: ${fromId} -> ${toId}`);
    } else {
        console.error(`Menu error: ${fromId} or ${toId} not found`);
    }
}

const startBtn = document.getElementById('start-btn');
if (startBtn) {
    startBtn.onclick = () => switchMenu('game-menu', 'char-selection');
}

const backBtn = document.getElementById('back-to-menu');
if (backBtn) {
    backBtn.onclick = () => switchMenu('char-selection', 'game-menu');
}

/**
 * Menu Logic & Pointer Lock Manager
 */
const pauseMenu = document.getElementById('pause-menu');

const resumeGame = () => {
    console.log("Resuming game...");
    if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
    }
};

const respawnAndResume = () => {
    console.log("Respawning and resuming...");
    respawnPlayer();
    resumeGame();
};

// Unified Pointer Lock Listener:
// This is the most reliable way to sync UI with browser state.
document.addEventListener('pointerlockchange', () => {
    const isLocked = document.pointerLockElement === canvas;
    console.log("Pointer lock changed. Locked:", isLocked, "CurrentState:", currentState);
    
    if (isLocked) {
        pauseMenu.classList.add('hidden');
    } else if (currentState === 'GAME') {
        pauseMenu.classList.remove('hidden');
    }
});

document.addEventListener('pointerlockerror', () => {
    console.error("Pointer lock error! Ensure you've clicked inside the window.");
});

// Button Handlers
const resumeHandler = (e) => {
    if (e) e.stopPropagation();
    console.log("Direct resume call from event:", e?.type);
    resumeGame();
};

document.getElementById('resume-btn').addEventListener('click', resumeHandler);
document.getElementById('resume-btn').addEventListener('mousedown', resumeHandler);

document.getElementById('respawn-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    respawnAndResume();
});

document.getElementById('quit-btn').addEventListener('click', () => {
    location.reload();
});

// Character Selection Handlers
document.querySelectorAll('.char-btn[data-char]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const char = btn.dataset.char;
        console.log(`Character selected: ${char}`);
        
        // Step 1: Request Lock (Must be first in user interaction)
        canvas.requestPointerLock();
        
        // Step 2: Start Game
        startGame(char);
    });
});


// All legacy menu handlers consolidated or removed.


/**
 * Game Loop
 */
const clock = new THREE.Clock();
const stats = new Stats();
document.body.appendChild(stats.dom);

function tick() {
    stats.begin();
    const dt = clock.getDelta();

    if (currentState === 'GAME') {
        updateController(dt);
        if (mixer) mixer.update(dt);
    } else if (currentState === 'MENU') {
        // Cinematic menu camera
        const time = clock.elapsedTime * 0.2;
        camera.position.x = Math.sin(time) * 30;
        camera.position.z = Math.cos(time) * 30;
        camera.position.y = 12;
        camera.lookAt(0, 2, 0);
    }

    // Fixed skybox — player can approach the horizon as they walk
    if (skyboxMesh) {
        skyboxMesh.position.set(0, 150, 0);
    }

    updateParticles(dt);

    composer.render();
    stats.end();
    requestAnimationFrame(tick);
}

// Window Resize
window.addEventListener('resize', () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setSize(sizes.width, sizes.height);
    composer.setSize(sizes.width, sizes.height);
});

tick();
