export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  reward: number; // Sparks granted on unlock
  /** Optional progress target. If absent, achievement is binary. */
  target?: number;
  hidden?: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'climb-100', name: 'Foothills', description: 'Reach 100 m altitude.', reward: 25, target: 100 },
  { id: 'climb-500', name: 'Rising Up', description: 'Reach 500 m altitude.', reward: 50, target: 500 },
  { id: 'climb-1000', name: 'Cloud Walker', description: 'Reach 1000 m altitude.', reward: 100, target: 1000 },
  { id: 'climb-2500', name: 'Sky High', description: 'Reach 2500 m altitude.', reward: 200, target: 2500 },
  { id: 'climb-5000', name: 'Stratosphere', description: 'Reach 5000 m altitude.', reward: 400, target: 5000 },
  { id: 'climb-10000', name: 'Above the Clouds', description: 'Reach 10 000 m altitude.', reward: 800, target: 10000 },
  { id: 'combo-3', name: 'Triple Threat', description: 'Reach combo ×3.', reward: 30, target: 3 },
  { id: 'combo-5', name: 'Five Alive', description: 'Reach combo ×5.', reward: 75, target: 5 },
  { id: 'combo-10', name: 'Max Combo', description: 'Reach combo ×10.', reward: 250, target: 10 },
  { id: 'perfect-10', name: 'Sharpshooter', description: 'Land 10 perfect anchors.', reward: 75, target: 10 },
  { id: 'perfect-100', name: 'Bullseye', description: 'Land 100 perfect anchors.', reward: 400, target: 100 },
  { id: 'near-miss-25', name: 'Close Call', description: 'Notch 25 near-misses.', reward: 60, target: 25 },
  { id: 'near-miss-200', name: 'Death Defying', description: 'Notch 200 near-misses.', reward: 350, target: 200 },
  { id: 'dash-50', name: 'Blink', description: 'Dash 50 times.', reward: 50, target: 50 },
  { id: 'survive-60s', name: 'Iron Lungs', description: 'Survive a single hook for 60 s.', reward: 150 },
  { id: 'daily-attempt', name: 'Diligent', description: 'Attempt your first daily challenge.', reward: 25 },
  { id: 'daily-top50', name: 'Top Half', description: 'Finish a daily challenge in the top 50%.', reward: 200 },
  { id: 'daily-top10', name: 'Top Ten', description: 'Finish a daily challenge in the top 10%.', reward: 500 },
  { id: 'streak-7', name: 'Week Long', description: 'Maintain a 7-day login streak.', reward: 250 },
  { id: 'streak-14', name: 'Fortnight', description: 'Maintain a 14-day login streak.', reward: 600 },
  { id: 'ta-bronze', name: 'Bronze Climber', description: 'Earn a Bronze medal in Time Attack.', reward: 150 },
  { id: 'ta-silver', name: 'Silver Climber', description: 'Earn a Silver medal in Time Attack.', reward: 300 },
  { id: 'ta-gold', name: 'Gold Climber', description: 'Earn a Gold medal in Time Attack.', reward: 600 },
  { id: 'bot-sparky', name: 'Beat Sparky', description: 'Win a Bot Race against Sparky.', reward: 100 },
  { id: 'bot-phase', name: 'Beat Phase', description: 'Win a Bot Race against Phase.', reward: 250 },
  { id: 'bot-apex', name: 'Beat Apex', description: 'Win a Bot Race against Apex.', reward: 600 },
  { id: 'combo-run-1000', name: 'Combo Crusher', description: 'Score 1000 in Combo Run.', reward: 200, target: 1000 },
  { id: 'first-unlock', name: 'New Threads', description: 'Unlock your first cosmetic.', reward: 50 },
  { id: 'unlocked-all-skins', name: 'Fashionista', description: 'Unlock every skin.', reward: 1000, hidden: true },
  { id: 'level-5', name: 'Pilot Trainee', description: 'Reach level 5.', reward: 100, target: 5 },
  { id: 'level-10', name: 'Pilot Veteran', description: 'Reach level 10.', reward: 300, target: 10 },
  { id: 'level-20', name: 'Pilot Legend', description: 'Reach level 20.', reward: 800, target: 20 },
  { id: 'sparks-50', name: 'Spark Hunter', description: 'Collect 50 sparks in a single run.', reward: 75, target: 50 },
  { id: 'shield-saved', name: 'Saved by the Bell', description: 'Survive a hit using a shield.', reward: 60 },
];

export const getAchievement = (id: string): AchievementDef | undefined =>
  ACHIEVEMENTS.find((a) => a.id === id);
