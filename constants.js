// ==========================================
// CONSTANTS
// ==========================================
const TILE = 32;
const COLS = 25;
const ROWS = 19;
const W = COLS * TILE;
const H = ROWS * TILE;
const PLAYER_SPEED = 140;
const GHOST_SPEED = 90;
const FRIGHTENED_SPEED = 55;
const TUNNEL_SPEED = 80;
const PELLET_SCORE = 10;
const POWER_PELLET_SCORE = 50;
const GHOST_EAT_SCORE = [200, 400, 800, 1600];

const DIR = {
    LEFT:  { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
    UP:    { x: 0, y: -1 },
    DOWN:  { x: 0, y: 1 },
    NONE:  { x: 0, y: 0 }
};

const KEY = {
    LEFT:  'LEFT', RIGHT: 'RIGHT', UP: 'UP', DOWN: 'DOWN'
};

// ==========================================
// AUDIO
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let muted = false;

const SFX = {
    _t(freq, type, dur, vol = 0.08, slide = null) {
        if (muted || audioCtx.state === 'suspended') return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (slide) osc.frequency.exponentialRampToValueAtTime(slide, now + dur);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + dur);
    },
    chomp: () => SFX._t(480, 'triangle', 0.05, 0.05, 580),
    powerup: () => { SFX._t(200, 'square', 0.35, 0.07, 900); },
    ghostEat: () => SFX._t(700, 'square', 0.12, 0.07, 1500),
    death: () => SFX._t(250, 'sawtooth', 0.7, 0.12, 25),
    fruit: () => SFX._t(1000, 'sine', 0.15, 0.05, 700),
    levelUp: () => {
        SFX._t(400, 'sine', 0.1, 0.07);
        setTimeout(() => SFX._t(600, 'sine', 0.1, 0.07), 100);
        setTimeout(() => SFX._t(800, 'sine', 0.12, 0.07), 200);
    },
    extraLife: () => {
        SFX._t(500, 'sine', 0.1, 0.05);
        setTimeout(() => SFX._t(700, 'sine', 0.12, 0.05), 120);
    }
};

// ==========================================
// MAZE DATA
// ==========================================
const MAZE_LAYOUT = [
    "XXXXXXXXXXXXXXXXXXXXXXXXX",
    "X. . . . . .X. . . . . .X",
    "X XXXXX XXXXXXXXX XXXXX X",
    "X.X   X X. . . .X X   X.X",
    "X.XXXXX X.XXXXX.X XXXXX.X",
    "X. . . . . . . . . . . .X",
    "X XXXXX.X.XXXXX.X.XXXXX X",
    "X. . . .X. .X. .X. . . .X",
    "XXXXXXX.XXXXX.XXXXX.XXXXX",
    "X . . . . . . . . . . . X",
    "XXXXXXX.X.XXXXX.X.XXXXXXX",
    "X. . . .X. . . .X. . . .X",
    "X.XXXXX XXXXXXXXX XXXXX.X",
    "X. . .X. . .X. . .X. . .X",
    "XXX.X.XXXXX X XXXXX.X.X.X",
    "X. .X. . . . . . . .X. .X",
    "X.XXXXXXXXX X XXXXXXXXX.X",
    "X. . . . . .X. . . . . .X",
    "XXXXXXXXXXXXXXXXXXXXXXXXX"
];

const POWER_PELLET_POSITIONS = [
    { x: 1, y: 1 }, { x: 23, y: 1 },
    { x: 1, y: 17 }, { x: 23, y: 17 }
];

const GHOST_SPAWN = [
    { x: 1, y: 1 },
    { x: 23, y: 1 },
    { x: 3, y: 17 },
    { x: 21, y: 17 }
];

const GHOST_COLORS = [0xf43f5e, 0xfb923c, 0xa78bfa, 0x2dd4bf];
const GHOST_NAMES = ['BLINKY', 'PINKY', 'INKY', 'CLYDE'];
const SCATTER_TARGETS = [
    { x: 22, y: 1 },  // Blinky: top-right corner
    { x: 2, y: 1 },   // Pinky: top-left corner
    { x: 22, y: 17 }, // Inky: bottom-right corner
    { x: 2, y: 17 }   // Clyde: bottom-left corner
];

const FRUIT_TABLE = [
    { score: 0,   name: 'CHERRY',  color: 0xf43f5e, pts: 100 },
    { score: 100, name: 'STRAWBERRY', color: 0xfb923c, pts: 300 },
    { score: 300, name: 'ORANGE',  color: 0xf97316, pts: 500 },
    { score: 500, name: 'APPLE',   color: 0x4ade80, pts: 700 },
    { score: 700, name: 'GRAPES',  color: 0xa78bfa, pts: 1000 },
    { score: 1000,name: 'GALAXIAN',color: 0x38bdf8, pts: 2000 },
    { score: 2000,name: 'BELL',    color: 0xfde047, pts: 3000 },
    { score: 3000,name: 'KEY',     color: 0xf43f5e, pts: 5000 }
];
