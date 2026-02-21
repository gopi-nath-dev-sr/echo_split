import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameStats, DEFAULT_STATS, RoundResult, DifficultyState, calculateCognitiveScore } from './game-engine';

const STATS_KEY = '@echo_split_stats';

export async function loadStats(): Promise<GameStats> {
  try {
    const data = await AsyncStorage.getItem(STATS_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return { ...DEFAULT_STATS };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export async function saveStats(stats: GameStats): Promise<void> {
  try {
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    console.error('Failed to save stats:', e);
  }
}

export async function addRoundResult(
  result: RoundResult,
  newDifficulty: DifficultyState,
): Promise<GameStats> {
  const stats = await loadStats();

  stats.totalRounds++;
  stats.history.push(result);

  if (stats.history.length > 100) {
    stats.history = stats.history.slice(-100);
  }

  if (result.accuracy >= 0.7) {
    stats.currentStreak++;
    stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
  } else {
    stats.currentStreak = 0;
  }

  stats.averageAccuracy =
    stats.history.reduce((sum, r) => sum + r.accuracy, 0) / stats.history.length;

  stats.cognitiveScore = calculateCognitiveScore(stats.history);
  stats.difficulty = newDifficulty;

  await saveStats(stats);
  return stats;
}

export async function resetStats(): Promise<GameStats> {
  const stats = { ...DEFAULT_STATS };
  await saveStats(stats);
  return stats;
}
