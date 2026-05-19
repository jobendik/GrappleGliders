import { Player, type PlayerInputState } from './Player';
import { Bot, BOT_PERSONALITIES } from './Bot';
import { World, type Obstacle } from './World';
import { Camera } from './Camera';
import { GameMode, GameState } from './GameState';

import { ParticleSystem } from '../render/Particles';
import { ScreenEffects } from '../render/ScreenEffects';
import { ParallaxBackground } from '../render/ParallaxBackground';
import { Renderer } from '../render/Renderer';
import { HookRenderer } from '../render/HookRenderer';
import { TrailRenderer } from '../render/TrailRenderer';
import { ThemeManager } from '../render/ThemeManager';

import { InputManager } from '../input/InputManager';

import { ScoringSystem } from '../systems/ScoringSystem';
import { ComboSystem } from '../systems/ComboSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { AchievementSystem } from '../systems/AchievementSystem';
import { UnlockSystem } from '../systems/UnlockSystem';
import { DailyChallengeSystem } from '../systems/DailyChallengeSystem';
import { LeaderboardSystem } from '../systems/LeaderboardSystem';
import { HapticsSystem } from '../systems/HapticsSystem';

import { AudioEngine } from '../audio/AudioEngine';
import { SFX } from '../audio/SFX';
import { Music } from '../audio/Music';

import { CrazyGamesPlatform } from '../platform/CrazyGamesSDK';

import { HUD } from '../ui/HUD';
import { MainMenu } from '../ui/MainMenu';
import { PauseMenu } from '../ui/PauseMenu';
import { GameOverScreen, type GameOverContext } from '../ui/GameOverScreen';
import { UnlocksScreen } from '../ui/UnlocksScreen';
import { SettingsScreen } from '../ui/SettingsScreen';
import { DailyChallengeScreen } from '../ui/DailyChallengeScreen';
import { Tutorial } from '../ui/Tutorial';
import { ToastManager } from '../ui/Toast';

import { getSkin } from '../content/skins';
import { getHook } from '../content/hooks';
import { getTrail } from '../content/trails';
import { clamp } from '../utils/math';
import { utcDateKey } from '../utils/format';

const WORLD_WIDTH = 1200;
const TIME_ATTACK_TARGET_ALT = 5000;
const BOT_RACE_TARGET_ALT = 3000;
const COMBO_RUN_SECONDS = 60;

interface GhostFrame {
  px: number;
  py: number;
  hx: number;
  hy: number;
  hookActive: 0 | 1;
}

interface TimeAttackResult {
  best: number;
  medal: 'gold' | 'silver' | 'bronze' | 'none';
}

const TIME_ATTACK_MEDALS = { gold: 80, silver: 110, bronze: 150 } as const;

interface RaceParticipant {
  id: 'player' | 'sparky' | 'phase' | 'apex';
  name: string;
  color: string;
  altitude: number;
  finished: boolean;
  finishTime: number | null;
}

export class Game {
  renderer: Renderer;
  camera = new Camera();
  particles = new ParticleSystem();
  screen = new ScreenEffects();
  background = new ParallaxBackground();
  hookRenderer = new HookRenderer();
  trailRenderer = new TrailRenderer();

  themes = new ThemeManager();
  input: InputManager;
  audio = new AudioEngine();
  sfx: SFX;
  music: Music;
  haptics = new HapticsSystem();
  save = new SaveSystem();
  scoring = new ScoringSystem();
  combo = new ComboSystem();
  progression: ProgressionSystem;
  achievements: AchievementSystem;
  unlocks: UnlockSystem;
  daily: DailyChallengeSystem;
  leaderboardSys = new LeaderboardSystem();
  crazy = new CrazyGamesPlatform();

  toast: ToastManager;
  hud: HUD | null = null;
  mainMenu: MainMenu;
  pauseMenu: PauseMenu;
  gameOver: GameOverScreen;
  unlocksScreen: UnlocksScreen;
  settingsScreen: SettingsScreen;
  dailyScreen: DailyChallengeScreen;
  tutorial: Tutorial | null = null;

  state: GameState = GameState.Boot;
  mode: GameMode = GameMode.EndlessClimb;
  world: World | null = null;
  player: Player | null = null;
  bots: Bot[] = [];
  raceParticipants: RaceParticipant[] = [];

  killY = 600;
  lavaSpeed = 0.94;
  baseLavaSpeed = 0.94;
  lavaAcceleration = 0.0008;
  framesSinceStart = 0;
  elapsedSeconds = 0;
  paused = false;

  /** Recording the active run's ghost frames. */
  ghostRecording: GhostFrame[] = [];
  ghostRecordCounter = 0;
  /** Playback of a previous best. */
  ghostPlayback: GhostFrame[] | null = null;

  /** Performance auto-tuning. */
  private slowFrameCount = 0;
  private lowQuality = false;

  /** Stable game-over guard. */
  private gameEnded = false;
  /** For combo run mode timer. */
  private modeTimer = 0;
  /** For Time Attack speed-run timer (counts up). */
  private modeElapsed = 0;
  /** For revive once-per-run. */
  private hasUsedRevive = false;
  private lastFrameTime = performance.now();
  private rafId = 0;
  private touchControlsEl: HTMLDivElement | null = null;
  private uiRoot: HTMLElement;
  private touchRoot: HTMLElement;
  private overlayRoot: HTMLElement;
  private toastRoot: HTMLElement;
  /** Last cause of death for the game-over screen. */
  private lastCause = 'Lost in the climb';
  /** Tracks lifetime dash count for achievements. */
  private dashCount = 0;
  /** Hook-time tracker for "Iron Lungs" achievement. */
  private hookAttachedFrames = 0;
  /** Single-attempt-per-day gating for daily challenge ranked. */
  private dailyRankedThisAttempt = false;

  constructor(opts: {
    canvas: HTMLCanvasElement;
    uiRoot: HTMLElement;
    touchRoot: HTMLElement;
    overlayRoot: HTMLElement;
    toastRoot: HTMLElement;
  }) {
    this.renderer = new Renderer(opts.canvas);
    this.uiRoot = opts.uiRoot;
    this.touchRoot = opts.touchRoot;
    this.overlayRoot = opts.overlayRoot;
    this.toastRoot = opts.toastRoot;
    this.input = new InputManager(opts.canvas);
    this.sfx = new SFX(this.audio);
    this.music = new Music(this.audio);
    this.progression = new ProgressionSystem(this.save);
    this.achievements = new AchievementSystem(this.save);
    this.unlocks = new UnlockSystem(this.save);
    this.daily = new DailyChallengeSystem(this.save);
    this.toast = new ToastManager(this.toastRoot);
    this.mainMenu = new MainMenu(this.overlayRoot);
    this.pauseMenu = new PauseMenu(this.overlayRoot);
    this.gameOver = new GameOverScreen(this.overlayRoot);
    this.unlocksScreen = new UnlocksScreen(this.overlayRoot);
    this.settingsScreen = new SettingsScreen(this.overlayRoot);
    this.dailyScreen = new DailyChallengeScreen(this.overlayRoot);

    this.themes.setTheme(this.save.data.equippedTheme);
    this.background.init(this.renderer.cssWidth, this.renderer.cssHeight);
    this.haptics.setEnabled(this.save.data.settings.haptics);
    this.input.setTapToggle(this.save.data.settings.tapToggle);

    this.input.onAudioUnlock(() => {
      this.audio.unlock();
      if (this.save.data.settings.music) this.music.play(this.save.data.equippedTheme);
      this.audio.setEnabled('sfx', this.save.data.settings.sound);
      this.audio.setEnabled('music', this.save.data.settings.music);
    });

    // Achievement check for streak rewards on boot
    if (this.save.data.dailyStreak >= 7) this.achievements.unlock('streak-7', this.notifyUnlock);
    if (this.save.data.dailyStreak >= 14) this.achievements.unlock('streak-14', this.notifyUnlock);
    if (this.save.data.level >= 5) this.achievements.setProgress('level-5', this.save.data.level, this.notifyUnlock);
    if (this.save.data.level >= 10) this.achievements.setProgress('level-10', this.save.data.level, this.notifyUnlock);
    if (this.save.data.level >= 20) this.achievements.setProgress('level-20', this.save.data.level, this.notifyUnlock);

    void this.bootPlatform();
  }

  private async bootPlatform(): Promise<void> {
    await this.crazy.init();
    const adapter = this.crazy.cloudAdapter();
    if (adapter) {
      this.save.attachCloud(
        {
          getItem: (k) => adapter.cloudGet(k),
          setItem: (k, v) => adapter.cloudSet(k, v),
        },
        () => this.toast.show('Cloud save synced.'),
      );
    }
    this.openMainMenu();
    this.startLoop();
  }

  private startLoop(): void {
    const tick = (now: number) => {
      const delta = Math.min(50, now - this.lastFrameTime);
      this.lastFrameTime = now;
      // Convert ms to "frames" at 60fps as in the original tuning
      const dt = (delta / 1000) * 60;
      this.tick(dt);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private tick(rawDt: number): void {
    const snap = this.input.snapshot();
    this.input.consume();
    const dt = rawDt * this.camera.timeScale;

    if (snap.pauseJustPressed && this.state === GameState.Playing && !this.paused) {
      this.pause();
    }

    if (this.state === GameState.Playing && !this.paused && this.player && this.world) {
      this.updatePlay(dt, snap);
    }

    // Background camera follow updates the smoothing.
    this.camera.setViewport(this.renderer.cssWidth, this.renderer.cssHeight);
    this.camera.update(rawDt);
    this.screen.update(rawDt);
    this.particles.update(dt);

    this.render(rawDt);
    if (this.state === GameState.Playing && !this.paused && this.player) {
      this.updateHUD();
    }

    // Auto-quality downgrade based on sustained slow frames
    if (rawDt > 22 / (1000 / 60)) {
      this.slowFrameCount += 1;
      if (this.slowFrameCount > 180 && !this.lowQuality) {
        this.lowQuality = true;
        this.particles.setLimit(100);
      }
    } else {
      this.slowFrameCount = Math.max(0, this.slowFrameCount - 1);
    }
  }

  private updatePlay(dt: number, snap: ReturnType<InputManager['snapshot']>): void {
    if (!this.player || !this.world) return;
    this.framesSinceStart += dt;
    this.elapsedSeconds += dt / 60;
    this.world.update(dt);
    this.world.generateUpTo(this.camera.position.y - this.renderer.cssHeight);

    if (this.mode === GameMode.ComboRun) {
      this.modeTimer = COMBO_RUN_SECONDS - this.elapsedSeconds;
      if (this.modeTimer <= 0) {
        this.endRun('Time up');
        return;
      }
    } else if (this.mode === GameMode.TimeAttack) {
      this.modeElapsed = this.elapsedSeconds;
      if (this.player.maxAltitude >= TIME_ATTACK_TARGET_ALT) {
        this.completeTimeAttack();
        return;
      }
    } else if (this.mode === GameMode.BotRace) {
      if (this.player.maxAltitude >= BOT_RACE_TARGET_ALT) {
        this.markRaceFinished('player', this.elapsedSeconds);
        this.endRun('Crossed the finish line');
        return;
      }
    } else if (this.mode === GameMode.EndlessClimb || this.mode === GameMode.DailyChallenge) {
      // Lava accelerates over time.
      if (this.framesSinceStart > 600) {
        this.lavaSpeed += this.lavaAcceleration * dt;
      }
    }

    // Lava (kill line) drifts upward when in modes that use it.
    if (this.usesLava()) {
      this.killY -= this.lavaSpeed * dt;
      this.world.setKillY(this.killY);
    }

    // Build input for player
    const worldPointer = this.camera.screenToWorld(snap.pointer.x, snap.pointer.y);
    const dashRequested =
      snap.dashJustPressed || (snap.twoFingerSwipeDown && this.player.dashCharges > 0);
    if (snap.dashJustPressed) {
      // Already counted.
    }
    const playerInput: PlayerInputState = {
      moveX: snap.moveX,
      reel: snap.reel,
      pointerDown: snap.pointerDown,
      dashRequested,
      hookTarget: snap.pointerJustDown
        ? worldPointer
        : null,
      releaseHook: snap.pointerJustReleased,
    };
    if (dashRequested && this.player.dashCharges > 0) this.dashCount += 1;

    this.player.update(dt, playerInput, this.world, this.killY);

    // Track Iron Lungs achievement
    if (this.player.hook.state === 'attached') {
      this.hookAttachedFrames += dt;
      if (this.hookAttachedFrames > 60 * 60) {
        this.achievements.unlock('survive-60s', this.notifyUnlock);
      }
    } else {
      this.hookAttachedFrames = 0;
    }

    // Update bots in race mode
    for (const bot of this.bots) {
      bot.update(dt, this.world, this.killY, this.framesSinceStart);
      if (this.mode === GameMode.BotRace && bot.player.maxAltitude >= BOT_RACE_TARGET_ALT) {
        this.markRaceFinished(bot.personality.name.toLowerCase() as RaceParticipant['id'], this.elapsedSeconds);
      }
    }

    // Combo expires
    if (this.combo.update(dt)) {
      // Chain expired silently.
    }

    // Scoring
    this.scoring.updateAltitude(this.player.maxAltitude);
    this.scoring.setCombo(this.combo.combo);

    // Camera
    this.camera.follow(this.player.pos, this.player.vel);

    // Trail
    const trailDef = getTrail(this.save.data.equippedTrail);
    this.trailRenderer.push(this.player.pos.x, this.player.pos.y, trailDef, dt);
    this.trailRenderer.update(dt, trailDef);

    // Record ghost frames every ~4 ticks for daily/endless
    if (this.mode === GameMode.DailyChallenge || this.mode === GameMode.EndlessClimb) {
      this.ghostRecordCounter += dt;
      if (this.ghostRecordCounter > 4) {
        this.ghostRecordCounter = 0;
        this.ghostRecording.push({
          px: this.player.pos.x,
          py: this.player.pos.y,
          hx: this.player.hook.position.x,
          hy: this.player.hook.position.y,
          hookActive: this.player.hook.state === 'attached' ? 1 : 0,
        });
      }
    }

    // Update achievements
    this.achievements.setProgress('climb-100', this.player.maxAltitude, this.notifyUnlock);
    this.achievements.setProgress('climb-500', this.player.maxAltitude, this.notifyUnlock);
    this.achievements.setProgress('climb-1000', this.player.maxAltitude, this.notifyUnlock);
    this.achievements.setProgress('climb-2500', this.player.maxAltitude, this.notifyUnlock);
    this.achievements.setProgress('climb-5000', this.player.maxAltitude, this.notifyUnlock);
    this.achievements.setProgress('climb-10000', this.player.maxAltitude, this.notifyUnlock);
    this.achievements.setProgress('combo-3', this.combo.peak, this.notifyUnlock);
    this.achievements.setProgress('combo-5', this.combo.peak, this.notifyUnlock);
    this.achievements.setProgress('combo-10', this.combo.peak, this.notifyUnlock);
    this.achievements.setProgress('perfect-10', this.combo.perfectAnchors, this.notifyUnlock);
    this.achievements.setProgress('perfect-100', this.combo.perfectAnchors, this.notifyUnlock);
    this.achievements.setProgress('near-miss-25', this.combo.nearMisses, this.notifyUnlock);
    this.achievements.setProgress('near-miss-200', this.combo.nearMisses, this.notifyUnlock);
    this.achievements.setProgress('dash-50', this.dashCount, this.notifyUnlock);

    if (this.player.dead && !this.gameEnded) {
      this.endRun(this.lastCause);
    }
  }

  private usesLava(): boolean {
    return (
      this.mode === GameMode.EndlessClimb ||
      this.mode === GameMode.DailyChallenge ||
      this.mode === GameMode.ComboRun
    );
  }

  private notifyUnlock = (e: { def: { id: string; name: string; reward: number } }): void => {
    this.toast.show(`Achievement: ${e.def.name} (+${e.def.reward} Sparks)`);
    this.haptics.trigger('unlock');
    this.sfx.unlock();
  };

  /* ---------- Render ---------- */

  private render(dt: number): void {
    const theme = this.themes.current;
    this.renderer.clear(theme.skyBottom);
    this.background.draw(this.renderer, this.camera, theme, this.framesSinceStart, this.lowQuality || this.save.data.settings.reducedMotion);

    if (this.world && this.player) {
      this.renderer.pushCamera(this.camera);
      // Lava
      if (this.usesLava()) {
        this.drawLava(theme.lava);
      }
      // Obstacles
      this.drawObstacles(this.world.obstacles, dt);
      // Trail
      const trailDef = getTrail(this.save.data.equippedTrail);
      this.trailRenderer.draw(this.renderer.ctx, trailDef, this.lowQuality);
      // Ghost playback
      if (this.ghostPlayback && this.save.data.settings.showGhost) {
        this.drawGhost(this.ghostPlayback);
      }
      // Bots
      for (const bot of this.bots) {
        this.drawPlayer(bot.player, bot.personality.color, bot.personality.color, true);
      }
      // Player
      const skin = getSkin(this.save.data.equippedSkin);
      this.drawPlayer(this.player, skin.primary, skin.glow, false);
      // Hook
      const hookDef = getHook(this.save.data.equippedHook);
      this.hookRenderer.draw(
        this.renderer.ctx,
        this.player.hook,
        this.player.pos,
        hookDef,
        this.framesSinceStart,
        this.lowQuality,
      );
      // Particles
      this.particles.draw(this.renderer.ctx, this.lowQuality);
      // Floating texts
      this.screen.drawWorld(this.renderer.ctx);
      this.renderer.popCamera();
    }
    this.screen.drawScreen(this.renderer, this.camera);
  }

  private drawObstacles(obstacles: Obstacle[], _dt: number): void {
    const ctx = this.renderer.ctx;
    for (const o of obstacles) {
      const cx = o.x + o.width / 2;
      const cy = o.y + o.height / 2;
      if (!this.isVisible(cx, cy, Math.max(o.width, o.height))) continue;
      const pulse = 0.6 + Math.sin(o.pulse) * 0.4;
      const alpha = o.unstableTriggered ? Math.max(0, 1 - o.unstableTimer / 24) : 1;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = o.color;
      if (!this.lowQuality) {
        ctx.shadowColor = o.color;
        ctx.shadowBlur = (o.kind === 'energy' ? 22 : 10) * pulse;
      }
      if (o.kind === 'energy') {
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(o.width, o.height) / 2 + Math.sin(o.pulse) * 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (o.kind === 'spike') {
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const x = o.x + (i * o.width) / 4 + o.width / 8;
          ctx.moveTo(x - 5, o.y + o.height);
          ctx.lineTo(x, o.y);
          ctx.lineTo(x + 5, o.y + o.height);
        }
        ctx.fill();
      } else if (o.kind === 'drone') {
        ctx.fillRect(o.x, o.y, o.width, o.height);
        ctx.strokeStyle = o.color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(o.x - 6, o.y + o.height / 2);
        ctx.lineTo(o.x + o.width + 6, o.y + o.height / 2);
        ctx.stroke();
      } else {
        ctx.fillRect(o.x, o.y, o.width, o.height);
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  private drawPlayer(player: Player, primary: string, glow: string, isBot: boolean): void {
    if (player.dead) return;
    const ctx = this.renderer.ctx;
    ctx.save();
    ctx.translate(player.pos.x, player.pos.y);
    const angle = Math.atan2(player.vel.y, player.vel.x) || -Math.PI / 2;
    ctx.rotate(angle + Math.PI / 2);
    if (!this.lowQuality) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = isBot ? 6 : 16;
    }
    if (player.dashFlashTimer > 0) {
      ctx.shadowBlur = 28;
      ctx.shadowColor = '#ffffff';
    }
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.moveTo(0, -player.radius * 1.4);
    ctx.lineTo(player.radius, player.radius);
    ctx.lineTo(0, player.radius * 0.5);
    ctx.lineTo(-player.radius, player.radius);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -player.radius * 0.3, player.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawGhost(frames: GhostFrame[]): void {
    if (!this.player) return;
    const ctx = this.renderer.ctx;
    const playerY = this.player.pos.y;
    let drawn = 0;
    for (let i = frames.length - 1; i >= 0; i--) {
      const f = frames[i]!;
      if (Math.abs(f.py - playerY) > this.renderer.cssHeight) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(f.px, f.py, 8, 0, Math.PI * 2);
      ctx.fill();
      if (++drawn > 12) break;
    }
  }

  private drawLava(colors: [string, string]): void {
    if (!this.player) return;
    const ctx = this.renderer.ctx;
    const w = WORLD_WIDTH;
    const x = -w / 2;
    const y = this.killY;
    const grad = ctx.createLinearGradient(0, y - 60, 0, y + 240);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.4, colors[0]);
    grad.addColorStop(1, colors[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(x - 800, y, w + 1600, 800);
    ctx.strokeStyle = colors[0];
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = -10; i <= 10; i++) {
      const xi = i * (w / 10);
      const wave = Math.sin(this.framesSinceStart * 0.04 + i) * 6;
      if (i === -10) ctx.moveTo(xi, y + wave);
      else ctx.lineTo(xi, y + wave);
    }
    ctx.stroke();
  }

  private isVisible(x: number, y: number, padding: number): boolean {
    const half = this.renderer.cssWidth * 0.75;
    const halfV = this.renderer.cssHeight * 0.75;
    return (
      Math.abs(x - this.camera.position.x) < half + padding &&
      Math.abs(y - this.camera.position.y) < halfV + padding
    );
  }

  /* ---------- HUD ---------- */

  private updateHUD(): void {
    if (!this.hud || !this.player) return;
    let modeTimer: number | undefined;
    let modeTimerLabel: string | undefined;
    let modeProgress: number | undefined;
    let modeProgressLabel: string | undefined;
    let raceStatus: string | undefined;
    if (this.mode === GameMode.ComboRun) {
      modeTimer = Math.max(0, this.modeTimer);
      modeTimerLabel = 'Sprint';
    } else if (this.mode === GameMode.TimeAttack) {
      modeTimer = this.modeElapsed;
      modeTimerLabel = 'Run Time';
      modeProgress = this.player.maxAltitude / TIME_ATTACK_TARGET_ALT;
      modeProgressLabel = 'To Exit';
    } else if (this.mode === GameMode.BotRace) {
      modeProgress = this.player.maxAltitude / BOT_RACE_TARGET_ALT;
      modeProgressLabel = 'To Finish';
      const sorted = [...this.raceParticipants].sort((a, b) => b.altitude - a.altitude);
      const myRank = sorted.findIndex((p) => p.id === 'player') + 1;
      raceStatus = `#${myRank} of ${sorted.length}`;
    }
    this.hud.update({
      mode: this.mode,
      player: this.player,
      combo: this.combo,
      scoring: this.scoring,
      bestAltitude: this.save.data.bestAltitude[this.mode] ?? 0,
      bestScore: this.save.data.bestScore[this.mode] ?? 0,
      ...(modeTimer !== undefined ? { modeTimer } : {}),
      ...(modeTimerLabel !== undefined ? { modeTimerLabel } : {}),
      ...(modeProgress !== undefined ? { modeProgress } : {}),
      ...(modeProgressLabel !== undefined ? { modeProgressLabel } : {}),
      ...(raceStatus !== undefined ? { raceStatus } : {}),
    });
    // Update race participants altitude
    if (this.mode === GameMode.BotRace) {
      const playerPart = this.raceParticipants.find((p) => p.id === 'player');
      if (playerPart) playerPart.altitude = this.player.maxAltitude;
      for (const bot of this.bots) {
        const p = this.raceParticipants.find(
          (rp) => rp.id === (bot.personality.name.toLowerCase() as RaceParticipant['id']),
        );
        if (p) p.altitude = bot.player.maxAltitude;
      }
    }
  }

  /* ---------- State transitions ---------- */

  openMainMenu(): void {
    this.cleanupRun();
    this.state = GameState.MainMenu;
    this.mainMenu.open(this.save, this.daily, {
      onPlay: (mode) => this.startMode(mode),
      onUnlocks: () => this.unlocksScreen.open(this.save, this.unlocks, this.toast, {
        onClose: () => this.openMainMenu(),
      }),
      onSettings: () => this.settingsScreen.open(this.save, this.audio, this.music, this.toast, {
        onClose: () => this.openMainMenu(),
        onTutorialReset: () => this.openMainMenu(),
      }),
      onLeaderboard: (mode) => {
        const score = this.save.data.bestScore[mode] ?? 0;
        const board = this.leaderboardSys.generateDaily(this.daily.today().seed, score);
        this.dailyScreen.open(this.save, this.daily, board, {
          onPlay: () => this.startMode(GameMode.DailyChallenge),
          onClose: () => this.openMainMenu(),
        });
      },
      onTutorial: () => {
        this.startMode(GameMode.EndlessClimb);
        this.startTutorial();
      },
    });
  }

  private startTutorial(): void {
    if (this.tutorial) return;
    this.tutorial = new Tutorial();
    this.tutorial.start(() => {
      this.tutorial?.destroy();
      this.tutorial = null;
      this.save.data.settings.tutorialSeen = true;
      this.save.save();
    });
  }

  private startMode(mode: GameMode): void {
    this.mode = mode;
    this.mainMenu.close();
    this.dailyScreen.close();
    this.gameOver.close();
    this.cleanupRun();

    let seed: number;
    let staticLayout: Obstacle[] | undefined;
    switch (mode) {
      case GameMode.DailyChallenge: {
        const today = this.daily.today();
        seed = today.seed;
        this.dailyRankedThisAttempt = !this.daily.hasSubmittedToday();
        break;
      }
      case GameMode.TimeAttack:
        seed = 0xc0ffee;
        staticLayout = this.buildTimeAttackLayout();
        break;
      case GameMode.ComboRun:
        seed = (Math.random() * 0xffffffff) | 0;
        break;
      case GameMode.BotRace:
        seed = (Math.random() * 0xffffffff) | 0;
        break;
      default:
        seed = (Math.random() * 0xffffffff) | 0;
        break;
    }

    this.world = new World({
      seed,
      worldWidth: WORLD_WIDTH,
      startY: 0,
      spawnGapMin: 140,
      spawnGapMax: 240,
      finishY: null,
      staticLayout,
    });
    this.player = new Player(0, -120);
    this.player.setEvents({
      onHookConnect: (e) => {
        this.combo.onHookConnect(e.perfectAnchor);
        this.sfx.hookConnect(e.distance);
        this.camera.shake(5);
        this.particles.burst(e.position.x, e.position.y, 18, e.obstacle.color, { speed: 0.8 });
        this.haptics.trigger('hookConnect');
        if (e.perfectAnchor) {
          this.scoring.addBonus(50);
          this.screen.addFloatingText('PERFECT ANCHOR', e.position.x, e.position.y - 12, '#00ff8a', { size: 14 });
        }
      },
      onHookRelease: (vel) => {
        this.combo.onHookRelease();
        this.sfx.hookRelease();
        this.sfx.swingWhoosh(vel.len());
        if (this.combo.combo > 1 && this.combo.combo % 3 === 0) {
          this.sfx.combo(this.combo.combo);
          this.camera.flash(0.2);
          this.haptics.trigger('comboMilestone');
          this.screen.addFloatingText(`COMBO ×${this.combo.combo}`, this.player!.pos.x, this.player!.pos.y - 30, '#ff9d2e', { size: 18 });
        }
      },
      onDash: () => {
        this.sfx.dash();
        this.camera.shake(8);
        this.camera.chroma(0.4);
        this.particles.burst(this.player!.pos.x, this.player!.pos.y, 14, '#ff2bff', { speed: 0.5 });
        this.haptics.trigger('dash');
      },
      onDeath: (cause) => {
        this.lastCause = cause;
        this.sfx.death();
        this.camera.shake(20);
        this.camera.flash(0.6);
        this.camera.slowMo(0.4, 5);
        this.particles.burst(this.player!.pos.x, this.player!.pos.y, 40, '#ff255e', { speed: 1.6, life: 1.4 });
        this.haptics.trigger('death');
      },
      onNearMiss: (obs, _distance) => {
        this.combo.onNearMiss();
        this.scoring.addBonus(15);
        this.sfx.nearMiss();
        this.camera.flash(0.08);
        this.haptics.trigger('nearMiss');
        this.screen.addFloatingText('NEAR MISS', obs.x + obs.width / 2, obs.y - 8, '#00f3ff', { size: 13 });
      },
      onBounce: (obs) => {
        this.sfx.bounce();
        this.camera.shake(6);
        this.particles.burst(obs.x + obs.width / 2, obs.y + obs.height / 2, 12, obs.color, { speed: 0.7 });
        this.haptics.trigger('bounce');
      },
    });

    // Reset state
    this.scoring.reset();
    this.combo.reset();
    this.particles.clear();
    this.screen.clear();
    this.trailRenderer.reset();
    this.camera.reset(this.player.pos);
    this.killY = 600;
    this.lavaSpeed = mode === GameMode.ComboRun ? 1.8 : 0.94;
    this.framesSinceStart = 0;
    this.elapsedSeconds = 0;
    this.gameEnded = false;
    this.modeTimer = COMBO_RUN_SECONDS;
    this.modeElapsed = 0;
    this.hasUsedRevive = false;
    this.dashCount = 0;
    this.hookAttachedFrames = 0;
    this.ghostRecording = [];
    this.ghostPlayback =
      mode === GameMode.EndlessClimb || mode === GameMode.DailyChallenge
        ? this.save.data.personalBestGhost
          ? this.decodeGhost(this.save.data.personalBestGhost)
          : null
        : null;
    this.bots = [];
    this.raceParticipants = [];

    if (mode === GameMode.BotRace) {
      const startX = -160;
      for (let i = 0; i < BOT_PERSONALITIES.length; i++) {
        const personality = BOT_PERSONALITIES[i]!;
        const bot = new Bot(personality, startX + (i + 1) * 80, -120);
        this.bots.push(bot);
        this.raceParticipants.push({
          id: personality.name.toLowerCase() as RaceParticipant['id'],
          name: personality.name,
          color: personality.color,
          altitude: 0,
          finished: false,
          finishTime: null,
        });
      }
      this.raceParticipants.unshift({
        id: 'player',
        name: 'YOU',
        color: '#00f3ff',
        altitude: 0,
        finished: false,
        finishTime: null,
      });
    }

    if (this.mode === GameMode.DailyChallenge) {
      this.achievements.unlock('daily-attempt', this.notifyUnlock);
    }

    // UI
    this.hud = new HUD(this.uiRoot);
    this.ensureTouchControls();
    this.state = GameState.Playing;
    this.paused = false;
    this.crazy.gameplayStart();
    if (this.save.data.settings.music) this.music.play(this.save.data.equippedTheme);

    if (!this.save.data.settings.tutorialSeen && mode === GameMode.EndlessClimb) {
      this.startTutorial();
    }
  }

  private markRaceFinished(id: RaceParticipant['id'], time: number): void {
    const p = this.raceParticipants.find((x) => x.id === id);
    if (!p || p.finished) return;
    p.finished = true;
    p.finishTime = time;
  }

  private buildTimeAttackLayout(): Obstacle[] {
    // Hand-pick a deterministic course toward 5000m
    const obs: Obstacle[] = [];
    let id = 100000;
    let y = -160;
    let x = 0;
    while (-y / 10 < TIME_ATTACK_TARGET_ALT + 30) {
      const dx = Math.sin(-y / 220) * 240;
      x = dx;
      const isEnergy = (-y / 200) % 4 < 1;
      obs.push({
        id: id++,
        x: x - 90,
        y,
        width: isEnergy ? 40 : 180,
        height: isEnergy ? 40 : 20,
        kind: isEnergy ? 'energy' : 'platform',
        color: isEnergy ? '#a45cff' : '#00f3ff',
        grappleable: true,
        lethal: false,
        bouncy: false,
        unstableTimer: 0,
        unstableTriggered: false,
        amp: 0,
        driftAngle: 0,
        driftSpeed: 0,
        lastX: x - 90,
        pulse: 0,
      });
      // Side spike for risk
      if ((-y / 200) % 7 < 1) {
        obs.push({
          id: id++,
          x: x + 140,
          y: y + 30,
          width: 80,
          height: 12,
          kind: 'spike',
          color: '#ff255e',
          grappleable: false,
          lethal: true,
          bouncy: false,
          unstableTimer: 0,
          unstableTriggered: false,
          amp: 0,
          driftAngle: 0,
          driftSpeed: 0,
          lastX: x + 140,
          pulse: 0,
        });
      }
      y -= 200;
    }
    return obs;
  }

  private decodeGhost(arr: number[]): GhostFrame[] {
    const frames: GhostFrame[] = [];
    for (let i = 0; i < arr.length; i += 5) {
      frames.push({
        px: arr[i] ?? 0,
        py: arr[i + 1] ?? 0,
        hx: arr[i + 2] ?? 0,
        hy: arr[i + 3] ?? 0,
        hookActive: (arr[i + 4] ?? 0) ? 1 : 0,
      });
    }
    return frames;
  }

  private encodeGhost(frames: GhostFrame[]): number[] {
    const out: number[] = [];
    for (const f of frames) {
      out.push(
        Math.round(f.px),
        Math.round(f.py),
        Math.round(f.hx),
        Math.round(f.hy),
        f.hookActive,
      );
    }
    return out;
  }

  private completeTimeAttack(): void {
    if (this.gameEnded) return;
    const time = this.modeElapsed;
    const previousBest = this.save.data.bestTime[this.mode];
    let medal: TimeAttackResult['medal'] = 'none';
    if (time < TIME_ATTACK_MEDALS.gold) medal = 'gold';
    else if (time < TIME_ATTACK_MEDALS.silver) medal = 'silver';
    else if (time < TIME_ATTACK_MEDALS.bronze) medal = 'bronze';
    const newBest = previousBest === undefined || time < previousBest;
    if (newBest) {
      this.save.data.bestTime[this.mode] = time;
    }
    const currentMedal = this.save.data.timeAttackMedals[this.mode] ?? 'none';
    const rank = { none: 0, bronze: 1, silver: 2, gold: 3 } as const;
    if (rank[medal] > rank[currentMedal]) {
      this.save.data.timeAttackMedals[this.mode] = medal;
      if (medal === 'bronze') this.achievements.unlock('ta-bronze', this.notifyUnlock);
      if (medal === 'silver') this.achievements.unlock('ta-silver', this.notifyUnlock);
      if (medal === 'gold') this.achievements.unlock('ta-gold', this.notifyUnlock);
    }
    this.endRun(`Cleared in ${time.toFixed(2)} s (${medal.toUpperCase()})`);
  }

  /* ---------- Run lifecycle ---------- */

  private endRun(cause: string): void {
    if (this.gameEnded) return;
    this.gameEnded = true;
    this.lastCause = cause;
    this.crazy.gameplayStop();
    if (!this.player) return;

    const altitude = this.player.maxAltitude;
    const score = this.mode === GameMode.ComboRun
      ? Math.floor(this.combo.peak * altitude)
      : this.scoring.total;

    // Bests
    const prevBestAlt = this.save.data.bestAltitude[this.mode] ?? 0;
    const newBestAltitude = altitude > prevBestAlt;
    if (newBestAltitude) this.save.data.bestAltitude[this.mode] = altitude;
    const prevBestScore = this.save.data.bestScore[this.mode] ?? 0;
    const newBestScore = score > prevBestScore;
    if (newBestScore) this.save.data.bestScore[this.mode] = score;
    const newBestTime = this.mode === GameMode.TimeAttack && !this.player.dead;

    // Save ghost on PB in endless/daily
    if (
      (this.mode === GameMode.EndlessClimb || this.mode === GameMode.DailyChallenge) &&
      newBestAltitude
    ) {
      this.save.data.personalBestGhost = this.encodeGhost(this.ghostRecording);
    }

    // Race results
    let raceResult: GameOverContext['raceResult'] | undefined;
    if (this.mode === GameMode.BotRace) {
      const playerPart = this.raceParticipants.find((p) => p.id === 'player');
      if (playerPart && !playerPart.finished) {
        playerPart.altitude = altitude;
      }
      const sorted = [...this.raceParticipants].sort((a, b) => {
        if (a.finished && b.finished) return (a.finishTime ?? 0) - (b.finishTime ?? 0);
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.altitude - a.altitude;
      });
      const myIdx = sorted.findIndex((p) => p.id === 'player');
      raceResult = { position: myIdx + 1, total: sorted.length };
      if (myIdx === 0) {
        this.save.data.botRaceWins['sparky'] = (this.save.data.botRaceWins['sparky'] ?? 0) + 1;
        this.achievements.unlock('bot-sparky', this.notifyUnlock);
        if (this.bots[1] && sorted[1]?.id === 'phase') this.achievements.unlock('bot-phase', this.notifyUnlock);
        if (sorted[1]?.id === 'apex') this.achievements.unlock('bot-apex', this.notifyUnlock);
      }
    }

    if (this.mode === GameMode.ComboRun) {
      this.achievements.setProgress('combo-run-1000', score, this.notifyUnlock);
    }

    // Daily history + leaderboard
    if (this.mode === GameMode.DailyChallenge) {
      const submitted = this.dailyRankedThisAttempt;
      this.daily.recordRun(score, altitude, this.combo.peak, submitted);
      if (submitted) {
        const board = this.leaderboardSys.generateDaily(this.daily.today().seed, score);
        const myEntry = board.find((b) => b.isYou);
        if (myEntry) {
          const pct = (myEntry.rank - 1) / board.length;
          if (pct <= 0.5) this.achievements.unlock('daily-top50', this.notifyUnlock);
          if (pct <= 0.1) this.achievements.unlock('daily-top10', this.notifyUnlock);
        }
      }
    }

    // Rewards
    const rewards = this.progression.awardRun({
      altitude,
      score,
      bonusComboPeak: this.combo.peak,
      perfectAnchors: this.combo.perfectAnchors,
      nearMisses: this.combo.nearMisses,
      dailyFirstRun: this.mode === GameMode.DailyChallenge && this.dailyRankedThisAttempt,
      completionBonus: this.mode === GameMode.TimeAttack && !this.player.dead,
    });
    this.save.save();
    this.save.flush();

    // Level achievements
    this.achievements.setProgress('level-5', this.save.data.level, this.notifyUnlock);
    this.achievements.setProgress('level-10', this.save.data.level, this.notifyUnlock);
    this.achievements.setProgress('level-20', this.save.data.level, this.notifyUnlock);

    // Streak ach if applicable
    this.achievements.setProgress('streak-7', this.save.data.dailyStreak, this.notifyUnlock);
    this.achievements.setProgress('streak-14', this.save.data.dailyStreak, this.notifyUnlock);

    // Construct game over screen
    this.state = GameState.GameOver;
    this.tutorial?.skip();
    this.hud?.destroy();
    this.hud = null;
    this.removeTouchControls();
    const ctx: GameOverContext = {
      mode: this.mode,
      cause,
      score,
      altitude,
      peakCombo: this.combo.peak,
      perfectAnchors: this.combo.perfectAnchors,
      nearMisses: this.combo.nearMisses,
      newBestAltitude,
      newBestScore,
      newBestTime,
      elapsedSeconds: this.elapsedSeconds,
      rewards,
      canRevive:
        !this.hasUsedRevive &&
        this.player.dead &&
        (this.mode === GameMode.EndlessClimb || this.mode === GameMode.DailyChallenge),
      ...(raceResult ? { raceResult } : {}),
    };
    void this.maybeShowAd();
    this.gameOver.open(ctx, {
      onRetry: () => this.startMode(this.mode),
      onMenu: () => this.openMainMenu(),
      onRevive: () => this.requestRevive(),
      onWatch2xAd: () => void this.watchDoubleAd(),
    });
  }

  private async maybeShowAd(): Promise<void> {
    if (!this.crazy.available) return;
    await this.crazy.requestAd('midgame', 240);
  }

  private async requestRevive(): Promise<void> {
    if (this.hasUsedRevive || !this.player) return;
    const adResult = await this.crazy.requestAd('rewarded');
    if (!adResult.rewarded && this.crazy.available) {
      this.toast.show('Ad failed — try again.');
      this.gameOver.open(this.buildLastGameOverCtx(), {
        onRetry: () => this.startMode(this.mode),
        onMenu: () => this.openMainMenu(),
        onRevive: () => this.requestRevive(),
        onWatch2xAd: () => void this.watchDoubleAd(),
      });
      return;
    }
    // Without an SDK present, still allow the revive as a courtesy.
    this.hasUsedRevive = true;
    this.gameEnded = false;
    this.state = GameState.Playing;
    this.player.revive();
    this.gameOver.close();
    this.hud = new HUD(this.uiRoot);
    this.ensureTouchControls();
    this.crazy.gameplayStart();
    this.toast.show('Revived!');
  }

  private async watchDoubleAd(): Promise<void> {
    const adResult = await this.crazy.requestAd('rewarded');
    if (adResult.rewarded || !this.crazy.available) {
      const bonus = Math.floor((this.save.data.bestScore[this.mode] ?? 0) * 0); // we doubled the *current* run; for simplicity grant 100% bonus of what was awarded already.
      // The simplest interpretation: double the rewards awarded by this run.
      const lastRunSparks =
        Math.floor((this.player?.maxAltitude ?? 0) / 50) +
        Math.floor(this.scoring.total / 200) +
        this.combo.perfectAnchors;
      this.save.data.sparks += lastRunSparks + bonus;
      this.save.save();
      this.toast.show(`+${lastRunSparks} bonus Sparks!`);
    }
  }

  private buildLastGameOverCtx(): GameOverContext {
    return {
      mode: this.mode,
      cause: this.lastCause,
      score: this.scoring.total,
      altitude: this.player?.maxAltitude ?? 0,
      peakCombo: this.combo.peak,
      perfectAnchors: this.combo.perfectAnchors,
      nearMisses: this.combo.nearMisses,
      newBestAltitude: false,
      newBestScore: false,
      newBestTime: false,
      elapsedSeconds: this.elapsedSeconds,
      rewards: { xp: 0, sparks: 0, bonusXp: 0, levelUps: [] },
      canRevive: false,
    };
  }

  private pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.state = GameState.Paused;
    this.pauseMenu.open({
      onResume: () => {
        this.paused = false;
        this.state = GameState.Playing;
      },
      onRestart: () => this.startMode(this.mode),
      onExit: () => this.openMainMenu(),
      onSettings: () =>
        this.settingsScreen.open(this.save, this.audio, this.music, this.toast, {
          onClose: () => {
            this.pauseMenu.open({
              onResume: () => {
                this.paused = false;
                this.state = GameState.Playing;
              },
              onRestart: () => this.startMode(this.mode),
              onExit: () => this.openMainMenu(),
              onSettings: () => undefined,
            });
          },
          onTutorialReset: () => undefined,
        }),
    });
  }

  private cleanupRun(): void {
    this.hud?.destroy();
    this.hud = null;
    this.removeTouchControls();
    this.particles.clear();
    this.screen.clear();
    this.trailRenderer.reset();
  }

  private ensureTouchControls(): void {
    if (this.touchControlsEl) return;
    const wrap = document.createElement('div');
    wrap.className = 'touch-controls visible';
    const pause = document.createElement('button');
    pause.className = 'touch-btn pause';
    pause.textContent = 'II';
    pause.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.pause();
    }, { passive: false });
    pause.addEventListener('click', () => this.pause());
    const dash = document.createElement('button');
    dash.className = 'touch-btn dash';
    dash.textContent = 'DASH';
    dash.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.input.triggerDash();
    }, { passive: false });
    dash.addEventListener('click', () => this.input.triggerDash());
    wrap.appendChild(dash);
    this.touchRoot.appendChild(wrap);
    document.body.appendChild(pause);
    this.touchControlsEl = wrap;
    (wrap as unknown as { _pauseBtn: HTMLButtonElement })._pauseBtn = pause;
  }

  private removeTouchControls(): void {
    if (!this.touchControlsEl) return;
    const pauseBtn = (this.touchControlsEl as unknown as { _pauseBtn: HTMLButtonElement })._pauseBtn;
    pauseBtn?.remove();
    this.touchControlsEl.remove();
    this.touchControlsEl = null;
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    this.cleanupRun();
    this.music.stop();
  }
}

// Touch utc for future leaderboard timestamping.
export const __debugTodayKey = utcDateKey;
// reference clamp to keep tree-shaking happy in case it's needed by future modes.
void clamp;
