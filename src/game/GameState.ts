export enum GameState {
  Boot = 'boot',
  MainMenu = 'mainMenu',
  Tutorial = 'tutorial',
  Playing = 'playing',
  Paused = 'paused',
  GameOver = 'gameOver',
  ModeSelect = 'modeSelect',
  DailyChallenge = 'dailyChallenge',
  Unlocks = 'unlocks',
  Settings = 'settings',
  Leaderboard = 'leaderboard',
}

export enum GameMode {
  EndlessClimb = 'endless',
  DailyChallenge = 'daily',
  TimeAttack = 'timeAttack',
  ComboRun = 'comboRun',
  BotRace = 'botRace',
}

/**
 * Launch gate for Time Attack.
 *
 * Set to `false` for the CrazyGames launch — the four authored courses need
 * more level-design iteration and playtested medal thresholds before they
 * ship. All code paths, save fields, and content remain intact so flipping
 * this back to `true` restores the mode without losing player progress.
 *
 * TODO(post-launch): polish course layouts + re-balance medal times, then
 * flip to `true`.
 */
export const TIME_ATTACK_ENABLED = false;

export interface ModeMeta {
  id: GameMode;
  name: string;
  tagline: string;
  description: string;
  goal: string;
  iconColor: string;
}

export const MODES: Record<GameMode, ModeMeta> = {
  [GameMode.EndlessClimb]: {
    id: GameMode.EndlessClimb,
    name: 'Endless Climb',
    tagline: 'Climb until the lava catches you',
    description: 'Procedural infinite tower. Lava accelerates. Personal best is everything.',
    goal: 'Reach the highest altitude possible.',
    iconColor: '#00f3ff',
  },
  [GameMode.DailyChallenge]: {
    id: GameMode.DailyChallenge,
    name: 'Daily Challenge',
    tagline: 'Same seed, every player, every UTC day',
    description: 'A new deterministic course every 24 hours. One ranked attempt per day.',
    goal: 'Top the global daily leaderboard.',
    iconColor: '#ff2bff',
  },
  [GameMode.TimeAttack]: {
    id: GameMode.TimeAttack,
    name: 'Time Attack',
    tagline: 'Four fixed routes. Three medal tiers. Beat the clock.',
    description: 'Pick a course — Rookie, The Spire, Pendulum, or Inferno — and chase gold.',
    goal: 'Earn gold on every course.',
    iconColor: '#00ff8a',
  },
  [GameMode.ComboRun]: {
    id: GameMode.ComboRun,
    name: 'Combo Run',
    tagline: '60-second sprint focused on chained grapples',
    description: 'Chain grapples within 1.5s of each release. Drop the combo and it ends.',
    goal: 'Multiply peak combo by altitude.',
    iconColor: '#ff9d2e',
  },
  [GameMode.BotRace]: {
    id: GameMode.BotRace,
    name: 'Bot Race',
    tagline: 'Outclimb Sparky, Phase and Apex to 3000m',
    description: 'Three bots. Three personalities. Beat them all for the gold.',
    goal: 'Reach altitude 3000m before all three bots.',
    iconColor: '#ff255e',
  },
};
