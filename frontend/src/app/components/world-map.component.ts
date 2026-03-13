import { Component, OnInit, OnDestroy, ElementRef, ViewChild, inject } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HumanService, VirtualHuman } from '../services/human.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-world-map',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="game-container">
      <div #canvasContainer class="canvas-wrapper"></div>
      
      <!-- Selected Human Info Panel -->
      <div class="info-panel glass-panel" *ngIf="selectedHuman">
        <button class="close-btn" (click)="selectedHuman = null">×</button>
        <div class="panel-header">
           <h3>{{ selectedHuman.firstName }} {{ selectedHuman.lastName }}</h3>
           <div class="badge">{{ selectedHuman.isPlayerControlled ? 'Player' : 'AI' }}</div>
        </div>
        <p class="money">💰 \${{ selectedHuman.moneyBalance | number:'1.2-2' }}</p>
        
        <div class="action-status">
           <strong>CURRENT TASK:</strong><br/>
           <span class="highlight">{{ selectedHuman.currentAction ? selectedHuman.currentAction.name : 'Wandering/Idling' }}</span>
        </div>

        <div class="stats-mini">
           <div>Hunger: {{ formatStat(selectedHuman.needHunger) }}%</div>
           <div>Energy: {{ formatStat(selectedHuman.needEnergy) }}%</div>
           <div>Joy: {{ formatStat(selectedHuman.needFun) }}%</div>
           <div>Social: {{ formatStat(selectedHuman.needSocial) }}%</div>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .game-container { position: relative; width: 100%; height: 600px; border-radius: 12px; overflow: hidden; border: 1px solid var(--glass-border); }
    .canvas-wrapper { width: 100%; height: 100%; }
    .info-panel { position: absolute; top: 20px; right: 20px; width: 300px; z-index: 10; padding: 20px; background: rgba(13, 15, 26, 0.9); backdrop-filter: blur(10px); border: 1px solid var(--primary); box-shadow: 0 0 20px rgba(0, 242, 254, 0.2); }
    .close-btn { position: absolute; top: 10px; right: 10px; background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer; }
    .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
    .panel-header h3 { margin: 0; color: #fff; }
    .badge { background: var(--primary); color: #000; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; }
    .money { color: var(--stat-fun); font-weight: bold; font-size: 1.2rem; margin-bottom: 15px; }
    .action-status { margin-bottom: 15px; font-size: 0.9rem; color: var(--text-muted); }
    .highlight { color: var(--primary); font-size: 1.1rem; font-weight: bold; }
    .stats-mini { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem; color: var(--text-main); }
  `]
})
export class WorldMapComponent implements OnInit, OnDestroy {
    @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef;

    private humanSvc = inject(HumanService);
    private pollingInterval: any;
    private animationFrameId: number | null = null;

    public humans: VirtualHuman[] = [];
    public selectedHuman: VirtualHuman | null = null;

    // THREE.js Variables
    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private renderer!: THREE.WebGLRenderer;
    private controls!: OrbitControls;
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();

    // Maps to track 3D meshes to their Human IDs 
    private humanMeshes: Map<string, THREE.Group | THREE.Mesh> = new Map();
    private targetPositions: Map<string, THREE.Vector3> = new Map();

    private hashCode(s: string): number {
        let hash = 0;
        for (let i = 0; i < s.length; i++) {
            hash = Math.imul(31, hash) + s.charCodeAt(i) | 0;
        }
        return hash;
    }

    ngOnInit() {
        this.initThreeJS();

        this.fetchData();
        this.pollingInterval = setInterval(() => this.fetchData(), 1000);
    }

    fetchData() {
        this.humanSvc.getHumans().subscribe(data => {
            this.humans = data;

            // Update selected human UI
            if (this.selectedHuman) {
                const updated = data.find(h => h.id === this.selectedHuman!.id);
                if (updated) this.selectedHuman = updated;
            }

            this.update3DScene(data);
        });
    }

    initThreeJS() {
        const container = this.canvasContainer.nativeElement as HTMLElement;

        // 1. Setup Scene, Camera, Renderer
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0d0f1a);
        this.scene.fog = new THREE.Fog(0x0d0f1a, 50, 200);

        const width = container.clientWidth;
        const height = container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        // Position camera diagonally looking down at the city
        this.camera.position.set(50, 60, 50);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        container.appendChild(this.renderer.domElement);

        // 2. Setup Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(50, 100, 50);
        dirLight.castShadow = true;
        dirLight.shadow.camera.top = 100;
        dirLight.shadow.camera.bottom = -100;
        dirLight.shadow.camera.left = -100;
        dirLight.shadow.camera.right = 100;
        this.scene.add(dirLight);

        // Neon accents
        const pointLight = new THREE.PointLight(0x00f2fe, 1, 100);
        pointLight.position.set(0, 10, 0);
        this.scene.add(pointLight);

        // 3. Setup Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 0, 0);
        this.controls.maxPolarAngle = Math.PI / 2.2; // Don't allow camera below ground
        this.controls.update();

        // 4. Build the 3D City!
        this.buildCity();

        // 5. Interaction (Clicking characters)
        this.renderer.domElement.addEventListener('pointerup', (e) => this.onMouseClick(e), false);

        // 6. Start Render Loop
        this.animate();

        // Handle Resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    buildCity() {
        // Generate an abstract 3D synthwave/cyberpunk city block

        // The Ground
        const planeGeo = new THREE.PlaneGeometry(200, 200);
        const planeMat = new THREE.MeshStandardMaterial({
            color: 0x111116,
            roughness: 0.8,
            metalness: 0.2
        });
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.rotation.x = -Math.PI / 2;
        plane.receiveShadow = true;
        this.scene.add(plane);

        // Grid helper for a futuristic floor look
        const gridHelper = new THREE.GridHelper(200, 100, 0x00f2fe, 0x333333);
        gridHelper.position.y = 0.01; // Slightly above ground to prevent Z-fighting
        (gridHelper.material as any).transparent = true;
        (gridHelper.material as any).opacity = 0.2;
        this.scene.add(gridHelper);

        // Generate Buildings (Procedural blocks)
        // We will leave the center (0,0) relatively open for wandering and place buildings on the edges
        const buildingMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.4 });
        const highlightMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, wireframe: true });

        const colors = [0x222233, 0x332233, 0x223333, 0x333344, 0x443333, 0x2a3b4c, 0x3e2723, 0x1b5e20];

        // Creating random skyscrapers around the playable boundary
        for (let i = 0; i < 60; i++) {
            // Random position, avoiding the middle 100x100 area
            let x = (Math.random() - 0.5) * 180;
            let z = (Math.random() - 0.5) * 180;

            if (Math.abs(x) < 50 && Math.abs(z) < 50) {
                // Push them out if they spawned in the center open area
                x = x > 0 ? x + 50 : x - 50;
                z = z > 0 ? z + 50 : z - 50;
            }

            const width = 6 + Math.random() * 8;
            const depth = 6 + Math.random() * 8;
            const baseHeight = 10 + Math.random() * 20;

            const bldgColor = colors[Math.floor(Math.random() * colors.length)];
            const bldgMat = new THREE.MeshStandardMaterial({ color: bldgColor, roughness: 0.6 });

            const baseGeo = new THREE.BoxGeometry(width, baseHeight, depth);
            const base = new THREE.Mesh(baseGeo, bldgMat);
            base.position.set(x, baseHeight / 2, z);
            base.castShadow = true;
            base.receiveShadow = true;
            this.scene.add(base);

            // Add cool wireframe edges for cyberpunk feel
            const edges = new THREE.EdgesGeometry(baseGeo);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0.15 }));
            base.add(line);

            // House/Block Number Sign
            if (Math.random() > 0.3) {
                const idString = "UNIT " + Math.floor(Math.random() * 999).toString().padStart(3, '0');
                // The canvas aspect is 4:1 width:height, scale width to match ratio approx
                const sign = this.createTextBoard(idString, '#000000', '#ffd93d', depth * 0.6);
                sign.rotation.y = Math.PI / 2; // Face sideways
                sign.position.set(width / 2 + 0.1, baseHeight / 2 - 2, 0);
                base.add(sign);
            }

            // Add a tower / top section 60% of the time to give a structured look
            if (Math.random() > 0.4) {
                const towerHeight = 10 + Math.random() * 25;
                const towerGeo = new THREE.BoxGeometry(width * 0.7, towerHeight, depth * 0.7);
                const tower = new THREE.Mesh(towerGeo, bldgMat);
                tower.position.set(x, baseHeight + towerHeight / 2, z);
                tower.castShadow = true;
                tower.receiveShadow = true;
                this.scene.add(tower);

                const tEdges = new THREE.EdgesGeometry(towerGeo);
                const tLine = new THREE.LineSegments(tEdges, new THREE.LineBasicMaterial({ color: 0xff0044, transparent: true, opacity: 0.15 }));
                tower.add(tLine);

                // Antenna
                if (Math.random() > 0.5) {
                    const antGeo = new THREE.CylinderGeometry(0.2, 0.2, 5);
                    const antMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
                    const ant = new THREE.Mesh(antGeo, antMat);
                    ant.position.set(x, baseHeight + towerHeight + 2.5, z);
                    this.scene.add(ant);
                }
            }
        }

        // Create explicit Points of Interest
        // Home (10, 10 mapped to -40, -40 on 3D grid)
        this.createMainBuilding(-40, -40, "HOME ZONE", 0x3d3d5c, 15, 12, 15);
        // Factory (80, 20 mapped to 30, -30)
        this.createMainBuilding(30, -30, "CYBER FACTORY", 0x5c3d3d, 20, 15, 20);
        // Restaurant (80, 80 mapped to 30, 30)
        this.createMainBuilding(30, 30, "NEON NOODLES", 0x5c523d, 18, 10, 18);
    }

    createTextBoard(text: string, bgColor: string, txtColor: string, widthScale: number = 8): THREE.Mesh {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d')!;

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, 512, 128);

        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 10;
        ctx.strokeRect(0, 0, 512, 128);

        ctx.fillStyle = txtColor;
        ctx.font = 'bold 70px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 256, 64);

        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.MeshBasicMaterial({ map: texture });
        const geo = new THREE.PlaneGeometry(widthScale, widthScale / 4);
        return new THREE.Mesh(geo, mat);
    }

    createMainBuilding(x: number, z: number, label: string, colorHex: number, w: number, h: number, d: number) {
        const g = new THREE.BoxGeometry(w, h, d);
        const m = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.7 });
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const edges = new THREE.EdgesGeometry(g);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0.5 }));
        mesh.add(line);

        // Add 3D text signboard
        const sign = this.createTextBoard(label, '#111116', '#00f2fe');
        // Place it slightly in front of the front face (assuming front is +Z)
        sign.position.set(0, h / 2 - 2, d / 2 + 0.1);
        mesh.add(sign);

        // Add a back sign too
        const signBack = this.createTextBoard(label, '#111116', '#00f2fe');
        signBack.position.set(0, h / 2 - 2, -d / 2 - 0.1);
        signBack.rotation.y = Math.PI;
        mesh.add(signBack);

        this.scene.add(mesh);
    }



    update3DScene(data: VirtualHuman[]) {
        // Clean up disconnected humans
        const currentIds = new Set(data.map(h => h.id));
        for (const [id, mesh] of this.humanMeshes.entries()) {
            if (!currentIds.has(id)) {
                this.scene.remove(mesh);
                this.humanMeshes.delete(id);
                this.targetPositions.delete(id);
            }
        }

        // Add or update human positions
        for (const h of data) {
            // The backend map simulates 0 to 100.
            // Let's translate this to a 3D coordinate system from -50 to +50 on the X/Z plane.
            const targetX = h.coordinateX - 50;
            const targetZ = h.coordinateY - 50;
            const newTarget = new THREE.Vector3(targetX, 1, targetZ); // Y=1 so they walk above ground

            if (!this.humanMeshes.has(h.id)) {
                // --- Create new 3D Human with distinct faces and clothes ---
                const group = new THREE.Group();
                group.position.copy(newTarget);
                group.userData = { id: h.id }; // Attach ID for raycaster clicks

                const hash = this.hashCode(h.id);
                // Random deterministic apparel and skin
                const skinTones = [0xffcc99, 0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d];
                const shirtColors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff, 0xffffff, 0x222222, 0x8844ff];
                const pantColors = [0x111155, 0x222222, 0x554433, 0x335533, 0xffffff];

                const skinColor = skinTones[Math.abs(hash) % skinTones.length];
                const shirtColor = shirtColors[Math.abs(hash * 2) % shirtColors.length];
                const pantColor = pantColors[Math.abs(hash * 3) % pantColors.length];

                const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.4 });
                const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
                const pantMat = new THREE.MeshStandardMaterial({ color: pantColor, roughness: 0.9 });

                // Construct Body Parts
                const headGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
                const head = new THREE.Mesh(headGeo, skinMat);
                head.position.y = 1.3 + 0.4;
                head.castShadow = true;

                // Eyes (face)
                const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
                const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
                const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
                leftEye.position.set(-0.2, 0.1, 0.41);
                const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
                rightEye.position.set(0.2, 0.1, 0.41);
                head.add(leftEye, rightEye);

                const torsoGeo = new THREE.BoxGeometry(0.9, 1.2, 0.5);
                const torso = new THREE.Mesh(torsoGeo, shirtMat);
                torso.position.y = 0.6 + 0.6;
                torso.castShadow = true;

                const legGeo = new THREE.BoxGeometry(0.4, 0.8, 0.4);
                const leftLeg = new THREE.Mesh(legGeo, pantMat);
                leftLeg.position.set(-0.25, -0.6 - 0.4, 0); // Relative to Torso
                leftLeg.castShadow = true;
                const rightLeg = new THREE.Mesh(legGeo, pantMat);
                rightLeg.position.set(0.25, -0.6 - 0.4, 0);
                rightLeg.castShadow = true;
                torso.add(leftLeg, rightLeg);

                group.add(head, torso);

                // Player Indicator
                if (h.isPlayerControlled) {
                    const markerGeo = new THREE.ConeGeometry(0.4, 0.8, 4);
                    const markerMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
                    const marker = new THREE.Mesh(markerGeo, markerMat);
                    marker.rotation.x = Math.PI;
                    marker.position.y = 2.5;
                    group.add(marker);
                }

                // Give them a tiny point light so they glow on the floor!
                const glow = new THREE.PointLight(shirtColor, 0.8, 4);
                glow.position.y = 1;
                group.add(glow);

                this.scene.add(group);
                this.humanMeshes.set(h.id, group);
                this.targetPositions.set(h.id, newTarget);
            } else {
                // --- Update Target Position for Interpolation ---
                this.targetPositions.set(h.id, newTarget);
            }
        }
    }

    onMouseClick(event: PointerEvent) {
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        const container = this.canvasContainer.nativeElement as HTMLElement;
        const rect = container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

        // Raycast from camera to scene
        this.raycaster.setFromCamera(this.mouse, this.camera);
        // Only check intersections against Human Meshes. Pass true to check children of groups.
        const intersects = this.raycaster.intersectObjects(Array.from(this.humanMeshes.values()), true);

        if (intersects.length > 0) {
            // Because humans are Groups, climb up the parent tree until we find the group with the userData id
            let object: THREE.Object3D | null = intersects[0].object;
            while (object && !object.userData['id']) {
                object = object.parent;
            }

            if (object && object.userData['id']) {
                const clickedId = object.userData['id'];
                const hum = this.humans.find(h => h.id === clickedId);
                if (hum) {
                    this.selectedHuman = hum;
                }
            }
        }
    }

    animate() {
        // Render Loop
        this.animationFrameId = requestAnimationFrame(() => this.animate());

        // Interpolate characters smoothly between server ticks
        for (const [id, mesh] of this.humanMeshes.entries()) {
            const targetPos = this.targetPositions.get(id);
            if (targetPos) {
                // Smooth lerp (linear interpolation) towards the target position. 
                // 0.1 determines the speed/smoothness of the slide.
                mesh.position.lerp(targetPos, 0.1);

                // Make them "bounce" slightly while moving to simulate walking!
                if (mesh.position.distanceTo(targetPos) > 0.5) {
                    mesh.position.y = 1 + Math.abs(Math.sin(Date.now() * 0.01)) * 0.5;
                } else {
                    mesh.position.y = 1; // Stand still
                }
            }
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        if (!this.camera || !this.renderer || !this.canvasContainer) return;
        const container = this.canvasContainer.nativeElement as HTMLElement;
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    ngOnDestroy() {
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

        // Cleanup ThreeJS Memory
        if (this.renderer) {
            this.renderer.dispose();
            const dom = this.canvasContainer?.nativeElement;
            if (dom && this.renderer.domElement) dom.removeChild(this.renderer.domElement);
        }

        this.humanMeshes.forEach(mesh => {
            if ((mesh as any).geometry) (mesh as any).geometry.dispose();
            // Notice: We don't dispose material globally if shared, but here we can
        });
    }

    public formatStat(value: number): string {
        return Math.max(0, Math.min(100, Math.round(value))).toString();
    }
}
