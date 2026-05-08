import Phaser from 'phaser';

const COLORS = {
    sky: 0x87CEEB,
    water: 0x4169E1,
    waterDark: 0x2850A0,
    grass: 0x228B22,
    grassDark: 0x1A6B1A,
    dock: 0x8B4513,
    dockDark: 0x6B3410,
    uiBg: 0x0f0f23,
    uiBgLight: 0x1a1a2e,
    uiBorder: 0x4a90d9,
    uiBorderDark: 0x2d5a87,
    uiText: 0xFFFFFF,
    uiTextDim: 0x8ba4c7,
    safeZone: 0x32CD32,
    dangerZone: 0xDC143C,
    safeZoneBg: 0x1A4A1A,
    dangerZoneBg: 0x4A1010,
    warning: 0xFFD700,
    white: 0xFFFFFF,
    black: 0x000000,
    orange: 0xFF8C00,
    red: 0xFF4444,
    yellow: 0xFFFF00,
    purple: 0x9932CC,
    blue: 0x4169E1,
    gold: 0xFFD700,
    common: 0x7ec8e3,
    rare: 0x9b59b6,
    legendary: 0xffd700
};

const FISH_DATA = {
    crucian: {
        name: '小鲫鱼',
        rarity: 'common',
        weightMin: 0.1,
        weightMax: 0.3,
        pullStrength: 1,
        probability: 0.40,
        color: 0xC0C0C0,
        size: { w: 16, h: 10 }
    },
    carp: {
        name: '鲤鱼',
        rarity: 'common',
        weightMin: 0.5,
        weightMax: 1.5,
        pullStrength: 2,
        probability: 0.30,
        color: 0xFF6B35,
        size: { w: 20, h: 12 }
    },
    perch: {
        name: '鳜鱼',
        rarity: 'rare',
        weightMin: 1.0,
        weightMax: 2.5,
        pullStrength: 3,
        probability: 0.15,
        color: 0x228B22,
        size: { w: 18, h: 11 }
    },
    goldfish: {
        name: '金鱼',
        rarity: 'legendary',
        weightMin: 0.2,
        weightMax: 0.5,
        pullStrength: 1,
        probability: 0.10,
        color: 0xFFD700,
        size: { w: 14, h: 12 }
    },
    shark: {
        name: '鲨鱼',
        rarity: 'legendary',
        weightMin: 5.0,
        weightMax: 15.0,
        pullStrength: 5,
        probability: 0.05,
        color: 0x708090,
        size: { w: 32, h: 14 }
    }
};

const GAME_STATES = {
    IDLE: 'IDLE',
    CASTING: 'CASTING',
    WAITING: 'WAITING',
    FISH_ON: 'FISH_ON',
    PULLING: 'PULLING',
    SUCCESS: 'SUCCESS',
    ESCAPE: 'ESCAPE'
};

class StateMachine {
    constructor() {
        this.currentState = GAME_STATES.IDLE;
        this.listeners = {};
    }

    addListener(state, callback) {
        if (!this.listeners[state]) {
            this.listeners[state] = [];
        }
        this.listeners[state].push(callback);
    }

    setState(newState) {
        const oldState = this.currentState;
        this.currentState = newState;
        if (this.listeners[newState]) {
            this.listeners[newState].forEach(cb => cb(newState, oldState));
        }
    }

    getState() {
        return this.currentState;
    }
}

class FishSystem {
    constructor() {
        this.totalProbability = Object.values(FISH_DATA).reduce((sum, fish) => sum + fish.probability, 0);
    }

    selectRandomFish() {
        let rand = Math.random() * this.totalProbability;
        for (const [key, fish] of Object.entries(FISH_DATA)) {
            rand -= fish.probability;
            if (rand <= 0) {
                return {
                    ...fish,
                    key,
                    weight: fish.weightMin + Math.random() * (fish.weightMax - fish.weightMin),
                    id: Date.now() + Math.random()
                };
            }
        }
        return null;
    }

    getFishSprite(fish, graphics) {
        const { w, h } = fish.size;
        graphics.clear();
        graphics.fillStyle(fish.color);
        graphics.fillRect(0, 2, w - 4, h - 4);
        graphics.fillTriangle(w - 4, h / 2, w, 0, w, h);
        graphics.fillStyle(0xFFFFFF);
        graphics.fillRect(w - 8, 3, 2, 2);
        graphics.fillStyle(0x000000);
        graphics.fillRect(w - 7, 4, 1, 1);
        graphics.fillStyle(COLORS.red);
        graphics.fillTriangle(w - 12, h / 2, w - 8, h / 2 - 2, w - 8, h / 2 + 2);
        return graphics.generateTexture(fish.key + '_sprite', w + 1, h);
    }
}

class FishingGame extends Phaser.Scene {
    constructor() {
        super({ key: 'FishingGame' });
        this.stateMachine = new StateMachine();
        this.fishSystem = new FishSystem();
        this.score = 0;
        this.currentFish = null;
        this.pullProgress = 0;
        this.fishPosition = 0;
        this.catchCount = 0;
        this.isPulling = false;
        this.pullDirection = 1;
        this.lastPullTime = 0;
        this.waveOffset = 0;
    }

    create() {
        this.createAssets();
        this.createBackground();
        this.createFisher();
        this.createWater();
        this.createUI();
        this.setupInput();
        this.setupStateListeners();
        this.updateUI();
    }

    createAssets() {
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });

        graphics.fillStyle(COLORS.sky);
        graphics.fillRect(0, 0, 480, 320);
        graphics.generateTexture('background', 480, 320);

        graphics.clear();
        graphics.fillStyle(0x8B6914);
        graphics.fillRect(0, 0, 32, 32);
        graphics.fillStyle(0x6B4914);
        graphics.fillRect(0, 0, 32, 4);
        graphics.lineStyle(1, 0x5B3914);
        for (let y = 8; y < 32; y += 8) {
            graphics.lineBetween(0, y, 32, y);
        }
        graphics.generateTexture('dock', 32, 32);

        graphics.clear();
        graphics.fillStyle(0xFF4444);
        graphics.fillCircle(16, 16, 12);
        graphics.fillStyle(0xFFFFFF);
        graphics.fillCircle(16, 16, 8);
        graphics.fillStyle(0xFF4444);
        graphics.fillCircle(16, 16, 6);
        graphics.fillStyle(COLORS.uiBorder);
        graphics.fillCircle(16, 16, 14);
        graphics.fillStyle(COLORS.uiBorderDark);
        graphics.fillCircle(16, 16, 15);
        graphics.generateTexture('bobber', 32, 32);

        graphics.clear();
        graphics.fillStyle(0x3D2817);
        graphics.fillRect(0, 0, 4, 100);
        graphics.fillStyle(0x5D4837);
        graphics.fillRect(0, 0, 4, 2);
        graphics.generateTexture('rod', 4, 100);

        graphics.clear();
        graphics.fillStyle(0xCCCCCC);
        graphics.fillRect(0, 0, 1, 80);
        graphics.generateTexture('line', 1, 80);

        Object.values(FISH_DATA).forEach(fish => {
            this.fishSystem.getFishSprite(fish, graphics);
        });

        graphics.clear();
        graphics.fillStyle(0x333333);
        graphics.fillRect(0, 0, 200, 24);
        graphics.generateTexture('progress_bg', 200, 24);

        graphics.clear();
        graphics.fillStyle(COLORS.safeZone);
        graphics.fillRect(0, 0, 80, 20);
        graphics.generateTexture('safe_zone', 80, 20);

        graphics.destroy();
    }

    createBackground() {
        this.add.image(240, 160, 'background');

        this.clouds = [];
        for (let i = 0; i < 3; i++) {
            const cloud = this.add.ellipse(100 + i * 150, 40 + i * 20, 60, 20, 0xFFFFFF, 0.6);
            cloud.setScale(1 + i * 0.3);
            this.clouds.push(cloud);

            this.tweens.add({
                targets: cloud,
                x: cloud.x + 30,
                duration: 3000 + i * 1000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        this.add.rectangle(240, 280, 480, 80, COLORS.grass);
        this.add.rectangle(240, 275, 480, 10, COLORS.grassDark);

        for (let x = 0; x < 480; x += 32) {
            this.add.image(x, 268, 'dock').setOrigin(0, 0.5);
        }

        this.add.rectangle(240, 200, 480, 8, COLORS.water);
        this.add.rectangle(240, 220, 480, 100, COLORS.waterDark);

        const sun = this.add.circle(420, 50, 25, 0xFFD93D);
        this.tweens.add({
            targets: sun,
            alpha: 0.8,
            duration: 2000,
            yoyo: true,
            repeat: -1
        });
    }

    createFisher() {
        this.fisher = this.add.container(80, 180);

        const body = this.add.rectangle(0, 0, 12, 16, 0x4169E1);
        const head = this.add.circle(0, -14, 6, 0xFFDAB9);
        const hat = this.add.rectangle(0, -20, 14, 4, 0x8B4513);
        const legs = this.add.rectangle(0, 12, 10, 8, 0x2F4F4F);
        const rod = this.add.image(10, -8, 'rod').setOrigin(0, 0);

        this.fisher.add([legs, body, head, hat, rod]);
        this.fisher.setScale(2);

        this.fisherIdleTween = this.tweens.add({
            targets: this.fisher,
            y: 178,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    createWater() {
        this.waterGraphics = this.add.graphics();
        this.waves = [];
        for (let i = 0; i < 8; i++) {
            this.waves.push({
                x: 60 + i * 50,
                y: 190 + Math.sin(i) * 5,
                phase: i * 0.5
            });
        }

        this.bobberContainer = this.add.container(300, 180);
        this.bobber = this.add.image(0, 0, 'bobber').setScale(1.5);
        this.bobberContainer.add(this.bobber);
        this.bobberContainer.setVisible(false);

        this.fishingLine = this.add.graphics();
        this.fishingLine.setVisible(false);
    }

    createUI() {
        this.createPanelTexture();
        this.createStatPanel();
        this.createPullUI();
        this.createHintPanel();
    }

    createPanelTexture() {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(COLORS.uiBg);
        g.fillRect(0, 0, 160, 60);
        g.fillStyle(COLORS.uiBorderDark);
        g.fillRect(0, 0, 160, 2);
        g.fillRect(0, 0, 2, 60);
        g.fillStyle(COLORS.uiBorder);
        g.fillRect(0, 58, 160, 2);
        g.fillRect(158, 0, 2, 60);
        g.fillStyle(COLORS.uiBgLight);
        g.fillRect(2, 2, 156, 56);
        g.lineStyle(2, COLORS.uiBorderDark);
        g.strokeRect(1, 1, 158, 58);
        g.generateTexture('stat_panel', 160, 60);

        g.clear();
        g.fillStyle(COLORS.uiBg);
        g.fillRect(0, 0, 320, 36);
        g.fillStyle(COLORS.uiBorderDark);
        g.fillRect(0, 0, 320, 2);
        g.fillRect(0, 0, 2, 36);
        g.fillStyle(COLORS.uiBorder);
        g.fillRect(0, 34, 320, 2);
        g.fillRect(318, 0, 2, 36);
        g.fillStyle(COLORS.uiBgLight);
        g.fillRect(2, 2, 316, 32);
        g.lineStyle(2, COLORS.uiBorderDark);
        g.strokeRect(1, 1, 318, 34);
        g.generateTexture('hint_panel', 320, 36);

        g.clear();
        g.fillStyle(COLORS.uiBg);
        g.fillRect(0, 0, 280, 100);
        g.fillStyle(COLORS.uiBorderDark);
        g.fillRect(0, 0, 280, 3);
        g.fillRect(0, 0, 3, 100);
        g.fillStyle(COLORS.uiBorder);
        g.fillRect(0, 97, 280, 3);
        g.fillRect(277, 0, 3, 100);
        g.fillStyle(COLORS.uiBgLight);
        g.fillRect(3, 3, 274, 94);
        g.lineStyle(2, COLORS.uiBorderDark);
        g.strokeRect(1, 1, 278, 98);
        g.generateTexture('pull_panel', 280, 100);

        g.clear();
        g.fillStyle(COLORS.uiBg);
        g.fillRect(0, 0, 200, 28);
        g.fillStyle(COLORS.uiBorderDark);
        g.fillRect(0, 0, 200, 2);
        g.fillStyle(COLORS.uiBorder);
        g.fillRect(0, 26, 200, 2);
        g.fillStyle(COLORS.uiBgLight);
        g.fillRect(1, 2, 198, 24);
        g.generateTexture('progress_bg', 200, 28);

        g.clear();
        g.fillStyle(COLORS.safeZone);
        g.fillRect(0, 0, 80, 24);
        g.generateTexture('safe_zone', 80, 24);

        g.clear();
        g.fillStyle(COLORS.common);
        g.fillRect(0, 0, 20, 20);
        g.generateTexture('rarity_common', 20, 20);

        g.clear();
        g.fillStyle(COLORS.rare);
        g.fillRect(0, 0, 20, 20);
        g.generateTexture('rarity_rare', 20, 20);

        g.clear();
        g.fillStyle(COLORS.legendary);
        g.fillRect(0, 0, 20, 20);
        g.generateTexture('rarity_legendary', 20, 20);

        g.destroy();
    }

    createStatPanel() {
        this.statPanel = this.add.container(0, 0);

        const panelBg = this.add.image(80, 50, 'stat_panel');

        const fishIcon = this.add.image(20, 50, 'rarity_common').setScale(1.2);
        const scoreLabel = this.add.text(30, 38, 'SCORE', {
            fontSize: '10px',
            fontFamily: 'monospace',
            color: '#8ba4c7'
        }).setOrigin(0, 0.5);
        this.scoreText = this.add.text(30, 50, '0', {
            fontSize: '20px',
            fontFamily: 'monospace',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);

        const divider = this.add.rectangle(90, 50, 2, 40, COLORS.uiBorderDark);

        const catchLabel = this.add.text(100, 38, 'CATCH', {
            fontSize: '10px',
            fontFamily: 'monospace',
            color: '#8ba4c7'
        }).setOrigin(0, 0.5);
        this.catchText = this.add.text(100, 50, '0', {
            fontSize: '20px',
            fontFamily: 'monospace',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);

        this.statPanel.add([panelBg, fishIcon, scoreLabel, this.scoreText, divider, catchLabel, this.catchText]);
    }

    createHintPanel() {
        this.hintPanel = this.add.container(240, 295);
        this.hintPanel.setAlpha(0);

        const hintBg = this.add.image(0, 0, 'hint_panel');
        this.hintText = this.add.text(0, 0, '点击或按空格开始钓鱼', {
            fontSize: '14px',
            fontFamily: 'monospace',
            color: '#FFFFFF'
        }).setOrigin(0.5);

        this.hintPanel.add([hintBg, this.hintText]);

        this.tweens.add({
            targets: this.hintPanel,
            alpha: 1,
            duration: 300
        });
    }

    createPullUI() {
        this.pullUI = this.add.container(240, 120).setVisible(false);

        const pullBg = this.add.image(0, 0, 'pull_panel');

        const fishNameText = this.add.text(0, -32, '', {
            fontSize: '16px',
            fontFamily: 'monospace',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const rarityBadge = this.add.image(-70, -32, 'rarity_common').setScale(1.2);
        const rarityLabel = this.add.text(-58, -32, '', {
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#8ba4c7'
        }).setOrigin(0, 0.5);

        const progressBg = this.add.image(0, 0, 'progress_bg');
        const safeZone = this.add.image(0, 0, 'safe_zone');

        const progressFill = this.add.rectangle(-92, 0, 0, 24, COLORS.blue);

        this.fishPullIcon = this.add.image(-92, 0, 'crucian_sprite').setScale(1.5);
        this.progressBar = progressFill;

        const weightText = this.add.text(0, 24, '', {
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#8ba4c7'
        }).setOrigin(0.5);

        this.pullFishName = fishNameText;
        this.pullRarityBadge = rarityBadge;
        this.pullRarityLabel = rarityLabel;
        this.pullWeightText = weightText;

        this.pullUI.add([
            pullBg, fishNameText, rarityBadge, rarityLabel,
            progressBg, safeZone, progressFill, this.fishPullIcon, weightText
        ]);
    }

    setupInput() {
        this.input.on('pointerdown', () => {
            if (this.stateMachine.getState() === GAME_STATES.PULLING) {
                this.handlePull();
            } else if (this.stateMachine.getState() === GAME_STATES.IDLE) {
                this.startCasting();
            }
        });

        this.input.keyboard.on('keydown-SPACE', () => {
            if (this.stateMachine.getState() === GAME_STATES.PULLING) {
                this.handlePull();
            } else if (this.stateMachine.getState() === GAME_STATES.IDLE) {
                this.startCasting();
            }
        });
    }

    setupStateListeners() {
        this.stateMachine.addListener(GAME_STATES.IDLE, () => {
            this.showHint('点击或按空格开始钓鱼');
            this.bobberContainer.setVisible(false);
            this.fishingLine.setVisible(false);
            this.pullUI.setVisible(false);
            this.fisherIdleTween.resume();
        });

        this.stateMachine.addListener(GAME_STATES.CASTING, () => {
            this.showHint('抛竿中...');
            this.fisherIdleTween.pause();
            this.bobberContainer.setPosition(300, 100);
            this.bobberContainer.setAlpha(0);
            this.bobberContainer.setVisible(true);

            this.tweens.add({
                targets: this.bobberContainer,
                y: 180,
                alpha: 1,
                duration: 500,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    this.stateMachine.setState(GAME_STATES.WAITING);
                }
            });
        });

        this.stateMachine.addListener(GAME_STATES.WAITING, () => {
            this.showHint('等待鱼儿上钩...');
            this.bobberContainer.setPosition(300, 180);
            this.bobberContainer.setVisible(true);

            this.bobberFloatTween = this.tweens.add({
                targets: this.bobberContainer,
                y: 175,
                duration: 1000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            const waitTime = 2000 + Math.random() * 4000;
            this.time.delayedCall(waitTime, () => {
                if (this.stateMachine.getState() === GAME_STATES.WAITING) {
                    this.bobberFloatTween.stop();
                    this.onFishBite();
                }
            });
        });

        this.stateMachine.addListener(GAME_STATES.FISH_ON, () => {
            this.showHint('有鱼上钩了!');
            this.bobberContainer.setVisible(false);
            this.showFishOnEffect();
        });

        this.stateMachine.addListener(GAME_STATES.PULLING, () => {
            this.showHint('按住空格或点击收线!');
            this.pullUI.setVisible(true);
            this.pullProgress = 0;
            this.fishPosition = 0;
            this.isPulling = false;
            this.lastPullTime = this.time.now;

            if (this.currentFish) {
                this.pullFishName.setText(this.currentFish.name);
                this.pullWeightText.setText(`${this.currentFish.weight.toFixed(1)} kg`);

                const rarityTextures = {
                    common: 'rarity_common',
                    rare: 'rarity_rare',
                    legendary: 'rarity_legendary'
                };
                this.pullRarityBadge.setTexture(rarityTextures[this.currentFish.rarity] || 'rarity_common');

                const rarityNames = {
                    common: '普通',
                    rare: '稀有',
                    legendary: '传说'
                };
                this.pullRarityLabel.setText(rarityNames[this.currentFish.rarity] || '普通');

                this.fishPullIcon.setTexture(this.currentFish.key + '_sprite');
                this.fishPullIcon.setScale(1.5);
            }

            this.startPullLoop();
        });

        this.stateMachine.addListener(GAME_STATES.SUCCESS, () => {
            this.pullUI.setVisible(false);
            this.showHint(`${this.currentFish ? this.currentFish.name : '鱼'}! (+${this.calculateScore()})`);
            this.showSuccessEffect();
            this.catchCount++;
            this.score += this.calculateScore();
            this.updateUI();

            this.time.delayedCall(2500, () => {
                this.stateMachine.setState(GAME_STATES.IDLE);
            });
        });

        this.stateMachine.addListener(GAME_STATES.ESCAPE, () => {
            this.pullUI.setVisible(false);
            this.showHint(`${this.currentFish ? this.currentFish.name : '鱼'} 跑掉了...`);

            this.time.delayedCall(2000, () => {
                this.stateMachine.setState(GAME_STATES.IDLE);
            });
        });
    }

    showHint(text) {
        this.hintText.setText(text);
        this.hintPanel.setAlpha(0);
        this.tweens.add({
            targets: this.hintPanel,
            alpha: 1,
            duration: 200
        });
    }

    startCasting() {
        this.stateMachine.setState(GAME_STATES.CASTING);

        this.tweens.add({
            targets: this.bobberContainer,
            x: 300,
            y: { from: 100, to: 180 },
            alpha: { from: 0, to: 1 },
            duration: 500,
            ease: 'Quad.easeOut'
        });
    }

    onFishBite() {
        this.stateMachine.setState(GAME_STATES.FISH_ON);
        this.currentFish = this.fishSystem.selectRandomFish();

        this.tweens.killTweensOf(this.fisher);
        this.tweens.add({
            targets: this.fisher,
            y: 225,
            duration: 100,
            yoyo: true,
            repeat: 3,
            onComplete: () => {
                this.stateMachine.setState(GAME_STATES.PULLING);
            }
        });
    }

    handlePull() {
        this.isPulling = true;
        this.lastPullTime = this.time.now;
    }

    startPullLoop() {
        this.pullInterval = this.time.addEvent({
            delay: 16,
            callback: this.updatePull,
            callbackScope: this,
            loop: true
        });
    }

    updatePull() {
        if (this.stateMachine.getState() !== GAME_STATES.PULLING) {
            if (this.pullInterval) {
                this.pullInterval.destroy();
            }
            return;
        }

        const baseProgress = 0.5;
        const strengthBonus = this.currentFish ? this.currentFish.pullStrength * 0.05 : 0;

        this.pullProgress += baseProgress + strengthBonus;

        if (this.isPulling) {
            const pullAmount = 2.0 + strengthBonus;
            this.pullProgress += pullAmount;

            if (this.pullProgress > 100) {
                this.pullProgress = 100;
            }
            this.isPulling = false;
        } else {
            const decayRate = 0.3 + (this.currentFish ? this.currentFish.pullStrength * 0.08 : 0.2);
            this.pullProgress -= decayRate;

            if (this.pullProgress < 0) {
                this.pullProgress = 0;
            }
        }

        this.isPulling = false;

        const fishSpeed = 0.3 + (this.currentFish ? this.currentFish.pullStrength * 0.08 : 0.1);
        const fishMovement = Math.sin(this.time.now * 0.005 * fishSpeed) * fishSpeed;
        this.fishPosition += fishMovement;

        if (this.fishPosition > 80) {
            this.fishPosition = 80;
        } else if (this.fishPosition < -80) {
            this.fishPosition = -80;
        }

        this.progressBar.setDisplaySize(Math.max(0, this.pullProgress * 1.84), 24);
        this.fishPullIcon.setX(-92 + this.pullProgress * 1.84);

        if (this.pullProgress >= 100) {
            this.pullInterval.destroy();
            this.stateMachine.setState(GAME_STATES.SUCCESS);
        } else if (this.pullProgress <= 0) {
            this.pullInterval.destroy();
            this.stateMachine.setState(GAME_STATES.ESCAPE);
        }
    }

    calculateScore() {
        if (!this.currentFish) return 0;
        const rarityMultiplier = {
            common: 1,
            rare: 3,
            legendary: 10
        };
        const baseScore = Math.round(this.currentFish.weight * 10);
        return baseScore * (rarityMultiplier[this.currentFish.rarity] || 1);
    }

    showFishOnEffect() {
        const particles = this.add.graphics();
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const x = 240 + Math.cos(angle) * 30;
            const y = 200 + Math.sin(angle) * 30;

            this.tweens.add({
                targets: { x, y },
                x: 240 + Math.cos(angle) * 60,
                y: 200 + Math.sin(angle) * 60,
                alpha: 0,
                duration: 500,
                ease: 'Quad.easeOut'
            });
        }
    }

    showSuccessEffect() {
        if (!this.currentFish) return;

        const flash = this.add.rectangle(240, 160, 480, 320, 0xFFFFFF, 0.5);
        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 300,
            onComplete: () => flash.destroy()
        });

        const fishSprite = this.add.image(240, 200, this.currentFish.key + '_sprite')
            .setScale(3)
            .setAlpha(0);

        const rarityColors = {
            common: 0x7ec8e3,
            rare: 0x9b59b6,
            legendary: 0xffd700
        };
        fishSprite.setTint(rarityColors[this.currentFish.rarity] || 0xFFFFFF);

        this.tweens.add({
            targets: fishSprite,
            y: 140,
            alpha: 1,
            scale: 5,
            duration: 600,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: fishSprite,
                    alpha: 0,
                    scale: 6,
                    delay: 1200,
                    duration: 400,
                    onComplete: () => fishSprite.destroy()
                });
            }
        });

        const weightText = this.add.text(240, 260, `${this.currentFish.name}  ${this.currentFish.weight.toFixed(1)} kg`, {
            fontSize: '18px',
            fontFamily: 'monospace',
            color: '#FFFFFF',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setAlpha(0);

        this.tweens.add({
            targets: weightText,
            alpha: 1,
            y: 250,
            duration: 400,
            delay: 200,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: weightText,
                    alpha: 0,
                    y: 240,
                    delay: 1200,
                    duration: 400,
                    onComplete: () => weightText.destroy()
                });
            }
        });
    }

    showFishOnEffect() {
        const flash = this.add.rectangle(240, 200, 100, 60, COLORS.warning, 0.4);
        this.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 1.5,
            duration: 400,
            ease: 'Quad.easeOut',
            onComplete: () => flash.destroy()
        });
    }

    showEscapeEffect() {
        const text = this.add.text(240, 200, '鱼跑掉了!', {
            fontSize: '20px',
            fontFamily: 'monospace',
            color: '#FF4444',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.tweens.add({
            targets: text,
            y: 170,
            alpha: 0,
            duration: 1000,
            ease: 'Quad.easeOut',
            onComplete: () => text.destroy()
        });
    }

    getRarityColor(rarity) {
        const colors = {
            common: 0xFFFFFF,
            rare: 0x9932CC,
            legendary: 0xFFD700
        };
        return colors[rarity] || 0xFFFFFF;
    }

    updateUI() {
        if (this.scoreText && this.catchText) {
            this.scoreText.setText(`${this.score}`);
            this.catchText.setText(`${this.catchCount}`);
        }
    }

    update(time, delta) {
        this.waveOffset = time * 0.001;

        this.waterGraphics.clear();
        this.waterGraphics.fillStyle(COLORS.water, 0.3);

        for (let x = 0; x < 480; x += 8) {
            const waveY = Math.sin((x + time * 0.05) * 0.05) * 3;
            this.waterGraphics.fillRect(x, 185 + waveY, 8, 2);
        }

        this.waterGraphics.fillStyle(COLORS.waterDark, 0.2);
        for (let x = 0; x < 480; x += 12) {
            const waveY = Math.sin((x + time * 0.03) * 0.04 + 1) * 2;
            this.waterGraphics.fillRect(x, 210 + waveY, 12, 2);
        }

        if (this.bobberContainer.visible && this.stateMachine.getState() === GAME_STATES.WAITING) {
            const rodTip = { x: 120, y: 195 };
            const bobberX = this.bobberContainer.x;
            const bobberY = this.bobberContainer.y;

            const midX = (rodTip.x + bobberX) / 2;
            const midY = rodTip.y + 20;

            const points = [];
            const steps = 10;
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const x = (1-t)*(1-t)*rodTip.x + 2*(1-t)*t*midX + t*t*bobberX;
                const y = (1-t)*(1-t)*rodTip.y + 2*(1-t)*t*midY + t*t*bobberY;
                points.push({ x, y });
            }
            this.fishingLine.clear();
            this.fishingLine.lineStyle(1, 0x888888, 0.7);
            this.fishingLine.beginPath();
            this.fishingLine.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                this.fishingLine.lineTo(points[i].x, points[i].y);
            }
            this.fishingLine.strokePath();
            this.fishingLine.setVisible(true);
        } else {
            this.fishingLine.setVisible(false);
        }
    }
}

const config = {
    type: Phaser.AUTO,
    width: 480,
    height: 320,
    parent: 'game-container',
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#0f0f23',
    scene: FishingGame
};

const game = new Phaser.Game(config);
