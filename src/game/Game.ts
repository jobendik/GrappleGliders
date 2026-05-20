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
import {
  LayeredLeaderboardBackend,
  LeaderboardSystem,
  LocalLeaderboardBackend,
  RemoteLeaderboardBackend,
} from '../systems/LeaderboardSystem';
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
import { NamePromptScreen } from '../ui/NamePromptScreen';

import { getSkin } from '../content/skins';
import { getHook } from '../content/hooks';
import { getTrail } from '../content/trails';
import { clamp } from '../utils/math';
import { withAlpha as withAlphaColor, mix as mixColor, lighten } from '../utils/color';
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
  leaderboardSys: LeaderboardSystem;
  crazy = new CrazyGamesPlatform();

  toast: ToastManager;
  hud: HUD | null = null;
  mainMenu: MainMenu;
  pauseMenu: PauseMenu;
  gameOver: GameOverScreen;
  unlocksScreen: UnlocksScreen;
  settingsScreen: SettingsScreen;
  dailyScreen: DailyChallengeScreen;
  namePrompt: NamePromptScreen;
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
  /** Sparks collected during the current run (mid-run rewards). */
  private runSparks = 0;
  /** Highest milestone celebrated this run (rounded down to nearest 250 then 500). */
  private nextMilestone = 100;
  /** Frames remaining of "slow lava" effect from the slow-pickup. */
  private slowLavaFrames = 0;
  /** Have we shown the preroll midgame ad yet this session? */
  private prerollShown = false;

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
    this.leaderboardSys = new LeaderboardSystem(this.buildLeaderboardBackend());
    this.toast = new ToastManager(this.toastRoot);
    this.mainMenu = new MainMenu(this.overlayRoot);
    this.pauseMenu = new PauseMenu(this.overlayRoot);
    this.gameOver = new GameOverScreen(this.overlayRoot);
    this.unlocksScreen = new UnlocksScreen(this.overlayRoot);
    this.settingsScreen = new SettingsScreen(this.overlayRoot);
    this.dailyScreen = new DailyChallengeScreen(this.overlayRoot);
    this.namePrompt = new NamePromptScreen(this.overlayRoot);

    this.themes.setTheme(this.save.data.equippedTheme);
    this.background.init(this.renderer.cssWidth, this.renderer.cssHeight);
    this.haptics.setEnabled(this.save.data.settings.haptics);
    this.input.setTapToggle(this.save.data.settings.tapToggle);

    this.input.onAudioUnlock(() => {
      this.audio.unlock();
      // Apply saved volumes before enable so the bus levels are correct on first sound.
      this.audio.setVolume('music', this.save.data.settings.musicVolume);
      this.audio.setVolume('sfx', this.save.data.settings.sfxVolume);
      this.audio.setEnabled('sfx', this.save.data.settings.sound);
      this.audio.setEnabled('music', this.save.data.settings.music);
      if (this.save.data.settings.music) this.music.play(this.save.data.equippedTheme);
    });

    // Auto-pause when the tab loses focus — avoids "I tabbed away and died".
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === GameState.Playing && !this.paused) {
        this.pause();
      }
    });
    window.addEventListener('blur', () => {
      if (this.state === GameState.Playing && !this.paused) this.pause();
    });

    // Achievement check for streak rewards on boot
    if (this.save.data.dailyStreak >= 7) this.achievements.unlock('streak-7', this.notifyUnlock);
    if (this.save.data.dailyStreak >= 14) this.achievements.unlock('streak-14', this.notifyUnlock);
    if (this.save.data.level >= 5) this.achievements.setProgress('level-5', this.save.data.level, this.notifyUnlock);
    if (this.save.data.level >= 10) this.achievements.setProgress('level-10', this.save.data.level, this.notifyUnlock);
    if (this.save.data.level >= 20) this.achievements.setProgress('level-20', this.save.data.level, this.notifyUnlock);

    this.bootPlatform();
  }

  private bootPlatform(): void {
    // Open the menu and start the render loop immediately. The CrazyGames SDK
    // can take 10s to settle into its "disabled" state when this is not the
    // CG portal — we don't want anything on the boot path waiting on it.
    this.openMainMenu();
    this.startLoop();

    void (async () => {
      await this.crazy.init();
      if (!this.crazy.available) return;
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
      // Pull the player's CrazyGames username if available — skips the local prompt.
      if (!this.save.data.playerNameSet) {
        const username = await this.crazy.getUsername();
        if (username) {
          this.save.data.playerName = username.slice(0, 16);
          this.save.data.playerNameSet = true;
          this.save.save();
          this.toast.show(`Signed in as ${this.save.data.playerName}.`);
          // If the main menu is open, refresh it so the new name shows.
          if (this.state === GameState.MainMenu) this.openMainMenu();
        }
      }
    })();
  }

  /**
   * Pick the right backend at boot. When `VITE_LEADERBOARD_API_URL` is set we
   * wrap the local backend with a `RemoteLeaderboardBackend` so the daily board
   * shows real cross-player competition. Without the env var we keep the offline
   * local-only ladder (which still mirrors via CrazyGames cloud save).
   */
  private buildLeaderboardBackend(): LocalLeaderboardBackend | LayeredLeaderboardBackend {
    const local = new LocalLeaderboardBackend(this.save);
    const apiUrl = import.meta.env.VITE_LEADERBOARD_API_URL;
    if (!apiUrl) return local;
    const apiKey = import.meta.env.VITE_LEADERBOARD_API_KEY as string | undefined;
    const fetchPath = import.meta.env.VITE_LEADERBOARD_FETCH_PATH as string | undefined;
    const submitPath = import.meta.env.VITE_LEADERBOARD_SUBMIT_PATH as string | undefined;
    const remote = new RemoteLeaderboardBackend({
      baseUrl: apiUrl,
      ...(apiKey ? { apiKey } : {}),
      ...(fetchPath ? { fetchPath } : {}),
      ...(submitPath ? { submitPath } : {}),
    });
    return new LayeredLeaderboardBackend(remote, local);
  }

  /** Resolve the leaderboard display name for the current player. */
  playerNameForBoard(): string {
    const stored = this.save.data.playerName?.trim();
    if (stored) return stored.slice(0, 16);
    return 'YOU';
  }

  /** Update the player's display name and persist it. */
  setPlayerName(raw: string): void {
    const cleaned = raw.replace(/[^\p{L}\p{N}_\-. ]/gu, '').trim().slice(0, 16);
    this.save.data.playerName = cleaned;
    this.save.data.playerNameSet = cleaned.length > 0;
    this.save.save();
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
    // Generate above whichever actor (player or bot) is currently highest.
    let topActorY = this.player.pos.y;
    for (const bot of this.bots) {
      if (bot.player.pos.y < topActorY) topActorY = bot.player.pos.y;
    }
    this.world.generateUpTo(
      Math.min(this.camera.position.y, topActorY) - this.renderer.cssHeight,
    );

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
      if (this.slowLavaFrames > 0) {
        this.slowLavaFrames -= dt;
        this.killY -= this.lavaSpeed * 0.25 * dt;
      } else {
        this.killY -= this.lavaSpeed * dt;
      }
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

    // Thruster puffs — emit when moving fast or while swinging on the hook.
    // This is gated by lowQuality so it never tanks perf on weak devices.
    if (!this.lowQuality && !this.save.data.settings.reducedMotion) {
      const speed = this.player.vel.len();
      const swinging = this.player.hook.state === 'attached';
      if (speed > 7 || swinging) {
        const speedRatio = Math.min(1, speed / 22);
        const emitChance = swinging ? 0.7 : 0.45 + speedRatio * 0.5;
        if (Math.random() < emitChance) {
          const vx = -this.player.vel.x * 0.18 + (Math.random() - 0.5) * 1.2;
          const vy = -this.player.vel.y * 0.18 + (Math.random() - 0.5) * 1.2;
          const skin = getSkin(this.save.data.equippedSkin);
          this.particles.thruster(
            this.player.pos.x - this.player.vel.x * 0.6,
            this.player.pos.y - this.player.vel.y * 0.6,
            vx,
            vy,
            skin.glow,
          );
          // Occasional hot spark trail at top speed
          if (speedRatio > 0.7 && Math.random() < 0.3) {
            const skin2 = getSkin(this.save.data.equippedSkin);
            this.particles.hotSpark(
              this.player.pos.x - this.player.vel.x * 0.8,
              this.player.pos.y - this.player.vel.y * 0.8,
              vx * 0.5,
              vy * 0.5,
              skin2.glow,
              0.4,
            );
          }
        }
      }
      // Atmospheric dust motes drifting up around the player area — sells
      // depth and altitude. Very rare, doesn't compete with combat particles.
      if (Math.random() < 0.05) {
        const offX = (Math.random() - 0.5) * this.renderer.cssWidth * 1.2;
        const offY = (Math.random() - 0.3) * this.renderer.cssHeight * 0.8;
        const themeAccent = this.themes.current.accent;
        this.particles.mote(this.camera.position.x + offX, this.camera.position.y + offY, themeAccent);
      }
    }

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
    this.achievements.setProgress('sparks-50', this.runSparks, this.notifyUnlock);

    // Altitude milestones: 100, 250, 500, then every 500.
    while (this.player.maxAltitude >= this.nextMilestone) {
      this.celebrateMilestone(this.nextMilestone);
      if (this.nextMilestone < 500) this.nextMilestone += 250;
      else this.nextMilestone += 500;
    }

    // Tutorial altitude notify (final step gates on this).
    this.tutorial?.notify('altitude', { altitude: this.player.maxAltitude });

    // Music intensity follows combo.
    if (this.save.data.settings.music) {
      this.music.setIntensity(Math.min(1, (this.combo.combo - 1) / 9));
    }

    if (this.player.dead && !this.gameEnded) {
      this.endRun(this.lastCause);
    }
  }

  private celebrateMilestone(altitude: number): void {
    if (!this.player) return;
    // Big bold callout
    this.screen.addFloatingText(
      `${altitude}M`,
      this.player.pos.x,
      this.player.pos.y - 70,
      '#ffd400',
      { size: 36, life: 1.8, vy: -1.6, bold: true },
    );
    // Multi-ring shockwave + radial burst + sparkles
    this.particles.shockwave(this.player.pos.x, this.player.pos.y - 30, '#ffd400', {
      size: 30,
      life: 0.8,
      thickness: 5,
    });
    this.particles.shockwave(this.player.pos.x, this.player.pos.y - 30, '#ffffff', {
      size: 18,
      life: 0.6,
      thickness: 3,
    });
    this.particles.burst(this.player.pos.x, this.player.pos.y - 30, 22, '#ffd400', { speed: 1.1, life: 1.2 });
    this.particles.sparkle(this.player.pos.x, this.player.pos.y - 30, '#ffd400', { size: 12, life: 1.4 });
    // Fireworks-style scattering sparkles around the milestone area
    for (let k = 0; k < 8; k++) {
      const a = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 80;
      const px = this.player.pos.x + Math.cos(a) * dist;
      const py = this.player.pos.y - 30 + Math.sin(a) * dist;
      this.particles.sparkle(px, py, k % 2 === 0 ? '#ffd400' : '#ff9d2e', {
        size: 6 + Math.random() * 4,
        life: 0.6 + Math.random() * 0.4,
      });
    }
    this.sfx.combo(Math.min(8, Math.floor(altitude / 500) + 2));
    this.camera.flash(0.22);
    this.screen.pulseBloom(0.4);
    this.haptics.trigger('comboMilestone');
    // Mid-run Sparks reward at major milestones.
    if (altitude >= 500 && altitude % 500 === 0) {
      const reward = Math.min(50, Math.floor(altitude / 100));
      this.runSparks += reward;
      this.screen.addFloatingText(
        `+${reward} SPARKS`,
        this.player.pos.x,
        this.player.pos.y - 38,
        '#ffd400',
        { size: 16, life: 1.4, bold: true },
      );
      // Even bigger flourish for major milestones
      this.particles.shockwave(this.player.pos.x, this.player.pos.y - 30, '#ff9d2e', {
        size: 44,
        life: 1,
        thickness: 4,
      });
      this.camera.shake(6);
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
    this.crazy.happytime();
  };

  /* ---------- Render ---------- */

  private render(dt: number): void {
    const theme = this.themes.current;
    const reduced = this.save.data.settings.reducedMotion;
    this.renderer.clear(theme.skyBottom);
    this.background.draw(this.renderer, this.camera, theme, this.framesSinceStart, this.lowQuality || reduced);

    // Update screen-effect intensities driven by player state.
    if (this.player) {
      const speed = this.player.vel.len();
      // Speed intensity ramps in from speed 14..30 (~ swing fling territory).
      const targetSpeed = Math.max(0, Math.min(1, (speed - 14) / 16));
      // Smooth ramp; recompute every frame.
      this.screen.speedIntensity =
        this.screen.speedIntensity + (targetSpeed - this.screen.speedIntensity) * 0.12;
      if (!this.lowQuality && !reduced && this.screen.speedIntensity > 0.15) {
        this.screen.emitSpeedLines(this.screen.speedIntensity, this.renderer.cssWidth, this.renderer.cssHeight);
      }
      // Combo tint follows current combo, fading naturally.
      if (this.combo.combo >= 2) {
        const t = Math.min(1, (this.combo.combo - 1) / 8);
        const tintColor =
          this.combo.combo >= 6 ? '#ff2bff' : this.combo.combo >= 4 ? '#ff9d2e' : '#ffd400';
        this.screen.setComboTint(tintColor, 0.3 + t * 0.5);
      }
    }

    if (this.world && this.player) {
      this.renderer.pushCamera(this.camera);
      // Lava
      if (this.usesLava()) {
        this.drawLava(theme.lava);
      }
      // Personal best altitude line
      this.drawPersonalBestLine();
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
        this.player.vel,
        hookDef,
        this.framesSinceStart,
        this.lowQuality,
      );
      // Particles
      this.particles.draw(this.renderer.ctx, this.lowQuality);
      // Floating texts
      this.screen.drawWorld(this.renderer.ctx);
      this.renderer.popCamera();
      // Lava-proximity vignette on top of the world.
      if (this.usesLava()) this.drawLavaVignette();
      // Shield indicator near player
      if (this.player.shield > 0) this.drawShieldHalo();
      // Magnet halo — rotating orbit ring around the player while active.
      if (this.player.magnetFrames > 0) this.drawMagnetHalo();
    }
    this.screen.drawScreen(this.renderer, this.camera);
  }

  private drawPersonalBestLine(): void {
    if (this.mode !== GameMode.EndlessClimb && this.mode !== GameMode.DailyChallenge) return;
    if (!this.player) return;
    const best = this.save.data.bestAltitude[this.mode] ?? 0;
    if (best <= 50) return;
    if (this.player.maxAltitude >= best) return;
    const y = -best * 10;
    const ctx = this.renderer.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,212,0,0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.moveTo(this.camera.position.x - this.renderer.cssWidth, y);
    ctx.lineTo(this.camera.position.x + this.renderer.cssWidth, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffd400';
    ctx.font = '700 12px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(
      `PB ${Math.floor(best)} M`,
      this.camera.position.x - this.renderer.cssWidth / 2 + 16,
      y - 8,
    );
    ctx.restore();
  }

  private drawLavaVignette(): void {
    if (!this.player) return;
    const distance = this.killY - this.player.pos.y;
    if (distance > 620) return;
    const intensity = Math.max(0, Math.min(1, 1 - distance / 620));
    const ctx = this.renderer.ctx;
    ctx.save();
    const w = this.renderer.cssWidth;
    const h = this.renderer.cssHeight;
    // Bottom-anchored radial vignette — feels like heat radiating up.
    const grad = ctx.createRadialGradient(
      w / 2,
      h * 1.05,
      h * 0.15,
      w / 2,
      h * 1.05,
      h * 1.1,
    );
    grad.addColorStop(0, `rgba(255,80,40,${0.7 * intensity})`);
    grad.addColorStop(0.55, `rgba(255,37,94,${0.38 * intensity})`);
    grad.addColorStop(1, 'rgba(255,37,94,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Thin pulsing band along the bottom warning of imminent danger.
    if (intensity > 0.4) {
      const pulse = 0.55 + Math.sin(this.framesSinceStart * 0.22) * 0.45;
      const band = ctx.createLinearGradient(0, h - 80, 0, h);
      band.addColorStop(0, 'rgba(255,80,40,0)');
      band.addColorStop(1, `rgba(255,200,60,${0.5 * intensity * pulse})`);
      ctx.fillStyle = band;
      ctx.fillRect(0, h - 80, w, 80);
    }

    // Side-edge heat tendrils — vertical orange bars that pulse from the sides.
    if (intensity > 0.55) {
      const pulse = 0.55 + Math.sin(this.framesSinceStart * 0.16) * 0.45;
      const sideA = (intensity - 0.55) * 0.6 * pulse;
      const sideGradL = ctx.createLinearGradient(0, h / 2, 60, h / 2);
      sideGradL.addColorStop(0, `rgba(255,80,40,${sideA})`);
      sideGradL.addColorStop(1, 'rgba(255,80,40,0)');
      ctx.fillStyle = sideGradL;
      ctx.fillRect(0, 0, 60, h);
      const sideGradR = ctx.createLinearGradient(w - 60, h / 2, w, h / 2);
      sideGradR.addColorStop(0, 'rgba(255,80,40,0)');
      sideGradR.addColorStop(1, `rgba(255,80,40,${sideA})`);
      ctx.fillStyle = sideGradR;
      ctx.fillRect(w - 60, 0, 60, h);
    }

    // High-danger full-screen flash (subtle).
    if (intensity > 0.75 && Math.floor(this.framesSinceStart * 0.3) % 2 === 0) {
      ctx.fillStyle = `rgba(255,37,94,${(intensity - 0.75) * 0.45})`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  private drawShieldHalo(): void {
    if (!this.player) return;
    const ctx = this.renderer.ctx;
    this.renderer.pushCamera(this.camera);
    const pulse = 0.6 + Math.sin(this.framesSinceStart * 0.2) * 0.4;
    const px = this.player.pos.x;
    const py = this.player.pos.y;
    const baseR = this.player.radius + 8 + pulse * 3;

    // Outer soft glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(px, py, baseR * 0.6, px, py, baseR * 2);
    halo.addColorStop(0, `rgba(0,255,138,${0.3 + pulse * 0.2})`);
    halo.addColorStop(0.7, 'rgba(0,255,138,0.1)');
    halo.addColorStop(1, 'rgba(0,255,138,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(px, py, baseR * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Hexagonal energy shell — rotates slowly.
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(this.framesSinceStart * 0.02);
    ctx.strokeStyle = `rgba(0,255,138,${0.6 + pulse * 0.3})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = Math.cos(a) * baseR;
      const y = Math.sin(a) * baseR;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    if (this.player.shield > 1) {
      ctx.strokeStyle = `rgba(0,255,138,${0.4 + pulse * 0.3})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(px, py, baseR + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    this.renderer.popCamera();
  }

  /** Rotating magenta orbital ring around the player while magnet is active. */
  private drawMagnetHalo(): void {
    if (!this.player) return;
    const ctx = this.renderer.ctx;
    this.renderer.pushCamera(this.camera);
    const px = this.player.pos.x;
    const py = this.player.pos.y;
    const r = this.player.radius + 14;
    const time = this.framesSinceStart;
    // Glow halo
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(px, py, r * 0.5, px, py, r * 2.2);
    halo.addColorStop(0, 'rgba(164,92,255,0.25)');
    halo.addColorStop(0.7, 'rgba(164,92,255,0.08)');
    halo.addColorStop(1, 'rgba(164,92,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(px, py, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    // Two orbiting "magnet" dots
    for (let k = 0; k < 4; k++) {
      const angle = time * 0.08 + (k * Math.PI) / 2;
      const ox = px + Math.cos(angle) * r;
      const oy = py + Math.sin(angle) * r * 0.45;
      const dotGrad = ctx.createRadialGradient(ox, oy, 0, ox, oy, 4);
      dotGrad.addColorStop(0, '#ffffff');
      dotGrad.addColorStop(0.5, '#a45cff');
      dotGrad.addColorStop(1, 'rgba(164,92,255,0)');
      ctx.fillStyle = dotGrad;
      ctx.beginPath();
      ctx.arc(ox, oy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Tilted orbit line
    ctx.strokeStyle = 'rgba(164,92,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(px, py, r, r * 0.45, time * 0.02, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    this.renderer.popCamera();
  }

  private drawObstacles(obstacles: Obstacle[], _dt: number): void {
    const ctx = this.renderer.ctx;
    const time = this.framesSinceStart;
    for (const o of obstacles) {
      const cx = o.x + o.width / 2;
      const cy = o.y + o.height / 2;
      if (!this.isVisible(cx, cy, Math.max(o.width, o.height))) continue;
      const pulse = 0.6 + Math.sin(o.pulse) * 0.4;
      const alpha = o.unstableTriggered ? Math.max(0, 1 - o.unstableTimer / 24) : 1;
      ctx.globalAlpha = alpha;

      if (o.kind === 'energy') {
        // Energy node: outer pulsing halo, swirling orbit ring, hot core.
        const r = Math.max(o.width, o.height) / 2 + Math.sin(o.pulse) * 3;
        if (!this.lowQuality) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          // Outer aura
          const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3.5);
          aura.addColorStop(0, withAlphaColor(o.color, 0.65 * pulse));
          aura.addColorStop(0.4, withAlphaColor(o.color, 0.22 * pulse));
          aura.addColorStop(1, withAlphaColor(o.color, 0));
          ctx.fillStyle = aura;
          ctx.beginPath();
          ctx.arc(cx, cy, r * 3.5, 0, Math.PI * 2);
          ctx.fill();
          // Orbit ring
          ctx.strokeStyle = withAlphaColor('#ffffff', 0.55 * pulse);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(cx, cy, r * 1.6, r * 0.55, time * 0.03, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = withAlphaColor(o.color, 0.7);
          ctx.beginPath();
          ctx.ellipse(cx, cy, r * 1.45, r * 0.5, time * 0.03 + Math.PI / 3, 0, Math.PI * 2);
          ctx.stroke();
          // Orbiting "electrons" — two small dots on each ring
          for (let k = 0; k < 2; k++) {
            const phase = time * 0.06 + k * Math.PI;
            const ox = cx + Math.cos(phase) * r * 1.6;
            const oy = cy + Math.sin(phase) * r * 0.55;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(ox, oy, 1.4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
        // Core fill — bright white inside, color outside.
        const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        core.addColorStop(0, '#ffffff');
        core.addColorStop(0.4, o.color);
        core.addColorStop(1, withAlphaColor(o.color, 0.85));
        ctx.fillStyle = core;
        if (!this.lowQuality) {
          ctx.shadowColor = o.color;
          ctx.shadowBlur = 20 * pulse;
        }
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Occasional crackle spark
        if (!this.lowQuality && Math.random() < 0.08) {
          const a = Math.random() * Math.PI * 2;
          const sp = 1.5 + Math.random() * 2;
          this.particles.hotSpark(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, o.color, 0.3);
        }
      } else if (o.kind === 'spike') {
        // Spike: gradient blade, pulsing menace.
        ctx.fillStyle = o.color;
        if (!this.lowQuality) {
          ctx.shadowColor = o.color;
          ctx.shadowBlur = 14 * pulse;
        }
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const x = o.x + (i * o.width) / 4 + o.width / 8;
          ctx.moveTo(x - 5, o.y + o.height);
          ctx.lineTo(x, o.y);
          ctx.lineTo(x + 5, o.y + o.height);
        }
        ctx.fill();
        // Bright tips
        if (!this.lowQuality) {
          ctx.fillStyle = withAlphaColor('#ffffff', 0.7 * pulse);
          for (let i = 0; i < 4; i++) {
            const x = o.x + (i * o.width) / 4 + o.width / 8;
            ctx.beginPath();
            ctx.arc(x, o.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // Subtle warning band underneath (only when on camera and close to player)
        ctx.shadowBlur = 0;
      } else if (o.kind === 'drone') {
        // Drone: body with led, exhaust trail, scanning rail line.
        ctx.fillStyle = mixColor(o.color, '#000000', 0.3);
        if (!this.lowQuality) {
          ctx.shadowColor = o.color;
          ctx.shadowBlur = 10 * pulse;
        }
        ctx.fillRect(o.x, o.y, o.width, o.height);
        // Bright edge highlight (top)
        ctx.fillStyle = o.color;
        ctx.fillRect(o.x, o.y, o.width, 2);
        // Scanning rail
        ctx.strokeStyle = withAlphaColor(o.color, 0.7);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(o.x - 8, o.y + o.height / 2);
        ctx.lineTo(o.x + o.width + 8, o.y + o.height / 2);
        ctx.stroke();
        // Scanner dot sweep
        if (!this.lowQuality) {
          const sweep = ((Math.sin(time * 0.06) * 0.5 + 0.5) * (o.width + 16)) - 8;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(o.x + sweep, o.y + o.height / 2, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        // Red LED bottom-right
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(o.x + o.width - 3, o.y + o.height - 3, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (o.kind === 'spark') {
        // Spark: rotating diamond crystal with halo. Big visual reward signal.
        const bob = Math.sin(o.pulse * 3) * 3;
        const r = 6 + Math.sin(o.pulse) * 1.4;
        const drawY = cy + bob;
        if (!this.lowQuality) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const halo = ctx.createRadialGradient(cx, drawY, 0, cx, drawY, r * 4);
          halo.addColorStop(0, withAlphaColor(o.color, 0.8));
          halo.addColorStop(0.4, withAlphaColor(o.color, 0.3));
          halo.addColorStop(1, withAlphaColor(o.color, 0));
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(cx, drawY, r * 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        // Rotating diamond
        ctx.save();
        ctx.translate(cx, drawY);
        ctx.rotate(time * 0.04);
        const grad = ctx.createLinearGradient(0, -r, 0, r);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.5, o.color);
        grad.addColorStop(1, mixColor(o.color, '#000000', 0.3));
        ctx.fillStyle = grad;
        if (!this.lowQuality) {
          ctx.shadowColor = o.color;
          ctx.shadowBlur = 12;
        }
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.2);
        ctx.lineTo(r, 0);
        ctx.lineTo(0, r * 1.2);
        ctx.lineTo(-r, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.restore();
        // Cross-glint
        if (!this.lowQuality) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = withAlphaColor('#ffffff', 0.7);
          ctx.lineWidth = 0.7;
          const beam = r * 2.4;
          ctx.beginPath();
          ctx.moveTo(cx - beam, drawY);
          ctx.lineTo(cx + beam, drawY);
          ctx.moveTo(cx, drawY - beam);
          ctx.lineTo(cx, drawY + beam);
          ctx.stroke();
          ctx.restore();
        }
        ctx.shadowBlur = 0;
      } else if (o.kind === 'shield-pickup' || o.kind === 'magnet-pickup' || o.kind === 'slow-pickup') {
        // Pickup: bobbing orb with concentric ring and rotating arc segments.
        const bob = Math.sin(o.pulse * 2) * 4;
        const r = Math.max(o.width, o.height) / 2;
        const drawY = cy + bob;
        if (!this.lowQuality) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const halo = ctx.createRadialGradient(cx, drawY, 0, cx, drawY, r * 3);
          halo.addColorStop(0, withAlphaColor(o.color, 0.7));
          halo.addColorStop(0.5, withAlphaColor(o.color, 0.2));
          halo.addColorStop(1, withAlphaColor(o.color, 0));
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(cx, drawY, r * 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        // Orb body
        const orb = ctx.createRadialGradient(cx, drawY, 0, cx, drawY, r);
        orb.addColorStop(0, '#ffffff');
        orb.addColorStop(0.5, o.color);
        orb.addColorStop(1, mixColor(o.color, '#000000', 0.3));
        ctx.fillStyle = orb;
        if (!this.lowQuality) {
          ctx.shadowColor = o.color;
          ctx.shadowBlur = 18 * pulse;
        }
        ctx.beginPath();
        ctx.arc(cx, drawY, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Rotating arc segments (orbit indicator)
        if (!this.lowQuality) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.6;
          const baseRot = time * 0.06;
          for (let k = 0; k < 2; k++) {
            ctx.beginPath();
            ctx.arc(cx, drawY, r + 3, baseRot + k * Math.PI, baseRot + k * Math.PI + Math.PI * 0.35);
            ctx.stroke();
          }
        }
        // Symbol hint via subtle inner ring
        ctx.strokeStyle = withAlphaColor('#ffffff', 0.7);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(cx, drawY, r - 4, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Platform / bouncy / unstable — flat rect with gradient depth + edge highlight.
        const isBouncy = o.kind === 'bouncy';
        const isUnstable = o.kind === 'unstable';
        const baseColor = o.color;
        // Body gradient — top half-bright to bottom-shadow gives 3D feel.
        const grad = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.height);
        grad.addColorStop(0, isBouncy ? lighten(baseColor, 0.3) : withAlphaColor(baseColor, 0.95));
        grad.addColorStop(0.5, baseColor);
        grad.addColorStop(1, mixColor(baseColor, '#000000', 0.5));
        ctx.fillStyle = grad;
        if (!this.lowQuality) {
          ctx.shadowColor = baseColor;
          ctx.shadowBlur = (isBouncy ? 14 : isUnstable ? 12 : 8) * pulse;
        }
        ctx.fillRect(o.x, o.y, o.width, o.height);
        ctx.shadowBlur = 0;
        // Glowing top edge
        if (!this.lowQuality) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = withAlphaColor('#ffffff', 0.5 * pulse);
          ctx.fillRect(o.x, o.y, o.width, 1.5);
          // Bouncy panels also get scanline highlights.
          if (isBouncy) {
            ctx.fillStyle = withAlphaColor('#ffffff', 0.25);
            for (let sx = o.x + 4; sx < o.x + o.width - 4; sx += 6) {
              ctx.fillRect(sx, o.y + 2, 2, o.height - 4);
            }
          }
          // Unstable: flashing warning hash lines
          if (isUnstable) {
            const flash = 0.4 + Math.abs(Math.sin(time * 0.18)) * 0.6;
            ctx.fillStyle = withAlphaColor('#ffffff', flash * 0.5);
            ctx.fillRect(o.x, o.y + o.height - 2, o.width, 2);
          }
          ctx.restore();
        }
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  private drawPlayer(player: Player, primary: string, glow: string, isBot: boolean): void {
    if (player.dead) return;
    const ctx = this.renderer.ctx;
    const speed = player.vel.len();
    const fast = Math.min(1, speed / 22);
    const time = this.framesSinceStart;

    // Outer bloom — drawn under the body, additive, scales with speed.
    if (!this.lowQuality) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // Pulsing outer aura
      const breathe = 0.85 + Math.sin(time * 0.12) * 0.15;
      const bloomR = (player.radius * (isBot ? 2.2 : 3.4) + fast * 10) * breathe;
      const bloom = ctx.createRadialGradient(
        player.pos.x,
        player.pos.y,
        0,
        player.pos.x,
        player.pos.y,
        bloomR,
      );
      const a = isBot ? 0.2 : 0.36 + fast * 0.22;
      bloom.addColorStop(0, withAlphaColor(glow, a));
      bloom.addColorStop(0.5, withAlphaColor(glow, a * 0.4));
      bloom.addColorStop(1, withAlphaColor(glow, 0));
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(player.pos.x, player.pos.y, bloomR, 0, Math.PI * 2);
      ctx.fill();
      // Secondary tight glow (whiter core)
      if (!isBot) {
        const tight = ctx.createRadialGradient(
          player.pos.x,
          player.pos.y,
          0,
          player.pos.x,
          player.pos.y,
          player.radius * 1.6,
        );
        tight.addColorStop(0, withAlphaColor('#ffffff', 0.35));
        tight.addColorStop(1, withAlphaColor('#ffffff', 0));
        ctx.fillStyle = tight;
        ctx.beginPath();
        ctx.arc(player.pos.x, player.pos.y, player.radius * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Dash afterimage echoes (only for player)
    if (!this.lowQuality && !isBot && player.dashFlashTimer > 0) {
      const t = player.dashFlashTimer / 8; // 0..1
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 1; i <= 3; i++) {
        const back = i * 6;
        const ax = player.pos.x - player.vel.x * 0.06 * i;
        const ay = player.pos.y - player.vel.y * 0.06 * i;
        const aa = (t * 0.45) / i;
        const echoGrad = ctx.createRadialGradient(ax, ay, 0, ax, ay, player.radius * 1.6);
        echoGrad.addColorStop(0, withAlphaColor('#ffffff', aa));
        echoGrad.addColorStop(0.4, withAlphaColor(glow, aa * 0.7));
        echoGrad.addColorStop(1, withAlphaColor(glow, 0));
        ctx.fillStyle = echoGrad;
        ctx.beginPath();
        ctx.arc(ax, ay, player.radius * (1.4 + i * 0.15), 0, Math.PI * 2);
        ctx.fill();
        void back;
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(player.pos.x, player.pos.y);
    const angle = Math.atan2(player.vel.y, player.vel.x) || -Math.PI / 2;
    ctx.rotate(angle + Math.PI / 2);

    // Motion streak behind the ship when moving fast.
    if (!this.lowQuality && fast > 0.4 && !isBot) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const streakLen = player.radius * (1.8 + fast * 3.6);
      const streak = ctx.createLinearGradient(0, player.radius, 0, player.radius + streakLen);
      streak.addColorStop(0, withAlphaColor(glow, 0.65 * fast));
      streak.addColorStop(0.5, withAlphaColor('#ffffff', 0.35 * fast));
      streak.addColorStop(1, withAlphaColor(glow, 0));
      ctx.fillStyle = streak;
      ctx.beginPath();
      ctx.moveTo(-player.radius * 0.7, player.radius * 0.7);
      ctx.lineTo(player.radius * 0.7, player.radius * 0.7);
      ctx.lineTo(0, player.radius + streakLen);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Engine glow at the tail — pulsing white-hot core
    if (!this.lowQuality && !isBot) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const flicker = 0.85 + Math.sin(time * 0.6) * 0.15;
      const engR = player.radius * (0.55 + fast * 0.4) * flicker;
      const eng = ctx.createRadialGradient(0, player.radius * 0.7, 0, 0, player.radius * 0.7, engR);
      eng.addColorStop(0, '#ffffff');
      eng.addColorStop(0.4, withAlphaColor(glow, 0.85));
      eng.addColorStop(1, withAlphaColor(glow, 0));
      ctx.fillStyle = eng;
      ctx.beginPath();
      ctx.arc(0, player.radius * 0.7, engR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (!this.lowQuality) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = isBot ? 6 : 16;
    }
    if (player.dashFlashTimer > 0) {
      ctx.shadowBlur = 36;
      ctx.shadowColor = '#ffffff';
    }
    // Ship body — gradient fill for depth.
    const bodyGrad = ctx.createLinearGradient(0, -player.radius * 1.4, 0, player.radius);
    bodyGrad.addColorStop(0, '#ffffff');
    bodyGrad.addColorStop(0.3, lighten(primary, 0.2));
    bodyGrad.addColorStop(0.55, primary);
    bodyGrad.addColorStop(1, mixColor(primary, '#000000', 0.5));
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(0, -player.radius * 1.4);
    ctx.lineTo(player.radius, player.radius);
    ctx.lineTo(0, player.radius * 0.5);
    ctx.lineTo(-player.radius, player.radius);
    ctx.closePath();
    ctx.fill();
    // Bright inner pip lines — subtle structural detail
    ctx.shadowBlur = 0;
    if (!isBot) {
      ctx.strokeStyle = withAlphaColor('#ffffff', 0.45);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, -player.radius * 1.2);
      ctx.lineTo(0, player.radius * 0.3);
      ctx.stroke();
    }
    // Cockpit glint — small bright orb with bloom
    ctx.fillStyle = '#ffffff';
    if (!this.lowQuality) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    ctx.arc(0, -player.radius * 0.3, player.radius * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Tiny inner glint dot (highlight)
    ctx.fillStyle = withAlphaColor('#ffffff', 0.95);
    ctx.beginPath();
    ctx.arc(-player.radius * 0.1, -player.radius * 0.4, player.radius * 0.12, 0, Math.PI * 2);
    ctx.fill();
    // Edge highlight
    ctx.strokeStyle = withAlphaColor(glow, 0.95);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -player.radius * 1.4);
    ctx.lineTo(player.radius, player.radius);
    ctx.lineTo(0, player.radius * 0.5);
    ctx.lineTo(-player.radius, player.radius);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  private drawGhost(frames: GhostFrame[]): void {
    if (!this.player) return;
    const ctx = this.renderer.ctx;
    const playerY = this.player.pos.y;
    let drawn = 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = frames.length - 1; i >= 0; i--) {
      const f = frames[i]!;
      if (Math.abs(f.py - playerY) > this.renderer.cssHeight) continue;
      const grad = ctx.createRadialGradient(f.px, f.py, 0, f.px, f.py, 14);
      grad.addColorStop(0, 'rgba(255,255,255,0.35)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(f.px, f.py, 14, 0, Math.PI * 2);
      ctx.fill();
      if (++drawn > 16) break;
    }
    ctx.restore();
  }

  private drawLava(colors: [string, string]): void {
    if (!this.player) return;
    const ctx = this.renderer.ctx;
    const w = WORLD_WIDTH;
    const x = -w / 2;
    const y = this.killY;
    const t = this.framesSinceStart;
    // Body of lava — vertical gradient with heat haze above.
    const grad = ctx.createLinearGradient(0, y - 120, 0, y + 320);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.12, withAlphaColor(colors[0], 0.32));
    grad.addColorStop(0.32, withAlphaColor(colors[0], 0.78));
    grad.addColorStop(0.5, colors[0]);
    grad.addColorStop(1, colors[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(x - 800, y - 80, w + 1600, 880);

    // Heat haze rising above — wavy gradient bands using additive blend.
    if (!this.lowQuality) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const hazeBands = 4;
      for (let i = 0; i < hazeBands; i++) {
        const phase = t * 0.012 + i * 1.7;
        const hy = y - 40 - i * 30 + Math.sin(phase) * 4;
        const haze = ctx.createLinearGradient(0, hy - 30, 0, hy + 30);
        haze.addColorStop(0, 'rgba(0,0,0,0)');
        haze.addColorStop(0.5, withAlphaColor(colors[0], 0.14 - i * 0.025));
        haze.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = haze;
        ctx.fillRect(x - 800, hy - 30, w + 1600, 60);
      }
      ctx.restore();
    }

    // Inner bright glow band right under the surface.
    if (!this.lowQuality) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createLinearGradient(0, y - 35, 0, y + 90);
      glow.addColorStop(0, 'rgba(0,0,0,0)');
      glow.addColorStop(0.5, withAlphaColor('#ffd200', 0.4));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 800, y - 35, w + 1600, 125);
      ctx.restore();
    }

    // Internal magma blobs — pulsing radial gradients beneath the surface for
    // depth. Hand-placed across width but jiggled by sin waves.
    if (!this.lowQuality) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const bx = x + (i + 0.5) * (w / 5) + Math.sin(t * 0.02 + i) * 30;
        const by = y + 50 + Math.cos(t * 0.025 + i * 1.3) * 18;
        const br = 60 + Math.sin(t * 0.03 + i) * 14;
        const blob = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        blob.addColorStop(0, withAlphaColor('#ffe680', 0.55));
        blob.addColorStop(0.5, withAlphaColor(colors[0], 0.25));
        blob.addColorStop(1, withAlphaColor(colors[0], 0));
        ctx.fillStyle = blob;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Wave crest — three layered sines + bright glow for a turbulent surface.
    ctx.save();
    if (!this.lowQuality) {
      ctx.shadowColor = colors[0];
      ctx.shadowBlur = 20;
    }
    // Outermost bright thin line
    ctx.strokeStyle = '#fff7c2';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = -16; i <= 16; i++) {
      const xi = i * (w / 16);
      const wave =
        Math.sin(t * 0.04 + i) * 5 +
        Math.sin(t * 0.09 + i * 0.7) * 3 +
        Math.sin(t * 0.18 + i * 1.3) * 1.5;
      if (i === -16) ctx.moveTo(xi, y + wave);
      else ctx.lineTo(xi, y + wave);
    }
    ctx.stroke();
    // Middle wave line — colored
    ctx.strokeStyle = colors[0];
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = -14; i <= 14; i++) {
      const xi = i * (w / 14);
      const wave = Math.sin(t * 0.04 + i) * 6 + Math.sin(t * 0.07 + i * 0.5) * 2.5;
      if (i === -14) ctx.moveTo(xi, y + wave + 3);
      else ctx.lineTo(xi, y + wave + 3);
    }
    ctx.stroke();
    // Inner dim secondary crest
    ctx.strokeStyle = withAlphaColor('#ffd200', 0.55);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = -12; i <= 12; i++) {
      const xi = i * (w / 12);
      const wave = Math.sin(t * 0.05 + i * 1.3) * 3 + Math.sin(t * 0.13 + i * 0.4) * 1.5;
      if (i === -12) ctx.moveTo(xi, y + wave + 7);
      else ctx.lineTo(xi, y + wave + 7);
    }
    ctx.stroke();
    ctx.restore();

    // Emit embers — denser when lava is near the player.
    if (!this.lowQuality && !this.save.data.settings.reducedMotion) {
      const distToPlayer = y - this.player.pos.y;
      if (distToPlayer < 800) {
        const density = Math.max(0.4, 1 - distToPlayer / 800);
        // Embers
        if (Math.random() < 0.75 * density) {
          const ex = this.player.pos.x + (Math.random() - 0.5) * this.renderer.cssWidth * 0.9;
          this.particles.ember(ex, y - 4, Math.random() < 0.5 ? colors[0] : '#ffd200');
        }
        // Occasional hot spark eruption right at the surface
        if (Math.random() < 0.18 * density) {
          const ex = this.player.pos.x + (Math.random() - 0.5) * this.renderer.cssWidth * 0.9;
          const sp = 2 + Math.random() * 4;
          const ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.7;
          this.particles.hotSpark(
            ex,
            y - 6,
            Math.cos(ang) * sp,
            Math.sin(ang) * sp,
            '#ffd200',
            0.6,
          );
        }
        // Rare lava splash burst when very close
        if (distToPlayer < 380 && Math.random() < 0.05) {
          const ex = this.player.pos.x + (Math.random() - 0.5) * this.renderer.cssWidth * 0.6;
          this.particles.shockwave(ex, y - 4, '#ffd200', { size: 18, life: 0.45 });
          this.particles.burst(ex, y - 8, 5, colors[0], { speed: 0.4, life: 0.6 });
        }
      }
    }
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
      onUnlocks: () => this.unlocksScreen.open(this.save, this.unlocks, this.achievements, this.toast, {
        onClose: () => this.openMainMenu(),
      }),
      onSettings: () => this.settingsScreen.open(this.save, this.audio, this.music, this.toast, {
        onClose: () => this.openMainMenu(),
        onTutorialReset: () => this.openMainMenu(),
        onNameChange: () => this.openMainMenu(),
      }),
      onLeaderboard: (mode) => {
        const score = this.save.data.bestScore[mode] ?? 0;
        const today = this.daily.today();
        const name = this.playerNameForBoard();
        void this.leaderboardSys
          .buildDailyBoard(today.date, today.seed, score, name)
          .then((snapshot) => {
            this.dailyScreen.open(this.save, this.daily, snapshot, {
              onPlay: () => this.startMode(GameMode.DailyChallenge),
              onClose: () => this.openMainMenu(),
            });
          });
      },
      onTutorial: () => {
        this.startMode(GameMode.EndlessClimb);
        this.startTutorial();
      },
      onSetName: () => this.openNamePrompt(),
    });
  }

  /** Open the name prompt, returning to the main menu afterwards. */
  openNamePrompt(): void {
    this.namePrompt.open(this.save.data.playerName ?? '', {
      onSave: (name) => {
        this.setPlayerName(name);
        this.openMainMenu();
        this.toast.show(`Name set to ${name}.`);
      },
      onCancel: () => this.openMainMenu(),
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
    // Show a preroll midgame ad once per session before the very first run,
    // then re-enter startMode after it resolves.
    if (!this.prerollShown && this.crazy.available) {
      this.prerollShown = true;
      this.mainMenu.close();
      this.dailyScreen.close();
      this.gameOver.close();
      this.showPrerollOverlay();
      void this.crazy.requestAd('midgame', 240).finally(() => {
        this.hidePrerollOverlay();
        this.startMode(mode);
      });
      return;
    }
    this.prerollShown = true;
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
        // Shockwave ring at anchor + radial burst of color particles.
        this.particles.shockwave(e.position.x, e.position.y, e.obstacle.color, { size: 18, life: 0.5 });
        this.particles.burst(e.position.x, e.position.y, 14, e.obstacle.color, { speed: 0.8 });
        // A few hot sparks flying out in random directions
        for (let k = 0; k < 6; k++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 2 + Math.random() * 3;
          this.particles.hotSpark(e.position.x, e.position.y, Math.cos(a) * sp, Math.sin(a) * sp, e.obstacle.color, 0.5);
        }
        this.screen.pulseBloom(0.25);
        this.haptics.trigger('hookConnect');
        this.tutorial?.notify('hookConnect');
        if (e.perfectAnchor) {
          this.scoring.addBonus(50);
          // Bigger callout + sparkle ring for perfect anchors
          this.particles.shockwave(e.position.x, e.position.y, '#00ff8a', { size: 28, life: 0.7, thickness: 4 });
          this.particles.sparkle(e.position.x, e.position.y, '#00ff8a', { size: 10, life: 1.2 });
          this.screen.addFloatingText('PERFECT ANCHOR', e.position.x, e.position.y - 18, '#00ff8a', { size: 16, bold: true });
          this.camera.flash(0.12);
        }
      },
      onHookRelease: (vel) => {
        this.combo.onHookRelease();
        this.sfx.hookRelease();
        this.sfx.swingWhoosh(vel.len());
        this.tutorial?.notify('hookRelease');
        // Brief burst at the player on release if moving fast
        if (vel.len() > 16 && this.player) {
          this.particles.burst(this.player.pos.x, this.player.pos.y, 6, '#ffffff', { speed: 0.4, life: 0.4 });
        }
        if (this.combo.combo > 1 && this.combo.combo % 3 === 0) {
          this.sfx.combo(this.combo.combo);
          this.camera.flash(0.22);
          this.camera.shake(3);
          this.screen.pulseBloom(0.35);
          this.haptics.trigger('comboMilestone');
          if (this.player) {
            this.particles.shockwave(this.player.pos.x, this.player.pos.y, '#ff9d2e', {
              size: 26,
              life: 0.6,
              thickness: 4,
            });
            this.particles.burst(this.player.pos.x, this.player.pos.y, 12, '#ff9d2e', { speed: 1, life: 0.9 });
            this.screen.addFloatingText(
              `COMBO ×${this.combo.combo}`,
              this.player.pos.x,
              this.player.pos.y - 36,
              this.combo.combo >= 6 ? '#ff2bff' : '#ff9d2e',
              { size: 22, bold: true },
            );
          }
        }
      },
      onDash: () => {
        this.sfx.dash();
        this.camera.shake(8);
        this.camera.chroma(0.45);
        this.screen.pulseBloom(0.45);
        if (this.player) {
          // Big shockwave ring + magenta burst + radial sparks shooting outward
          this.particles.shockwave(this.player.pos.x, this.player.pos.y, '#ff2bff', {
            size: 22,
            life: 0.55,
            thickness: 4,
          });
          this.particles.shockwave(this.player.pos.x, this.player.pos.y, '#ffffff', {
            size: 14,
            life: 0.4,
          });
          this.particles.burst(this.player.pos.x, this.player.pos.y, 14, '#ff2bff', { speed: 0.7, life: 0.8 });
          for (let k = 0; k < 8; k++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 3 + Math.random() * 3;
            this.particles.hotSpark(
              this.player.pos.x,
              this.player.pos.y,
              Math.cos(a) * sp,
              Math.sin(a) * sp,
              '#ff2bff',
              0.55,
            );
          }
        }
        this.haptics.trigger('dash');
        this.tutorial?.notify('dash');
      },
      onDeath: (cause) => {
        this.lastCause = cause;
        this.sfx.death();
        this.camera.shake(22);
        this.camera.flash(0.7);
        this.camera.chroma(0.6);
        this.camera.slowMo(0.35, 7);
        if (this.player) {
          // Triple expanding shockwaves + dense burst
          this.particles.shockwave(this.player.pos.x, this.player.pos.y, '#ff255e', {
            size: 30,
            life: 0.9,
            thickness: 5,
          });
          this.particles.shockwave(this.player.pos.x, this.player.pos.y, '#ff9d2e', {
            size: 22,
            life: 0.7,
            thickness: 3,
          });
          this.particles.shockwave(this.player.pos.x, this.player.pos.y, '#ffffff', {
            size: 14,
            life: 0.55,
            thickness: 2,
          });
          this.particles.burst(this.player.pos.x, this.player.pos.y, 40, '#ff255e', { speed: 1.6, life: 1.4 });
          this.particles.burst(this.player.pos.x, this.player.pos.y, 16, '#ffd200', { speed: 1.1, life: 1.2 });
          for (let k = 0; k < 14; k++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 3 + Math.random() * 5;
            this.particles.hotSpark(
              this.player.pos.x,
              this.player.pos.y,
              Math.cos(a) * sp,
              Math.sin(a) * sp,
              k % 2 === 0 ? '#ff255e' : '#ffd200',
              0.8,
            );
          }
        }
        this.haptics.trigger('death');
      },
      onNearMiss: (obs, _distance) => {
        this.combo.onNearMiss();
        this.scoring.addBonus(15);
        this.sfx.nearMiss();
        this.camera.flash(0.1);
        this.camera.chroma(0.18);
        this.haptics.trigger('nearMiss');
        // Subtle sparkle at the obstacle
        if (this.player) {
          this.particles.sparkle(obs.x + obs.width / 2, obs.y + obs.height / 2, '#00f3ff', { size: 6, life: 0.6 });
        }
        this.screen.addFloatingText('NEAR MISS', obs.x + obs.width / 2, obs.y - 8, '#00f3ff', { size: 14 });
      },
      onBounce: (obs) => {
        this.sfx.bounce();
        this.camera.shake(6);
        const cx = obs.x + obs.width / 2;
        const cy = obs.y + obs.height / 2;
        this.particles.shockwave(cx, cy, obs.color, { size: 14, life: 0.4, thickness: 3 });
        this.particles.burst(cx, cy, 12, obs.color, { speed: 0.7 });
        for (let k = 0; k < 5; k++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
          const sp = 2 + Math.random() * 2;
          this.particles.hotSpark(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, obs.color, 0.4);
        }
        this.haptics.trigger('bounce');
      },
      onShieldAbsorb: () => {
        this.achievements.unlock('shield-saved', this.notifyUnlock);
        if (this.player) {
          this.particles.shockwave(this.player.pos.x, this.player.pos.y, '#00ff8a', {
            size: 30,
            life: 0.7,
            thickness: 5,
          });
          this.particles.burst(this.player.pos.x, this.player.pos.y, 22, '#00ff8a', { speed: 1.2, life: 0.9 });
          this.camera.flash(0.3);
          this.screen.pulseBloom(0.5);
        }
      },
      onPickup: (kind, obs) => {
        const cx = obs.x + obs.width / 2;
        const cy = obs.y + obs.height / 2;
        switch (kind) {
          case 'spark': {
            this.runSparks += 1;
            this.scoring.addBonus(20);
            this.particles.sparkle(cx, cy, '#ffd400', { size: 7, life: 0.8 });
            this.particles.burst(cx, cy, 6, '#ffd400', { speed: 0.5, life: 0.5 });
            this.sfx.blip('spark', { freq: 880, duration: 0.05, type: 'triangle', gain: 0.03, slide: 360 });
            this.screen.addFloatingText('+1', cx, cy - 6, '#ffd400', { size: 12, life: 0.6 });
            break;
          }
          case 'shield-pickup':
            this.particles.shockwave(cx, cy, '#00ff8a', { size: 18, life: 0.6, thickness: 3 });
            this.particles.burst(cx, cy, 18, '#00ff8a', { speed: 0.8 });
            this.particles.sparkle(cx, cy, '#00ff8a', { size: 12, life: 1.2 });
            this.sfx.unlock();
            this.haptics.trigger('unlock');
            this.screen.pulseBloom(0.3);
            this.screen.addFloatingText('SHIELD', cx, cy - 12, '#00ff8a', { size: 14, bold: true });
            this.toast.show('Shield ready — blocks the next hit.');
            break;
          case 'magnet-pickup':
            this.particles.shockwave(cx, cy, '#a45cff', { size: 18, life: 0.6, thickness: 3 });
            this.particles.burst(cx, cy, 18, '#a45cff', { speed: 0.8 });
            this.particles.sparkle(cx, cy, '#a45cff', { size: 12, life: 1.2 });
            this.sfx.unlock();
            this.haptics.trigger('unlock');
            this.screen.pulseBloom(0.3);
            this.screen.addFloatingText('MAGNET', cx, cy - 12, '#a45cff', { size: 14, bold: true });
            this.toast.show('Magnet active — pulls in nearby sparks for 6 seconds.');
            break;
          case 'slow-pickup':
            this.slowLavaFrames = Math.max(this.slowLavaFrames, 600);
            this.particles.shockwave(cx, cy, '#a4f0ff', { size: 22, life: 0.7, thickness: 3 });
            this.particles.burst(cx, cy, 18, '#a4f0ff', { speed: 0.8 });
            this.particles.sparkle(cx, cy, '#a4f0ff', { size: 12, life: 1.2 });
            this.sfx.unlock();
            this.haptics.trigger('unlock');
            this.screen.pulseBloom(0.3);
            this.screen.addFloatingText('SLOW LAVA', cx, cy - 12, '#a4f0ff', { size: 14, bold: true });
            this.toast.show('Slow lava active — rising hazard at quarter speed.');
            break;
        }
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
    this.runSparks = 0;
    this.nextMilestone = 100;
    this.slowLavaFrames = 0;
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
        name: this.playerNameForBoard(),
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
    // Hand-crafted 5000m route. The course is divided into four narrative acts:
    //   0–1000m  Tutorial corridor — generous platforms, no hazards.
    //   1000–2500m  Pendulum bowls — energy nodes paired with side spikes.
    //   2500–3800m  S-bend gauntlet — alternating tight chains with bouncy panels.
    //   3800–5000m  Final ascent — sparse anchors, big swings, the medal threshold.
    // Each entry is [yMeters, kind, x, widthOrSize, optionalNote].
    type Spec =
      | { y: number; kind: 'platform' | 'energy' | 'bouncy'; x: number; w?: number; h?: number }
      | { y: number; kind: 'spike'; x: number; w: number }
      | { y: number; kind: 'spark' | 'shield-pickup' | 'slow-pickup'; x: number };
    const route: Spec[] = [
      // Act 1 — gentle ascent (0–1000m).
      { y: 80, kind: 'platform', x: -40, w: 220 },
      { y: 220, kind: 'platform', x: 80, w: 200 },
      { y: 360, kind: 'platform', x: -120, w: 200 },
      { y: 500, kind: 'energy', x: 60 },
      { y: 640, kind: 'platform', x: -180, w: 180 },
      { y: 760, kind: 'platform', x: 100, w: 200 },
      { y: 900, kind: 'energy', x: -40 },

      // Act 2 — pendulum bowls (1000–2500m).
      { y: 1040, kind: 'platform', x: -220, w: 140 },
      { y: 1040, kind: 'platform', x: 120, w: 140 },
      { y: 1180, kind: 'energy', x: 0 },
      { y: 1220, kind: 'spike', x: 160, w: 80 },
      { y: 1340, kind: 'platform', x: -240, w: 160 },
      { y: 1340, kind: 'spike', x: 100, w: 120 },
      { y: 1480, kind: 'energy', x: -60 },
      { y: 1560, kind: 'spark', x: 60 },
      { y: 1620, kind: 'platform', x: 160, w: 160 },
      { y: 1720, kind: 'shield-pickup', x: 0 },
      { y: 1800, kind: 'energy', x: 120 },
      { y: 1880, kind: 'spike', x: -200, w: 110 },
      { y: 1960, kind: 'platform', x: -60, w: 200 },
      { y: 2120, kind: 'energy', x: -200 },
      { y: 2280, kind: 'energy', x: 200 },
      { y: 2440, kind: 'platform', x: 0, w: 200 },

      // Act 3 — S-bend gauntlet (2500–3800m).
      { y: 2580, kind: 'bouncy', x: -240, w: 100 },
      { y: 2640, kind: 'energy', x: 160 },
      { y: 2720, kind: 'spike', x: -120, w: 100 },
      { y: 2780, kind: 'platform', x: 140, w: 180 },
      { y: 2900, kind: 'spark', x: -80 },
      { y: 2960, kind: 'energy', x: -200 },
      { y: 3060, kind: 'bouncy', x: 200, w: 120 },
      { y: 3160, kind: 'energy', x: 80 },
      { y: 3240, kind: 'spike', x: -160, w: 90 },
      { y: 3280, kind: 'platform', x: 140, w: 160 },
      { y: 3400, kind: 'energy', x: -120 },
      { y: 3480, kind: 'slow-pickup', x: 60 },
      { y: 3560, kind: 'energy', x: 220 },
      { y: 3680, kind: 'platform', x: -180, w: 180 },
      { y: 3800, kind: 'energy', x: 60 },

      // Act 4 — final ascent (3800–5000m).
      { y: 3960, kind: 'energy', x: -120 },
      { y: 4080, kind: 'platform', x: 160, w: 140 },
      { y: 4220, kind: 'energy', x: -40 },
      { y: 4360, kind: 'spike', x: 180, w: 110 },
      { y: 4380, kind: 'energy', x: 80 },
      { y: 4520, kind: 'bouncy', x: -180, w: 100 },
      { y: 4680, kind: 'energy', x: 200 },
      { y: 4820, kind: 'energy', x: -100 },
      { y: 4960, kind: 'platform', x: 0, w: 280 },
    ];
    let nextId = 100000;
    const obs: Obstacle[] = [];
    for (const spec of route) {
      const y = -spec.y * 10;
      if (spec.kind === 'platform') {
        const width = spec.w ?? 180;
        const height = spec.h ?? 20;
        obs.push({
          id: nextId++,
          x: spec.x - width / 2,
          y,
          width,
          height,
          kind: 'platform',
          color: '#00f3ff',
          grappleable: true,
          lethal: false,
          bouncy: false,
          pickup: false,
          collected: false,
          unstableTimer: 0,
          unstableTriggered: false,
          amp: 0,
          driftAngle: 0,
          driftSpeed: 0,
          lastX: spec.x - width / 2,
          pulse: 0,
        });
      } else if (spec.kind === 'energy') {
        const size = spec.w ?? 38;
        obs.push({
          id: nextId++,
          x: spec.x - size / 2,
          y,
          width: size,
          height: size,
          kind: 'energy',
          color: '#a45cff',
          grappleable: true,
          lethal: false,
          bouncy: false,
          pickup: false,
          collected: false,
          unstableTimer: 0,
          unstableTriggered: false,
          amp: 0,
          driftAngle: 0,
          driftSpeed: 0,
          lastX: spec.x - size / 2,
          pulse: 0,
        });
      } else if (spec.kind === 'bouncy') {
        const width = spec.w ?? 110;
        obs.push({
          id: nextId++,
          x: spec.x - width / 2,
          y,
          width,
          height: 16,
          kind: 'bouncy',
          color: '#00ff8a',
          grappleable: true,
          lethal: false,
          bouncy: true,
          pickup: false,
          collected: false,
          unstableTimer: 0,
          unstableTriggered: false,
          amp: 0,
          driftAngle: 0,
          driftSpeed: 0,
          lastX: spec.x - width / 2,
          pulse: 0,
        });
      } else if (spec.kind === 'spike') {
        obs.push({
          id: nextId++,
          x: spec.x - spec.w / 2,
          y,
          width: spec.w,
          height: 14,
          kind: 'spike',
          color: '#ff255e',
          grappleable: false,
          lethal: true,
          bouncy: false,
          pickup: false,
          collected: false,
          unstableTimer: 0,
          unstableTriggered: false,
          amp: 0,
          driftAngle: 0,
          driftSpeed: 0,
          lastX: spec.x - spec.w / 2,
          pulse: 0,
        });
      } else {
        // Pickup (spark, shield, slow).
        obs.push({
          id: nextId++,
          x: spec.x - 14,
          y,
          width: spec.kind === 'spark' ? 16 : 28,
          height: spec.kind === 'spark' ? 16 : 28,
          kind: spec.kind,
          color:
            spec.kind === 'spark' ? '#ffd400' : spec.kind === 'shield-pickup' ? '#00ff8a' : '#a4f0ff',
          grappleable: false,
          lethal: false,
          bouncy: false,
          pickup: true,
          collected: false,
          unstableTimer: 0,
          unstableTriggered: false,
          amp: 0,
          driftAngle: 0,
          driftSpeed: 0,
          lastX: spec.x - 14,
          pulse: 0,
        });
      }
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
      if (medal === 'gold') {
        this.achievements.unlock('ta-gold', this.notifyUnlock);
        this.crazy.happytime();
      }
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

    // Signal a "happy moment" to CrazyGames on a meaningful personal best
    // (prev > 0 filters out first-run noise; the platform rate-limits to once/min).
    if ((newBestAltitude && prevBestAlt > 0) || (newBestScore && prevBestScore > 0)) {
      this.crazy.happytime();
    }

    // Save ghost on PB in endless/daily
    if (
      (this.mode === GameMode.EndlessClimb || this.mode === GameMode.DailyChallenge) &&
      newBestAltitude
    ) {
      this.save.data.personalBestGhost = this.encodeGhost(this.ghostRecording);
    }

    // Race results
    let raceResult: GameOverContext['raceResult'] | undefined;
    let racePodium: GameOverContext['racePodium'] | undefined;
    if (this.mode === GameMode.BotRace) {
      const playerPart = this.raceParticipants.find((p) => p.id === 'player');
      if (playerPart) {
        playerPart.name = this.playerNameForBoard();
        if (!playerPart.finished) playerPart.altitude = altitude;
      }
      const sorted = [...this.raceParticipants].sort((a, b) => {
        if (a.finished && b.finished) return (a.finishTime ?? 0) - (b.finishTime ?? 0);
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.altitude - a.altitude;
      });
      const myIdx = sorted.findIndex((p) => p.id === 'player');
      raceResult = { position: myIdx + 1, total: sorted.length };
      racePodium = sorted.map((p, i) => ({
        position: i + 1,
        name: p.name,
        color: p.color,
        altitude: p.altitude,
        isYou: p.id === 'player',
        finished: p.finished,
        finishTime: p.finishTime,
      }));
      // "Beat <bot>" unlocks when the player finishes ahead of that bot individually.
      const sparkyIdx = sorted.findIndex((p) => p.id === 'sparky');
      const phaseIdx = sorted.findIndex((p) => p.id === 'phase');
      const apexIdx = sorted.findIndex((p) => p.id === 'apex');
      if (sparkyIdx > myIdx) this.achievements.unlock('bot-sparky', this.notifyUnlock);
      if (phaseIdx > myIdx) this.achievements.unlock('bot-phase', this.notifyUnlock);
      if (apexIdx > myIdx) this.achievements.unlock('bot-apex', this.notifyUnlock);
      // Track wins per bot defeated for stats.
      if (sparkyIdx > myIdx)
        this.save.data.botRaceWins['sparky'] = (this.save.data.botRaceWins['sparky'] ?? 0) + 1;
      if (phaseIdx > myIdx)
        this.save.data.botRaceWins['phase'] = (this.save.data.botRaceWins['phase'] ?? 0) + 1;
      if (apexIdx > myIdx)
        this.save.data.botRaceWins['apex'] = (this.save.data.botRaceWins['apex'] ?? 0) + 1;
    }

    if (this.mode === GameMode.ComboRun) {
      this.achievements.setProgress('combo-run-1000', score, this.notifyUnlock);
    }

    // Daily history + leaderboard
    if (this.mode === GameMode.DailyChallenge) {
      const submitted = this.dailyRankedThisAttempt;
      this.daily.recordRun(score, altitude, this.combo.peak, submitted);
      if (submitted) {
        const today = this.daily.today();
        const name = this.playerNameForBoard();
        // Fire-and-forget submission to the backend, then check placement achievements.
        void this.leaderboardSys
          .submitDaily(today.date, today.seed, name, score, altitude)
          .then(() => this.leaderboardSys.buildDailyBoard(today.date, today.seed, score, name))
          .then((snapshot) => {
            const myEntry = snapshot.entries.find((b) => b.isYou);
            if (!myEntry) return;
            const pct = (myEntry.rank - 1) / Math.max(1, snapshot.realPlayerCount);
            if (pct <= 0.5) this.achievements.unlock('daily-top50', this.notifyUnlock);
            if (pct <= 0.1) this.achievements.unlock('daily-top10', this.notifyUnlock);
          });
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
    // Add Sparks collected mid-run (pickups + milestone bonuses) on top of the run rewards.
    if (this.runSparks > 0) {
      this.save.data.sparks += this.runSparks;
      rewards.sparks += this.runSparks;
    }
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
      adsAvailable: this.crazy.available,
      dailyStreak: this.save.data.dailyStreak,
      ...(raceResult ? { raceResult } : {}),
      ...(racePodium ? { racePodium } : {}),
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

  private prerollEl: HTMLDivElement | null = null;

  private showPrerollOverlay(): void {
    if (this.prerollEl) return;
    const el = document.createElement('div');
    el.className = 'preroll-overlay';
    el.innerHTML = `
      <div class="preroll-card">
        <div class="preroll-logo gradient-text">GRAPPLE<br>GLIDERS</div>
        <div class="preroll-spinner"></div>
        <div class="preroll-label">Loading…</div>
      </div>
    `;
    this.overlayRoot.appendChild(el);
    this.prerollEl = el;
  }

  private hidePrerollOverlay(): void {
    if (!this.prerollEl) return;
    this.prerollEl.classList.add('fading');
    const el = this.prerollEl;
    this.prerollEl = null;
    setTimeout(() => el.remove(), 280);
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
      const lastRunSparks =
        Math.floor((this.player?.maxAltitude ?? 0) / 50) +
        Math.floor(this.scoring.total / 200) +
        this.combo.perfectAnchors;
      this.save.data.sparks += lastRunSparks;
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
      adsAvailable: this.crazy.available,
      dailyStreak: this.save.data.dailyStreak,
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
          onNameChange: () => undefined,
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
    if (this.tutorial) {
      this.tutorial.destroy();
      this.tutorial = null;
    }
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

    // Optional on-screen steering arrows. Always show on touch devices so the
    // control is discoverable; players can hide via Settings if they prefer
    // the gesture-only experience.
    let steerEl: HTMLDivElement | null = null;
    if (this.save.data.settings.mobileSteering) {
      steerEl = document.createElement('div');
      steerEl.className = 'touch-steer';
      steerEl.innerHTML = `
        <button class="touch-btn steer-btn" data-dir="-1" aria-label="Steer left">◀</button>
        <button class="touch-btn steer-btn" data-dir="1" aria-label="Steer right">▶</button>
      `;
      const setSoft = (v: -1 | 0 | 1): void => this.input.setSoftSteer(v);
      const left = steerEl.querySelector<HTMLButtonElement>('[data-dir="-1"]')!;
      const right = steerEl.querySelector<HTMLButtonElement>('[data-dir="1"]')!;
      const bind = (el: HTMLElement, dir: -1 | 1): void => {
        const start = (e: Event): void => {
          e.preventDefault();
          e.stopPropagation();
          setSoft(dir);
        };
        const end = (e: Event): void => {
          e.preventDefault();
          e.stopPropagation();
          setSoft(0);
        };
        el.addEventListener('touchstart', start, { passive: false });
        el.addEventListener('touchend', end, { passive: false });
        el.addEventListener('touchcancel', end, { passive: false });
        el.addEventListener('mousedown', start);
        el.addEventListener('mouseup', end);
        el.addEventListener('mouseleave', end);
      };
      bind(left, -1);
      bind(right, 1);
      document.body.appendChild(steerEl);
    }

    this.touchControlsEl = wrap;
    (wrap as unknown as { _pauseBtn: HTMLButtonElement; _steerEl: HTMLDivElement | null })._pauseBtn = pause;
    (wrap as unknown as { _pauseBtn: HTMLButtonElement; _steerEl: HTMLDivElement | null })._steerEl = steerEl;
  }

  private removeTouchControls(): void {
    if (!this.touchControlsEl) return;
    const handles = this.touchControlsEl as unknown as { _pauseBtn?: HTMLButtonElement; _steerEl?: HTMLDivElement | null };
    handles._pauseBtn?.remove();
    handles._steerEl?.remove();
    this.touchControlsEl.remove();
    this.touchControlsEl = null;
    this.input.setSoftSteer(0);
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
