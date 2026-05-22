export type GameState = 'MENU' | 'TUTORIAL' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

export interface Bird {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  type: 'robin' | 'hummingbird' | 'phoenix' | 'golden';
  color: string;
  points: number;
  isHit: boolean;
  hitTimer: number;
  wingAngle: number;
  wingSpeed: number;
  hp: number;
  maxHp: number;
  movementType: 'straight' | 'sine' | 'wave' | 'swoop';
  startY: number;
  waveSeed: number; // Offset for sine wave calculation
}

export interface Stone {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: 'normal' | 'fire' | 'split';
  angle: number;
  trail: { x: number; y: number }[];
  active: boolean;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  alpha: number;
  life: number;
  maxLife: number;
  type: 'feather' | 'smoke' | 'spark' | 'star';
  rotation?: number;
  rotSpeed?: number;
}

export interface Cloud {
  id: number;
  x: number;
  y: number;
  speed: number;
  scale: number;
  opacity: number;
}

export interface BackgroundStar {
  id: number;
  x: number;
  y: number;
  size: number;
  brightness: number;
  twinkleSpeed: number;
}
