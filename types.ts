export interface Point {
  x: number;
  y: number;
}

export interface RockEntity {
  id: number;
  seed: number;
  angleOffset: number; // Position in the circle (0 to 2PI)
  
  // Physics Properties
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  
  rotX: number;
  rotY: number;
  rotZ: number;
  
  rotVelX: number; 
  rotVelY: number;
  rotVelZ: number;

  isSleeping: boolean; // If true, controlled by ring orbit. If false, controlled by physics.
}

export enum VoidState {
  IDLE = 'IDLE',
  LOADING_VISION = 'LOADING_VISION',
  ACTIVE = 'ACTIVE',
  ERROR = 'ERROR',
}

export interface HandGestures {
  pinchDistance: number; // 0 to 1 (normalized)
  rotationAngle: number; // Radians, roll of the hand
  isDetected: boolean;
  isFist: boolean; // New gesture
}