import * as THREE from 'three';
import type { TelemetryFrame } from '../io/loadJsonl';

export class FlightEnvelope {
    group: THREE.Group;
    mesh: THREE.Mesh;

    constructor(frames: TelemetryFrame[]) {
        this.group = new THREE.Group();

        // Calculate bounds from frames
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        frames.forEach(f => {
            minX = Math.min(minX, f.x);
            maxX = Math.max(maxX, f.x);
            minY = Math.min(minY, f.y);
            maxY = Math.max(maxY, f.y);
            minZ = Math.min(minZ, f.z);
            maxZ = Math.max(maxZ, f.z);
        });

        // Add some padding to bounds
        const width = (maxX - minX) || 10;
        const height = (maxY - minY) || 10;
        const depth = (maxZ - minZ) || 10;

        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({
            color: 0x00ff88,
            wireframe: true,
            transparent: true,
            opacity: 0.4,
            emissive: 0x00ff88,
            emissiveIntensity: 0.5
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
        this.group.add(this.mesh);

        // Add threshold planes for X=1, X=3
        this.addThresholdPlane(1, 0x00ffff, width, height, depth);
        this.addThresholdPlane(3, 0xff0055, width, height, depth);

        // Add a floor grid
        const gridHelper = new THREE.GridHelper(100, 50, 0x00ff88, 0x004422);
        gridHelper.position.y = minY - 2;
        this.group.add(gridHelper);

        // Axis Labels
        this.addLabel("STRUCTURAL AIRSPEED (X)", new THREE.Vector3(maxX + 2, minY - 1, (minZ + maxZ) / 2), 0x00ff88);
        this.addLabel("LOAD FACTOR (Y)", new THREE.Vector3(minX - 1, maxY + 1, (minZ + maxZ) / 2), 0x00ff88);
        this.addLabel("WALL PROXIMITY (Z)", new THREE.Vector3((minX + maxX) / 2, minY - 1, maxZ + 2), 0x00ff88);
    }

    private addLabel(text: string, pos: THREE.Vector3, color: number) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = 512;
        canvas.height = 128;
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = 'Bold 40px Monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
        ctx.fillText(text, 256, 64);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.copy(pos);
        sprite.scale.set(8, 2, 1);
        this.group.add(sprite);
    }

    private addThresholdPlane(x: number, color: number, w: number, h: number, d: number) {
        const geom = new THREE.PlaneGeometry(h + 10, d + 10);
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
            emissive: color,
            emissiveIntensity: 0.2
        });
        const plane = new THREE.Mesh(geom, mat);
        plane.position.x = x;
        plane.rotation.y = Math.PI / 2;
        this.group.add(plane);
    }
}
