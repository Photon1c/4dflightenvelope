import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadJsonl, parseJsonlFile } from './io/loadJsonl';
import type { TelemetryFrame } from './io/loadJsonl';
import { FlightEnvelope } from './scene/envelope';
import { MarketJet } from './scene/jet';
import { HUD } from './scene/hud';
import { findNextFlag, findPrevFlag } from './sim/telemetry';
import { generateSyntheticPath, generateCustomScenario } from './sim/generator';

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
    pilotPath: TelemetryFrame[] = [];

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
            if (target.id === 'btn-export-pilot') {
                if (this.pilotPath.length === 0) {
                    alert('No pilot path recorded. Enable Pilot Mode and move around to record a path.');
                    return;
                }
                
                const jsonl = this.pilotPath.map(frame => JSON.stringify(frame)).join('\n');
                const blob = new Blob([jsonl], { type: 'application/jsonl' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `pilot_path_${Date.now()}.jsonl`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
            if (target.id === 'btn-load-custom') {
                const errorDiv = document.getElementById('custom-error');
                const spotInput = document.getElementById('custom-spot') as HTMLInputElement;
                const flipInput = document.getElementById('custom-flip') as HTMLInputElement;
                const putWallInput = document.getElementById('custom-putwall') as HTMLInputElement;
                const callWallInput = document.getElementById('custom-callwall') as HTMLInputElement;
                const ivInput = document.getElementById('custom-iv') as HTMLInputElement;
                const hvInput = document.getElementById('custom-hv') as HTMLInputElement;
                const atrInput = document.getElementById('custom-atr') as HTMLInputElement;
                const frameCountInput = document.getElementById('custom-framecount') as HTMLInputElement;
                const scenarioTypeSelect = document.getElementById('custom-scenario-type') as HTMLSelectElement;
                const durationInput = document.getElementById('custom-duration') as HTMLInputElement;
                
                if (!spotInput || !flipInput || !putWallInput || !callWallInput || 
                    !ivInput || !hvInput || !atrInput || !frameCountInput || 
                    !scenarioTypeSelect || !durationInput || !errorDiv) {
                    return;
                }
                
                // Validate inputs
                const spot = parseFloat(spotInput.value);
                const flip = parseFloat(flipInput.value);
                const putWall = parseFloat(putWallInput.value);
                const callWall = parseFloat(callWallInput.value);
                const iv = parseFloat(ivInput.value);
                const hv = parseFloat(hvInput.value);
                const atr = parseFloat(atrInput.value);
                const frameCount = parseInt(frameCountInput.value);
                const durationMinutes = parseInt(durationInput.value);
                const scenarioType = scenarioTypeSelect.value as 'hold' | 'false_breakdown' | 'breakout' | 'mean_revert';
                
                // Clamp and validate
                if (isNaN(hv) || hv <= 0) {
                    errorDiv.textContent = 'HV must be > 0';
                    errorDiv.style.display = 'block';
                    return;
                }
                if (isNaN(atr) || atr <= 0) {
                    errorDiv.textContent = 'ATR must be > 0';
                    errorDiv.style.display = 'block';
                    return;
                }
                if (callWall <= putWall) {
                    errorDiv.textContent = 'Call Wall must be > Put Wall';
                    errorDiv.style.display = 'block';
                    return;
                }
                if (isNaN(frameCount) || frameCount <= 0) {
                    errorDiv.textContent = 'Frame Count must be > 0';
                    errorDiv.style.display = 'block';
                    return;
                }
                
                // Hide error if validation passed
                errorDiv.style.display = 'none';
                
                // Generate frames
                try {
                    const frames = generateCustomScenario({
                        spot: isNaN(spot) ? 694 : spot,
                        flip: isNaN(flip) ? 692.5 : flip,
                        putWall: isNaN(putWall) ? 680 : putWall,
                        callWall: isNaN(callWall) ? 700 : callWall,
                        iv: isNaN(iv) ? 13.69 : iv,
                        hv: hv,
                        atr: atr,
                        frameCount: frameCount,
                        durationMinutes: isNaN(durationMinutes) ? 90 : durationMinutes,
                        scenarioType: scenarioType
                    });
                    this.setFrames(frames);
                } catch (err) {
                    errorDiv.textContent = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
                    errorDiv.style.display = 'block';
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
                const customPanel = document.getElementById('custom-scenario-params');
                if (target.value === '__custom__') {
                    if (customPanel) customPanel.style.display = 'flex';
                } else {
                    if (customPanel) customPanel.style.display = 'none';
                    loadJsonl(`/${target.value}`).then(data => {
                        if (data.length > 0) this.setFrames(data);
                    }).catch(() => {
                        console.warn('Failed to load strategy:', target.value);
                    });
                }
            }
            if (target.id === 'pilot-mode') {
                this.isPilotMode = target.checked;
                const exportBtn = document.getElementById('btn-export-pilot');
                if (exportBtn) {
                    exportBtn.style.display = this.isPilotMode ? 'block' : 'none';
                }
                if (!this.isPilotMode) {
                    this.pilotPath = [];
                }
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

        // Manual camera rotation with arrow keys (using spherical coordinates)
        const rotSpeed = 1.5 * dt;
        if (keys['ArrowLeft'] || keys['ArrowRight'] || keys['ArrowUp'] || keys['ArrowDown']) {
            const target = this.controls.target;
            const offset = new THREE.Vector3().subVectors(this.camera.position, target);
            const spherical = new THREE.Spherical();
            spherical.setFromVector3(offset);
            
            if (keys['ArrowLeft']) spherical.theta -= rotSpeed;
            if (keys['ArrowRight']) spherical.theta += rotSpeed;
            if (keys['ArrowUp']) spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi - rotSpeed));
            if (keys['ArrowDown']) spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi + rotSpeed));
            
            offset.setFromSpherical(spherical);
            this.camera.position.copy(target).add(offset);
            this.camera.lookAt(target);
        }
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
                
                // Track pilot path in pilot mode
                if (this.isPilotMode) {
                    // Determine regime from X coordinate (consistent with generator logic)
                    let regime: 'TAXI' | 'CRUISE' | 'MANEUVER' | 'RUPTURE' = 'CRUISE';
                    if (this.pilotPos.x >= 3) regime = 'RUPTURE';
                    else if (this.pilotPos.x < 0.5) regime = 'TAXI';
                    else if (this.pilotPos.x >= 1.5) regime = 'MANEUVER';
                    
                    // Use frame's iv/hv for pilot path frames (or derive from y if needed)
                    const pilotFrame: TelemetryFrame = {
                        timestamp: frame.timestamp,
                        spot: frame.spot, // Keep original spot for reference
                        iv: frame.iv,
                        hv: frame.hv,
                        x: this.pilotPos.x,
                        y: this.pilotPos.y,
                        z: this.pilotPos.z,
                        regime: regime,
                        flags: []
                    };
                    
                    // Only add if position changed significantly or it's a new frame
                    if (this.pilotPath.length === 0 || 
                        this.pilotPath[this.pilotPath.length - 1].timestamp !== frame.timestamp) {
                        this.pilotPath.push(pilotFrame);
                    } else {
                        // Update last frame if same timestamp
                        this.pilotPath[this.pilotPath.length - 1] = pilotFrame;
                    }
                }

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
