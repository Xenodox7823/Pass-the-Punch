import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  ARENA_SURFACE_Y,
  PLATFORM_RADIUS,
  GhostAbilityType,
  GhostZoneEffect,
  LooseToken,
  ModifierPickup,
  PlayerState,
} from '../game/types';
import { GameEngine } from '../game/GameEngine';

export type CameraViewMode = 'THIRD_PERSON' | 'CINEMATIC' | 'ISOMETRIC';

export class GameRenderer3D {
  private container: HTMLElement;
  private engine: GameEngine;

  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private isSoftwareGl: boolean;

  public cameraMode: CameraViewMode = 'THIRD_PERSON';
  public cameraYaw: number = 0;
  public cameraPitch: number = 0.38;
  public cameraZoom: number = 14;
  public targetPlayerId: number = 1;

  // 3D Meshes Cache
  private playerGroups: Map<number, THREE.Group> = new Map();
  private tokenMeshes: Map<number, THREE.Mesh> = new Map();
  private pickupGroups: Map<number, THREE.Group> = new Map();
  private ghostZoneGroups: Map<number, THREE.Group> = new Map();
  private playerGooglyEyes: Map<
    number,
    {
      leftX: number;
      leftY: number;
      leftVx: number;
      leftVy: number;
      rightX: number;
      rightY: number;
      rightVx: number;
      rightVy: number;
    }
  > = new Map();

  // Nametag textures cache
  private nametagSprites: Map<number, { sprite: THREE.Sprite; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture }> = new Map();

  // Shared Assets
  private tokenGeometry: THREE.CylinderGeometry;
  private goldMaterial: THREE.MeshStandardMaterial;

  // Arena Objects
  private stageMesh!: THREE.Mesh;
  private shockwaveRing!: THREE.Mesh;
  private shockwaveScale: number = 0;
  private overtimeGroup!: THREE.Group;
  private overtimeMat!: THREE.MeshBasicMaterial;
  private crowdParticles!: THREE.Points;

  private animTime: number = 0;
  private currentCameraPos: THREE.Vector3 = new THREE.Vector3(0, 8, 20);
  private currentCameraLook: THREE.Vector3 = new THREE.Vector3(0, 1.8, 0);

  constructor(container: HTMLElement, engine: GameEngine) {
    this.container = container;
    this.engine = engine;

    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060913);
    this.scene.fog = new THREE.FogExp2(0x060913, 0.012);

    const width = container.clientWidth || 1200;
    const height = container.clientHeight || 650;
    this.camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 400);
    this.camera.position.set(0, 8, 20);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    this.tokenGeometry = new THREE.CylinderGeometry(0.65, 0.65, 0.18, 20);
    this.goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.88,
      roughness: 0.2,
      emissive: 0x854d0e,
      emissiveIntensity: 0.25,
    });

    this.buildLighting();
    this.buildExpandedArena();
    this.buildStadiumBackdrop();
    this.buildShockwave();
    this.buildOvertimeRing();

    window.addEventListener('resize', this.onResize);
  }

  private onResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private buildLighting() {
    const hemiLight = new THREE.HemisphereLight(0x60a5fa, 0x0f172a, 0.7);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.5);
    dirLight.position.set(20, 45, 25);
    if (!this.isSoftwareGl) {
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 2048;
      dirLight.shadow.mapSize.height = 2048;
      dirLight.shadow.camera.near = 2;
      dirLight.shadow.camera.far = 100;
      dirLight.shadow.camera.left = -35;
      dirLight.shadow.camera.right = 35;
      dirLight.shadow.camera.top = 35;
      dirLight.shadow.camera.bottom = -35;
      dirLight.shadow.bias = -0.0005;
    }
    this.scene.add(dirLight);

    // Neon edge lighting in stadium
    const cyanLight = new THREE.PointLight(0x06b6d4, 3, 60);
    cyanLight.position.set(-28, 8, -10);
    this.scene.add(cyanLight);

    const redLight = new THREE.PointLight(0xef4444, 3, 60);
    redLight.position.set(28, 8, -10);
    this.scene.add(redLight);

    const centerLight = new THREE.PointLight(0xf59e0b, 2.0, 40);
    centerLight.position.set(0, 12, 0);
    this.scene.add(centerLight);
  }

  private buildExpandedArena() {
    // EXPANDED 3D PLATFORM: Radius 28, Height 8
    const radius = PLATFORM_RADIUS;
    const height = 8;

    // Cylinder platform with 32 segments
    const stageGeo = new THREE.CylinderGeometry(radius, radius * 0.96, height, 36);
    const stageMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.65,
      roughness: 0.35,
    });
    this.stageMesh = new THREE.Mesh(stageGeo, stageMat);
    this.stageMesh.position.set(0, -height / 2, 0);
    this.stageMesh.receiveShadow = !this.isSoftwareGl;
    this.scene.add(this.stageMesh);

    // Top Platform Surface with Ring Decal
    const floorGeo = new THREE.CircleGeometry(radius, 36);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.45,
      roughness: 0.4,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.01, 0);
    floor.receiveShadow = !this.isSoftwareGl;
    this.scene.add(floor);

    // Glowing Neon Edge Ring
    const edgeRingGeo = new THREE.TorusGeometry(radius, 0.25, 12, 48);
    const edgeRingMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const edgeRing = new THREE.Mesh(edgeRingGeo, edgeRingMat);
    edgeRing.rotation.x = Math.PI / 2;
    edgeRing.position.set(0, 0.05, 0);
    this.scene.add(edgeRing);

    // Center Combat Ring
    const centerRingGeo = new THREE.RingGeometry(6, 6.8, 36);
    const centerRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const centerRing = new THREE.Mesh(centerRingGeo, centerRingMat);
    centerRing.rotation.x = -Math.PI / 2;
    centerRing.position.set(0, 0.03, 0);
    this.scene.add(centerRing);

    // Outer Danger Warning Ring (near the platform edge)
    const dangerRingGeo = new THREE.RingGeometry(radius - 2.5, radius - 2.0, 48);
    const dangerRingMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const dangerRing = new THREE.Mesh(dangerRingGeo, dangerRingMat);
    dangerRing.rotation.x = -Math.PI / 2;
    dangerRing.position.set(0, 0.03, 0);
    this.scene.add(dangerRing);
  }

  private buildStadiumBackdrop() {
    // Vast 3D Stadium Crowd Stands
    const crowdCount = 900;
    const crowdGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(crowdCount * 3);
    const colors = new Float32Array(crowdCount * 3);

    const palette = [
      new THREE.Color(0xef4444),
      new THREE.Color(0x3b82f6),
      new THREE.Color(0xf59e0b),
      new THREE.Color(0x10b981),
      new THREE.Color(0xa855f7),
      new THREE.Color(0xf8fafc),
    ];

    for (let i = 0; i < crowdCount; i++) {
      const angle = (i / crowdCount) * Math.PI * 2;
      const dist = PLATFORM_RADIUS + 16 + Math.random() * 32;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = -4 + (dist - PLATFORM_RADIUS) * 0.45 + Math.random() * 4;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const c = palette[i % palette.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    crowdGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    crowdGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const crowdMat = new THREE.PointsMaterial({
      size: 0.55,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });
    this.crowdParticles = new THREE.Points(crowdGeo, crowdMat);
    this.scene.add(this.crowdParticles);

    // Floodlight Towers
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const tx = Math.cos(angle) * (PLATFORM_RADIUS + 18);
      const tz = Math.sin(angle) * (PLATFORM_RADIUS + 18);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.7, 34, 8),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 })
      );
      pole.position.set(tx, 10, tz);
      this.scene.add(pole);

      const lightHead = new THREE.Mesh(
        new THREE.BoxGeometry(4, 2, 2),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      lightHead.position.set(tx, 27, tz);
      lightHead.lookAt(0, 2, 0);
      this.scene.add(lightHead);
    }
  }

  private buildShockwave() {
    const ringGeo = new THREE.RingGeometry(0.5, 1.4, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.shockwaveRing = new THREE.Mesh(ringGeo, ringMat);
    this.shockwaveRing.rotation.x = -Math.PI / 2;
    this.shockwaveRing.position.set(0, 0.08, 0);
    this.scene.add(this.shockwaveRing);
  }

  public triggerShockwave(x: number, z: number, color: number = 0xf59e0b) {
    this.shockwaveRing.position.set(x, 0.08, z);
    (this.shockwaveRing.material as THREE.MeshBasicMaterial).color.setHex(color);
    (this.shockwaveRing.material as THREE.MeshBasicMaterial).opacity = 0.9;
    this.shockwaveScale = 1;
  }

  private buildOvertimeRing() {
    this.overtimeGroup = new THREE.Group();

    this.overtimeMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      wireframe: true,
    });

    // Vertical electric danger wall
    const wallGeo = new THREE.CylinderGeometry(1, 1, 10, 48, 1, true);
    const wallMesh = new THREE.Mesh(wallGeo, this.overtimeMat);
    wallMesh.position.y = 5;
    this.overtimeGroup.add(wallMesh);

    // Glowing electric floor perimeter ring
    const floorRingGeo = new THREE.RingGeometry(0.97, 1.03, 64);
    const floorMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const floorRingMesh = new THREE.Mesh(floorRingGeo, floorMat);
    floorRingMesh.rotation.x = -Math.PI / 2;
    floorRingMesh.position.y = 0.06;
    floorRingMesh.name = 'overtimeFloorRing';
    this.overtimeGroup.add(floorRingMesh);

    this.overtimeGroup.visible = false;
    this.scene.add(this.overtimeGroup);
  }

  public onPointerDrag(deltaX: number, deltaY: number) {
    this.cameraYaw -= deltaX * 0.005;
    this.cameraPitch = Math.max(0.12, Math.min(1.2, this.cameraPitch + deltaY * 0.005));
  }

  // --------------------------------------------------------------------------
  // PROCEDURAL 3D BILLBOARD NAMETAG (Above every player)
  // --------------------------------------------------------------------------
  private getOrCreateNametagSprite(player: PlayerState): THREE.Sprite {
    let entry = this.nametagSprites.get(player.id);
    if (!entry) {
      const canvas = document.createElement('canvas');
      canvas.width = 384;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;

      const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
      });

      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(4.2, 1.4, 1);
      sprite.center.set(0.5, 0);

      entry = { sprite, canvas, ctx, texture };
      this.nametagSprites.set(player.id, entry);
      this.scene.add(sprite);
    }

    // Render Canvas Content
    const { canvas, ctx, texture, sprite } = entry;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background Badge
    const isOverload = player.tokens >= 5;
    ctx.fillStyle = player.isHuman ? 'rgba(15, 23, 42, 0.88)' : 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(12, 10, canvas.width - 24, canvas.height - 20, 18);
    ctx.fill();

    // Border
    ctx.strokeStyle = isOverload
      ? '#ef4444'
      : player.isHuman
      ? '#38bdf8'
      : player.color;
    ctx.lineWidth = player.isHuman ? 5 : 4;
    ctx.stroke();

    // Player Name
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 28px "Fredoka", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(player.name, canvas.width / 2, 48);

    // Lives & Tokens Row: e.g. "❤️❤️❤️ · 🪙 2"
    let statusText = '';
    for (let i = 0; i < player.lives; i++) statusText += '❤️';
    statusText += `  🪙 ${player.tokens}`;
    if (isOverload) statusText += ' [OVERLOAD!]';

    ctx.fillStyle = isOverload ? '#f87171' : '#fde047';
    ctx.font = '800 22px "Fredoka", sans-serif';
    ctx.fillText(statusText, canvas.width / 2, 85);

    texture.needsUpdate = true;
    return sprite;
  }

  // --------------------------------------------------------------------------
  // PROCEDURAL 3D CHARACTER GROUP (3-12 parts)
  // --------------------------------------------------------------------------
  private createPlayer3DGroup(player: PlayerState): THREE.Group {
    const group = new THREE.Group();

    // 1. Torso/Body (CapsuleGeometry)
    const bodyGeo = new THREE.CapsuleGeometry(0.9, 1.3, 16, 24);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(player.color),
      metalness: 0.35,
      roughness: 0.45,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.castShadow = !this.isSoftwareGl;
    bodyMesh.receiveShadow = !this.isSoftwareGl;
    bodyMesh.position.y = 1.55;
    bodyMesh.name = 'bodyMesh';
    group.add(bodyMesh);

    // 2. Chest Accent Stripe
    const beltGeo = new THREE.TorusGeometry(0.92, 0.08, 8, 24);
    const beltMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(player.accentColor),
      metalness: 0.5,
      roughness: 0.2,
    });
    const beltMesh = new THREE.Mesh(beltGeo, beltMat);
    beltMesh.rotation.x = Math.PI / 2;
    beltMesh.position.y = 1.3;
    group.add(beltMesh);

    // 3. Googly Eyes (Repo Game style floppy physics)
    const eyeCupGeo = new THREE.SphereGeometry(0.24, 16, 16);
    const eyeCupMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.15,
      metalness: 0.05,
    });
    const eyeRimGeo = new THREE.TorusGeometry(0.24, 0.028, 8, 20);
    const eyeRimMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    const pupilGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16);
    const pupilMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.2,
      metalness: 0.4,
    });

    // Left Eye Cup & Pupil
    const leftEye = new THREE.Mesh(eyeCupGeo, eyeCupMat);
    leftEye.position.set(0.32, 1.9, 0.78);
    const leftRim = new THREE.Mesh(eyeRimGeo, eyeRimMat);
    leftRim.position.set(0.32, 1.9, 0.94);
    const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    leftPupil.rotation.x = Math.PI / 2;
    leftPupil.position.set(0.32, 1.86, 0.96);
    leftPupil.name = 'leftPupil';
    group.add(leftEye);
    group.add(leftRim);
    group.add(leftPupil);

    // Right Eye Cup & Pupil
    const rightEye = new THREE.Mesh(eyeCupGeo, eyeCupMat);
    rightEye.position.set(-0.32, 1.9, 0.78);
    const rightRim = new THREE.Mesh(eyeRimGeo, eyeRimMat);
    rightRim.position.set(-0.32, 1.9, 0.94);
    const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    rightPupil.rotation.x = Math.PI / 2;
    rightPupil.position.set(-0.32, 1.86, 0.96);
    rightPupil.name = 'rightPupil';
    group.add(rightEye);
    group.add(rightRim);
    group.add(rightPupil);

    // 4. Chunky Boxing Gloves
    const gloveGeo = new THREE.SphereGeometry(0.6, 20, 20);
    const gloveMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(player.gloveColor),
      metalness: 0.5,
      roughness: 0.3,
    });
    const cuffGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.35, 16);
    const cuffMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.6 });

    // Right (Punching) Glove
    const rightGloveGroup = new THREE.Group();
    rightGloveGroup.name = 'rightGlove';
    const rGlove = new THREE.Mesh(gloveGeo, gloveMat);
    rGlove.castShadow = !this.isSoftwareGl;
    const rCuff = new THREE.Mesh(cuffGeo, cuffMat);
    rCuff.position.z = -0.45;
    rCuff.rotation.x = Math.PI / 2;
    rightGloveGroup.add(rGlove);
    rightGloveGroup.add(rCuff);
    rightGloveGroup.position.set(1.1, 1.3, 0.5);
    group.add(rightGloveGroup);

    // Left (Guard) Glove
    const leftGloveGroup = new THREE.Group();
    leftGloveGroup.name = 'leftGlove';
    const lGlove = new THREE.Mesh(gloveGeo, gloveMat);
    lGlove.castShadow = !this.isSoftwareGl;
    const lCuff = new THREE.Mesh(cuffGeo, cuffMat);
    lCuff.position.z = -0.45;
    lCuff.rotation.x = Math.PI / 2;
    leftGloveGroup.add(lGlove);
    leftGloveGroup.add(lCuff);
    leftGloveGroup.position.set(-1.0, 1.2, 0.6);
    group.add(leftGloveGroup);

    // 5. Giga Bonk Giant Floating Glove
    const gigaGloveGroup = new THREE.Group();
    gigaGloveGroup.name = 'gigaGlove';
    const bigGloveMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        metalness: 0.7,
        roughness: 0.2,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.35,
      })
    );
    gigaGloveGroup.add(bigGloveMesh);
    gigaGloveGroup.position.set(0, 4.4, 0);
    gigaGloveGroup.visible = false;
    group.add(gigaGloveGroup);

    // 6. Contact Ground Shadow Disc
    const shadowGeo = new THREE.CircleGeometry(1.1, 24);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x030712,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.02;
    shadowMesh.name = 'shadowMesh';
    group.add(shadowMesh);

    // 7. Ghost Halo
    const haloGeo = new THREE.TorusGeometry(0.65, 0.07, 8, 24);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.rotation.x = Math.PI / 2;
    haloMesh.position.y = 2.9;
    haloMesh.name = 'ghostHalo';
    haloMesh.visible = false;
    group.add(haloMesh);

    return group;
  }

  // --------------------------------------------------------------------------
  // MAIN RENDER LOOP
  // --------------------------------------------------------------------------
  public render(dt: number) {
    this.animTime += dt;

    // 1. Update 3rd Person & Dynamic Cameras
    this.updateCamera(dt);

    // 2. Animate Crowd & Shockwaves
    this.updateArenaEffects(dt);

    // 3. Sync Players & Nametags in 3D
    this.syncPlayers(dt);

    // 4. Sync Loose Tokens in 3D
    this.syncLooseTokens(dt);

    // 5. Sync Modifier Pickups in 3D
    this.syncPickups(dt);

    // 6. Sync Ghost Sabotage in 3D
    this.syncGhostZones(dt);

    this.renderer.render(this.scene, this.camera);
  }

  private updateCamera(dt: number) {
    const target =
      this.engine.players.find((p) => p.id === this.targetPlayerId) ||
      this.engine.players.find((p) => p.isHuman) ||
      this.engine.players[0];

    if (this.cameraMode === 'THIRD_PERSON' && target && target.y > -16) {
      // 3RD PERSON CAMERA: Smoothly follows target player or free-roam ghost with pan yaw & pitch
      const yaw = this.cameraYaw;
      const pitch = this.cameraPitch;
      const dist = this.cameraZoom;

      const horizDist = Math.cos(pitch) * dist;
      const targetCamX = target.x - Math.sin(yaw) * horizDist;
      const targetCamZ = target.z - Math.cos(yaw) * horizDist;
      const targetCamY = Math.max(1.2, target.y + Math.sin(pitch) * dist + 1.2);

      this.currentCameraPos.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), dt * 8.5);

      const lookY = target.y + 1.8;
      this.currentCameraLook.lerp(new THREE.Vector3(target.x, lookY, target.z), dt * 9.5);

      this.camera.position.copy(this.currentCameraPos);
      this.camera.lookAt(this.currentCameraLook);
    } else if (this.cameraMode === 'ISOMETRIC') {
      // High-angle arena overview
      this.currentCameraPos.lerp(new THREE.Vector3(26, 32, 34), dt * 4.0);
      this.currentCameraLook.lerp(new THREE.Vector3(0, 0, 0), dt * 4.0);
      this.camera.position.copy(this.currentCameraPos);
      this.camera.lookAt(this.currentCameraLook);
    } else {
      // CINEMATIC ARENA CAM: Frames living players
      const living = this.engine.players.filter((p) => !p.isEliminated && !p.isGhost && p.y > -10);
      let avgX = 0;
      let avgZ = 0;
      let maxDist = 8;

      if (living.length > 0) {
        for (const p of living) {
          avgX += p.x;
          avgZ += p.z;
          maxDist = Math.max(maxDist, Math.hypot(p.x, p.z));
        }
        avgX /= living.length;
        avgZ /= living.length;
      }

      const camZ = avgZ + Math.max(26, maxDist * 1.5);
      const camY = Math.max(12, maxDist * 0.7);
      this.currentCameraPos.lerp(new THREE.Vector3(avgX * 0.5, camY, camZ), dt * 4.5);
      this.currentCameraLook.lerp(new THREE.Vector3(avgX * 0.7, 1.5, avgZ * 0.7), dt * 5.5);

      this.camera.position.copy(this.currentCameraPos);
      this.camera.lookAt(this.currentCameraLook);
    }

    // 3D Trauma Screen Shake
    if (this.engine.screenShake > 0) {
      const shakeAmt = this.engine.screenShake * 0.06;
      this.camera.position.x += (Math.random() - 0.5) * shakeAmt;
      this.camera.position.y += (Math.random() - 0.5) * shakeAmt;
      this.camera.position.z += (Math.random() - 0.5) * shakeAmt;
    }
  }

  private updateArenaEffects(dt: number) {
    if (this.shockwaveScale > 0) {
      this.shockwaveScale += dt * 36;
      this.shockwaveRing.scale.set(this.shockwaveScale, this.shockwaveScale, 1);
      const mat = this.shockwaveRing.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1 - this.shockwaveScale / 28);
      if (mat.opacity <= 0) {
        this.shockwaveScale = 0;
      }
    }

    // Visual Zone is rendered during Deathmatch (OVERTIME) only
    const isDeathmatch = this.engine.matchFlow.phase === 'OVERTIME';
    if (this.overtimeGroup) {
      if (isDeathmatch) {
        this.overtimeGroup.visible = true;
        const safeRadius = this.engine.matchFlow.safeRadius;
        this.overtimeGroup.scale.set(safeRadius, 1, safeRadius);
        const pulse = 0.55 + Math.sin(this.animTime * 12) * 0.35;
        this.overtimeMat.opacity = pulse;
        const hex = Math.sin(this.animTime * 8) > 0 ? 0xef4444 : 0x06b6d4;
        this.overtimeMat.color.setHex(hex);
        const floorRing = this.overtimeGroup.getObjectByName('overtimeFloorRing') as THREE.Mesh;
        if (floorRing) {
          (floorRing.material as THREE.MeshBasicMaterial).color.setHex(hex);
          (floorRing.material as THREE.MeshBasicMaterial).opacity = Math.min(1.0, pulse + 0.25);
        }
      } else {
        this.overtimeGroup.visible = false;
      }
    }
  }

  private syncPlayers(dt: number) {
    for (const player of this.engine.players) {
      let group = this.playerGroups.get(player.id);
      if (!group) {
        group = this.createPlayer3DGroup(player);
        this.scene.add(group);
        this.playerGroups.set(player.id, group);
      }

      const nametagSprite = this.getOrCreateNametagSprite(player);

      if (player.respawnTimer > 0) {
        group.visible = false;
        nametagSprite.visible = false;
        continue;
      }

      group.visible = true;
      nametagSprite.visible = true;

      // Position in full 3D world space!
      group.position.set(player.x, player.y, player.z);
      group.rotation.y = player.rotationY;
      group.scale.set(player.squashX, player.squashY, player.squashX);

      // Position Nametag directly above head
      nametagSprite.position.set(player.x, player.y + 3.2, player.z);

      const bodyMesh = group.getObjectByName('bodyMesh') as THREE.Mesh;
      const ghostHalo = group.getObjectByName('ghostHalo') as THREE.Mesh;
      const shadowMesh = group.getObjectByName('shadowMesh') as THREE.Mesh;

      if (player.isGhost) {
        group.position.y = 8 + Math.sin(this.animTime * 3 + player.id) * 0.8;
        nametagSprite.position.y = group.position.y + 3.2;
        if (bodyMesh) {
          (bodyMesh.material as THREE.MeshStandardMaterial).transparent = true;
          (bodyMesh.material as THREE.MeshStandardMaterial).opacity = 0.55;
        }
        if (ghostHalo) ghostHalo.visible = true;
        if (shadowMesh) shadowMesh.visible = false;
      } else {
        if (bodyMesh) {
          (bodyMesh.material as THREE.MeshStandardMaterial).transparent = player.isInvulnerable;
          (bodyMesh.material as THREE.MeshStandardMaterial).opacity = player.isInvulnerable ? 0.6 : 1.0;
        }
        if (ghostHalo) ghostHalo.visible = false;
        if (shadowMesh) {
          // If player is falling off platform, hide ground shadow
          const isOver = Math.hypot(player.x, player.z) <= PLATFORM_RADIUS;
          shadowMesh.visible = isOver && player.y >= -1;
          if (shadowMesh.visible) {
            const h = Math.max(0, player.y);
            const s = Math.max(0.3, 1.1 - h * 0.08);
            shadowMesh.scale.set(s, s, 1);
          }
        }
      }

      // Update Repo Game floppy Googly Eyes physics
      let eyeState = this.playerGooglyEyes.get(player.id);
      if (!eyeState) {
        eyeState = {
          leftX: 0,
          leftY: -0.04,
          leftVx: 0,
          leftVy: 0,
          rightX: 0,
          rightY: -0.04,
          rightVx: 0,
          rightVy: 0,
        };
        this.playerGooglyEyes.set(player.id, eyeState);
      }

      const spd = Math.hypot(player.vx, player.vz);
      const isHit = player.hitReactionTimer > 0;
      const jiggle = isHit ? (Math.random() - 0.5) * 0.35 : 0;

      // Inertia & spring target
      const targetOffX = Math.max(-0.08, Math.min(0.08, -player.vx * 0.004 + (Math.random() - 0.5) * (spd > 3 ? 0.03 : 0.008)));
      const targetOffY = Math.max(-0.08, Math.min(0.08, -0.04 - player.vy * 0.005 + jiggle));

      const springK = 44.0;
      const damping = 0.75;

      eyeState.leftVx = (eyeState.leftVx + (targetOffX - eyeState.leftX) * springK * dt) * damping;
      eyeState.leftVy = (eyeState.leftVy + (targetOffY - eyeState.leftY) * springK * dt) * damping;
      eyeState.leftX = Math.max(-0.09, Math.min(0.09, eyeState.leftX + eyeState.leftVx * dt));
      eyeState.leftY = Math.max(-0.09, Math.min(0.08, eyeState.leftY + eyeState.leftVy * dt));

      eyeState.rightVx = (eyeState.rightVx + (targetOffX - eyeState.rightX) * springK * dt) * damping;
      eyeState.rightVy = (eyeState.rightVy + (targetOffY - eyeState.rightY) * springK * dt) * damping;
      eyeState.rightX = Math.max(-0.09, Math.min(0.09, eyeState.rightX + eyeState.rightVx * dt));
      eyeState.rightY = Math.max(-0.09, Math.min(0.08, eyeState.rightY + eyeState.rightVy * dt));

      const leftPupil = group.getObjectByName('leftPupil') as THREE.Mesh;
      const rightPupil = group.getObjectByName('rightPupil') as THREE.Mesh;
      if (leftPupil) {
        leftPupil.position.set(0.32 + eyeState.leftX, 1.9 + eyeState.leftY, 0.96);
      }
      if (rightPupil) {
        rightPupil.position.set(-0.32 + eyeState.rightX, 1.9 + eyeState.rightY, 0.96);
      }

      // Punch Animation
      const rightGlove = group.getObjectByName('rightGlove') as THREE.Group;
      if (rightGlove) {
        if (player.punchTimer > 0) {
          const reach = player.punchModifier === 'STRETCHY_ARM' ? 3.2 : 1.6;
          rightGlove.position.z = 0.5 + reach;
          rightGlove.scale.set(player.isOverloadPunch ? 1.6 : 1.2, player.isOverloadPunch ? 1.6 : 1.2, player.isOverloadPunch ? 1.6 : 1.2);
        } else {
          rightGlove.position.z = 0.5;
          rightGlove.scale.set(1, 1, 1);
        }
      }

      // GIGA BONK charging
      const gigaGlove = group.getObjectByName('gigaGlove') as THREE.Group;
      if (gigaGlove) {
        gigaGlove.visible = player.hasGigaBonk || player.isChargingGigaBonk;
        if (gigaGlove.visible) {
          gigaGlove.rotation.y += dt * 5;
          const p = 1 + Math.sin(this.animTime * 12) * 0.18;
          gigaGlove.scale.set(p, p, p);
        }
      }
    }
  }

  private syncLooseTokens(dt: number) {
    const currentTokens = this.engine.tokenSystem.looseTokens;
    const activeIds = new Set<number>();

    for (const token of currentTokens) {
      activeIds.add(token.id);
      let mesh = this.tokenMeshes.get(token.id);

      if (!mesh) {
        mesh = new THREE.Mesh(this.tokenGeometry, this.goldMaterial);
        mesh.castShadow = !this.isSoftwareGl;
        mesh.receiveShadow = !this.isSoftwareGl;
        this.scene.add(mesh);
        this.tokenMeshes.set(token.id, mesh);
      }

      mesh.position.set(token.x, token.y, token.z);
      mesh.rotation.x = token.rotationX;
      mesh.rotation.y = token.rotationY;
      mesh.rotation.z = token.rotationZ;
    }

    for (const [id, mesh] of this.tokenMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.tokenMeshes.delete(id);
      }
    }
  }

  private createModifier3DGroup(pickup: ModifierPickup): THREE.Group {
    const group = new THREE.Group();

    if (pickup.category === 'GIGA_BONK') {
      const bigGlove = new THREE.Mesh(
        new THREE.SphereGeometry(1.6, 20, 20),
        new THREE.MeshStandardMaterial({
          color: 0xdc2626,
          metalness: 0.8,
          roughness: 0.2,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.45,
        })
      );
      group.add(bigGlove);

      // Knuckle Spikes
      for (let i = 0; i < 4; i++) {
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.25, 0.6, 10),
          new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.1 })
        );
        spike.rotation.x = Math.PI / 2;
        spike.position.set((i - 1.5) * 0.55, 0.2, 1.4);
        group.add(spike);
      }

      const haloRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.2, 0.1, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
      );
      haloRing.rotation.x = Math.PI / 2;
      group.add(haloRing);
    } else if (pickup.category === 'SCRAP_PACK') {
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 1.4, 1.4),
        new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.4, metalness: 0.4 })
      );
      group.add(crate);

      // Caution stripe crossbars
      const crossbar = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 0.25, 1.45),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
      );
      group.add(crossbar);
    } else if (pickup.category === 'PUNCH') {
      const type = pickup.punchType;
      if (type === 'ROCKET_KNUCKLES') {
        // Glove + Rocket Thruster + Fiery Plume
        const glove = new THREE.Mesh(
          new THREE.SphereGeometry(0.65, 16, 16),
          new THREE.MeshStandardMaterial({ color: 0xe11d48, metalness: 0.6, roughness: 0.3 })
        );
        glove.position.z = 0.3;
        group.add(glove);

        const thruster = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.42, 0.65, 16),
          new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 })
        );
        thruster.rotation.x = Math.PI / 2;
        thruster.position.z = -0.3;
        group.add(thruster);

        const flame = new THREE.Mesh(
          new THREE.ConeGeometry(0.34, 0.8, 12),
          new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
        );
        flame.rotation.x = -Math.PI / 2;
        flame.position.z = -0.9;
        flame.name = 'rocketFlame';
        group.add(flame);
      } else if (type === 'TRIPLE_BONK') {
        // 3 mini gloves orbiting in a triangle
        for (let i = 0; i < 3; i++) {
          const ang = (i / 3) * Math.PI * 2;
          const miniGlove = new THREE.Mesh(
            new THREE.SphereGeometry(0.42, 14, 14),
            new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.5, roughness: 0.3 })
          );
          miniGlove.position.set(Math.cos(ang) * 0.65, 0, Math.sin(ang) * 0.65);
          group.add(miniGlove);
        }
        const hub = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.3, 0.15, 16),
          new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8 })
        );
        group.add(hub);
      } else if (type === 'STRETCHY_ARM') {
        // Glove + Accordion Spring Coil
        const glove = new THREE.Mesh(
          new THREE.SphereGeometry(0.6, 16, 16),
          new THREE.MeshStandardMaterial({ color: 0xd946ef, metalness: 0.5, roughness: 0.3 })
        );
        glove.position.z = 0.65;
        group.add(glove);

        // 4 metallic spring rings
        for (let i = 0; i < 4; i++) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.3, 0.05, 8, 16),
            new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.1 })
          );
          ring.position.z = -0.5 + i * 0.3;
          group.add(ring);
        }
      } else if (type === 'THUNDER_BONK') {
        // Electric Cyan Glove + Lightning Spikes
        const glove = new THREE.Mesh(
          new THREE.SphereGeometry(0.65, 16, 16),
          new THREE.MeshStandardMaterial({
            color: 0x06b6d4,
            metalness: 0.7,
            roughness: 0.2,
            emissive: 0x0891b2,
            emissiveIntensity: 0.4,
          })
        );
        group.add(glove);

        for (let i = 0; i < 3; i++) {
          const ang = (i / 3) * Math.PI * 2;
          const bolt = new THREE.Mesh(
            new THREE.ConeGeometry(0.18, 0.7, 8),
            new THREE.MeshBasicMaterial({ color: 0xfef08a })
          );
          bolt.position.set(Math.cos(ang) * 0.75, Math.sin(ang) * 0.75, 0);
          bolt.rotation.z = ang - Math.PI / 2;
          group.add(bolt);
        }
      } else {
        // Boomerang / Default Punch
        const glove = new THREE.Mesh(
          new THREE.SphereGeometry(0.65, 16, 16),
          new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.6, roughness: 0.3 })
        );
        group.add(glove);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.9, 0.08, 8, 20),
          new THREE.MeshBasicMaterial({ color: 0xfde047 })
        );
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
      }
    } else {
      // TOKEN category
      const type = pickup.tokenType;
      if (type === 'TOKEN_MAGNET') {
        // Horseshoe Magnet + Floating Token
        const magnetArch = new THREE.Mesh(
          new THREE.TorusGeometry(0.65, 0.16, 10, 20, Math.PI),
          new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, metalness: 0.5 })
        );
        magnetArch.rotation.z = Math.PI;
        group.add(magnetArch);

        // Silver magnetic pole tips
        const leftPole = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 0.32, 0.32),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 })
        );
        leftPole.position.set(-0.65, -0.15, 0);
        group.add(leftPole);

        const rightPole = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 0.32, 0.32),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 })
        );
        rightPole.position.set(0.65, -0.15, 0);
        group.add(rightPole);

        // Hovering token between poles
        const coin = new THREE.Mesh(this.tokenGeometry, this.goldMaterial);
        coin.scale.set(0.7, 0.7, 0.7);
        coin.position.y = -0.2;
        group.add(coin);
      } else if (type === 'POCKET_JACKPOT') {
        // 3-coin gold token stack + Star crest
        for (let i = 0; i < 3; i++) {
          const coin = new THREE.Mesh(this.tokenGeometry, this.goldMaterial);
          coin.position.y = (i - 1) * 0.28;
          coin.rotation.y = i * 0.4;
          group.add(coin);
        }
        const star = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.4, 0),
          new THREE.MeshStandardMaterial({
            color: 0xfacc15,
            metalness: 0.9,
            roughness: 0.1,
            emissive: 0xca8a04,
            emissiveIntensity: 0.5,
          })
        );
        star.position.y = 0.7;
        group.add(star);
      } else if (type === 'TOKEN_BOMB') {
        // Black Bomb + Fuse + Spark
        const bombBody = new THREE.Mesh(
          new THREE.SphereGeometry(0.65, 18, 18),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.8 })
        );
        group.add(bombBody);

        const collar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.25, 0.25, 12),
          new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 })
        );
        collar.position.y = 0.65;
        group.add(collar);

        const fuseSpark = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 10, 10),
          new THREE.MeshBasicMaterial({ color: 0xf97316 })
        );
        fuseSpark.position.set(0.12, 0.9, 0);
        fuseSpark.name = 'bombSpark';
        group.add(fuseSpark);
      } else if (type === 'DOUBLE_VALUE') {
        // Emerald/Gold Ring with Twin Tokens
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.85, 0.08, 10, 24),
          new THREE.MeshStandardMaterial({
            color: 0x10b981,
            metalness: 0.8,
            emissive: 0x059669,
            emissiveIntensity: 0.4,
          })
        );
        group.add(ring);

        const coin1 = new THREE.Mesh(this.tokenGeometry, this.goldMaterial);
        coin1.scale.set(0.6, 0.6, 0.6);
        coin1.position.x = -0.35;
        group.add(coin1);

        const coin2 = new THREE.Mesh(this.tokenGeometry, this.goldMaterial);
        coin2.scale.set(0.6, 0.6, 0.6);
        coin2.position.x = 0.35;
        group.add(coin2);
      } else if (type === 'STICKY_FINGERS') {
        // Slime Hand
        const hand = new THREE.Mesh(
          new THREE.SphereGeometry(0.55, 16, 16),
          new THREE.MeshStandardMaterial({
            color: 0x84cc16,
            roughness: 0.2,
            metalness: 0.4,
            transparent: true,
            opacity: 0.88,
          })
        );
        group.add(hand);

        // Slime droplets
        for (let i = 0; i < 3; i++) {
          const drop = new THREE.Mesh(
            new THREE.SphereGeometry(0.16, 10, 10),
            new THREE.MeshStandardMaterial({ color: 0xa3e635, roughness: 0.1 })
          );
          drop.position.set((i - 1) * 0.35, -0.55, 0);
          group.add(drop);
        }
      } else {
        // Default Token
        const coin = new THREE.Mesh(this.tokenGeometry, this.goldMaterial);
        group.add(coin);
      }
    }

    return group;
  }

  private syncPickups(dt: number) {
    const currentPickups = this.engine.modifierSystem.pickups;
    const activeIds = new Set<number>();

    for (const pickup of currentPickups) {
      activeIds.add(pickup.id);
      let group = this.pickupGroups.get(pickup.id);

      if (!group) {
        group = this.createModifier3DGroup(pickup);
        this.scene.add(group);
        this.pickupGroups.set(pickup.id, group);
      }

      const bob = Math.sin(pickup.bobTimer) * 0.25;
      group.position.set(pickup.x, pickup.y + bob, pickup.z);
      group.rotation.y += dt * 2.5;

      const rocketFlame = group.getObjectByName('rocketFlame') as THREE.Mesh;
      if (rocketFlame) {
        const s = 0.8 + Math.sin(this.animTime * 20) * 0.3;
        rocketFlame.scale.set(s, s, s);
      }
      const bombSpark = group.getObjectByName('bombSpark') as THREE.Mesh;
      if (bombSpark) {
        const s = 0.9 + Math.sin(this.animTime * 24) * 0.4;
        bombSpark.scale.set(s, s, s);
      }
    }

    for (const [id, group] of this.pickupGroups.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.pickupGroups.delete(id);
      }
    }
  }

  private syncGhostZones(dt: number) {
    const currentZones = this.engine.ghostSystem.activeZones;
    const activeIds = new Set<number>();

    for (const zone of currentZones) {
      activeIds.add(zone.id);
      let group = this.ghostZoneGroups.get(zone.id);

      if (!group) {
        group = new THREE.Group();
        const r = zone.radius;

        if (zone.type === 'JELLY_PATCH') {
          // 1. Juicy translucent wobbling slime pool
          const puddleGeo = new THREE.CircleGeometry(r, 32);
          const puddleMat = new THREE.MeshStandardMaterial({
            color: 0xec4899,
            metalness: 0.1,
            roughness: 0.1,
            transparent: true,
            opacity: 0.72,
            side: THREE.DoubleSide,
          });
          const puddle = new THREE.Mesh(puddleGeo, puddleMat);
          puddle.rotation.x = -Math.PI / 2;
          puddle.position.y = 0.04;
          group.add(puddle);

          // 2. Translucent pink jelly bubbles orbiting around perimeter
          for (let i = 0; i < 6; i++) {
            const bubbleGeo = new THREE.SphereGeometry(0.45, 14, 14);
            const bubbleMat = new THREE.MeshStandardMaterial({
              color: 0xf472b6,
              metalness: 0.2,
              roughness: 0.1,
              transparent: true,
              opacity: 0.8,
            });
            const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
            const ang = (i / 6) * Math.PI * 2;
            bubble.position.set(Math.cos(ang) * (r * 0.75), 0.4, Math.sin(ang) * (r * 0.75));
            bubble.name = `jellyBubble_${i}`;
            group.add(bubble);
          }
        } else if (zone.type === 'GUST_FAN') {
          // 1. Heavy metallic floor turbine housing ring
          const ringGeo = new THREE.TorusGeometry(r * 0.9, 0.22, 10, 32);
          const ringMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            metalness: 0.85,
            roughness: 0.3,
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = 0.1;
          group.add(ring);

          // 2. High-speed spinning 4-blade rotor
          const rotorGroup = new THREE.Group();
          rotorGroup.name = 'gustRotor';
          for (let i = 0; i < 4; i++) {
            const blade = new THREE.Mesh(
              new THREE.BoxGeometry(r * 0.82, 0.08, 0.45),
              new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.7, roughness: 0.2 })
            );
            blade.rotation.y = (i / 4) * Math.PI * 2;
            rotorGroup.add(blade);
          }
          rotorGroup.position.y = 0.12;
          group.add(rotorGroup);

          // 3. Cyan wind stream arrow lines pointing along wind direction
          const windDirX = zone.directionX || 1;
          const windDirZ = zone.directionZ || 0;
          const windAngle = Math.atan2(windDirZ, windDirX);

          for (let i = 0; i < 4; i++) {
            const stream = new THREE.Mesh(
              new THREE.BoxGeometry(0.18, 0.08, r * 0.7),
              new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.75 })
            );
            stream.rotation.y = -windAngle + Math.PI / 2;
            const offset = (i - 1.5) * (r * 0.35);
            stream.position.set(-Math.sin(windAngle) * offset, 0.35 + i * 0.1, Math.cos(windAngle) * offset);
            stream.name = `windStream_${i}`;
            group.add(stream);
          }
        } else {
          // TOKEN_TORNADO: Swirling golden funnel vortex + orbiting tokens
          const cylGeo = new THREE.CylinderGeometry(r * 1.15, 0.6, 5.5, 24, 1, true);
          const cylMat = new THREE.MeshBasicMaterial({
            color: 0xfacc15,
            transparent: true,
            opacity: 0.32,
            side: THREE.DoubleSide,
          });
          const funnel = new THREE.Mesh(cylGeo, cylMat);
          funnel.position.y = 2.75;
          group.add(funnel);

          // Orbiting mini gold coins inside tornado
          for (let i = 0; i < 4; i++) {
            const coin = new THREE.Mesh(this.tokenGeometry, this.goldMaterial);
            coin.scale.set(0.6, 0.6, 0.6);
            coin.name = `tornadoCoin_${i}`;
            group.add(coin);
          }
        }

        this.scene.add(group);
        this.ghostZoneGroups.set(zone.id, group);
      }

      group.position.set(zone.x, 0.05, zone.z);

      if (zone.type === 'JELLY_PATCH') {
        const pulse = 1.0 + Math.sin(this.animTime * 6) * 0.06;
        group.scale.set(pulse, 1, pulse);

        for (let i = 0; i < 6; i++) {
          const bubble = group.getObjectByName(`jellyBubble_${i}`) as THREE.Mesh;
          if (bubble) {
            bubble.position.y = 0.35 + Math.sin(this.animTime * 5 + i * 1.1) * 0.28;
          }
        }
      } else if (zone.type === 'GUST_FAN') {
        const rotor = group.getObjectByName('gustRotor') as THREE.Group;
        if (rotor) {
          rotor.rotation.y += dt * 32;
        }
      } else if (zone.type === 'TOKEN_TORNADO') {
        group.rotation.y += dt * 9;
        for (let i = 0; i < 4; i++) {
          const coin = group.getObjectByName(`tornadoCoin_${i}`) as THREE.Mesh;
          if (coin) {
            const coinAng = this.animTime * 8 + (i * Math.PI) / 2;
            const coinH = 0.8 + ((i * 1.2 + this.animTime * 2) % 4.5);
            const coinR = 0.8 + (coinH / 5.5) * (zone.radius * 0.85);
            coin.position.set(Math.cos(coinAng) * coinR, coinH, Math.sin(coinAng) * coinR);
            coin.rotation.x += dt * 6;
            coin.rotation.y += dt * 8;
          }
        }
      }
    }

    for (const [id, group] of this.ghostZoneGroups.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.ghostZoneGroups.delete(id);
      }
    }
  }

  private sabotagePreviewRing?: THREE.Mesh;

  public setSabotagePreview(x: number, z: number, type: GhostAbilityType | null) {
    if (!this.sabotagePreviewRing) {
      const ringGeo = new THREE.RingGeometry(5.5, 6.5, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xc084fc,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      this.sabotagePreviewRing = new THREE.Mesh(ringGeo, ringMat);
      this.sabotagePreviewRing.rotation.x = -Math.PI / 2;
      this.sabotagePreviewRing.position.y = 0.08;
      this.scene.add(this.sabotagePreviewRing);
    }

    if (!type) {
      this.sabotagePreviewRing.visible = false;
      return;
    }

    this.sabotagePreviewRing.visible = true;
    this.sabotagePreviewRing.position.set(x, 0.08, z);
    const mat = this.sabotagePreviewRing.material as THREE.MeshBasicMaterial;
    mat.color.setHex(type === 'JELLY_PATCH' ? 0xec4899 : type === 'GUST_FAN' ? 0x38bdf8 : 0xfacc15);
  }

  public onMouseMove(movementX: number, movementY: number) {
    const yawSens = 0.0032;
    const pitchSens = 0.0028;
    this.cameraYaw -= movementX * yawSens;
    this.cameraPitch = Math.max(0.12, Math.min(1.18, this.cameraPitch + movementY * pitchSens));
  }

  public onWheelZoom(deltaY: number) {
    this.cameraZoom = Math.max(8, Math.min(26, this.cameraZoom + deltaY * 0.012));
  }

  public setCameraMode(mode: CameraViewMode) {
    this.cameraMode = mode;
  }

  public destroy() {
    window.removeEventListener('resize', this.onResize);
    for (const entry of this.nametagSprites.values()) {
      entry.texture.dispose();
      entry.sprite.material.dispose();
      this.scene.remove(entry.sprite);
    }
    this.nametagSprites.clear();
    this.tokenGeometry.dispose();
    this.goldMaterial.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
