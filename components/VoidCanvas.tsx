import React, { useRef, useEffect } from 'react';
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import * as THREE from 'three';
// Standard NPM import paths for Three.js examples
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { RockEntity, HandGestures, VoidState } from '../types';

// Constants
const ROCKS_COUNT = 12;
const BASE_RADIUS = 3.5;

// Camera Distance Config
const DESKTOP_Z_OFFSET = 12;
const MOBILE_Z_OFFSET = 18; // Further back for portrait mode

// Model URL
const MODEL_URL = 'https://cdn.jsdelivr.net/gh/nen-max/Gemini-3d-assets@main/shaw__hornet_-_hollow_knight_silksong.glb';

// Physics Constants
const GRAVITY = 0.015;
const BOUNCE_DAMPING = 0.5;
const FRICTION = 0.98;
const FLOOR_Y = -4.0;

interface VoidCanvasProps {
  onStateChange: (state: VoidState) => void;
  onGestureUpdate: (gestures: HandGestures) => void;
  isAnalyzerActive: boolean;
  verticalOffset: number; 
  baseRotationSpeed: number;
  invertRotation: boolean;
  isAnimating: boolean;
}

const VoidCanvas: React.FC<VoidCanvasProps> = ({ 
    onStateChange, 
    onGestureUpdate, 
    verticalOffset,
    baseRotationSpeed,
    invertRotation,
    isAnimating
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(document.createElement("video"));
  
  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rockMeshesRef = useRef<THREE.Object3D[]>([]);
  
  // Animation References
  const mixersRef = useRef<THREE.AnimationMixer[]>([]);
  const animationClipsRef = useRef<THREE.AnimationClip[]>([]);
  
  // Logic & Vision References
  const rocksDataRef = useRef<RockEntity[]>([]);
  const requestRef = useRef<number | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  
  // State Refs
  const verticalOffsetRef = useRef(verticalOffset);
  const baseSpeedRef = useRef(baseRotationSpeed);
  const invertRotationRef = useRef(invertRotation);
  const isAnimatingRef = useRef(isAnimating);

  useEffect(() => {
    verticalOffsetRef.current = verticalOffset * 0.02;
  }, [verticalOffset]);

  useEffect(() => {
    baseSpeedRef.current = baseRotationSpeed;
  }, [baseRotationSpeed]);

  useEffect(() => {
    invertRotationRef.current = invertRotation;
  }, [invertRotation]);

  useEffect(() => {
    isAnimatingRef.current = isAnimating;
    if (animationClipsRef.current.length > 0) {
        const clip = animationClipsRef.current[0];
        mixersRef.current.forEach(mixer => {
            const action = mixer.clipAction(clip);
            if (isAnimating) action.play();
            else action.stop();
        });
    }
  }, [isAnimating]);
  
  const physicsState = useRef({
    orbitAngle: 0,
    orbitSpeed: 0,
    currentRadius: BASE_RADIUS,
    targetRadius: BASE_RADIUS,
    handDetected: false,
    isFist: false,
    globalTime: 0
  });

  // --- 1. Initialize Three.js Environment ---
  useEffect(() => {
    if (!containerRef.current) return;

    // Detect Mobile (Portrait)
    const isPortrait = window.innerHeight > window.innerWidth;
    const initialZ = isPortrait ? MOBILE_Z_OFFSET : DESKTOP_Z_OFFSET;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    scene.fog = new THREE.FogExp2(0xffffff, 0.03); 

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, initialZ);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // optimize for mobile
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.8);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024; // Lower Res for mobile perf
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.0001;
    scene.add(dirLight);

    const planeGeometry = new THREE.PlaneGeometry(100, 100);
    const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.1 });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = FLOOR_Y;
    plane.receiveShadow = true;
    scene.add(plane);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        const isNowPortrait = window.innerHeight > window.innerWidth;
        // Dynamically adjust camera Z based on orientation
        const targetZ = isNowPortrait ? MOBILE_Z_OFFSET : DESKTOP_Z_OFFSET;
        
        // Smooth transition could be added here, but direct set is safer for resize
        cameraRef.current.position.z = targetZ;

        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, []);

  // --- 2. Initialize Rocks ---
  useEffect(() => {
    if (!sceneRef.current) return;

    const rocks: RockEntity[] = [];
    for (let i = 0; i < ROCKS_COUNT; i++) {
        rocks.push({
            id: i,
            seed: Math.random(),
            angleOffset: (i / ROCKS_COUNT) * Math.PI * 2,
            x: 0, y: 0, z: 0,
            vx: 0, vy: 0, vz: 0,
            rotX: 0,
            rotY: Math.random() * Math.PI * 2,
            rotZ: 0,
            rotVelX: 0, rotVelY: 0, rotVelZ: 0,
            isSleeping: true
        });
    }
    rocksDataRef.current = rocks;
    
    const loader = new GLTFLoader();
    loader.load(
        MODEL_URL,
        (gltf) => {
            const rawModel = gltf.scene;
            animationClipsRef.current = gltf.animations;

            rawModel.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.frustumCulled = false; 
                    if (child.material) {
                        child.material.envMapIntensity = 1;
                        child.material.needsUpdate = true;
                        child.material.roughness = 0.6;
                        child.material.metalness = 0.1;
                    }
                }
            });

            const wrapper = new THREE.Group();
            wrapper.add(rawModel);

            const box = new THREE.Box3().setFromObject(rawModel);
            const size = new THREE.Vector3();
            box.getSize(size);
            const center = new THREE.Vector3();
            box.getCenter(center);

            rawModel.position.x -= center.x;
            rawModel.position.y -= center.y;
            rawModel.position.z -= center.z;

            const maxDim = Math.max(size.x, size.y, size.z);
            const targetSize = 1.5; 
            const scaleFactor = targetSize / maxDim;
            wrapper.scale.set(scaleFactor, scaleFactor, scaleFactor);

            const meshes: THREE.Object3D[] = [];
            const mixers: THREE.AnimationMixer[] = [];
            
            for (let i = 0; i < ROCKS_COUNT; i++) {
                const clone = SkeletonUtils.clone(wrapper);
                if (gltf.animations.length > 0) {
                    const mixer = new THREE.AnimationMixer(clone);
                    mixers.push(mixer);
                    if (isAnimatingRef.current) {
                        mixer.clipAction(gltf.animations[0]).play();
                    }
                }
                const varScale = 1.0 + (Math.random() - 0.5) * 0.1;
                clone.scale.multiplyScalar(varScale);

                if (sceneRef.current) sceneRef.current.add(clone);
                meshes.push(clone);
            }
            
            rockMeshesRef.current = meshes;
            mixersRef.current = mixers;
        },
        undefined,
        (error) => {
            console.error("GLB Error:", error);
        }
    );

    return () => {
      rockMeshesRef.current.forEach(m => {
        if (sceneRef.current) sceneRef.current.remove(m);
      });
      rockMeshesRef.current = [];
      mixersRef.current = [];
    };
  }, []);

  // --- 3. Vision & Logic (Mobile Adapted) ---
  useEffect(() => {
    const initVision = async () => {
      onStateChange(VoidState.LOADING_VISION);
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
        );
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        
        // IMPORTANT: Use 'user' for front camera on mobile
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'user',
                width: { ideal: 640 }, // Lower res for perf
                height: { ideal: 480 }
            } 
        });
        
        videoRef.current.srcObject = stream;
        // Plays inline prevents fullscreen on iOS
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.addEventListener("loadeddata", () => {
          videoRef.current.play();
          onStateChange(VoidState.ACTIVE);
          startAnimationLoop();
        });
      } catch (err) {
        console.error("Vision Init Error:", err);
        onStateChange(VoidState.ERROR);
      }
    };

    initVision();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const processGestures = (landmarks: any[]) => {
    if (!landmarks || landmarks.length === 0) {
      physicsState.current.handDetected = false;
      physicsState.current.isFist = false;
      physicsState.current.orbitSpeed = physicsState.current.orbitSpeed * 0.8;
      if (Math.abs(physicsState.current.orbitSpeed) < 0.0001) physicsState.current.orbitSpeed = 0;
      onGestureUpdate({ isDetected: false, pinchDistance: 0, rotationAngle: 0, isFist: false });
      return;
    }

    physicsState.current.handDetected = true;
    const hand = landmarks[0]; 
    const wrist = hand[0];

    // Fist Detection
    let curledCount = 0;
    const fingerIndices = [8, 12, 16, 20];
    const pipIndices = [6, 10, 14, 18];
    for(let i=0; i<4; i++) {
        const tip = hand[fingerIndices[i]];
        const pip = hand[pipIndices[i]];
        // Simple distance check in 2D
        const dTip = Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2);
        const dPip = Math.pow(pip.x - wrist.x, 2) + Math.pow(pip.y - wrist.y, 2);
        if (dTip < dPip * 1.1) curledCount++;
    }
    const isFist = curledCount >= 3;
    physicsState.current.isFist = isFist;

    // Pinch: Thumb (4) & Index (8)
    let normalizedDist = 0;
    if (!isFist) {
        const thumb = hand[4];
        const indexFinger = hand[8]; // Changed from Middle (12) to Index (8)
        const dist = Math.sqrt(Math.pow(thumb.x - indexFinger.x, 2) + Math.pow(thumb.y - indexFinger.y, 2));
        normalizedDist = Math.min(Math.max((dist - 0.02) / 0.2, 0), 1);
        physicsState.current.targetRadius = 1.5 + (normalizedDist * 4.0);
    }

    // Rotation
    const middleMCP = hand[9];
    const dx = middleMCP.x - wrist.x;
    const dy = middleMCP.y - wrist.y;
    // On mobile front cam, X is mirrored. 
    // We stick to one logic and let the 'Invert' switch handle user pref.
    const angle = Math.atan2(dy, dx); 
    const vertical = -Math.PI / 2;
    const diff = angle - vertical;
    let normalizedDiff = Math.atan2(Math.sin(diff), Math.cos(diff));

    let rotationForce = 0;
    if (!isFist && Math.abs(normalizedDiff) > 0.15) {
        let direction = normalizedDiff; 
        if (invertRotationRef.current) direction *= -1;
        rotationForce = direction * (0.05 + baseSpeedRef.current * 4);
    }
    
    physicsState.current.orbitSpeed = physicsState.current.orbitSpeed * 0.90 + rotationForce * 0.10;

    onGestureUpdate({
        isDetected: true,
        pinchDistance: normalizedDist,
        rotationAngle: normalizedDiff,
        isFist: isFist
    });
  };

  const startAnimationLoop = () => {
    let lastTime = performance.now();

    const loop = (time: number) => {
        const delta = (time - lastTime) / 1000;
        lastTime = time;
        physicsState.current.globalTime += 0.02;

        if (mixersRef.current.length > 0) {
            mixersRef.current.forEach(mixer => mixer.update(delta));
        }

        if (handLandmarkerRef.current && videoRef.current.readyState >= 2) {
             const detections = handLandmarkerRef.current.detectForVideo(videoRef.current, time);
             processGestures(detections.landmarks);
        } else {
             physicsState.current.orbitSpeed = physicsState.current.orbitSpeed * 0.8;
             if (Math.abs(physicsState.current.orbitSpeed) < 0.0001) physicsState.current.orbitSpeed = 0;
        }

        physicsState.current.currentRadius += (physicsState.current.targetRadius - physicsState.current.currentRadius) * 0.1;
        physicsState.current.orbitAngle += physicsState.current.orbitSpeed;
        
        const isCollapsing = physicsState.current.isFist;
        const currentVerticalOffset = verticalOffsetRef.current;

        rocksDataRef.current.forEach((rock, i) => {
            const orbit = physicsState.current.orbitAngle + rock.angleOffset;
            const r = physicsState.current.currentRadius;
            
            const targetX = Math.cos(orbit) * r;
            const targetY = currentVerticalOffset + Math.sin(orbit) * r;
            const targetZ = 0;

            if (isCollapsing) {
                if (rock.isSleeping) {
                    rock.isSleeping = false;
                    rock.x = targetX;
                    rock.y = targetY;
                    rock.z = targetZ;

                    const tangentAngle = orbit + Math.PI / 2;
                    const speed = Math.abs(physicsState.current.orbitSpeed) > 0.01 
                        ? physicsState.current.orbitSpeed * r * 8.0 
                        : (Math.random() - 0.5) * 0.2;
                    
                    rock.vx = Math.cos(tangentAngle) * speed + (Math.random() - 0.5) * 0.1;
                    rock.vy = (Math.random() - 0.2) * 0.1; 
                    rock.vz = (Math.random() - 0.5) * 0.5;
                    rock.rotVelX = (Math.random() - 0.5) * 0.1;
                    rock.rotVelY = (Math.random() - 0.5) * 0.1;
                    rock.rotVelZ = (Math.random() - 0.5) * 0.1;
                }

                rock.vy -= GRAVITY;
                rock.vx *= FRICTION;
                rock.vz *= FRICTION;
                rock.x += rock.vx;
                rock.y += rock.vy;
                rock.z += rock.vz;

                if (rock.y < FLOOR_Y + 0.5) {
                    rock.y = FLOOR_Y + 0.5;
                    rock.vy *= -BOUNCE_DAMPING; 
                    rock.vx *= 0.8; 
                    rock.vz *= 0.8;
                    rock.rotVelX *= 0.9;
                    rock.rotVelY *= 0.9;
                    rock.rotVelZ *= 0.9;
                }

                rock.rotX += rock.rotVelX;
                rock.rotY += rock.rotVelY;
                rock.rotZ += rock.rotVelZ;
            } else {
                rock.isSleeping = true;
                rock.x += (targetX - rock.x) * 0.08;
                rock.y += (targetY - rock.y) * 0.08;
                rock.z += (targetZ - rock.z) * 0.08;
                rock.rotY += 0.02; 
            }

            const mesh = rockMeshesRef.current[i];
            if (mesh) {
                mesh.position.set(rock.x, rock.y, rock.z);
                mesh.rotation.set(rock.rotX, rock.rotY, rock.rotZ);
            }
        });

        if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
        }

        requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);
  };

  return (
    <div 
        ref={containerRef} 
        className="block w-full h-full absolute top-0 left-0 z-0 bg-white"
    />
  );
};

export default VoidCanvas;