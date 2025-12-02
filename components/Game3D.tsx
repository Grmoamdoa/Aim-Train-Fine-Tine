import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { ScenarioType, ShotData, TargetEntity } from '../types';

interface Game3DProps {
  scenario: ScenarioType;
  sensitivity: number;
  onFinish: (score: number, shotsFired: number, shotsHit: number, missData: ShotData[]) => void;
}

// -----------------------------------------------------------------------------
// Helper: Target Component
// -----------------------------------------------------------------------------
interface TargetMeshProps {
  target: TargetEntity;
  onClick?: () => void;
}

const TargetMesh: React.FC<TargetMeshProps> = ({ target, onClick }) => {
  return (
    <mesh position={target.position} onClick={onClick}>
      <sphereGeometry args={[target.radius, 32, 32]} />
      <meshStandardMaterial
        color="#00ffcc"
        emissive="#00aa88"
        emissiveIntensity={0.5}
        metalness={0.8}
        roughness={0.2}
      />
    </mesh>
  );
};

// -----------------------------------------------------------------------------
// Core Game Logic Component (Inside Canvas)
// -----------------------------------------------------------------------------
const GameController = ({ scenario, sensitivity, onFinish }: Game3DProps) => {
  const { camera, raycaster } = useThree();
  const [targets, setTargets] = useState<TargetEntity[]>([]);
  
  // UI State
  const [score, setScore] = useState(0);
  const [shotsFired, setShotsFired] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  
  // Refs for logic (Fixes stale closure in setInterval)
  const shotDataRef = useRef<ShotData[]>([]);
  const targetsRef = useRef<TargetEntity[]>([]);
  const scoreRef = useRef(0);
  const shotsFiredRef = useRef(0);

  // Initialize targets based on scenario
  useEffect(() => {
    const initialTargets: TargetEntity[] = [];
    if (scenario === ScenarioType.GRIDSHOT) {
      for (let i = 0; i < 3; i++) spawnTarget(initialTargets);
    } else if (scenario === ScenarioType.TRACKING) {
      spawnTarget(initialTargets, [0, 1.5, -10]);
    } else {
        // Flicking
      spawnTarget(initialTargets);
    }
    setTargets(initialTargets);
    targetsRef.current = initialTargets;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Use Refs to get the most up-to-date values
          onFinish(scoreRef.current, shotsFiredRef.current, scoreRef.current, shotDataRef.current); 
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync ref with state (simplification for render loop access)
  useEffect(() => {
    targetsRef.current = targets;
  }, [targets]);

  const spawnTarget = (currentList: TargetEntity[], fixedPos?: [number, number, number]) => {
    const id = Math.random().toString(36).substr(2, 9);
    // Random position within a frustrating but fair frustum
    const x = fixedPos ? fixedPos[0] : (Math.random() - 0.5) * 10;
    const y = fixedPos ? fixedPos[1] : 1 + Math.random() * 3;
    const z = fixedPos ? fixedPos[2] : -8 - Math.random() * 5; // Distance
    
    // Tracking scenario needs velocity
    const velocity: [number, number, number] = scenario === ScenarioType.TRACKING 
        ? [(Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 2), 0, 0] 
        : [0,0,0];

    const newTarget: TargetEntity = {
      id,
      position: [x, y, z],
      active: true,
      velocity,
      radius: scenario === ScenarioType.FLICKING ? 0.3 : 0.5
    };
    currentList.push(newTarget);
    return newTarget;
  };

  // Game Loop
  useFrame((state, delta) => {
    if (scenario === ScenarioType.TRACKING) {
        setTargets(prev => prev.map(t => {
            // Simple bounce logic
            let newX = t.position[0] + t.velocity[0] * delta;
            let velX = t.velocity[0];
            
            if (newX > 8 || newX < -8) {
                velX *= -1;
                newX = t.position[0] + velX * delta;
            }

            return {
                ...t,
                position: [newX, t.position[1], t.position[2]],
                velocity: [velX, t.velocity[1], t.velocity[2]]
            };
        }));
    }
  });

  // ---------------------------------------------------------------------------
  // The Secret Sauce: Miss Analysis Logic
  // ---------------------------------------------------------------------------
  const handleShoot = () => {
    // Update Refs immediately
    shotsFiredRef.current += 1;
    // Update State for UI
    setShotsFired(prev => prev + 1);
    
    // Raycast from center of camera
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    
    let hitFound = false;
    let hitTargetId = "";

    // 1. Check for hits
    const activeTargets = targetsRef.current;
    
    // Find closest target to the ray (Conceptually the one the user aimed at)
    let closestTarget: TargetEntity | null = null;
    let minAngularDist = Infinity;

    const rayDir = new THREE.Vector3();
    camera.getWorldDirection(rayDir);

    activeTargets.forEach(target => {
        const targetPos = new THREE.Vector3(...target.position);
        
        // Sphere intersection check
        // Vector from camera to target center
        const toTarget = targetPos.clone().sub(camera.position);
        const projectionLength = toTarget.dot(rayDir);
        
        // Closest point on ray to sphere center
        const closestPointOnRay = camera.position.clone().add(rayDir.clone().multiplyScalar(projectionLength));
        const distToCenter = closestPointOnRay.distanceTo(targetPos);

        if (distToCenter < target.radius) {
            hitFound = true;
            hitTargetId = target.id;
        }

        // Logic for identifying intended target for MISS calculation
        const angle = rayDir.angleTo(toTarget.normalize());
        if (angle < minAngularDist) {
            minAngularDist = angle;
            closestTarget = target;
        }
    });

    if (hitFound) {
      scoreRef.current += 1;
      setScore(s => s + 1);
      
      shotDataRef.current.push({ timestamp: Date.now(), hit: true, targetId: hitTargetId });
      
      // Respawn logic
      const newTargets = activeTargets.filter(t => t.id !== hitTargetId);
      spawnTarget(newTargets);
      setTargets([...newTargets]); // Trigger re-render
    } else {
        // 2. Analyze the Miss
        if (closestTarget) {
            const targetPos = new THREE.Vector3(...(closestTarget as TargetEntity).position);
            
            const plane = new THREE.Plane();
            plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), targetPos);

            const intersection = new THREE.Vector3();
            raycaster.ray.intersectPlane(plane, intersection);

            if (intersection) {
                // Vector from Target Center to Impact Point
                const diff = intersection.clone().sub(targetPos);
                
                const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
                const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

                const relativeX = diff.dot(camRight);
                const relativeY = diff.dot(camUp);

                shotDataRef.current.push({ 
                    timestamp: Date.now(), 
                    hit: false, 
                    relativeX, 
                    relativeY,
                    distanceFromCenter: diff.length(),
                    targetVelocityX: (closestTarget as TargetEntity).velocity[0]
                });
            }
        } else {
             shotDataRef.current.push({ timestamp: Date.now(), hit: false });
        }
    }
  };

  useEffect(() => {
    const handleMouseDown = () => handleShoot();
    window.addEventListener('mousedown', handleMouseDown);
    return () => window.removeEventListener('mousedown', handleMouseDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets]);

  return (
    <>
      <PointerLockControls selector="#root" />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      
      {/* HUD (Rendered within Canvas context to access state easily) */}
      <Html position={[0,0,0]} fullscreen style={{ pointerEvents: 'none' }}>
        <div className="absolute top-4 left-4 font-mono text-xl select-none">
            <div className="flex flex-col gap-2 text-white">
                <span className="bg-zinc-900/80 px-3 py-1 rounded border border-zinc-700 text-emerald-400 font-bold">
                    TIME: {timeLeft}s
                </span>
                <span className="bg-zinc-900/80 px-3 py-1 rounded border border-zinc-700">
                    SCORE: {score}
                </span>
                <span className="bg-zinc-900/80 px-3 py-1 rounded border border-zinc-700 text-sm">
                    ACC: {shotsFired > 0 ? ((score/shotsFired)*100).toFixed(1) : 0}%
                </span>
                <span className="bg-zinc-900/80 px-3 py-1 rounded border border-zinc-700 text-xs text-zinc-400 mt-2">
                    {scenario}
                </span>
            </div>
        </div>
      </Html>

      {/* Grid Floor */}
      <gridHelper args={[100, 100, 0x444444, 0x222222]} position={[0, -2, 0]} />
      
      {/* Targets */}
      {targets.map(t => (
        <TargetMesh key={t.id} target={t} />
      ))}
    </>
  );
};

// -----------------------------------------------------------------------------
// Wrapper Component
// -----------------------------------------------------------------------------
export const Game3D: React.FC<Game3DProps> = (props) => {
  return (
    <div className="w-full h-full relative bg-black">
      {/* Crosshair */}
      <div className="crosshair"></div>

      {/* Canvas */}
      <Canvas
        camera={{ fov: 75, position: [0, 0, 0] }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping }}
      >
         <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
         <GameController {...props} />
      </Canvas>
    </div>
  );
};
