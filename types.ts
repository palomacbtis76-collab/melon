export interface Point {
  x: number;
  y: number;
}

export interface Ripple {
  id: number;
  x: number;
  y: number;
  age: number; // 0 to maxAge
  maxAge: number;
  intensity: number;
}

export enum SoundType {
  PLUCK = 'PLUCK',
  SWEEP = 'SWEEP'
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandResults {
  multiHandLandmarks: HandLandmark[][];
}
