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
    private humanMeshes: Map<string, THREE.Mesh> = new Map();
    private targetPositions: Map<string, THREE.Vector3> = new Map();

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

        // Creating random skyscrapers around the playable boundary
        for (let i = 0; i < 40; i++) {
            // Random position, avoiding the middle 100x100 area
            let x = (Math.random() - 0.5) * 180;
            let z = (Math.random() - 0.5) * 180;

            if (Math.abs(x) < 50 && Math.abs(z) < 50) {
                // Push them out if they spawned in the center open area
                x = x > 0 ? x + 50 : x - 50;
                z = z > 0 ? z + 50 : z - 50;
            }

            const width = 5 + Math.random() * 10;
            const depth = 5 + Math.random() * 10;
            const height = 10 + Math.random() * 40;

            const geometry = new THREE.BoxGeometry(width, height, depth);
            const bldg = new THREE.Mesh(geometry, buildingMat);
            bldg.position.set(x, height / 2, z);
            bldg.castShadow = true;
            bldg.receiveShadow = true;
            this.scene.add(bldg);

            // Add cool wireframe edges for cyberpunk feel
            const edges = new THREE.EdgesGeometry(geometry);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0.3 }));
            bldg.add(line);
        }

        // Create explicit Points of Interest
        // Home (10, 10 mapped to -40, -40 on 3D grid)
        this.createZoneMarker(-40, -40, 0x3d3d5c);
        // Factory (80, 20 mapped to 30, -30)
        this.createZoneMarker(30, -30, 0x5c3d3d);
        // Restaurant (80, 80 mapped to 30, 30)
        this.createZoneMarker(30, 30, 0x5c523d);
    }

    createZoneMarker(x: number, z: number, color: number) {
        const g = new THREE.BoxGeometry(10, 0.5, 10);
        const m = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.5 });
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(x, 0.25, z);
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
                // --- Create new 3D Human (A simple capsule/cylinder for now) ---
                const geometry = new THREE.CapsuleGeometry(0.5, 1.5, 4, 8);

                // Yellow for AI, Cyan for Player
                const color = h.isPlayerControlled ? 0x00f2fe : 0xffd93d;
                const material = new THREE.MeshStandardMaterial({
                    color: color,
                    emissive: color,
                    emissiveIntensity: 0.5
                });

                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.copy(newTarget);
                mesh.castShadow = true;
                mesh.userData = { id: h.id }; // Attach ID for raycaster clicks

                // Give them a tiny point light so they glow on the floor!
                const glow = new THREE.PointLight(color, 2, 5);
                mesh.add(glow);

                this.scene.add(mesh);
                this.humanMeshes.set(h.id, mesh);
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
        // Only check intersections against Human Meshes
        const intersects = this.raycaster.intersectObjects(Array.from(this.humanMeshes.values()));

        if (intersects.length > 0) {
            const clickedId = intersects[0].object.userData['id'];
            const hum = this.humans.find(h => h.id === clickedId);
            if (hum) {
                this.selectedHuman = hum;
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
            if (mesh.geometry) mesh.geometry.dispose();
            // Notice: We don't dispose material globally if shared, but here we can
        });
    }

    public formatStat(value: number): string {
        return Math.max(0, Math.min(100, Math.round(value))).toString();
    }
}
