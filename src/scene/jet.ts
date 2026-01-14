import * as THREE from 'three';
import type { TelemetryFrame } from '../io/loadJsonl';
import { getRegimeColor } from '../sim/telemetry';

export class MarketJet {
    mesh: THREE.Group;
    trail: THREE.Line;
    trailGeometry: THREE.BufferGeometry;
    trailPoints: THREE.Vector3[] = [];
    maxTrailPoints = 500;

    constructor() {
        this.mesh = new THREE.Group();
        
        // Simple jet model (Cone)
        const geometry = new THREE.ConeGeometry(0.4, 1.2, 8);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x00ffff, 
            emissive: 0x00ffff, 
            emissiveIntensity: 1.0 
        });
        const cone = new THREE.Mesh(geometry, material);
        cone.rotation.x = Math.PI / 2;
        this.mesh.add(cone);

        // Trail
        this.trailGeometry = new THREE.BufferGeometry();
        const trailMaterial = new THREE.LineBasicMaterial({ vertexColors: true });
        this.trail = new THREE.Line(this.trailGeometry, trailMaterial);
    }

    update(frame: TelemetryFrame, pilotPos?: { x: number, y: number, z: number }) {
        const pos = pilotPos || { x: frame.x, y: frame.y, z: frame.z };
        this.mesh.position.set(pos.x, pos.y, pos.z);

        // Update trail
        this.trailPoints.push(new THREE.Vector3(pos.x, pos.y, pos.z));
        if (this.trailPoints.length > this.maxTrailPoints) {
            this.trailPoints.shift();
        }

        if (this.trailPoints.length > 1) {
            const positions = new Float32Array(this.trailPoints.length * 3);
            const colors = new Float32Array(this.trailPoints.length * 3);
            
            this.trailPoints.forEach((p, i) => {
                positions[i * 3] = p.x;
                positions[i * 3 + 1] = p.y;
                positions[i * 3 + 2] = p.z;
                
                const color = new THREE.Color(getRegimeColor(frame.regime));
                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;
            });

            this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            this.trailGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            this.trailGeometry.attributes.position.needsUpdate = true;
            this.trailGeometry.attributes.color.needsUpdate = true;
            this.trailGeometry.computeBoundingSphere();
        }
    }

    resetTrail() {
        this.trailPoints = [];
    }
}
