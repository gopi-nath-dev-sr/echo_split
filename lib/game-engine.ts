import * as Crypto from 'expo-crypto';

export type SymbolShape = 'circle' | 'triangle' | 'square' | 'diamond' | 'star' | 'pentagon' | 'hexagon' | 'cross' | 'arrow' | 'spiral';

export const ALL_SYMBOLS: SymbolShape[] = [
  'circle', 'triangle', 'square', 'diamond', 'star',
  'pentagon', 'hexagon', 'cross', 'arrow', 'spiral',
];

export interface StreamSymbol {
  id: string;
  shape: SymbolShape;
  stream: 'blue' | 'orange';
  position: number;
}

export interface GameRound {
  blueStream: StreamSymbol[];
  orangeStream: StreamSymbol[];
  interleaved: StreamSymbol[];
  interferenceType: 'tap-shape' | 'tap-color' | 'count';
  interferenceData: InterferenceData;
}

export interface InterferenceData {
  type: 'tap-shape' | 'tap-color' | 'count';
  target: string;
  options: string[];
  correctAnswer: string;
}

export interface DifficultyState {
  level: number;
  streamLength: number;
  symbolSpeed: number;
  symbolPool: number;
  consecutiveHigh: number;
  consecutiveLow: number;
}

export interface RoundResult {
  blueCorrect: number;
  blueTotal: number;
  orangeCorrect: number;
  orangeTotal: number;
  interferenceCorrect: boolean;
  accuracy: number;
  timestamp: number;
}

export interface GameStats {
  totalRounds: number;
  averageAccuracy: number;
  bestStreak: number;
  currentStreak: number;
  cognitiveScore: number;
  history: RoundResult[];
  difficulty: DifficultyState;
}

export const DEFAULT_DIFFICULTY: DifficultyState = {
  level: 1,
  streamLength: 3,
  symbolSpeed: 700,
  symbolPool: 5,
  consecutiveHigh: 0,
  consecutiveLow: 0,
};

export const DEFAULT_STATS: GameStats = {
  totalRounds: 0,
  averageAccuracy: 0,
  bestStreak: 0,
  currentStreak: 0,
  cognitiveScore: 0,
  history: [],
  difficulty: { ...DEFAULT_DIFFICULTY },
};

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = shuffleArray(arr);
  return shuffled.slice(0, count);
}

export function generateRound(difficulty: DifficultyState): GameRound {
  const availableSymbols = ALL_SYMBOLS.slice(0, difficulty.symbolPool);
  
  const blueStream: StreamSymbol[] = [];
  const orangeStream: StreamSymbol[] = [];

  for (let i = 0; i < difficulty.streamLength; i++) {
    const blueShape = availableSymbols[Math.floor(Math.random() * availableSymbols.length)];
    blueStream.push({
      id: Crypto.randomUUID(),
      shape: blueShape,
      stream: 'blue',
      position: i,
    });
  }

  for (let i = 0; i < difficulty.streamLength; i++) {
    const orangeShape = availableSymbols[Math.floor(Math.random() * availableSymbols.length)];
    orangeStream.push({
      id: Crypto.randomUUID(),
      shape: orangeShape,
      stream: 'orange',
      position: i,
    });
  }

  const interleaved: StreamSymbol[] = [];
  let bIdx = 0;
  let oIdx = 0;
  let useBlue = Math.random() > 0.5;

  while (bIdx < blueStream.length || oIdx < orangeStream.length) {
    if (useBlue && bIdx < blueStream.length) {
      interleaved.push(blueStream[bIdx]);
      bIdx++;
    } else if (!useBlue && oIdx < orangeStream.length) {
      interleaved.push(orangeStream[oIdx]);
      oIdx++;
    } else if (bIdx < blueStream.length) {
      interleaved.push(blueStream[bIdx]);
      bIdx++;
    } else {
      interleaved.push(orangeStream[oIdx]);
      oIdx++;
    }
    useBlue = !useBlue;
  }

  const interferenceType: InterferenceData['type'] = 
    difficulty.level <= 3 ? 'tap-shape' : 
    difficulty.level <= 6 ? 'tap-color' : 'count';

  const interferenceData = generateInterference(interferenceType, availableSymbols);

  return {
    blueStream,
    orangeStream,
    interleaved,
    interferenceType,
    interferenceData,
  };
}

function generateInterference(type: InterferenceData['type'], symbols: SymbolShape[]): InterferenceData {
  if (type === 'tap-shape') {
    const target = symbols[Math.floor(Math.random() * symbols.length)];
    const distractors = pickRandom(symbols.filter(s => s !== target), 2);
    const options = shuffleArray([target, ...distractors]);
    return { type, target, options, correctAnswer: target };
  } else if (type === 'tap-color') {
    const colors = ['blue', 'orange', 'green', 'red'];
    const target = colors[Math.floor(Math.random() * 2)];
    const options = shuffleArray(colors.slice(0, 3));
    return { type, target, options, correctAnswer: target };
  } else {
    const count = Math.floor(Math.random() * 5) + 2;
    const options = shuffleArray([
      String(count),
      String(count + 1),
      String(count - 1),
    ]);
    return { type, target: String(count), options, correctAnswer: String(count) };
  }
}

export function scoreRound(
  blueAnswer: SymbolShape[],
  orangeAnswer: SymbolShape[],
  blueCorrectSeq: SymbolShape[],
  orangeCorrectSeq: SymbolShape[],
  interferenceCorrect: boolean,
): RoundResult {
  let blueCorrect = 0;
  for (let i = 0; i < blueCorrectSeq.length; i++) {
    if (i < blueAnswer.length && blueAnswer[i] === blueCorrectSeq[i]) {
      blueCorrect++;
    }
  }

  let orangeCorrect = 0;
  for (let i = 0; i < orangeCorrectSeq.length; i++) {
    if (i < orangeAnswer.length && orangeAnswer[i] === orangeCorrectSeq[i]) {
      orangeCorrect++;
    }
  }

  const totalSymbols = blueCorrectSeq.length + orangeCorrectSeq.length;
  const totalCorrect = blueCorrect + orangeCorrect;
  const accuracy = totalSymbols > 0 ? totalCorrect / totalSymbols : 0;

  return {
    blueCorrect,
    blueTotal: blueCorrectSeq.length,
    orangeCorrect,
    orangeTotal: orangeCorrectSeq.length,
    interferenceCorrect,
    accuracy,
    timestamp: Date.now(),
  };
}

export function updateDifficulty(
  difficulty: DifficultyState,
  result: RoundResult,
): DifficultyState {
  const newDiff = { ...difficulty };

  if (result.accuracy >= 0.8) {
    newDiff.consecutiveHigh++;
    newDiff.consecutiveLow = 0;

    if (newDiff.consecutiveHigh >= 3) {
      newDiff.level = Math.min(newDiff.level + 1, 15);
      newDiff.consecutiveHigh = 0;

      if (newDiff.level % 2 === 0 && newDiff.streamLength < 7) {
        newDiff.streamLength++;
      }
      if (newDiff.symbolSpeed > 300) {
        newDiff.symbolSpeed = Math.max(300, newDiff.symbolSpeed - 50);
      }
      if (newDiff.symbolPool < ALL_SYMBOLS.length) {
        newDiff.symbolPool = Math.min(ALL_SYMBOLS.length, newDiff.symbolPool + 1);
      }
    }
  } else if (result.accuracy < 0.5) {
    newDiff.consecutiveLow++;
    newDiff.consecutiveHigh = 0;

    if (newDiff.consecutiveLow >= 2) {
      newDiff.level = Math.max(1, newDiff.level - 1);
      newDiff.consecutiveLow = 0;

      if (newDiff.streamLength > 3) {
        newDiff.streamLength--;
      }
      if (newDiff.symbolSpeed < 700) {
        newDiff.symbolSpeed = Math.min(700, newDiff.symbolSpeed + 50);
      }
    }
  } else {
    newDiff.consecutiveHigh = 0;
    newDiff.consecutiveLow = 0;
  }

  return newDiff;
}

export function calculateCognitiveScore(history: RoundResult[]): number {
  if (history.length === 0) return 0;
  const recent = history.slice(-20);
  const avgAccuracy = recent.reduce((sum, r) => sum + r.accuracy, 0) / recent.length;
  const consistency = 1 - (recent.length > 1
    ? Math.sqrt(
        recent.reduce((sum, r) => sum + Math.pow(r.accuracy - avgAccuracy, 2), 0) / recent.length
      )
    : 0);
  return Math.round((avgAccuracy * 70 + consistency * 30) * 10);
}
