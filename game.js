// ==========================================
// SCENE: BOOT
// ==========================================
class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }

    create() {
        const cx = W / 2;
        const cy = H / 2;

        const title = this.add.text(cx, cy - 50, 'NEON PAC-MAN', {
            fontSize: '48px', fill: '#0ea5e9', fontStyle: 'bold'
        }).setOrigin(0.5);
        title.setShadow(0, 0, '#38bdf8', 15, true, true);

        const blink = this.add.text(cx, cy + 20, 'CLICK TO START', {
            fontSize: '22px', fill: '#fff'
        }).setOrigin(0.5);

        this.tweens.add({
            targets: blink, alpha: 0, duration: 800, yoyo: true, repeat: -1
        });

        const hs = localStorage.getItem('neonPacmanHighScore') || 0;
        this.add.text(cx, cy + 80, `HIGH SCORE: ${hs}`, {
            fontSize: '18px', fill: '#fde047'
        }).setOrigin(0.5);

        this.add.text(cx, cy + 120, 'ARROW KEYS TO MOVE | ESC PAUSE | M MUTE', {
            fontSize: '12px', fill: '#64748b'
        }).setOrigin(0.5);

        this.input.on('pointerdown', () => {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            this.scene.start('GameScene');
        });
    }
}

// ==========================================
// SCENE: GAME
// ==========================================
class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    init() {
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.isGameOver = false;
        this.isPaused = false;
        this.ghostsEatenCombo = 0;
        this.frightenedTimer = 0;
        this.modeTimer = 0;
        this.isChaseMode = true;
        this.fruitActive = false;
        this.fruitSprite = null;
        this.fruitTimer = 0;
        this.nextFruitScore = 0;
        this.lastFruitIndex = -1;
        this.transitioning = false;

        this.player = null;
        this.currentDir = DIR.RIGHT;
        this.nextDir = DIR.RIGHT;
        this.ghostList = [];

        this.mapGrid = [];
        this.flowField = [];
        this.pelletCount = 0;
        this.pelletsEaten = 0;
        this.totalPellets = 0;

        this.debugMode = false;
        this._debugGfx = null;
        this._debugInfo = null;
        this._debugFF = null;

        this.invincibleTimer = 0;
    }

    create() {
        this.init();

        this.walls = this.physics.add.staticGroup();
        this.pellets = this.physics.add.group();
        this.powerPellets = this.physics.add.group();
        this.ghosts = this.physics.add.group();

        this.generateTextures();
        this.createMaze();
        this.createPlayer();
        this.createHUD();
        this.createTouchControls();
        this.setupInput();

        this.generateGhostTextures();
        this.createGhosts();

        // 3s invincibility at game start
        this.invincibleTimer = 3000;

        this.physics.add.overlap(this.player, this.pellets, this.eatPellet, null, this);
        this.physics.add.overlap(this.player, this.powerPellets, this.eatPowerPellet, null, this);
        this.physics.add.overlap(this.player, this.ghosts, this.hitGhost, null, this);
    }

    // ---- TEXTURES ----
    generateTextures() {
        const g = this.add.graphics();

        // Pac-Man
        g.fillStyle(0xfde047, 1);
        g.beginPath();
        g.arc(16, 16, 12, Phaser.Math.DegToRad(25), Phaser.Math.DegToRad(335), false);
        g.lineTo(16, 16);
        g.fillPath();
        g.generateTexture('pacman', 32, 32);
        g.clear();

        // Pellet
        g.fillStyle(0xfde047, 1);
        g.fillCircle(4, 4, 3);
        g.generateTexture('pellet', 8, 8);
        g.clear();

        // Power pellet
        g.fillStyle(0xfde047, 1);
        g.fillCircle(8, 8, 6);
        g.lineStyle(2, 0xfde047, 0.3);
        g.strokeCircle(8, 8, 10);
        g.generateTexture('powerPellet', 16, 16);
        g.clear();

        // Particle
        g.fillStyle(0xfde047, 1);
        g.fillCircle(4, 4, 4);
        g.generateTexture('particle', 8, 8);
        g.clear();

        // Fruit graphic (simple circle with outline)
        g.fillStyle(0x4ade80, 1);
        g.fillCircle(10, 10, 8);
        g.lineStyle(2, 0xffffff, 0.5);
        g.strokeCircle(10, 10, 8);
        g.generateTexture('fruit', 20, 20);
        g.destroy();
    }

    generateGhostTextures() {
        GHOST_COLORS.forEach((color, i) => {
            const g = this.add.graphics();
            g.fillStyle(color, 1);
            g.beginPath();
            g.arc(16, 14, 10, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(0), false);
            g.lineTo(26, 26);
            g.lineTo(23, 22);
            g.lineTo(20, 26);
            g.lineTo(16, 22);
            g.lineTo(12, 26);
            g.lineTo(9, 22);
            g.lineTo(6, 26);
            g.lineTo(6, 14);
            g.fillPath();

            g.fillStyle(0xffffff, 1);
            g.fillCircle(11, 12, 3);
            g.fillCircle(21, 12, 3);
            g.fillStyle(0x020617, 1);
            g.fillCircle(11, 12, 1);
            g.fillCircle(21, 12, 1);
            g.generateTexture(`ghost_${i}`, 32, 32);
            g.destroy();
        });

        // Frightened ghost
        const g = this.add.graphics();
        g.fillStyle(0x3b82f6, 1);
        g.beginPath();
        g.arc(16, 14, 10, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(0), false);
        g.lineTo(26, 26);
        g.lineTo(23, 22);
        g.lineTo(20, 26);
        g.lineTo(16, 22);
        g.lineTo(12, 26);
        g.lineTo(9, 22);
        g.lineTo(6, 26);
        g.lineTo(6, 14);
        g.fillPath();
        g.fillStyle(0xffffff, 1);
        g.fillCircle(8, 12, 2);
        g.fillCircle(22, 12, 2);
        g.generateTexture('ghost_frightened', 32, 32);

        // White flash before frightened ends
        g.clear();
        g.fillStyle(0xffffff, 1);
        g.beginPath();
        g.arc(16, 14, 10, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(0), false);
        g.lineTo(26, 26);
        g.lineTo(23, 22);
        g.lineTo(20, 26);
        g.lineTo(16, 22);
        g.lineTo(12, 26);
        g.lineTo(9, 22);
        g.lineTo(6, 26);
        g.lineTo(6, 14);
        g.fillPath();
        g.generateTexture('ghost_scared', 32, 32);
        g.destroy();
    }

    // ---- MAZE ----
    createMaze() {
        this.tileSize = TILE;
        this.layout = MAZE_LAYOUT;

        // Clean up previous wall graphics if any
        if (this.wallGfx) this.wallGfx.destroy();

        this.mapGrid = [];
        this.layout.forEach((row, y) => {
            this.mapGrid[y] = [];
            for (let x = 0; x < row.length; x++) {
                this.mapGrid[y][x] = (row[x] === 'X') ? 1 : 0;
            }
        });

        // Neon glow walls
        this.wallGfx = this.add.graphics();
        const glowLayers = [
            { width: 8, alpha: 0.08 },
            { width: 4, alpha: 0.25 },
            { width: 2, alpha: 0.7 }
        ];

        glowLayers.forEach(layer => {
            this.wallGfx.lineStyle(layer.width, 0x0ea5e9, layer.alpha);
            this.layout.forEach((row, y) => {
                for (let x = 0; x < row.length; x++) {
                    if (row[x] === 'X') {
                        this.wallGfx.strokeRect(x * TILE, y * TILE, TILE, TILE);
                    }
                }
            });
        });

        this.wallGfx.fillStyle(0x0f172a, 1);
        this.layout.forEach((row, y) => {
            for (let x = 0; x < row.length; x++) {
                if (row[x] === 'X') {
                    this.wallGfx.fillRect(x * TILE, y * TILE, TILE, TILE);
                    const wall = this.walls.create(x * TILE + TILE / 2, y * TILE + TILE / 2, null);
                    wall.setSize(TILE, TILE);
                    wall.visible = false;
                } else if (row[x] === '.') {
                    // Check if this is a power pellet position
                    const isPower = POWER_PELLET_POSITIONS.some(p => p.x === x && p.y === y);
                    if (isPower) {
                        this.createPowerPellet(x * TILE + TILE / 2, y * TILE + TILE / 2);
                    } else {
                        this.createPellet(x * TILE + TILE / 2, y * TILE + TILE / 2);
                    }
                }
            }
        });

        this.totalPellets = this.pelletCount;
    }

    createPellet(x, y) {
        const p = this.pellets.create(x, y, 'pellet');
        p.setSize(8, 8);
        this.pelletCount++;
    }

    createPowerPellet(x, y) {
        const p = this.powerPellets.create(x, y, 'powerPellet');
        p.setSize(14, 14);
        this.pelletCount++;

        // Pulse animation
        this.tweens.add({
            targets: p,
            scaleX: { from: 0.6, to: 1.2 },
            scaleY: { from: 0.6, to: 1.2 },
            duration: 500,
            yoyo: true,
            repeat: -1
        });
    }

    // ---- PLAYER ----
    createPlayer() {
        const spawnX = 12 * TILE + TILE / 2;
        const spawnY = 9 * TILE + TILE / 2;
        this.player = this.physics.add.sprite(spawnX, spawnY, 'pacman');
        this.player.setCollideWorldBounds(true);
        this.player.setCircle(10, 6, 6);
        this.player.setDepth(5);
        this.currentDir = DIR.RIGHT;
        this.nextDir = DIR.RIGHT;
    }

    // ---- GHOSTS ----
    createGhosts() {
        // Safety: find nearest walkable tile if spawn is in a wall
        const warpWalkable = (tx, ty) => {
            if (this.isWalkable(tx, ty)) return { x: tx, y: ty };
            for (let r = 1; r < 6; r++) {
                for (let dy = -r; dy <= r; dy++) {
                    for (let dx = -r; dx <= r; dx++) {
                        if (Math.abs(dx) === r || Math.abs(dy) === r) {
                            if (this.isWalkable(tx + dx, ty + dy))
                                return { x: tx + dx, y: ty + dy };
                        }
                    }
                }
            }
            return { x: 12, y: 9 }; // fallback: player spawn
        };

        GHOST_SPAWN.forEach((pos, i) => {
            const safe = warpWalkable(pos.x, pos.y);
            const px = safe.x * TILE + TILE / 2;
            const py = safe.y * TILE + TILE / 2;
            const ghost = this.ghosts.create(px, py, `ghost_${i}`);
            ghost.setCollideWorldBounds(true);
            ghost.setCircle(10, 6, 6);
            ghost.setDepth(4);
            ghost.ghostIndex = i;
            ghost.ghostName = GHOST_NAMES[i];
            ghost.isFrightened = false;
            ghost.isEaten = false;
            ghost.baseSpeed = GHOST_SPEED + i * 5;
            ghost.scatterTarget = SCATTER_TARGETS[i];
            ghost.personality = i;
            ghost.currentDir = DIR.UP;
            this.ghostList.push(ghost);
        });
    }

    // ---- HUD ----
    createHUD() {
        this.scoreText = this.add.text(16, 8, 'SCORE: 0', {
            fontSize: '18px', fill: '#fff', fontStyle: 'bold'
        }).setDepth(10);

        this.highScoreText = this.add.text(W / 2, 8, '', {
            fontSize: '14px', fill: '#fde047'
        }).setOrigin(0.5, 0).setDepth(10);
        const hs = localStorage.getItem('neonPacmanHighScore') || 0;
        if (hs > 0) this.highScoreText.setText(`HIGH: ${hs}`);

        this.livesText = this.add.text(W - 16, 8, '', {
            fontSize: '18px', fill: '#fde047'
        }).setOrigin(1, 0).setDepth(10);
        this.updateLivesDisplay();

        this.levelText = this.add.text(16, H - 20, 'LEVEL 1', {
            fontSize: '12px', fill: '#64748b'
        }).setDepth(10);

        this.pauseOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x020617, 0.7).setDepth(50).setVisible(false);
        this.pauseText = this.add.text(W / 2, H / 2, 'PAUSED\n\nESC TO RESUME', {
            fontSize: '32px', fill: '#0ea5e9', align: 'center'
        }).setOrigin(0.5).setDepth(51).setVisible(false);
    }

    updateLivesDisplay() {
        let s = '';
        for (let i = 0; i < this.lives - 1; i++) s += '\u25C9 ';
        this.livesText.setText(s.trim());
    }

    createTouchControls() {
        const btnStyle = {
            fontSize: '28px', fill: '#0ea5e9', backgroundColor: 'rgba(14,165,233,0.15)',
            padding: { x: 12, y: 8 }, fixedWidth: 56, fixedHeight: 56, align: 'center'
        };

        const btnUp = this.add.text(W / 2, H - 90, '\u25B2', btnStyle).setOrigin(0.5).setDepth(20).setInteractive();
        const btnDown = this.add.text(W / 2, H - 26, '\u25BC', btnStyle).setOrigin(0.5).setDepth(20).setInteractive();
        const btnLeft = this.add.text(W / 2 - 68, H - 58, '\u25C0', btnStyle).setOrigin(0.5).setDepth(20).setInteractive();
        const btnRight = this.add.text(W / 2 + 68, H - 58, '\u25B6', btnStyle).setOrigin(0.5).setDepth(20).setInteractive();

        const setDir = (d) => { this.nextDir = d; };
        btnUp.on('pointerdown', () => setDir(DIR.UP));
        btnDown.on('pointerdown', () => setDir(DIR.DOWN));
        btnLeft.on('pointerdown', () => setDir(DIR.LEFT));
        btnRight.on('pointerdown', () => setDir(DIR.RIGHT));
    }

    // ---- INPUT ----
    setupInput() {
        const kb = this.input.keyboard;
        kb.addCapture([
            Phaser.Input.Keyboard.KeyCodes.LEFT,
            Phaser.Input.Keyboard.KeyCodes.RIGHT,
            Phaser.Input.Keyboard.KeyCodes.UP,
            Phaser.Input.Keyboard.KeyCodes.DOWN,
            Phaser.Input.Keyboard.KeyCodes.W,
            Phaser.Input.Keyboard.KeyCodes.A,
            Phaser.Input.Keyboard.KeyCodes.S,
            Phaser.Input.Keyboard.KeyCodes.D,
            Phaser.Input.Keyboard.KeyCodes.F1
        ]);

        this.keyLeft = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
        this.keyRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
        this.keyUp = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
        this.keyDown = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
        this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);

        kb.on('keydown-ESC', () => {
            if (!this.isGameOver && !this.transitioning) this.togglePause();
        });

        kb.on('keydown-F1', () => {
            this.debugMode = !this.debugMode;
            if (!this.debugMode) {
                if (this._debugGfx) this._debugGfx.clear();
                if (this._debugInfo) this._debugInfo.setText('');
            }
        });

        kb.on('keydown-M', () => {
            muted = !muted;
            const msg = muted ? 'MUTED' : 'SOUND ON';
            const txt = this.add.text(W / 2, H - 40, msg, {
                fontSize: '14px', fill: muted ? '#f43f5e' : '#4ade80'
            }).setOrigin(0.5).setDepth(60);
            this.tweens.add({
                targets: txt, alpha: 0, y: txt.y - 20, duration: 1000, delay: 500,
                onComplete: () => txt.destroy()
            });
        });
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.physics.pause();
            this.pauseOverlay.setVisible(true);
            this.pauseText.setVisible(true);
        } else {
            this.physics.resume();
            this.pauseOverlay.setVisible(false);
            this.pauseText.setVisible(false);
        }
    }

    // ---- TILE HELPERS ----
    tileCenter(tx, ty) { return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }; }
    toTile(px, py) { return { x: Math.floor(px / TILE), y: Math.floor(py / TILE) }; }
    isWalkable(tx, ty) { return ty >= 0 && ty < ROWS && tx >= 0 && tx < COLS && this.mapGrid[ty][tx] === 0; }

    // ---- PLAYER MOVEMENT (CLASSIC STYLE) ----
    updatePlayerMovement() {
        const p = this.player;
        const step = Math.max(PLAYER_SPEED * (this.game.loop.delta / 1000), 1);
        const ct = this.toTile(p.x, p.y);
        const cc = this.tileCenter(ct.x, ct.y);

        // Snap to center only when entering a NEW tile — guarantees hitting every center
        if (!p._lastTile) p._lastTile = { x: ct.x, y: ct.y };
        if (p._lastTile.x !== ct.x || p._lastTile.y !== ct.y) {
            p.x = cc.x;
            p.y = cc.y;
            p._lastTile.x = ct.x;
            p._lastTile.y = ct.y;
        }
        const atCenter = Math.abs(p.x - cc.x) < 0.001 && Math.abs(p.y - cc.y) < 0.001;

        // Read input (arrows + WASD)
        if (this.keyLeft.isDown || this.keyA.isDown) this.nextDir = DIR.LEFT;
        else if (this.keyRight.isDown || this.keyD.isDown) this.nextDir = DIR.RIGHT;
        else if (this.keyUp.isDown || this.keyW.isDown) this.nextDir = DIR.UP;
        else if (this.keyDown.isDown || this.keyS.isDown) this.nextDir = DIR.DOWN;

        // Immediate reverse — only if the reverse tile is walkable
        if (this.nextDir &&
            this.nextDir.x === -this.currentDir.x && this.nextDir.y === -this.currentDir.y &&
            this.isWalkable(ct.x + this.nextDir.x, ct.y + this.nextDir.y)) {
            this.currentDir = this.nextDir;
            this.nextDir = null;
            p.x += this.currentDir.x * step;
            p.y += this.currentDir.y * step;
            this._setPlayerAngle();
            return;
        }

        // At tile center → evaluate turn
        if (atCenter) {
            if (this.nextDir && this.isWalkable(ct.x + this.nextDir.x, ct.y + this.nextDir.y)) {
                this.currentDir = this.nextDir;
                this.nextDir = null;
            }
            if (this.isWalkable(ct.x + this.currentDir.x, ct.y + this.currentDir.y)) {
                p.x += this.currentDir.x * step;
                p.y += this.currentDir.y * step;
            }
        } else {
            // Between tiles → keep current direction
            const newX = p.x + this.currentDir.x * step;
            const newY = p.y + this.currentDir.y * step;
            const nt = this.toTile(newX, newY);
            if (this.isWalkable(nt.x, nt.y)) {
                p.x = newX;
                p.y = newY;
            } else {
                // Hit a wall → snap to nearest tile center
                const snap = this.tileCenter(ct.x, ct.y);
                p.x = snap.x;
                p.y = snap.y;
            }
        }

        this._setPlayerAngle();
    }

    _setPlayerAngle() {
        const p = this.player;
        if (this.currentDir === DIR.LEFT) p.setAngle(180);
        else if (this.currentDir === DIR.RIGHT) p.setAngle(0);
        else if (this.currentDir === DIR.UP) p.setAngle(-90);
        else if (this.currentDir === DIR.DOWN) p.setAngle(90);
    }

    // ---- FLOW FIELD (BFS from player outward) ----
    computeFlowField(fromTileX, fromTileY) {
        const ff = Array(ROWS).fill().map(() => Array(COLS).fill(null));
        if (fromTileY < 0 || fromTileY >= ROWS || fromTileX < 0 || fromTileX >= COLS ||
            this.mapGrid[fromTileY][fromTileX] === 1) return ff;

        const queue = [{ x: fromTileX, y: fromTileY, dist: 0 }];
        ff[fromTileY][fromTileX] = { dx: 0, dy: 0, dist: 0 };
        const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
        let head = 0;
        while (head < queue.length) {
            const curr = queue[head++];
            for (const d of dirs) {
                const nx = curr.x + d.dx, ny = curr.y + d.dy;
                if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS &&
                    this.mapGrid[ny][nx] === 0 && !ff[ny][nx]) {
                    ff[ny][nx] = { dx: -d.dx, dy: -d.dy, dist: curr.dist + 1 };
                    queue.push({ x: nx, y: ny, dist: curr.dist + 1 });
                }
            }
        }
        return ff;
    }

    moveTileSteered(sprite, targetDir, speed) {
        const step = Math.max(speed * (this.game.loop.delta / 1000), 1);
        const ct = this.toTile(sprite.x, sprite.y);
        const cc = this.tileCenter(ct.x, ct.y);

        if (!sprite._lastTile) sprite._lastTile = { x: ct.x, y: ct.y };
        if (sprite._lastTile.x !== ct.x || sprite._lastTile.y !== ct.y) {
            sprite.x = cc.x;
            sprite.y = cc.y;
            sprite._lastTile.x = ct.x;
            sprite._lastTile.y = ct.y;
        }
        const atCenter = Math.abs(sprite.x - cc.x) < 0.001 && Math.abs(sprite.y - cc.y) < 0.001;

        if (atCenter) {
            if (this.isWalkable(ct.x + targetDir.x, ct.y + targetDir.y)) {
                sprite.currentDir = { x: targetDir.x, y: targetDir.y };
            }
            if (this.isWalkable(ct.x + sprite.currentDir.x, ct.y + sprite.currentDir.y)) {
                sprite.x += sprite.currentDir.x * step;
                sprite.y += sprite.currentDir.y * step;
            }
        } else {
            const newX = sprite.x + sprite.currentDir.x * step;
            const newY = sprite.y + sprite.currentDir.y * step;
            const nt = this.toTile(newX, newY);
            if (this.isWalkable(nt.x, nt.y)) {
                sprite.x = newX;
                sprite.y = newY;
            } else {
                const snap = this.tileCenter(ct.x, ct.y);
                sprite.x = snap.x;
                sprite.y = snap.y;
            }
        }
    }

    getFlowDirAt(ff, tx, ty) {
        if (!ff || !ff[ty] || !ff[ty][tx]) return null;
        return ff[ty][tx];
    }

    // ---- GHOST AI ----
    updateGhosts() {
        const mode = this.isChaseMode ? 'chase' : 'scatter';
        const isFrightened = this.frightenedTimer > 0;

        // Compute chase flow field once from player position
        const pTileX = Math.floor(this.player.x / TILE);
        const pTileY = Math.floor(this.player.y / TILE);
        const chaseFF = this.computeFlowField(pTileX, pTileY);
        if (this.debugMode) this._debugFF = chaseFF;

        this.ghostList.forEach(ghost => {
            if (ghost.isEaten) return;

            const gx = Math.floor(ghost.x / TILE);
            const gy = Math.floor(ghost.y / TILE);
            const speed = ghost.baseSpeed + (this.level - 1) * 5;

            if (isFrightened) {
                ghost.setTexture('ghost_frightened');
                if (this.frightenedTimer < 2000) {
                    if (Math.floor(this.frightenedTimer / 200) % 2 === 0) {
                        ghost.setTexture('ghost_scared');
                    }
                }
                this.moveGhostFrightened(ghost);
                return;
            }

            ghost.setTexture(`ghost_${ghost.ghostIndex}`);

            if (mode === 'chase') {
                // Determine flow direction based on ghost personality
                let targetDir = null;

                switch (ghost.ghostIndex) {
                    case 0: // Blinky: follow flow directly
                        targetDir = this.getFlowDirAt(chaseFF, gx, gy);
                        break;
                    case 1: { // Pinky: target 4 tiles ahead
                        const aheadX = pTileX + this.currentDir.x * 4;
                        const aheadY = pTileY + this.currentDir.y * 4;
                        const cX = Phaser.Math.Clamp(aheadX, 0, COLS - 1);
                        const cY = Phaser.Math.Clamp(aheadY, 0, ROWS - 1);
                        if (this.mapGrid[cY][cX] === 0) {
                            const pinkyFF = this.computeFlowField(cX, cY);
                            targetDir = this.getFlowDirAt(pinkyFF, gx, gy);
                        } else {
                            targetDir = this.getFlowDirAt(chaseFF, gx, gy);
                        }
                        break;
                    }
                    case 2: { // Inky: chase toward player (like Blinky)
                        targetDir = this.getFlowDirAt(chaseFF, gx, gy);
                        break;
                    }
                    case 3: { // Clyde: chase if far, scatter if close
                        const dist = Phaser.Math.Distance.Between(
                            ghost.x, ghost.y, this.player.x, this.player.y
                        );
                        if (dist > 8 * TILE) {
                            targetDir = this.getFlowDirAt(chaseFF, gx, gy);
                        } else {
                            const clydeFF = this.computeFlowField(ghost.scatterTarget.x, ghost.scatterTarget.y);
                            targetDir = this.getFlowDirAt(clydeFF, gx, gy);
                        }
                        break;
                    }
                }

                if (targetDir && (targetDir.dx !== 0 || targetDir.dy !== 0)) {
                    this.moveTileSteered(ghost,
                        { x: targetDir.dx, y: targetDir.dy },
                        speed
                    );
                } else {
                    this.moveTileSteered(ghost, ghost.currentDir, speed);
                }
            } else {
                // Scatter: use flow field toward scatter target
                const scatterFF = this.computeFlowField(ghost.scatterTarget.x, ghost.scatterTarget.y);
                const targetDir = this.getFlowDirAt(scatterFF, gx, gy);
                const scatterSpeed = ghost.baseSpeed * 0.7 + (this.level - 1) * 3;
                if (targetDir && (targetDir.dx !== 0 || targetDir.dy !== 0)) {
                    this.moveTileSteered(ghost,
                        { x: targetDir.dx, y: targetDir.dy },
                        scatterSpeed
                    );
                } else {
                    this.moveTileSteered(ghost, ghost.currentDir, scatterSpeed);
                }
            }
        });
    }

    moveGhostFrightened(ghost) {
        const step = Math.max(FRIGHTENED_SPEED * (this.game.loop.delta / 1000), 1);
        const ct = this.toTile(ghost.x, ghost.y);
        const cc = this.tileCenter(ct.x, ct.y);

        if (!ghost._lastTile) ghost._lastTile = { x: ct.x, y: ct.y };
        if (ghost._lastTile.x !== ct.x || ghost._lastTile.y !== ct.y) {
            ghost.x = cc.x;
            ghost.y = cc.y;
            ghost._lastTile.x = ct.x;
            ghost._lastTile.y = ct.y;
        }
        const atCenter = Math.abs(ghost.x - cc.x) < 0.001 && Math.abs(ghost.y - cc.y) < 0.001;

        if (atCenter) {
            const avail = [];
            const reverse = { x: -ghost.currentDir.x, y: -ghost.currentDir.y };
            [DIR.LEFT, DIR.RIGHT, DIR.UP, DIR.DOWN].forEach(d => {
                if (d.x === reverse.x && d.y === reverse.y) return;
                if (this.isWalkable(ct.x + d.x, ct.y + d.y)) avail.push(d);
            });
            if (avail.length > 0) {
                ghost.currentDir = avail[Math.floor(Math.random() * avail.length)];
            }
            if (this.isWalkable(ct.x + ghost.currentDir.x, ct.y + ghost.currentDir.y)) {
                ghost.x += ghost.currentDir.x * step;
                ghost.y += ghost.currentDir.y * step;
            }
        } else {
            const newX = ghost.x + ghost.currentDir.x * step;
            const newY = ghost.y + ghost.currentDir.y * step;
            const nt = this.toTile(newX, newY);
            if (this.isWalkable(nt.x, nt.y)) {
                ghost.x = newX;
                ghost.y = newY;
            } else {
                const snap = this.tileCenter(ct.x, ct.y);
                ghost.x = snap.x;
                ghost.y = snap.y;
            }
        }
    }

    // ---- PELLETS ----
    eatPellet(player, pellet) {
        pellet.destroy();
        this.score += PELLET_SCORE;
        this.pelletsEaten++;
        this.scoreText.setText('SCORE: ' + this.score);
        SFX.chomp();

        // Scale pop
        this.tweens.add({
            targets: this.player,
            scaleX: 1.25, scaleY: 1.25,
            duration: 50, yoyo: true
        });

        this.checkFruitSpawn();
        this.checkWin();
    }

    eatPowerPellet(player, pp) {
        pp.destroy();
        this.score += POWER_PELLET_SCORE;
        this.pelletsEaten++;
        this.scoreText.setText('SCORE: ' + this.score);
        SFX.powerup();

        // Scale pop
        this.tweens.add({
            targets: this.player,
            scaleX: 1.3, scaleY: 1.3,
            duration: 50, yoyo: true
        });

        // Activate frightened mode
        this.frightenedTimer = 8000 + this.ghostsEatenCombo * 1000;
        this.ghostsEatenCombo = 0;

        // Reverse ghosts
        this.ghostList.forEach(g => {
            if (!g.isEaten) {
                g.currentDir.x *= -1;
                g.currentDir.y *= -1;
                g.isFrightened = true;
            }
        });

        this.checkFruitSpawn();
        this.checkWin();
    }

    // ---- FRUIT ----
    checkFruitSpawn() {
        let idx = -1;
        for (let i = FRUIT_TABLE.length - 1; i >= 0; i--) {
            if (this.score >= FRUIT_TABLE[i].score) { idx = i; break; }
        }
        if (idx > this.lastFruitIndex) {
            this.lastFruitIndex = idx;
            this.spawnFruit(FRUIT_TABLE[idx]);
        }
    }

    spawnFruit(data) {
        if (this.fruitActive) return;
        this.fruitActive = true;

        const fx = 13 * TILE + TILE / 2;
        const fy = 9 * TILE + TILE / 2;
        this.fruitSprite = this.add.sprite(fx, fy, 'fruit');
        this.fruitSprite.setTint(data.color);
        this.fruitSprite.setDepth(6);
        this.fruitSprite.score = data.pts;

        // Pulsing effect
        this.tweens.add({
            targets: this.fruitSprite,
            scaleX: 1.2, scaleY: 1.2,
            duration: 400, yoyo: true, repeat: -1
        });

        // Remove after 10s
        this.fruitTimer = this.time.delayedCall(10000, () => {
            if (this.fruitSprite) {
                this.fruitSprite.destroy();
                this.fruitActive = false;
            }
        });

        // Overlap check with player
        this.physics.add.overlap(this.player, this.fruitSprite, () => {
            if (!this.fruitActive) return;
            this.score += this.fruitSprite.score;
            this.scoreText.setText('SCORE: ' + this.score);
            SFX.fruit();
            const txt = this.add.text(this.fruitSprite.x, this.fruitSprite.y - 10,
                `+${this.fruitSprite.score}`, {
                    fontSize: '14px', fill: '#4ade80', fontStyle: 'bold'
                }).setOrigin(0.5).setDepth(20);
            this.tweens.add({
                targets: txt, y: txt.y - 30, alpha: 0,
                duration: 800, onComplete: () => txt.destroy()
            });
            this.fruitSprite.destroy();
            this.fruitActive = false;
            if (this.fruitTimer) this.fruitTimer.remove();
        }, null, this);
    }

    // ---- GHOST HIT ----
    hitGhost(player, ghost) {
        if (this.isGameOver || this.transitioning) return;
        if (ghost.isEaten) return;
        if (this.invincibleTimer > 0) return;

        if (this.frightenedTimer > 0) {
            // Eat the ghost!
            ghost.isEaten = true;
            ghost.setVisible(false);
            this.ghostsEatenCombo++;

            const combo = Math.min(this.ghostsEatenCombo - 1, 3);
            const pts = GHOST_EAT_SCORE[combo];
            this.score += pts;
            this.scoreText.setText('SCORE: ' + this.score);
            SFX.ghostEat();

            // Show score
            const txt = this.add.text(ghost.x, ghost.y - 10, `${pts}`, {
                fontSize: '18px', fill: '#38bdf8', fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(20);
            this.tweens.add({
                targets: txt, y: txt.y - 40, alpha: 0,
                duration: 600, onComplete: () => txt.destroy()
            });

            // Return ghost after 3s
            this.time.delayedCall(3000, () => {
                ghost.isEaten = false;
                ghost.setVisible(true);
                ghost.setTexture(`ghost_${ghost.ghostIndex}`);
                const sp = GHOST_SPAWN[ghost.ghostIndex];
                const ok = this.isWalkable(sp.x, sp.y);
                const sx = ok ? sp.x : 12;
                const sy = ok ? sp.y : 9;
                ghost.x = sx * TILE + TILE / 2;
                ghost.y = sy * TILE + TILE / 2;
                ghost.currentDir = DIR.UP;
            });
        } else {
            // Lose a life
            this.loseLife();
        }
    }

    // ---- LIVES ----
    loseLife() {
        this.lives--;
        this.updateLivesDisplay();
        SFX.death();
        this.transitioning = true;

        // Death explosion particles
        const emitter = this.add.particles(this.player.x, this.player.y, 'particle', {
            speed: { min: 80, max: 300 },
            scale: { start: 1.2, end: 0 },
            alpha: { start: 1, end: 0 },
            blendMode: 'ADD',
            lifespan: 700,
            tint: [0xfde047, 0xf43f5e, 0x0ea5e9],
            emitting: false
        });
        emitter.setDepth(15);
        emitter.explode(40);

        // Screen shake
        this.cameras.main.shake(300, 0.01);

        this.player.setVisible(false);

        if (this.lives <= 0) {
            // Game over
            this.time.delayedCall(1200, () => {
                this.endGame(false);
            });
        } else {
            // Respawn after delay
            this.time.delayedCall(1200, () => {
                this.respawnPlayer();
            });
        }
    }

    respawnPlayer() {
        const spawnX = 12 * TILE + TILE / 2;
        const spawnY = 9 * TILE + TILE / 2;
        this.player.setPosition(spawnX, spawnY);
        this.player.setVisible(true);
        this.player.setTint(0xffffff);
        this.player.clearTint();
        this.player.setScale(1);
        this.currentDir = DIR.RIGHT;
        this.nextDir = DIR.RIGHT;
        this.frightenedTimer = 0;
        this.invincibleTimer = 3000;
        this.transitioning = false;

        // Brief invincibility flash
        this.tweens.add({
            targets: this.player,
            alpha: { from: 0.3, to: 1 },
            duration: 100,
            repeat: 5,
            onComplete: () => {
                this.player.setAlpha(1);
            }
        });
    }

    // ---- LEVELS ----
    checkWin() {
        if (this.pelletsEaten >= this.totalPellets) {
            this.transitioning = true;
            this.time.delayedCall(500, () => {
                this.nextLevel();
            });
        }
    }

    nextLevel() {
        this.level++;
        this.levelText.setText(`LEVEL ${this.level}`);
        SFX.levelUp();

        this.walls.clear(true, true);
        this.pellets.clear(true, true);
        this.powerPellets.clear(true, true);
        this.ghostList = [];
        this.ghosts.clear(true, true);
        this.pelletCount = 0;
        this.pelletsEaten = 0;
        this.frightenedTimer = 0;
        this.lastFruitIndex = -1;

        this.createMaze();
        this.createGhosts();

        this.respawnPlayer();
        this.isChaseMode = true;
        this.modeTimer = 0;

        // Show level text
        const lvlText = this.add.text(W / 2, H / 2, `LEVEL ${this.level}`, {
            fontSize: '48px', fill: '#0ea5e9', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(30);
        lvlText.setShadow(0, 0, '#38bdf8', 15, true, true);
        this.tweens.add({
            targets: lvlText, alpha: 0, scaleX: 1.5, scaleY: 1.5,
            duration: 1500, delay: 500,
            onComplete: () => { lvlText.destroy(); this.transitioning = false; }
        });
    }

    // ---- GAME OVER ----
    endGame(isWin) {
        this.isGameOver = true;
        this.physics.pause();
        this.player.setVisible(false);

        if (!isWin) {
            SFX.death();
        }

        const hs = parseInt(localStorage.getItem('neonPacmanHighScore') || '0');
        if (this.score > hs) {
            localStorage.setItem('neonPacmanHighScore', this.score);
        }

        this.time.delayedCall(1500, () => {
            this.scene.start('GameOverScene', {
                score: this.score, win: isWin, level: this.level
            });
        });
    }

    // ---- MODE TIMER (Chase/Scatter) ----
    updateModeTimer(dt) {
        if (this.frightenedTimer > 0) return;

        this.modeTimer += dt * 1000;
        const chaseDuration = Math.max(5000, 10000 - (this.level - 1) * 500);
        const scatterDuration = Math.max(2000, 5000 - (this.level - 1) * 300);

        if (this.isChaseMode && this.modeTimer >= chaseDuration) {
            this.isChaseMode = false;
            this.modeTimer = 0;
            // Reverse ghosts for scatter
            this.ghostList.forEach(g => {
                if (!g.isEaten && this.frightenedTimer <= 0) {
                    g.currentDir.x *= -1;
                    g.currentDir.y *= -1;
                }
            });
        } else if (!this.isChaseMode && this.modeTimer >= scatterDuration) {
            this.isChaseMode = true;
            this.modeTimer = 0;
            this.ghostList.forEach(g => {
                if (!g.isEaten && this.frightenedTimer <= 0) {
                    g.currentDir.x *= -1;
                    g.currentDir.y *= -1;
                }
            });
        }
    }

    // ---- Frightened Timer ----
    updateFrightenedTimer(dt) {
        if (this.frightenedTimer > 0) {
            this.frightenedTimer -= dt * 1000;
            if (this.frightenedTimer <= 0) {
                this.frightenedTimer = 0;
                this.ghostList.forEach(g => {
                    g.isFrightened = false;
                    g.setTexture(`ghost_${g.ghostIndex}`);
                });
            }
        }
    }

    // ---- Invincibility Timer ----
    updateInvincible(dt) {
        if (this.invincibleTimer > 0) {
            this.invincibleTimer -= dt * 1000;
            // Flash player while invincible
            if (this.player.visible) {
                this.player.alpha = Math.floor(this.invincibleTimer / 150) % 2 === 0 ? 0.3 : 1;
            }
            if (this.invincibleTimer <= 0) {
                this.invincibleTimer = 0;
                this.player.alpha = 1;
            }
        }
    }

    // ---- DEBUG ----
    renderDebug() {
        if (!this.debugMode) return;

        if (!this._debugGfx) {
            this._debugGfx = this.add.graphics().setDepth(100);
            this._debugInfo = this.add.text(8, 30, '', {
                fontSize: '11px', fill: '#0ea5e9', backgroundColor: '#020617',
                padding: { x: 4, y: 2 }
            }).setDepth(100);
        }

        const g = this._debugGfx;
        g.clear();

        // Tile grid
        g.lineStyle(1, 0x0ea5e9, 0.12);
        for (let x = 0; x <= COLS; x++) g.lineBetween(x * TILE, 0, x * TILE, H);
        for (let y = 0; y <= ROWS; y++) g.lineBetween(0, y * TILE, W, y * TILE);

        // Walkable / wall overlay
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                if (this.mapGrid[y][x] === 1) {
                    g.fillStyle(0x0ea5e9, 0.08);
                    g.fillRect(x * TILE, y * TILE, TILE, TILE);
                }
            }
        }

        // Flow field arrows
        if (this._debugFF) {
            for (let y = 0; y < ROWS; y++) {
                for (let x = 0; x < COLS; x++) {
                    const f = this._debugFF[y][x];
                    if (f && (f.dx !== 0 || f.dy !== 0)) {
                        const cx = x * TILE + TILE / 2;
                        const cy = y * TILE + TILE / 2;
                        const len = 10;
                        const color = this.isChaseMode ? 0x4ade80 : 0x38bdf8;
                        const alpha = this.frightenedTimer > 0 ? 0.2 : 0.5;
                        g.lineStyle(2, color, alpha);
                        g.lineBetween(cx, cy, cx + f.dx * len, cy + f.dy * len);
                        // Arrow head (0.5 rad ≈ 30° offset from shaft)
                        const ax = cx + f.dx * len;
                        const ay = cy + f.dy * len;
                        const a1 = Math.atan2(f.dy, f.dx) + 0.5;
                        const a2 = Math.atan2(f.dy, f.dx) - 0.5;
                        g.lineBetween(ax, ay, ax + Math.cos(a1) * 4, ay + Math.sin(a1) * 4);
                        g.lineBetween(ax, ay, ax + Math.cos(a2) * 4, ay + Math.sin(a2) * 4);
                    }
                }
            }
        }

        // Player tile highlight
        const pt = this.toTile(this.player.x, this.player.y);
        g.lineStyle(2, 0xfde047, 0.9);
        g.strokeRect(pt.x * TILE, pt.y * TILE, TILE, TILE);
        g.fillStyle(0xfde047, 0.15);
        g.fillRect(pt.x * TILE, pt.y * TILE, TILE, TILE);

        // Ghost markers
        this.ghostList.forEach((ghost, i) => {
            if (ghost.isEaten) return;
            const gt = this.toTile(ghost.x, ghost.y);
            g.fillStyle(GHOST_COLORS[i], 0.35);
            g.fillCircle(gt.x * TILE + TILE / 2, gt.y * TILE + TILE / 2, 8);
            g.lineStyle(1.5, GHOST_COLORS[i], 0.7);
            g.strokeCircle(gt.x * TILE + TILE / 2, gt.y * TILE + TILE / 2, 8);
        });

        // Info text
        let info = `[F1:HIDE] MODE:${this.isChaseMode ? 'CHASE' : 'SCATTER'}`;
        info += ` LV:${this.level}`;
        if (this.invincibleTimer > 0) info += ` INV:${(this.invincibleTimer / 1000).toFixed(1)}s`;
        info += ` FRIGHT:${(this.frightenedTimer / 1000).toFixed(1)}s\n`;
        info += `PLAYER:(${pt.x},${pt.y}) DIR:(${this.currentDir.x},${this.currentDir.y})`;
        info += ` NEXT:(${(this.nextDir || DIR.NONE).x},${(this.nextDir || DIR.NONE).y})\n`;
        info += `\u2191 arrows show ghost path direction toward player\n`;
        info += `GHOSTS: `;
        this.ghostList.forEach((g, i) => {
            const gt = this.toTile(g.x, g.y);
            info += `${g.ghostName}:(${gt.x},${gt.y})${g.isFrightened ? '[F]' : ''} `;
        });
        this._debugInfo.setText(info);
    }

    // ==========================================
    // MAIN UPDATE
    // ==========================================
    update(time, delta) {
        if (this.isGameOver) return;
        if (this.transitioning) return;
        if (this.isPaused) { this.renderDebug(); return; }

        const dt = delta / 1000;

        this.updateFrightenedTimer(dt);
        this.updateModeTimer(dt);
        this.updateInvincible(dt);

        this.updatePlayerMovement();
        this.updateGhosts();
        this.renderDebug();
    }
}

// ==========================================
// SCENE: GAME OVER
// ==========================================
class GameOverScene extends Phaser.Scene {
    constructor() { super('GameOverScene'); }

    init(data) {
        this.finalScore = data.score || 0;
        this.isWin = data.win || false;
        this.level = data.level || 1;
    }

    create() {
        const cx = W / 2;
        const cy = H / 2;

        const msg = this.isWin ? 'YOU WIN!' : 'GAME OVER';
        const color = this.isWin ? '#4ade80' : '#f43f5e';

        const title = this.add.text(cx, cy - 60, msg, {
            fontSize: '64px', fill: color, fontStyle: 'bold'
        }).setOrigin(0.5);
        title.setShadow(0, 0, color, 15, true, true);

        this.add.text(cx, cy + 10, `FINAL SCORE: ${this.finalScore}`, {
            fontSize: '28px', fill: '#fff'
        }).setOrigin(0.5);

        this.add.text(cx, cy + 50, `LEVEL REACHED: ${this.level}`, {
            fontSize: '18px', fill: '#94a3b8'
        }).setOrigin(0.5);

        const hs = localStorage.getItem('neonPacmanHighScore') || 0;
        this.add.text(cx, cy + 80, `HIGH SCORE: ${hs}`, {
            fontSize: '18px', fill: '#fde047'
        }).setOrigin(0.5);

        const btn = this.add.text(cx, cy + 130, 'CLICK TO RESTART', {
            fontSize: '22px', fill: '#94a3b8'
        }).setOrigin(0.5);

        this.tweens.add({
            targets: btn, alpha: 0.5, duration: 800, yoyo: true, repeat: -1
        });

        this.input.on('pointerdown', () => {
            this.scene.start('GameScene');
        });
    }
}

// ==========================================
// CONFIG
// ==========================================
const config = {
    type: Phaser.AUTO,
    width: W,
    height: H,
    parent: 'game-container',
    backgroundColor: '#020617',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [BootScene, GameScene, GameOverScene]
};

const game = new Phaser.Game(config);
