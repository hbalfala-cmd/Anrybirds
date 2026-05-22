/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Flame, 
  Award, 
  HelpCircle, 
  Info, 
  X, 
  Heart, 
  Layers, 
  ChevronRight, 
  Trophy, 
  Zap 
} from 'lucide-react';
import { sound } from './sound';
import { GameState, Bird, Stone, Particle, Cloud, BackgroundStar } from './types';

// Constants
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 675;
const GRAVITY = 0.22;
const SLINGSHOT_CENTER_X = 160;
const SLINGSHOT_CENTER_Y = 430;
const MAX_DRAG = 90;
const LAUNCH_FACTOR = 0.16;

export default function App() {
  // Game states and scores
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('batul_high_score');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [ammo, setAmmo] = useState(10);
  const [comboStreak, setComboStreak] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [accuracy, setAccuracy] = useState({ shots: 0, hits: 0 });
  const [showInfo, setShowInfo] = useState(false);

  // References
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Sound unlock trigger on first user interaction
  const unlockAudio = () => {
    sound.setMute(isMuted);
  };

  // Game Engine State Refs (to avoid React re-render lag inside the anim frame)
  const stateRef = useRef({
    gameState: 'MENU' as GameState,
    score: 0,
    ammo: 10,
    comboStreak: 0,
    maxCombo: 0,
    accuracy: { shots: 0, hits: 0 },
    
    // Canvas items
    birds: [] as Bird[],
    stones: [] as Stone[],
    particles: [] as Particle[],
    clouds: [] as Cloud[],
    stars: [] as BackgroundStar[],
    
    // Slingshot dragging state
    isDragging: false,
    dragX: SLINGSHOT_CENTER_X,
    dragY: SLINGSHOT_CENTER_Y,
    
    // Slinger spring physical bounce details
    isSpringingBack: false,
    springX: 0,
    springY: 0,
    springVx: 0,
    springVy: 0,
    
    // Screen shake
    shakeTime: 0,
    shakeIntensity: 0,
    
    // Timers
    nextBirdSpawnTime: 0,
    birdsSpawnedCount: 0,
    lastFrameTime: 0,
    
    // Float texts (for displaying hit scores and combos)
    floatingTexts: [] as { x: number; y: number; text: string; alpha: number; yOffset: number; isCombo: boolean }[]
  });

  // Keep Sync between stateRef and React states
  useEffect(() => {
    stateRef.current.gameState = gameState;
  }, [gameState]);

  useEffect(() => {
    sound.setMute(isMuted);
  }, [isMuted]);

  // High Score checking
  const handleScoreUpdate = (newScore: number) => {
    setScore(newScore);
    if (newScore > highScore) {
      setHighScore(newScore);
      localStorage.setItem('batul_high_score', newScore.toString());
    }
  };

  // Setup stars & clouds on mount
  useEffect(() => {
    // Generate stars
    const stars: BackgroundStar[] = [];
    for (let i = 0; i < 75; i++) {
      stars.push({
        id: i,
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * (CANVAS_HEIGHT - 250),
        size: Math.random() * 2 + 0.4,
        brightness: Math.random(),
        twinkleSpeed: 0.01 + Math.random() * 0.02
      });
    }
    stateRef.current.stars = stars;

    // Generate parallax clouds
    const clouds: Cloud[] = [];
    for (let i = 0; i < 6; i++) {
      clouds.push({
        id: i,
        x: Math.random() * CANVAS_WIDTH,
        y: 40 + Math.random() * 140,
        speed: 0.15 + Math.random() * 0.35,
        scale: 0.5 + Math.random() * 0.7,
        opacity: 0.25 + Math.random() * 0.35
      });
    }
    stateRef.current.clouds = clouds;
  }, []);

  // Set initial game states
  const initGame = () => {
    unlockAudio();
    const g = stateRef.current;
    g.score = 0;
    g.ammo = 10;
    g.comboStreak = 0;
    g.maxCombo = 0;
    g.accuracy = { shots: 0, hits: 0 };
    g.birds = [];
    g.stones = [];
    g.particles = [];
    g.floatingTexts = [];
    g.isDragging = false;
    g.isSpringingBack = false;
    g.birdsSpawnedCount = 0;
    g.nextBirdSpawnTime = 120; // Frame offset spawn quickly

    setScore(0);
    setAmmo(10);
    setComboStreak(0);
    setMaxCombo(0);
    setAccuracy({ shots: 0, hits: 0 });
    setGameState('PLAYING');
  };

  // Spawn Birds AI logic
  const spawnBird = () => {
    const g = stateRef.current;
    g.birdsSpawnedCount++;

    const id = Date.now() + Math.random();
    const startX = CANVAS_WIDTH + 50;
    const startY = 80 + Math.random() * 280; // Sky height bounds
    
    // Choose bird type based on spawn count / score for dynamic difficulty
    let type: Bird['type'] = 'robin';
    let color = '#0ea5e9'; // Cool sky-blue Robin
    let points = 10;
    let maxHp = 1;
    let wingSpeed = 0.12;
    let vx = -(2.2 + Math.random() * 1.8 + (g.score * 0.01)); // gets faster as score increases
    let vy = 0;
    let width = 38;
    let height = 28;
    let movementType: Bird['movementType'] = 'straight';

    const randVal = Math.random();

    // High Score unlocks tougher birds
    if (g.birdsSpawnedCount % 7 === 0) {
      // Phoenix / Boss Bird
      type = 'phoenix';
      color = '#f97316'; // Crimson-Orange
      points = 50;
      maxHp = 3;
      wingSpeed = 0.06;
      vx = -1.5;
      width = 56;
      height = 44;
      movementType = 'swoop';
    } else if (randVal < 0.22) {
      // Fast Hummingbird
      type = 'hummingbird';
      color = '#ec4899'; // Bright Fuchsia
      points = 25;
      maxHp = 1;
      wingSpeed = 0.25;
      vx = -(4.5 + Math.random() * 2.0);
      width = 26;
      height = 20;
      movementType = 'sine';
    } else if (randVal > 0.88) {
      // Golden Bird (Rare bullet)
      type = 'golden';
      color = '#fbbf24'; // Shimmering Gold
      points = 40;
      maxHp = 1;
      wingSpeed = 0.15;
      vx = -(3.2 + Math.random() * 1.5);
      width = 34;
      height = 26;
      movementType = 'wave';
    } else {
      // Standard Robin
      if (Math.random() < 0.45) {
        movementType = 'sine';
      }
    }

    g.birds.push({
      id,
      x: startX,
      y: startY,
      vx,
      vy,
      width,
      height,
      type,
      color,
      points,
      isHit: false,
      hitTimer: 0,
      wingAngle: 0,
      wingSpeed,
      hp: maxHp,
      maxHp,
      movementType,
      startY,
      waveSeed: Math.random() * 100
    });
  };

  // Stone launchers and trail tracking
  const triggerSlingshotRelease = () => {
    const g = stateRef.current;
    if (g.ammo <= 0) return;

    // Calculate launch parameters
    const dx = SLINGSHOT_CENTER_X - g.dragX;
    const dy = SLINGSHOT_CENTER_Y - g.dragY;
    const dist = Math.hypot(dx, dy);

    if (dist < 12) {
      // Too short drag, return pouch to center gently
      g.isDragging = false;
      g.dragX = SLINGSHOT_CENTER_X;
      g.dragY = SLINGSHOT_CENTER_Y;
      return;
    }

    // Launch stone physics calculations
    const speedX = dx * LAUNCH_FACTOR;
    const speedY = dy * LAUNCH_FACTOR;

    // Trigger spring launch feedback
    g.isDragging = false;
    g.isSpringingBack = true;
    g.springX = g.dragX - SLINGSHOT_CENTER_X;
    g.springY = g.dragY - SLINGSHOT_CENTER_Y;
    g.springVx = -g.springX * 0.4;
    g.springVy = -g.springY * 0.4;

    // Deduct ammo, record stats
    g.ammo--;
    setAmmo(g.ammo);
    g.accuracy.shots++;
    setAccuracy({ ...g.accuracy });

    // Determine ammo type based on Combo streak
    let stoneType: Stone['type'] = 'normal';
    if (g.comboStreak >= 5) {
      stoneType = 'split'; // Multi-shot electric!
      sound.playComboUnlock();
    } else if (g.comboStreak >= 3) {
      stoneType = 'fire'; // Pyro core!
      sound.playExplosion();
    } else {
      sound.playWoosh();
    }

    // Spawn Stone(s)
    const baseAngle = Math.atan2(speedY, speedX);
    const stoneRadius = stoneType === 'fire' ? 14 : 7;

    if (stoneType === 'split') {
      // Launch 3 stones in angled arcs
      const angles = [-0.08, 0, 0.08]; // spread angles
      const speed = Math.hypot(speedX, speedY);
      
      angles.forEach((offsetAngle, idx) => {
        const finalAngle = baseAngle + offsetAngle;
        g.stones.push({
          id: Date.now() + Math.random() + idx,
          x: SLINGSHOT_CENTER_X,
          y: SLINGSHOT_CENTER_Y,
          vx: Math.cos(finalAngle) * speed,
          vy: Math.sin(finalAngle) * speed,
          radius: 7,
          type: 'split',
          angle: finalAngle,
          trail: [],
          active: true
        });
      });
    } else {
      g.stones.push({
        id: Date.now() + Math.random(),
        x: SLINGSHOT_CENTER_X,
        y: SLINGSHOT_CENTER_Y,
        vx: speedX,
        vy: speedY,
        radius: stoneRadius,
        type: stoneType,
        angle: baseAngle,
        trail: [],
        active: true
      });
    }

    // Reset drag anchor
    g.dragX = SLINGSHOT_CENTER_X;
    g.dragY = SLINGSHOT_CENTER_Y;

    // Check if combo threshold reached, reset if standard shot is fired
    // Note: special stone properties are resolved, but visual state stays until used.
  };

  // Feather explosion particle spawning
  const spawnFeatherParticles = (x: number, y: number, color: string, count = 12) => {
    const g = stateRef.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      g.particles.push({
        id: Date.now() + Math.random() + i,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (1 + Math.random() * 2), // upward bias
        color,
        radius: 3 + Math.random() * 5,
        alpha: 1.0,
        life: 0,
        maxLife: 45 + Math.round(Math.random() * 30),
        type: 'feather',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: -0.08 + Math.random() * 0.16
      });
    }
  };

  // Fire smoke explosion particle spawning
  const spawnFireParticles = (x: number, y: number) => {
    const g = stateRef.current;
    // Radial bright burst
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.5;
      const rVal = Math.random();
      const color = rVal < 0.35 ? '#ff4500' : rVal < 0.7 ? '#ffd700' : '#ffa500';
      g.particles.push({
        id: Date.now() + Math.random(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        color,
        radius: 4 + Math.random() * 8,
        alpha: 1.0,
        life: 0,
        maxLife: 25 + Math.round(Math.random() * 20),
        type: 'spark'
      });
    }

    // Black expanding puff smoke
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      g.particles.push({
        id: Date.now() + Math.random(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: -0.2 - Math.random() * 0.6,
        color: 'rgba(55, 65, 81, 0.4)',
        radius: 8 + Math.random() * 12,
        alpha: 0.8,
        life: 0,
        maxLife: 40 + Math.round(Math.random() * 20),
        type: 'smoke'
      });
    }
  };

  // Spark sparks behind flying stone
  const spawnTrailParticles = (x: number, y: number, type: Stone['type']) => {
    const g = stateRef.current;
    if (type === 'fire') {
      g.particles.push({
        id: Date.now() + Math.random(),
        x: x - 5 + Math.random() * 10,
        y: y + 2,
        vx: -1 - Math.random() * 1.5,
        vy: -0.5 + Math.random() * 1,
        color: Math.random() < 0.5 ? '#f59e0b' : '#ef4444',
        radius: 2 + Math.random() * 4,
        alpha: 0.9,
        life: 0,
        maxLife: 15 + Math.round(Math.random() * 15),
        type: 'spark'
      });
    } else if (type === 'split') {
      // cyan spark
      g.particles.push({
        id: Date.now() + Math.random(),
        x: x - 4,
        y: y,
        vx: -0.8 - Math.random() * 1,
        vy: -0.4 + Math.random() * 0.8,
        color: '#06b6d4', // neon cyan
        radius: 2 + Math.random() * 3,
        alpha: 0.8,
        life: 0,
        maxLife: 12 + Math.round(Math.random() * 12),
        type: 'spark'
      });
    } else {
      // Normal smoke trail
      g.particles.push({
        id: Date.now() + Math.random(),
        x,
        y,
        vx: -0.2 - Math.random() * 0.4,
        vy: -0.1 + Math.random() * 0.2,
        color: 'rgba(255,255,255,0.25)',
        radius: 2 + Math.random() * 3,
        alpha: 0.5,
        life: 0,
        maxLife: 15 + Math.round(Math.random() * 10),
        type: 'smoke'
      });
    }
  };

  // Hit visual confirmation float text
  const addFloatingText = (x: number, y: number, text: string, isCombo = false) => {
    stateRef.current.floatingTexts.push({
      x,
      y,
      text,
      alpha: 1.0,
      yOffset: 0,
      isCombo
    });
  };

  // Core Game loop updates and calculations
  const updatePhysics = () => {
    const g = stateRef.current;
    
    // 1. Spawning Birds
    g.nextBirdSpawnTime--;
    if (g.nextBirdSpawnTime <= 0) {
      spawnBird();
      // Difficulty pacing: decrease spawn interval as score scales up
      const baseInterval = 130; // ~2.2 seconds
      const minInterval = 55;   // ~0.9 seconds
      const speedModifier = Math.min(60, g.score * 0.4);
      g.nextBirdSpawnTime = Math.max(minInterval, baseInterval - speedModifier) + Math.round(Math.random() * 40);
    }

    // 2. Parallax Background & Day/Night interpolation details
    // Stars Twinkle
    g.stars.forEach(star => {
      star.brightness += star.twinkleSpeed;
      if (star.brightness > 1 || star.brightness < 0.15) {
        star.twinkleSpeed = -star.twinkleSpeed;
      }
    });

    // Clouds float right-to-left
    g.clouds.forEach(cloud => {
      cloud.x -= cloud.speed;
      if (cloud.x < -200) {
        cloud.x = CANVAS_WIDTH + 150;
        cloud.y = 35 + Math.random() * 160;
        cloud.speed = 0.15 + Math.random() * 0.35;
        cloud.scale = 0.5 + Math.random() * 0.70;
      }
    });

    // 3. Update Slingshot Spring-back mechanics
    if (g.isSpringingBack) {
      const forceX = -0.22 * g.springX;
      const forceY = -0.22 * g.springY;
      g.springVx += forceX;
      g.springVy += forceY;
      g.springVx *= 0.72; // friction/damping
      g.springVy *= 0.72;
      g.springX += g.springVx;
      g.springY += g.springVy;

      if (Math.hypot(g.springX, g.springY) < 0.8 && Math.hypot(g.springVx, g.springVy) < 0.2) {
        g.isSpringingBack = false;
        g.springX = 0;
        g.springY = 0;
        g.springVx = 0;
        g.springVy = 0;
      }
    }

    // 4. Update Flying Stones
    let shotsThatMissedEntirely: Stone[] = [];
    g.stones.forEach(stone => {
      stone.x += stone.vx;
      stone.y += stone.vy;
      stone.vy += GRAVITY;

      // Add actual rotation
      stone.angle = Math.atan2(stone.vy, stone.vx);

      // Append trails
      stone.trail.push({ x: stone.x, y: stone.y });
      if (stone.trail.length > 10) {
        stone.trail.shift();
      }

      // Spawn trail visual elements
      if (Math.random() < 0.45 || stone.type === 'fire') {
        spawnTrailParticles(stone.x, stone.y, stone.type);
      }

      // Bounds checking (offscreen)
      if (stone.x > CANVAS_WIDTH + 80 || stone.y > CANVAS_HEIGHT + 50 || stone.x < -50) {
        stone.active = false;
        // Keep track of shots which flew out of bounds without impact
        shotsThatMissedEntirely.push(stone);
      }
    });

    // Remove inactive stones
    g.stones = g.stones.filter(s => s.active);

    // If a stone went offscreen, let's verify if the entire shot missed or was recycled
    shotsThatMissedEntirely.forEach(stone => {
      // In a split/multishot, as long as any splits hit, or since each individual split goes off-screen:
      // We check if this single stone hit nothing.
      // To simplify: if any shot is fired, we expect a bird hit. If a stone is marked for destruction and hit nothing:
      // Let's reset combo ONLY if we currently have zero active stones in the air and combo streak hasn't changed.
      if (g.stones.length === 0) {
        // Reset streak only if no other active projectiles exist
        if (g.comboStreak > 0) {
          g.comboStreak = 0;
          setComboStreak(0);
          addFloatingText(150, 480, "COMBO LOST", true);
        }
      }
    });

    // 5. Update Birds
    g.birds.forEach(bird => {
      if (!bird.isHit) {
        // AI movement flight paths
        bird.x += bird.vx;
        
        if (bird.movementType === 'sine') {
          // Rapid wavy wing beat sine
          bird.y = bird.startY + Math.sin(bird.x * 0.015 + bird.waveSeed) * 50;
        } else if (bird.movementType === 'wave') {
          // Ascending/descending wider curves
          bird.y = bird.startY + Math.sin(bird.x * 0.006 + bird.waveSeed) * 85;
        } else if (bird.movementType === 'swoop') {
          // Slow dramatic sweep dive
          bird.y = bird.startY + Math.cos(bird.x * 0.004 + bird.waveSeed) * 110;
        }

        // Flapping wings frame increment
        bird.wingAngle += bird.wingSpeed;

        // Escape out of screen borders (miss score)
        if (bird.x < -100) {
          bird.isHit = false; // escapes unharmed
        }
      } else {
        // Physics of falling bird after hit
        bird.vy += GRAVITY;
        bird.x += bird.vx * 0.3; // slows lateral drift
        bird.y += bird.vy;
        bird.wingAngle += 0.4; // rapid chaotic dead spin
        
        // Falling off-screen cleanup
        if (bird.y > CANVAS_HEIGHT + 70) {
          bird.hp = 0; // complete removal
        }
      }
    });

    // Clean up escaped or dead birds
    // Escaped ones just vanish. If bird was hit and fell, score was already granted block-wise.
    const initialCount = g.birds.length;
    g.birds = g.birds.filter(b => b.x > -80 && (b.hp > 0 || !b.isHit));
    const finalCount = g.birds.length;
    
    // In strict arcade: if raw robins escape unharmed, do we reset combo?
    // Let's make it hit-based. Only missing a fired shot breaks combo, which is and feels more fair!

    // 6. Projectiles Collision Detections
    g.stones.forEach(stone => {
      g.birds.forEach(bird => {
        if (!bird.isHit && stone.active) {
          const dx = stone.x - bird.x;
          const dy = stone.y - bird.y;
          // check ellipses / rect collision boundaries
          const distance = Math.hypot(dx, dy);

          const collisionRadius = stone.radius + (bird.width / 2.1);
          
          if (distance < collisionRadius) {
            // EXPLOSION OR DAMAGE CORE
            
            // Check Fire Stone explosive shockwave properties
            if (stone.type === 'fire') {
              stone.active = false; // explodes on contact
              g.shakeTime = 16;
              g.shakeIntensity = 8;
              
              // Spark particles
              spawnFireParticles(stone.x, stone.y);
              sound.playExplosion();

              // Splash damage to ALL nearby birds in range
              g.birds.forEach(otherBird => {
                if (!otherBird.isHit) {
                  const splashDistance = Math.hypot(otherBird.x - stone.x, otherBird.y - stone.y);
                  if (splashDistance < 130) {
                    // Exploded splash hit
                    otherBird.hp -= 2; // high damage
                    if (otherBird.hp <= 0) {
                      otherBird.isHit = true;
                      otherBird.vy = -3; // slight upwards jump on explosion
                      
                      // Rewards
                      g.score += otherBird.points;
                      g.accuracy.hits++;
                      
                      spawnFeatherParticles(otherBird.x, otherBird.y, otherBird.color, 16);
                      addFloatingText(otherBird.x, otherBird.y, `+${otherBird.points}`);
                      
                      // Special item recoveries
                      if (otherBird.type === 'golden') {
                        g.ammo += 2;
                        addFloatingText(otherBird.x, otherBird.y - 25, "+2 STONES", true);
                        sound.playGoldenHit();
                      }
                    } else {
                      // Tough bird damaged flash
                      otherBird.hitTimer = 8;
                      spawnFeatherParticles(otherBird.x, otherBird.y, otherBird.color, 5);
                      addFloatingText(otherBird.x, otherBird.y, "CRIT!", true);
                      sound.playHitHeavy();
                    }
                  }
                }
              });

              // Increase combo and sync core
              g.comboStreak++;
              if (g.comboStreak > g.maxCombo) {
                g.maxCombo = g.comboStreak;
                setMaxCombo(g.maxCombo);
              }
              setComboStreak(g.comboStreak);
              addFloatingText(stone.x, stone.y - 40, `COMBO x${g.comboStreak}!`, true);

              // Update React state
              handleScoreUpdate(g.score);
              setAccuracy({ ...g.accuracy });
              
              // Hitting phoenix/golden drops extra recycle ammo
              g.ammo = Math.min(30, g.ammo + 1); // Recycle shot
              setAmmo(g.ammo);
            } else {
              // Normal and Multi-Shot impact properties
              bird.hp -= 1;
              stone.active = false; // normal stone stops or breaks

              if (bird.hp <= 0) {
                bird.isHit = true;
                bird.vy = -2.5 + Math.random() * -1.5; // fall dead trajectory
                
                // Add points
                g.score += bird.points;
                handleScoreUpdate(g.score);
                
                g.accuracy.hits++;
                setAccuracy({ ...g.accuracy });

                // Spawns particles
                spawnFeatherParticles(bird.x, bird.y, bird.color, 12);
                sound.playHit();
                
                // Float text
                addFloatingText(bird.x, bird.y, `+${bird.points}`);

                // Ammo recycling
                if (bird.type === 'golden') {
                  g.ammo = Math.min(30, g.ammo + 2);
                  setAmmo(g.ammo);
                  addFloatingText(bird.x, bird.y - 25, "+2 STONES", true);
                  sound.playGoldenHit();
                } else if (bird.type === 'phoenix') {
                  g.ammo = Math.min(30, g.ammo + 3);
                  setAmmo(g.ammo);
                  addFloatingText(bird.x, bird.y - 25, "+3 BOUNTY", true);
                  sound.playGoldenHit();
                } else {
                  g.ammo = Math.min(30, g.ammo + 1); // direct recycle
                  setAmmo(g.ammo);
                }

                // Combo Streak calculations
                g.comboStreak++;
                if (g.comboStreak > g.maxCombo) {
                  g.maxCombo = g.comboStreak;
                  setMaxCombo(g.maxCombo);
                }
                setComboStreak(g.comboStreak);

                if (g.comboStreak === 3) {
                  sound.playComboUnlock();
                  addFloatingText(150, 480, "FIRE CORE READY!", true);
                } else if (g.comboStreak === 5) {
                  sound.playComboUnlock();
                  addFloatingText(150, 480, "ELECTRIC MULTI-SHOT READY!", true);
                } else if (g.comboStreak > 1) {
                  addFloatingText(bird.x, bird.y - 20, `${g.comboStreak}x CHAIN!`, true);
                }
              } else {
                // Tough bird hit (Phoenix) but still alive
                bird.hitTimer = 8; // flash damage
                spawnFeatherParticles(bird.x, bird.y, bird.color, 6);
                addFloatingText(bird.x, bird.y, "HP -1", false);
                sound.playHitHeavy();
              }
            }
          }
        }
      });
    });

    // 7. Update Particles
    g.particles.forEach(p => {
      p.life++;
      p.x += p.vx;
      p.y += p.vy;

      if (p.type === 'feather') {
        p.vy += 0.08; // floaty gravity
        p.vx *= 0.96; // drag
        if (p.rotation !== undefined && p.rotSpeed !== undefined) {
          p.rotation += p.rotSpeed;
        }
      } else if (p.type === 'smoke') {
        p.radius += 0.22; // expand smoke size
        p.vx *= 0.95;
        p.vy *= 0.95;
      } else {
        p.vy += 0.05; // light sparks decay
      }

      // fade ratio
      p.alpha = 1.0 - (p.life / p.maxLife);
    });

    // Filter living particles
    g.particles = g.particles.filter(p => p.life < p.maxLife && p.alpha > 0);

    // 8. Update floating popup texts
    g.floatingTexts.forEach(ft => {
      ft.yOffset -= 1.1; // rise up
      ft.alpha -= 0.022; // fade
    });
    g.floatingTexts = g.floatingTexts.filter(ft => ft.alpha > 0);

    // 9. Update Screen shake factor
    if (g.shakeTime > 0) {
      g.shakeTime--;
    }

    // 10. Check Game Over
    // Ammo hits 0 AND there are no active projectiles in flight that could hit anything:
    if (g.ammo <= 0 && g.stones.length === 0 && g.gameState === 'PLAYING') {
      // Let's verify if all birds are clear or if the player has absolutely no options left
      setGameState('GAMEOVER');
      sound.playGameOver();
    }
  };

  // Rendering graphics on HTML5 Canvas
  const drawCanvas = (ctx: CanvasRenderingContext2D) => {
    const g = stateRef.current;
    
    ctx.save();
    
    // Apply camera shaking visual feedback (micro shake frames)
    if (g.shakeTime > 0 && g.shakeIntensity > 0) {
      const sx = (Math.random() - 0.5) * g.shakeIntensity;
      const sy = (Math.random() - 0.5) * g.shakeIntensity;
      ctx.translate(sx, sy);
    }

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // A. Generate Beautiful interpolate sky color
    // Day (0) -> Sunset (50) -> Night (120)
    let topColor = [14, 165, 233]; // cyan sky
    let botColor = [186, 230, 253]; // light blue
    let levelTransition = 0; // 0 = day, 1 = sunset/evening, 2 = night
    
    const dayTop = [14, 165, 233];
    const dayBot = [186, 230, 253];
    
    const duskTop = [88, 28, 135]; // dark purple
    const duskMid = [249, 115, 22]; // hot orange
    const duskBot = [253, 186, 116]; // light amber
    
    const nightTop = [15, 23, 42]; // dark navy
    const nightBot = [9, 9, 11]; // slate deep

    let starsOpacity = 0;
    
    if (g.score < 40) {
      // Day -> Sunset Lerp
      const factor = g.score / 40;
      topColor = [
        Math.round(dayTop[0] + (duskTop[0] - dayTop[0]) * factor),
        Math.round(dayTop[1] + (duskTop[1] - dayTop[1]) * factor),
        Math.round(dayTop[2] + (duskTop[2] - dayTop[2]) * factor),
      ];
      botColor = [
        Math.round(dayBot[0] + (duskBot[0] - dayBot[0]) * factor),
        Math.round(dayBot[1] + (duskBot[1] - dayBot[1]) * factor),
        Math.round(dayBot[2] + (duskBot[2] - dayBot[2]) * factor),
      ];
    } else if (g.score < 90) {
      // Sunset -> Night lerp
      const factor = (g.score - 40) / 50;
      topColor = [
        Math.round(duskTop[0] + (nightTop[0] - duskTop[0]) * factor),
        Math.round(duskTop[1] + (nightTop[1] - duskTop[1]) * factor),
        Math.round(duskTop[2] + (nightTop[2] - duskTop[2]) * factor),
      ];
      botColor = [
        Math.round(duskBot[0] + (nightBot[0] - duskBot[0]) * factor),
        Math.round(duskBot[1] + (nightBot[1] - duskBot[1]) * factor),
        Math.round(duskBot[2] + (nightBot[2] - duskBot[2]) * factor),
      ];
      starsOpacity = factor;
    } else {
      topColor = nightTop;
      botColor = nightBot;
      starsOpacity = 1.0;
    }

    // Sky Linear Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    skyGrad.addColorStop(0, `rgb(${topColor.join(',')})`);
    
    // Add glowing sun horizon effect in dusk transitioning score bounds
    if (g.score >= 12 && g.score < 90) {
      const density = (g.score < 40) ? (g.score - 12) / 28 : 1.0 - (g.score - 40) / 50;
      skyGrad.addColorStop(0.5, `rgba(${duskMid[0]},${duskMid[1]},${duskMid[2]},${density * 0.7})`);
    }
    skyGrad.addColorStop(1, `rgb(${botColor.join(',')})`);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // B. Draw Stars twinkling in Night Mode
    if (starsOpacity > 0) {
      ctx.save();
      ctx.globalAlpha = starsOpacity;
      g.stars.forEach(star => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Add random shooting stars visuals
        if (g.score >= 90 && Math.random() < 0.0001) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(star.x, star.y);
          ctx.lineTo(star.x - 40, star.y + 15);
          ctx.stroke();
        }
      });
      ctx.restore();
    }

    // C. Draw Celestial bodies (Sun sets, Moon rises)
    // Draw Sun setting (score dependent)
    if (g.score < 75) {
      const sunY = 160 + (g.score * 4.5); // Sinks as score grows
      const sunAlpha = Math.max(0, 1.0 - (g.score / 75));
      ctx.save();
      ctx.globalAlpha = sunAlpha;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 35;
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(280, sunY, 52, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Moon rising (in Night mode)
    if (g.score >= 45) {
      const moonFactor = Math.min(1.0, (g.score - 45) / 50);
      const moonY = 320 - (moonFactor * 210); // Rises from bottom
      ctx.save();
      ctx.globalAlpha = moonFactor;
      ctx.shadowColor = '#e2e8f0';
      ctx.shadowBlur = 40;
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(950, moonY, 40, 0, Math.PI * 2);
      ctx.fill();
      
      // Moon eclipse crescent overlay cutout shadow to form crescent shape
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(935, moonY - 10, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // D. Draw Clouds (with custom parallax layering)
    g.clouds.forEach(cloud => {
      ctx.save();
      ctx.globalAlpha = cloud.opacity;
      ctx.fillStyle = '#ffffff';
      
      const cx = cloud.x;
      const cy = cloud.y;
      const cs = cloud.scale;

      ctx.beginPath();
      ctx.arc(cx, cy, 25 * cs, 0, Math.PI * 2);
      ctx.arc(cx + 25 * cs, cy - 12 * cs, 30 * cs, 0, Math.PI * 2);
      ctx.arc(cx + 60 * cs, cy, 20 * cs, 0, Math.PI * 2);
      ctx.arc(cx + 35 * cs, cy + 12 * cs, 25 * cs, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // E. Draw Scrolling Far Mountain Layer Silhouettes
    // color based on level
    let mountainFill = '#1e3a8a';
    let mountainAlpha = 0.12;
    if (g.score >= 40 && g.score < 90) {
      mountainFill = '#31105e'; // twilight purple
      mountainAlpha = 0.20;
    } else if (g.score >= 90) {
      mountainFill = '#070a13'; // obsidian space dark
      mountainAlpha = 0.40;
    }

    ctx.fillStyle = mountainFill;
    ctx.globalAlpha = mountainAlpha;
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_HEIGHT);
    ctx.lineTo(0, 480);
    // Draw sweeping range curves
    ctx.bezierCurveTo(280, 410, 420, 520, 680, 440);
    ctx.bezierCurveTo(940, 360, 1100, 500, CANVAS_WIDTH, 420);
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1.0; // reset

    // Draw close grassy hills decoration
    let hillFill = '#0f766e'; // teal
    if (g.score >= 40 && g.score < 90) hillFill = '#1e1b4b'; // twilight indigo
    else if (g.score >= 90) hillFill = '#090d16'; // dark grey

    ctx.fillStyle = hillFill;
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_HEIGHT);
    ctx.lineTo(0, 530);
    ctx.quadraticCurveTo(350, 480, 700, 540);
    ctx.quadraticCurveTo(1000, 510, CANVAS_WIDTH, 520);
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Foreground bottom ground deck (the soil deck)
    const deckGrad = ctx.createLinearGradient(0, 570, 0, CANVAS_HEIGHT);
    deckGrad.addColorStop(0, g.score >= 90 ? '#020617' : '#134e4a');
    deckGrad.addColorStop(1, g.score >= 90 ? '#090514' : '#111827');
    ctx.fillStyle = deckGrad;
    ctx.fillRect(0, 570, CANVAS_WIDTH, 105);

    // Beautiful glowing light particles on the ground (shimmer grass)
    ctx.save();
    g.stars.slice(0, 10).forEach((val, idx) => {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(idx * 120 + 20, 580 + (idx % 3) * 20, 4, 15);
    });
    ctx.restore();

    // F. Draw Dotted Predictive Trajectory Line (while dragging)
    if (g.isDragging && g.gameState === 'PLAYING' && g.ammo > 0) {
      ctx.save();
      const dx = SLINGSHOT_CENTER_X - g.dragX;
      const dy = SLINGSHOT_CENTER_Y - g.dragY;
      const dist = Math.hypot(dx, dy);

      if (dist > 15) {
        let tempX = SLINGSHOT_CENTER_X;
        let tempY = SLINGSHOT_CENTER_Y;
        let tempVx = dx * LAUNCH_FACTOR;
        let tempVy = dy * LAUNCH_FACTOR;

        // Custom path color for special active stone states
        let trajColor = 'rgba(255, 255, 255, 0.45)';
        if (g.comboStreak >= 5) {
          trajColor = 'rgba(34, 211, 238, 0.7)'; // electric cyan glow
        } else if (g.comboStreak >= 3) {
          trajColor = 'rgba(249, 115, 22, 0.7)'; // flaming orange glow
        }

        ctx.strokeStyle = trajColor;
        ctx.setLineDash([4, 10]); // neat circular dotted path
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tempX, tempY);

        // Pre-plot physics projections (30 steps)
        for (let i = 0; i < 28; i++) {
          tempX += tempVx;
          tempY += tempVy;
          tempVy += GRAVITY;
          ctx.lineTo(tempX, tempY);
        }
        ctx.stroke();

        // Draw an elegant landing target crosshair indicator at terminal end
        ctx.strokeStyle = trajColor;
        ctx.setLineDash([]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tempX, tempY, 8 + Math.sin(Date.now() * 0.01) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // G. Draw Birds (Custom beautiful vector paths with motion!)
    g.birds.forEach(bird => {
      // Flapping wings sine oscillation offset calculation
      const flapAngle = Math.sin(bird.wingAngle + bird.waveSeed) * 0.78;

      ctx.save();
      ctx.translate(bird.x, bird.y);

      // Facing Direction
      if (bird.vx < 0) {
        ctx.scale(-1, 1);
      }

      // Hit color flashing
      if (bird.hitTimer > 0) {
        bird.hitTimer--;
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 15;
      }

      // Draw Bird Model
      // 1. Tail Feathers
      const pCount = bird.type === 'phoenix' ? 42 : bird.type === 'golden' ? 24 : 15;

      ctx.fillStyle = bird.color;
      ctx.beginPath();
      ctx.moveTo(-bird.width / 3, 0);
      ctx.lineTo(-bird.width / 1.3, -bird.height / 3.2);
      ctx.lineTo(-bird.width / 1.1, 0);
      ctx.lineTo(-bird.width / 1.3, bird.height / 3.2);
      ctx.closePath();
      ctx.fill();

      // Phoenix tail streamers details
      if (bird.type === 'phoenix') {
        const bounce = Math.sin(Date.now() * 0.01 + bird.waveSeed) * 6;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-bird.width / 2.5, 0);
        ctx.quadraticCurveTo(-bird.width * 1.2, -15 + bounce, -bird.width * 1.8, -10);
        ctx.moveTo(-bird.width / 2.5, 0);
        ctx.quadraticCurveTo(-bird.width * 1.2, 15 + bounce, -bird.width * 1.8, 10);
        ctx.stroke();
      }

      // 2. Oval/Seed Body
      ctx.fillStyle = bird.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, bird.width / 2, bird.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shiny chest gradient visual
      const chestGrad = ctx.createRadialGradient(
        bird.width / 6, -bird.height / 10, 1,
        bird.width / 6, -bird.height / 10, bird.width / 2
      );
      chestGrad.addColorStop(0, '#ffffff');
      
      let chestColor = '#ff6b35';
      if (bird.type === 'hummingbird') chestColor = '#10b981'; // Green chest
      else if (bird.type === 'phoenix') chestColor = '#facc15'; // Golden core
      else if (bird.type === 'golden') chestColor = '#fef08a';

      chestGrad.addColorStop(0.35, bird.color);
      chestGrad.addColorStop(0.85, chestColor);
      ctx.fillStyle = chestGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, bird.width / 2, bird.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3. Beak (Facing Forward)
      ctx.fillStyle = bird.type === 'golden' ? '#ffff80' : '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(bird.width / 2 - 3, -bird.height / 8);
      ctx.lineTo(bird.width / 2 + (bird.type === 'hummingbird' ? 14 : 9), bird.height / 15);
      ctx.lineTo(bird.width / 2 - 3, bird.height / 4);
      ctx.closePath();
      ctx.fill();

      // 4. White animated Eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(bird.width / 4, -bird.height / 5, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(bird.width / 4 + 1.2, -bird.height / 5, 2.0, 0, Math.PI * 2);
      ctx.fill();

      // 5. Wings (Flapping from upper joint)
      ctx.save();
      ctx.translate(-bird.width * 0.08, -bird.height * 0.08);
      ctx.rotate(flapAngle);
      
      const wingGrad = ctx.createLinearGradient(0, 0, -5, -bird.height * 1.2);
      wingGrad.addColorStop(0, bird.color);
      wingGrad.addColorStop(1, bird.type === 'phoenix' ? '#ef4444' : '#ffffff');
      ctx.fillStyle = wingGrad;

      // Draw elegant wing polygon
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-bird.width * 0.2, -bird.height * 0.8, -bird.width * 0.5, -bird.height * 1.3, -bird.width * 0.1, -bird.height * 1.3);
      ctx.bezierCurveTo(bird.width * 0.2, -bird.height * 1.1, bird.width * 0.1, -bird.height * 0.4, 0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Phoenix tough crest decoration
      if (bird.type === 'phoenix') {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(4, -bird.height/2);
        ctx.quadraticCurveTo(-10, -bird.height/1.1, -22, -bird.height/2.2);
        ctx.stroke();
      }

      // Render boss-scale Health Bar for Phoenix
      if (bird.type === 'phoenix' && bird.hp < bird.maxHp) {
        ctx.save();
        ctx.scale(-1, 1); // unflip text coordinate scaling if facing left
        const barW = 55;
        const barH = 5;
        const barX = -barW / 2;
        const barY = -bird.height - 18;
        
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(barX, barY, barW, barH);
        
        const hpPercent = bird.hp / bird.maxHp;
        const rGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        rGrad.addColorStop(0, '#f87171');
        rGrad.addColorStop(1, '#ef4444');
        ctx.fillStyle = rGrad;
        ctx.fillRect(barX, barY, barW * hpPercent, barH);
        
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
        ctx.restore();
      }

      ctx.restore();
    });

    // H. Draw Particles (Smoke, explosion spark cores, feather drift)
    g.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.type === 'feather') {
        // Feather-like curved oval path
        ctx.translate(p.x, p.y);
        if (p.rotation !== undefined) {
          ctx.rotate(p.rotation);
        }
        ctx.beginPath();
        ctx.ellipse(0, 0, p.radius * 1.6, p.radius * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // draw individual central white quill line
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(-p.radius * 1.6, 0);
        ctx.lineTo(p.radius * 1.6, 0);
        ctx.stroke();
      } else if (p.type === 'smoke') {
        // Puffy cloud core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'spark') {
        // Bright particle with radial bloom
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // I. Draw Slingshot Bands, Leather Pouch Pushing & Loaded Projectile
    ctx.save();
    
    // 1. Draw solid mahogany Wood Y-Frame slingshot post
    const woodGrad = ctx.createLinearGradient(SLINGSHOT_CENTER_X - 25, SLINGSHOT_CENTER_Y - 20, SLINGSHOT_CENTER_X + 25, SLINGSHOT_CENTER_Y + 110);
    woodGrad.addColorStop(0, '#78350f'); // Dark amber wood
    woodGrad.addColorStop(0.5, '#b45309'); // Warm mahogany
    woodGrad.addColorStop(1, '#451a03'); // Near black shadow bottom
    
    ctx.strokeStyle = woodGrad;
    ctx.lineWidth = 15;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Main vertical support & split fork lines
    ctx.beginPath();
    ctx.moveTo(SLINGSHOT_CENTER_X, SLINGSHOT_CENTER_Y + 115); // Anchor base
    ctx.lineTo(SLINGSHOT_CENTER_X, SLINGSHOT_CENTER_Y + 50); // Stem fork start
    // curves out to forks
    ctx.quadraticCurveTo(SLINGSHOT_CENTER_X, SLINGSHOT_CENTER_Y + 25, SLINGSHOT_CENTER_X - 25, SLINGSHOT_CENTER_Y); // Left Fork Left point
    ctx.moveTo(SLINGSHOT_CENTER_X, SLINGSHOT_CENTER_Y + 50);
    ctx.quadraticCurveTo(SLINGSHOT_CENTER_X, SLINGSHOT_CENTER_Y + 25, SLINGSHOT_CENTER_X + 25, SLINGSHOT_CENTER_Y); // Right Fork point
    ctx.stroke();

    // Wood highlights shine details
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(SLINGSHOT_CENTER_X - 2, SLINGSHOT_CENTER_Y + 105);
    ctx.lineTo(SLINGSHOT_CENTER_X - 2, SLINGSHOT_CENTER_Y + 55);
    ctx.stroke();

    // Left Anchor Band Pin points
    const leftForkX = SLINGSHOT_CENTER_X - 22;
    const leftForkY = SLINGSHOT_CENTER_Y + 3;
    const rightForkX = SLINGSHOT_CENTER_X + 22;
    const rightForkY = SLINGSHOT_CENTER_Y + 3;

    // 2. Elastic rubber band lines & pouch drawing
    let pouchX = SLINGSHOT_CENTER_X;
    let pouchY = SLINGSHOT_CENTER_Y;

    if (g.isDragging) {
      pouchX = g.dragX;
      pouchY = g.dragY;
    } else if (g.isSpringingBack) {
      pouchX = SLINGSHOT_CENTER_X + g.springX;
      pouchY = SLINGSHOT_CENTER_Y + g.springY;
    }

    const dragDist = Math.hypot(SLINGSHOT_CENTER_X - pouchX, SLINGSHOT_CENTER_Y - pouchY);

    if (g.isDragging || g.isSpringingBack) {
      // BACK ELASTIC STRAP (painted background layering behind stone)
      ctx.strokeStyle = '#d97706'; // Amber elasticity strap
      ctx.lineWidth = Math.max(3.5, 7.5 - dragDist * 0.04);
      ctx.beginPath();
      ctx.moveTo(leftForkX, leftForkY);
      ctx.lineTo(pouchX - 8, pouchY);
      ctx.stroke();

      // Core loaded Ammo rendering
      // Choose ammo styling
      let ammoType: Stone['type'] = 'normal';
      if (g.comboStreak >= 5) ammoType = 'split';
      else if (g.comboStreak >= 3) ammoType = 'fire';

      // Draw inside pouch
      drawActiveStone(ctx, pouchX, pouchY, ammoType);

      // FRONT ELASTIC STRAP (painted overlay layer)
      ctx.strokeStyle = '#fbbf24'; // Brighter amber stretch indicator light
      ctx.lineWidth = Math.max(2.8, 6.2 - dragDist * 0.04);
      ctx.beginPath();
      ctx.moveTo(rightForkX, rightForkY);
      ctx.lineTo(pouchX + 8, pouchY);
      ctx.stroke();

      // Leather pouch pocket shell
      const angle = Math.atan2(pouchY - SLINGSHOT_CENTER_Y, pouchX - SLINGSHOT_CENTER_X);
      ctx.fillStyle = '#451a03'; // Heavy raw leather
      ctx.save();
      ctx.translate(pouchX, pouchY);
      ctx.rotate(angle + Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      // Natural resting state
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 7.5;
      ctx.beginPath();
      ctx.moveTo(leftForkX, leftForkY);
      ctx.lineTo(rightForkX, rightForkY);
      ctx.stroke();

      // Rested leather grip pouch
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.ellipse(SLINGSHOT_CENTER_X, SLINGSHOT_CENTER_Y, 15, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // J. Draw Launched Stones (with custom trail animations & glow!)
    g.stones.forEach(stone => {
      // 1. Draw trails
      if (stone.trail.length > 2) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(stone.trail[0].x, stone.trail[0].y);
        for (let i = 1; i < stone.trail.length; i++) {
          ctx.lineTo(stone.trail[i].x, stone.trail[i].y);
        }
        
        let pathColor = 'rgba(212, 212, 216, 0.45)'; // grey
        if (stone.type === 'fire') {
          pathColor = 'rgba(239, 68, 68, 0.6)';
        } else if (stone.type === 'split') {
          pathColor = 'rgba(6, 182, 212, 0.6)';
        }
        
        ctx.strokeStyle = pathColor;
        ctx.lineWidth = stone.radius * 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      }

      // 2. Draw active stone sphere
      drawActiveStone(ctx, stone.x, stone.y, stone.type);
    });

    // K. Draw Popup floating hit confirm texts (Score / combo milestones)
    g.floatingTexts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      
      if (ft.isCombo) {
        // Glowing combo callouts (gold/red)
        ctx.fillStyle = '#fdb022';
        ctx.font = '800 24px "Outfit", sans-serif';
        ctx.shadowColor = '#d97706';
        ctx.shadowBlur = 12;
      } else {
        // Normal hit numbers
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px "Outfit", sans-serif';
        ctx.shadowColor = '#0f172a';
        ctx.shadowBlur = 6;
      }
      
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y + ft.yOffset);
      ctx.restore();
    });

    // Restore shake translations
    ctx.restore();
  };

  // Dedicated Stone Rendering logic (loaded vs flight shares identical models)
  const drawActiveStone = (ctx: CanvasRenderingContext2D, x: number, y: number, type: Stone['type']) => {
    ctx.save();
    ctx.translate(x, y);

    if (type === 'fire') {
      // Fire core (Pyro meteorite!)
      const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, 14);
      grad.addColorStop(0, '#ffffcc');
      grad.addColorStop(0.3, '#f97316'); // hot orange
      grad.addColorStop(1, '#ef4444'); // dark red rim
      
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 24;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      
      // Flickering yellow flame sparks around meteorite rim
      const ms = Date.now() * 0.05;
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffff66';
      for (let idx = 0; idx < 4; idx++) {
        const rad = 15 + Math.sin(ms + idx * 1.5) * 3;
        const ang = (idx * Math.PI) / 2 + Math.cos(ms) * 0.5;
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * rad, Math.sin(ang) * rad, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === 'split') {
      // Cyber split stone (electric cyan)
      const grad = ctx.createRadialGradient(-2, -2, 1, 0, 0, 7);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#22d3ee'); // cyan electric
      grad.addColorStop(1, '#0e7490'); // cyan outline
      
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 12;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      
      // electric ring lines
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Normal gray stone
      const grad = ctx.createRadialGradient(-2, -2, 1, 0, 0, 7.5);
      grad.addColorStop(0, '#e2e8f0');
      grad.addColorStop(0.65, '#64748b'); // slate grey
      grad.addColorStop(1, '#334155'); // shadow rim
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  // Game Render Loop frame driver
  useEffect(() => {
    if (gameState !== 'PLAYING') {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set layout dimension bounds
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const gameLoop = () => {
      updatePhysics();
      drawCanvas(ctx);

      // Continuously sync critical game metrics of interest to React panels
      const g = stateRef.current;
      setScore(g.score);
      setAmmo(g.ammo);
      setComboStreak(g.comboStreak);

      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameState]);

  // Touch and Mouse controller bindings mapped to standard aspect 1200x675
  const getMouseCoord = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  // Input Events Handlers
  const handleInputStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (gameState !== 'PLAYING') return;
    const coords = getMouseCoord(e);
    if (!coords) return;

    // check proximity to slingshot rest pointer anchor to initiate dragging
    const distanceToSling = Math.hypot(coords.x - SLINGSHOT_CENTER_X, coords.y - SLINGSHOT_CENTER_Y);
    
    if (distanceToSling < 60 && stateRef.current.ammo > 0) {
      stateRef.current.isDragging = true;
      stateRef.current.dragX = coords.x;
      stateRef.current.dragY = coords.y;
      sound.playStretch();
    }
  };

  const handleInputMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const g = stateRef.current;
    if (!g.isDragging) return;

    const coords = getMouseCoord(e);
    if (!coords) return;

    // Constrain pulling/drag distance from elastic sling bounds
    const dx = coords.x - SLINGSHOT_CENTER_X;
    const dy = coords.y - SLINGSHOT_CENTER_Y;
    const dist = Math.hypot(dx, dy);

    if (dist <= MAX_DRAG) {
      g.dragX = coords.x;
      g.dragY = coords.y;
    } else {
      // Clamp coordinates to radius of MAX_DRAG
      const angle = Math.atan2(dy, dx);
      g.dragX = SLINGSHOT_CENTER_X + Math.cos(angle) * MAX_DRAG;
      g.dragY = SLINGSHOT_CENTER_Y + Math.sin(angle) * MAX_DRAG;
    }

    // click sound triggers tick feedback periodically on stretching
    if (Math.random() < 0.08) {
      sound.playStretch();
    }
  };

  const handleInputEnd = () => {
    if (stateRef.current.isDragging) {
      triggerSlingshotRelease();
    }
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    sound.setMute(!isMuted);
  };

  // Score tier progress calculations
  const getLevelName = () => {
    if (score < 40) return { name: 'Morning Sky', style: 'text-sky-400 bg-sky-950/40 border-sky-800' };
    if (score < 90) return { name: 'Sunset Twilight', style: 'text-amber-400 bg-amber-950/40 border-amber-800' };
    return { name: 'Obsidian Night', style: 'text-indigo-400 bg-indigo-950/40 border-indigo-800' };
  };

  const levelInfo = getLevelName();

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-slate-950 overflow-y-auto selection:bg-amber-500/30 selection:text-white">
      {/* Container holding Game frame AND UI elements */}
      <div className="w-full max-w-5xl flex flex-col gap-4">
        
        {/* TOP Header HUD bar */}
        <div className="w-full flex justify-between items-center px-2 py-1">
          <div className="flex items-center gap-3">
            <Layers className="text-amber-500 h-6 w-6 stroke-1.75" />
            <h1 className="text-xl font-extrabold tracking-tight text-slate-100 font-sans">
              BATUL <span className="text-amber-500 font-medium text-base">Sling Bird</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              id="btn-info"
              onClick={() => setShowInfo(true)}
              className="p-2 text-slate-400 hover:text-slate-100 transition-all rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800"
              title="Show Tutorial & Instructions"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
            <button 
              id="btn-mute"
              onClick={handleMuteToggle}
              className="p-2 text-slate-400 hover:text-slate-100 transition-all rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800"
              title={isMuted ? 'Unmute game' : 'Mute game'}
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* ACTIVE CANVAS MAIN WINDOW */}
        <div className="w-full aspect-[16/9] bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl relative select-none">
          
          <canvas 
            id="game-canvas"
            ref={canvasRef}
            onMouseDown={handleInputStart}
            onMouseMove={handleInputMove}
            onMouseUp={handleInputEnd}
            onMouseLeave={handleInputEnd}
            onTouchStart={handleInputStart}
            onTouchMove={handleInputMove}
            onTouchEnd={handleInputEnd}
            className="w-full h-full block cursor-crosshair"
          />

          {/* GAME SCREENS IMPLEMENTATION */}
          <AnimatePresence mode="wait">
            
            {/* 1. MAIN WELCOME MENU OVERLAY */}
            {gameState === 'MENU' && (
              <motion.div 
                id="menu-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-950/75 backdrop-blur-md"
              >
                <div className="text-center flex flex-col items-center gap-6 max-w-md">
                  
                  {/* Title block */}
                  <motion.div
                    initial={{ scale: 0.9, y: -20 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 100 }}
                  >
                    <span className="text-xs uppercase font-bold tracking-widest text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                      HTML5 Arcade Masterclass
                    </span>
                    <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mt-3 text-slate-100 drop-shadow-lg">
                      BATUL: SLINGSHOT
                    </h2>
                    <p className="text-slate-400 font-sans mt-2 text-sm leading-relaxed">
                      Pull-aim, steady tension, let fly the stone to defend. Ultra lightweight physics simulator.
                    </p>
                  </motion.div>

                  {/* High score badge */}
                  {highScore > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-900/40 border border-white/5 rounded-xl"
                    >
                      <Trophy className="h-4 w-4 text-amber-400" />
                      <span className="text-xs text-slate-400 font-mono">HIGH SCORE:</span>
                      <span className="text-sm font-bold text-amber-400 font-mono">{highScore}</span>
                    </motion.div>
                  )}

                  {/* Play Game Button */}
                  <motion.button
                    id="btn-play"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={initGame}
                    className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 font-bold text-white rounded-xl shadow-lg border border-amber-400/20 hover:from-amber-400 hover:to-orange-500 hover:shadow-amber-500/20 hover:shadow-2xl transition-all font-sans text-base cursor-pointer"
                  >
                    <Play className="fill-white h-5 w-5" />
                    LAUNCH GAME
                  </motion.button>

                  <p className="text-[11px] text-slate-500 font-mono">
                    Touch & drag back anywhere on the slingshot. Release to fire!
                  </p>
                </div>
              </motion.div>
            )}

            {/* 2. CORE PLAYING GLASS HUD BAR */}
            {gameState === 'PLAYING' && (
              <div 
                id="hud-playing"
                className="absolute top-4 left-4 right-4 pointer-events-none flex justify-between gap-4"
              >
                {/* Score & multiplier panel */}
                <div className="flex items-center gap-3 glass-panel px-4 py-2.5 rounded-xl">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">SCORE</span>
                    <span className="text-2xl font-black text-white font-mono leading-none tracking-tight">{score}</span>
                  </div>
                  
                  {/* Divider line */}
                  <div className="h-8 w-[1px] bg-white/10" />

                  {/* Combo state marker */}
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">COMBO</span>
                    <div className="flex items-center gap-1.5 leading-none">
                      <span className="text-xl font-bold font-mono text-amber-400">{comboStreak}x</span>
                      {comboStreak >= 3 && (
                        <motion.span 
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 1.2 }}
                        >
                          <Flame className={`h-4 w-4 ${comboStreak >= 5 ? 'text-cyan-400' : 'text-orange-500'}`} />
                        </motion.span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Level info state / Special loaded Ammo info */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold font-mono border px-3 py-1.5 rounded-lg select-none transition-all ${levelInfo.style}`}>
                    {levelInfo.name}
                  </span>
                  
                  {comboStreak >= 5 ? (
                    <span className="glass-panel-light text-cyan-400 border border-cyan-500/30 text-xs font-black font-mono px-3 py-1.5 rounded-lg flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5 fill-cyan-400" /> MULTI-SHOT LOADED
                    </span>
                  ) : comboStreak >= 3 ? (
                    <span className="glass-panel-light text-orange-400 border border-orange-500/30 text-xs font-black font-mono px-3 py-1.5 rounded-lg flex items-center gap-1">
                      <Flame className="h-3.5 w-3.5 fill-orange-400" /> PYRO STONE
                    </span>
                  ) : null}
                </div>

                {/* Stones (Ammo/Hearts lives) count panel */}
                <div className="flex items-center gap-2 glass-panel px-4 py-2 rounded-xl">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">STONES (LIFE)</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {/* Represent remaining stones as solid circles in slate */}
                      {Array.from({ length: Math.min(6, ammo) }).map((_, idx) => (
                        <div 
                          key={idx} 
                          className={`h-2.5 w-2.5 rounded-full ${comboStreak >= 5 ? 'bg-cyan-400' : comboStreak >= 3 ? 'bg-orange-500 animate-pulse' : 'bg-slate-300'}`} 
                        />
                      ))}
                      {ammo > 6 && (
                        <span className="text-[11px] font-bold text-slate-300 font-mono">+{ammo - 6}</span>
                      )}
                      
                      {ammo <= 3 && ammo > 0 && (
                        <span className="text-[11px] font-bold text-red-500 animate-pulse font-mono">LOW AMMO</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. GAME OVER OVERLAY SCREEN */}
            {gameState === 'GAMEOVER' && (
              <motion.div 
                id="gameover-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-950/85 backdrop-blur-md"
              >
                <div className="text-center flex flex-col items-center gap-6 max-w-sm">
                  
                  <motion.div
                    initial={{ scale: 0.8, rotate: -3 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 10 }}
                  >
                    <span className="text-xs uppercase font-extrabold tracking-widest text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full">
                      OUT OF STONES
                    </span>
                    <h2 className="text-3xl font-extrabold text-white mt-3">HUNT CONCLUDED</h2>
                  </motion.div>

                  {/* Results report list */}
                  <div className="w-full bg-slate-900/50 border border-white/5 p-4 rounded-xl flex flex-col gap-3 font-mono">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">FINAL SCORE:</span>
                      <span className="text-white font-bold text-sm">{score}</span>
                    </div>
                    <div className="flex justify-between text-xs border-t border-white/5 pt-2">
                      <span className="text-slate-400">BEST SCORE:</span>
                      <span className="text-amber-400 font-bold">{highScore}</span>
                    </div>
                    <div className="flex justify-between text-xs border-t border-white/5 pt-2">
                      <span className="text-slate-400">PEAK COMBO:</span>
                      <span className="text-white font-bold">{maxCombo > 0 ? `${maxCombo}x Chain` : '0'}</span>
                    </div>
                    <div className="flex justify-between text-xs border-t border-white/5 pt-2">
                      <span className="text-slate-400">ACCURACY RATIO:</span>
                      <span className="text-white font-bold">
                        {accuracy.shots > 0 ? `${Math.round((accuracy.hits / accuracy.shots) * 100)}%` : '0%'}
                      </span>
                    </div>
                  </div>

                  {/* Operational Controls buttons */}
                  <div className="flex gap-3 w-full">
                    <button
                      id="btn-retry"
                      onClick={initGame}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition-all cursor-pointer shadow-lg hover:shadow-amber-500/10"
                    >
                      <RotateCcw className="h-4 w-4 stroke-2.5" />
                      RETRY HUNT
                    </button>
                    <button
                      id="btn-menu"
                      onClick={() => setGameState('MENU')}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-slate-850 text-slate-300 font-bold text-sm rounded-xl border border-white/5 transition-all cursor-pointer"
                    >
                      MAIN MENU
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* BOTTOM TUTORIAL INFORMATIONAL OVERLAY MODAL */}
        <AnimatePresence>
          {showInfo && (
            <div 
              id="info-modal-overlay"
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.div 
                id="info-modal"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 relative shadow-2xl overflow-y-auto max-h-[90vh]"
              >
                <button 
                  id="btn-close-info"
                  onClick={() => setShowInfo(false)}
                  className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800/60"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="flex items-center gap-2.5 text-amber-500 mb-4 ">
                  <Info className="h-5 w-5 stroke-2" />
                  <h3 className="text-lg font-bold">Hunting Instructions & Mechanics</h3>
                </div>

                <div className="text-sm text-slate-300 leading-relaxed font-sans flex flex-col gap-4">
                  <div>
                    <h4 className="font-semibold text-slate-100 mb-1 font-sans text-sm uppercase text-amber-600/90 tracking-wider">How to play</h4>
                    <p className="font-sans text-xs">
                      1. Put your finger or mouse pointer inside the slingshot, and **drag back** to stretch elastics and load a stone.
                      <br/>
                      2. Observe the predicted **dotted trajectory arc**. Angle the arc perfectly to intersect incoming birds.
                      <br/>
                      3. **Release mouse/touch** to fire.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-100 mb-1.5 font-sans text-sm uppercase text-amber-600/90 tracking-wider">Physics & Ammo Recycle Rules</h4>
                    <p className="font-sans text-xs">
                      - Firing a shot costs **1 Stone**.
                      <br/>
                      - Hitting any bird harvests and **returns +1 Stone** instantly. Accurate marksmen can play forever!
                      <br/>
                      - If your stone fails to contact any birds and exits the canvas, that stone is decayed, and your **Combo streak collapses to 0**.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-100 mb-1.5 font-sans text-sm uppercase text-amber-600/90 tracking-wider">Combo Breakthrough Abilities</h4>
                    <div className="grid grid-cols-2 gap-3.5 mt-1.5">
                      <div className="p-2.5 bg-slate-950/45 rounded-xl border border-orange-500/20">
                        <span className="text-xs font-bold text-orange-400 flex items-center gap-1">
                          <Flame className="h-3 w-3 fill-orange-400" /> Combo 3x: Fire Stone
                        </span>
                        <p className="text-[11px] text-slate-400 mt-1 font-sans">
                          Unlocks fire core stone. Explodes in wide splash fields dealing high damage and igniting all neighboring birds!
                        </p>
                      </div>
                      <div className="p-2.5 bg-slate-950/45 rounded-xl border border-cyan-500/20">
                        <span className="text-xs font-bold text-cyan-400 flex items-center gap-1">
                          <Zap className="h-3 w-3 fill-cyan-400" /> Combo 5x: Multi-Shot
                        </span>
                        <p className="text-[11px] text-slate-400 mt-1 font-sans">
                          Loads three stones at once into the slingshot, letting you loose an angled sweep to clear the entire sky deck!
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-100 mb-1.5 font-sans text-sm uppercase text-amber-600/90 tracking-wider">Bird Tiers List</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between items-center p-2 bg-slate-950/20 rounded-lg">
                        <span className="text-sky-400 font-bold">Robin (Teal)</span>
                        <span className="text-slate-400">10 Pts</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-slate-950/20 rounded-lg">
                        <span className="text-pink-400 font-bold">Hummingbird (Fuchsia)</span>
                        <span className="text-slate-400">25 Pts | High wave speeds</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-slate-950/20 rounded-lg">
                        <span className="text-amber-400 font-bold">Golden Crane</span>
                        <span className="text-slate-400">40 Pts | Restores +2 Stones on hit</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-slate-950/20 rounded-lg">
                        <span className="text-orange-500 font-bold">Phoenix (Crimson Boss)</span>
                        <span className="text-slate-400">50 Pts | Needs 3 hits or Fire Core</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* BOTTOM Footer bar */}
        <div className="w-full text-center py-2">
          <p className="text-xs text-slate-500 font-mono">
            Optimized zero-latency layout • Responsive Touch & Mouse Controls • Saved in Session LocalStorage
          </p>
        </div>

      </div>
    </div>
  );
}
