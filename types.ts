export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  RESULTS = 'RESULTS'
}

export enum ScenarioType {
  GRIDSHOT = 'GRIDSHOT', // Static targets appearing rapidly
  TRACKING = 'TRACKING', // Moving targets
  FLICKING = 'FLICKING'  // Small targets requiring precision
}

export interface ShotData {
  timestamp: number;
  hit: boolean;
  targetId?: string;
  // Position relative to target center (if applicable)
  relativeX?: number; 
  relativeY?: number; 
  distanceFromCenter?: number;
  targetVelocityX?: number; // To detect over/undershoot on moving targets
}

export interface SessionStats {
  score: number;
  shotsFired: number;
  shotsHit: number;
  accuracy: number;
  avgTimeOnTarget?: number; // For tracking
  missData: ShotData[];
  scenario: ScenarioType;
  sensitivity: number;
}

export interface TargetEntity {
  id: string;
  position: [number, number, number];
  active: boolean;
  velocity: [number, number, number];
  radius: number;
}