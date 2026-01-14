import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadJsonl, parseJsonlFile } from './io/loadJsonl';
import type { TelemetryFrame } from './io/loadJsonl';
import { FlightEnvelope } from './scene/envelope';
import { MarketJet } from './scene/jet';
import { HUD } from './scene/hud';
import { findNextFlag, findPrevFlag } from './sim/telemetry';
import { generateSyntheticPath } from './sim/generator';

class App {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    
    frames: TelemetryFrame[] = [];
    currentIndex = 0;
    isPlaying = true;
    playbackSpeed = 1;
    isPilotMode = false;
    pilotPos = { x: 0, y: 0, z: 0 };

    envelope?: FlightEnvelope;
    jet: MarketJet;
    hud: HUD;

    lastTime = 0;

    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050505);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 5, 15);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        const container = document.getElementById('app');
        if (container) container.appendChild(this.renderer.domElement);
        else document.body.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.enableKeys = true;
        this.controls.keys = {
            LEFT: 'ArrowLeft',
            UP: 'ArrowUp',
            RIGHT: 'ArrowRight',
            BOTTOM: 'ArrowDown'
        };
        
        const ambient = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambient);
        
        const sun = new THREE.DirectionalLight(0xffffff, 1.5);
        sun.position.set(5, 10, 7.5);
        this.scene.add(sun);

        this.scene.add(new THREE.AxesHelper(5));

        this.jet = new MarketJet();
        this.scene.add(this.jet.mesh);
        this.scene.add(this.jet.trail);

        this.hud = new HUD();

        this.setupEvents();
        this.animate();

        this.initDefault();
    }

    initDefault() {
        const grid = new THREE.GridHelper(100, 100, 0x00ff88, 0x002211);
        grid.position.y = -2;
        this.scene.add(grid);

        const introGeo = new THREE.IcosahedronGeometry(2, 1);
        const introMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true, transparent: true, opacity: 0.3 });
        const introMesh = new THREE.Mesh(introGeo, introMat);
        introMesh.name = 'intro-mesh';
        this.scene.add(introMesh);

        loadJsonl('/telemetry.jsonl').then(data => {
            if (data.length > 0) {
                this.scene.remove(introMesh);
                this.setFrames(data);
            }
        }).catch(() => {
            console.log('No default telemetry found. Showing intro cue.');
        });
    }

    setFrames(frames: TelemetryFrame[]) {
        this.frames = frames;
        this.currentIndex = 0;
        
        if (this.envelope) this.scene.remove(this.envelope.group);
        this.envelope = new FlightEnvelope(frames);
        this.scene.add(this.envelope.group);
        
        this.jet.resetTrail();
        const firstFrame = frames[0];
        if (firstFrame) {
            this.pilotPos = { x: firstFrame.x, y: firstFrame.y, z: firstFrame.z };
        }

        const center = new THREE.Vector3();
        const box = new THREE.Box3().setFromObject(this.envelope.group);
        box.getCenter(center);
        
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const dist = maxDim * 2;
        
        this.camera.position.set(center.x, center.y + 2, center.z + dist);
        this.controls.target.copy(center);
        this.controls.update();
    }

    setupEvents() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.id === 'play-pause') {
                this.isPlaying = !this.isPlaying;
                target.innerText = this.isPlaying ? 'PAUSE' : 'PLAY';
            }
            if (target.id === 'next-flag') {
                this.currentIndex = findNextFlag(this.frames, this.currentIndex);
            }
            if (target.id === 'prev-flag') {
                this.currentIndex = findPrevFlag(this.frames, this.currentIndex);
            }
            if (target.id === 'btn-generate') {
                const framesInput = document.getElementById('param-frames') as HTMLInputElement;
                const spotInput = document.getElementById('param-spot') as HTMLInputElement;
                const ivInput = document.getElementById('param-iv') as HTMLInputElement;
                
                if (framesInput && spotInput && ivInput) {
                    const steps = parseInt(framesInput.value);
                    const startSpot = parseFloat(spotInput.value);
                    const startIv = parseFloat(ivInput.value);

                    const frames = generateSyntheticPath({
                        steps,
                        startSpot,
                        startIv,
                        targetIv: startIv,
                        atr: 2.8,
                        flip: 692.5,
                        putWall: 680.0,
                        callWall: 700.0
                    });
                    this.setFrames(frames);
                }
            }
        });

        document.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            if (target.id === 'timeline') {
                this.currentIndex = parseInt(target.value);
                this.isPlaying = false;
                const btn = document.getElementById('play-pause');
                if (btn) btn.innerText = 'PLAY';
            }
            if (target.id === 'speed-select') {
                this.playbackSpeed = parseFloat(target.value);
            }
            if (target.id === 'strategy-select') {
                loadJsonl(`/${target.value}`).then(data => {
                    if (data.length > 0) this.setFrames(data);
                });
            }
            if (target.id === 'pilot-mode') {
                this.isPilotMode = target.checked;
            }
        });

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.jsonl';
        input.id = 'file-upload-input';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (file) {
                const data = await parseJsonlFile(file);
                this.setFrames(data);
            }
        };

        const keys: Record<string, boolean> = {};
        window.addEventListener('keydown', (e) => {
            keys[e.code] = true;
            if (e.key === 'i' || e.key === 'I') {
                const pane = document.getElementById('instructions-pane');
                if (pane) {
                    pane.style.display = pane.style.display === 'none' ? 'block' : 'none';
                }
            }

            if (e.code === 'Space' && this.isPilotMode) {
                const frame = this.frames[Math.floor(this.currentIndex)];
                if (frame) {
                    this.pilotPos = { x: frame.x, y: frame.y, z: frame.z };
                }
            }
        });
        window.addEventListener('keyup', (e) => {
            keys[e.code] = false;
        });

        this.animate(0, keys);
    }

    animate(time = 0, keys: Record<string, boolean> = {}) {
        requestAnimationFrame((t) => this.animate(t, keys));
        
        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        // OrbitControls handles arrow keys natively via enableKeys
        this.controls.update();

        if (this.isPilotMode) {
            const step = 5.0 * dt;
            if (keys['KeyW']) this.pilotPos.z -= step;
            if (keys['KeyS']) this.pilotPos.z += step;
            if (keys['KeyA']) this.pilotPos.x -= step;
            if (keys['KeyD']) this.pilotPos.x += step;
            if (keys['KeyQ']) this.pilotPos.y += step;
            if (keys['KeyE']) this.pilotPos.y -= step;
        }

        const introMesh = this.scene.getObjectByName('intro-mesh');
        if (introMesh) {
            introMesh.rotation.y += dt * 0.5;
            introMesh.rotation.z += dt * 0.3;
        }

        if (this.frames.length > 0) {
            if (this.isPlaying) {
                this.currentIndex += dt * 30 * this.playbackSpeed;
                if (this.currentIndex >= this.frames.length) {
                    this.currentIndex = 0;
                    this.jet.resetTrail();
                }
            }

            const frameIndex = Math.floor(this.currentIndex);
            const frame = this.frames[frameIndex];
            
            if (frame) {
                this.jet.update(frame, this.isPilotMode ? this.pilotPos : undefined);
                this.hud.update(frame, frameIndex, this.frames.length - 1, this.isPilotMode, this.pilotPos);

                if (this.isPlaying && !this.isPilotMode) {
                    const offset = new THREE.Vector3(0, 2, 5);
                    const targetPos = this.jet.mesh.position.clone().add(offset);
                    
                    if (!keys['ArrowLeft'] && !keys['ArrowRight'] && !keys['ArrowUp'] && !keys['ArrowDown']) {
                        this.camera.position.lerp(targetPos, 0.1);
                        this.controls.target.lerp(this.jet.mesh.position, 0.1);
                    }
                }
            }
            this.controls.update();
        }

        this.renderer.render(this.scene, this.camera);
    }
}

new App();
