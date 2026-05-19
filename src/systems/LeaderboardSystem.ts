import { SeededRandom, makeDailySeed } from '../utils/seededRandom';

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  altitude: number;
  isYou: boolean;
  isBot: boolean;
}

const BOT_FIRST_NAMES = [
  'NEON', 'VYRA', 'ECHO', 'KAI', 'ZED', 'NOVA', 'AXEL', 'RIO', 'STORM', 'IONA',
  'ORBIT', 'RUNE', 'SABLE', 'ARC', 'TIDE', 'GLITCH', 'FOX', 'JIN', 'LUMEN', 'PYRE',
  'VEX', 'OYO', 'KILN', 'BRYNN', 'ESKO', 'MOTH', 'PARA', 'OPAL', 'CYRA', 'HALO',
];

const BOT_LAST_TAGS = ['7', '99', '_X', '_v2', '_HD', '01', '_99', '00', '_pro', '_alpha'];

export class LeaderboardSystem {
  generateDaily(
    seed: number,
    playerScore: number,
    playerName: string = 'YOU',
    size: number = 100,
  ): LeaderboardEntry[] {
    const rng = new SeededRandom(makeDailySeed(seed, 'leaderboard'));
    // Procedural skill curve: place the player in a believable percentile that
    // slightly favors them (between ~p25 and ~p75 depending on score).
    const target = Math.max(playerScore, 1000);
    const top = Math.floor(target * (1.2 + rng.next() * 1.6));
    const bottom = Math.max(50, Math.floor(target * 0.3));
    const scores: number[] = [];
    for (let i = 0; i < size - 1; i++) {
      const t = i / (size - 1);
      // exponential falloff toward bottom of board.
      const skill = Math.pow(1 - t, 2);
      const noise = (rng.next() - 0.5) * (top - bottom) * 0.08;
      scores.push(Math.max(bottom, Math.floor(bottom + (top - bottom) * skill + noise)));
    }
    scores.push(playerScore);
    scores.sort((a, b) => b - a);
    const entries: LeaderboardEntry[] = scores.map((s, i) => ({
      rank: i + 1,
      name: this.botName(rng),
      score: s,
      altitude: Math.floor(s / 10),
      isYou: false,
      isBot: true,
    }));
    // Replace the entry closest to playerScore with the real player.
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < entries.length; i++) {
      const d = Math.abs(entries[i]!.score - playerScore);
      if (d < closestDist) {
        closestDist = d;
        closestIdx = i;
      }
    }
    entries[closestIdx] = {
      ...entries[closestIdx]!,
      name: playerName,
      score: playerScore,
      altitude: Math.floor(playerScore / 10),
      isYou: true,
      isBot: false,
    };
    // Re-rank
    entries.sort((a, b) => b.score - a.score);
    return entries.map((e, i) => ({ ...e, rank: i + 1 }));
  }

  private botName(rng: SeededRandom): string {
    const first = rng.pick(BOT_FIRST_NAMES);
    return rng.chance(0.6) ? `${first}${rng.pick(BOT_LAST_TAGS)}` : first;
  }
}
