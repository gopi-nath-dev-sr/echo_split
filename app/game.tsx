import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Dimensions, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withSequence, withDelay, FadeIn, FadeInDown, FadeInUp, withRepeat, Easing } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { SymbolIcon } from '@/components/SymbolView';
import {
  GameRound, StreamSymbol, SymbolShape, RoundResult, DifficultyState,
  generateRound, scoreRound, updateDifficulty, ALL_SYMBOLS, DEFAULT_DIFFICULTY,
} from '@/lib/game-engine';
import { loadStats, addRoundResult } from '@/lib/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type GamePhase = 'breathing' | 'observe' | 'interfere' | 'recall' | 'feedback';

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  const [phase, setPhase] = useState<GamePhase>('breathing');
  const [round, setRound] = useState<GameRound | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyState>(DEFAULT_DIFFICULTY);
  const [roundNumber, setRoundNumber] = useState(0);

  const [currentSymbolIndex, setCurrentSymbolIndex] = useState(-1);
  const [breathCount, setBreathCount] = useState(3);

  const [interferenceAnswer, setInterferenceAnswer] = useState<string | null>(null);
  const [interferenceCorrect, setInterferenceCorrect] = useState(false);

  const [blueRecall, setBlueRecall] = useState<SymbolShape[]>([]);
  const [orangeRecall, setOrangeRecall] = useState<SymbolShape[]>([]);
  const [activeRecallStream, setActiveRecallStream] = useState<'blue' | 'orange'>('blue');

  const [result, setResult] = useState<RoundResult | null>(null);
  const [replayIndex, setReplayIndex] = useState(-1);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadStats().then((stats) => {
      if (stats.difficulty) {
        setDifficulty(stats.difficulty);
      }
    });
  }, []);

  const startNewRound = useCallback(() => {
    const newRound = generateRound(difficulty);
    setRound(newRound);
    setRoundNumber((p) => p + 1);
    setCurrentSymbolIndex(-1);
    setInterferenceAnswer(null);
    setInterferenceCorrect(false);
    setBlueRecall([]);
    setOrangeRecall([]);
    setActiveRecallStream('blue');
    setResult(null);
    setReplayIndex(-1);
    setBreathCount(1);
    setPhase('breathing');
  }, [difficulty]);

  useEffect(() => {
    startNewRound();
  }, []);

  useEffect(() => {
    if (phase === 'breathing') {
      if (breathCount > 0) {
        timerRef.current = setTimeout(() => {
          setBreathCount((c) => c - 1);
        }, 800);
      } else {
        timerRef.current = setTimeout(() => {
          setPhase('observe');
          setCurrentSymbolIndex(0);
        }, 400);
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, breathCount]);

  useEffect(() => {
    if (phase === 'observe' && round && currentSymbolIndex >= 0) {
      if (currentSymbolIndex < round.interleaved.length) {
        timerRef.current = setTimeout(() => {
          setCurrentSymbolIndex((i) => i + 1);
        }, difficulty.symbolSpeed);
      } else {
        timerRef.current = setTimeout(() => {
          setPhase('interfere');
        }, 300);
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, currentSymbolIndex, round, difficulty.symbolSpeed]);

  const handleInterferenceAnswer = useCallback((answer: string) => {
    if (!round || interferenceAnswer !== null) return;
    const correct = answer === round.interferenceData.correctAnswer;
    setInterferenceAnswer(answer);
    setInterferenceCorrect(correct);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy);
    }
    timerRef.current = setTimeout(() => {
      setPhase('recall');
    }, 800);
  }, [round, interferenceAnswer]);

  const handleRecallTap = useCallback((shape: SymbolShape) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (activeRecallStream === 'blue') {
      if (blueRecall.length < (round?.blueStream.length || 0)) {
        setBlueRecall((prev) => [...prev, shape]);
      }
    } else {
      if (orangeRecall.length < (round?.orangeStream.length || 0)) {
        setOrangeRecall((prev) => [...prev, shape]);
      }
    }
  }, [activeRecallStream, blueRecall.length, orangeRecall.length, round]);

  const handleUndoRecall = useCallback(() => {
    if (activeRecallStream === 'blue') {
      setBlueRecall((prev) => prev.slice(0, -1));
    } else {
      setOrangeRecall((prev) => prev.slice(0, -1));
    }
  }, [activeRecallStream]);

  const handleSubmitRecall = useCallback(async () => {
    if (!round) return;

    if (activeRecallStream === 'blue' && blueRecall.length === round.blueStream.length) {
      setActiveRecallStream('orange');
      return;
    }

    if (activeRecallStream === 'orange' && orangeRecall.length === round.orangeStream.length) {
      const blueCorrectShapes = round.blueStream.map((s) => s.shape);
      const orangeCorrectShapes = round.orangeStream.map((s) => s.shape);
      const roundResult = scoreRound(blueRecall, orangeRecall, blueCorrectShapes, orangeCorrectShapes, interferenceCorrect);
      setResult(roundResult);

      const newDiff = updateDifficulty(difficulty, roundResult);
      setDifficulty(newDiff);
      await addRoundResult(roundResult, newDiff);

      setPhase('feedback');

      if (Platform.OS !== 'web') {
        if (roundResult.accuracy >= 0.8) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (roundResult.accuracy >= 0.5) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    }
  }, [round, activeRecallStream, blueRecall, orangeRecall, interferenceCorrect, difficulty]);

  useEffect(() => {
    if (phase === 'feedback' && round) {
      let idx = 0;
      const replayTimer = setInterval(() => {
        if (idx < round.interleaved.length) {
          setReplayIndex(idx);
          idx++;
        } else {
          clearInterval(replayTimer);
        }
      }, difficulty.symbolSpeed * 2);
      return () => clearInterval(replayTimer);
    }
  }, [phase, round, difficulty.symbolSpeed]);

  const handleBack = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    router.back();
  }, []);

  if (!round) return <View style={[styles.container, { backgroundColor: Colors.background }]} />;

  const currentRecallList = activeRecallStream === 'blue' ? blueRecall : orangeRecall;
  const currentRecallTarget = activeRecallStream === 'blue' ? round.blueStream.length : round.orangeStream.length;
  const recallColor = activeRecallStream === 'blue' ? Colors.streamBlue : Colors.streamOrange;
  const canSubmit = currentRecallList.length === currentRecallTarget;

  const availableSymbolPool = ALL_SYMBOLS.slice(0, difficulty.symbolPool);

  return (
    <View style={[styles.container, {
      paddingTop: insets.top + webTopInset,
      paddingBottom: insets.bottom + webBottomInset,
    }]}>
      <View style={styles.topBar}>
        <Pressable onPress={handleBack} hitSlop={20}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </Pressable>
        <Text style={styles.roundLabel}>Round {roundNumber}</Text>
        <Text style={styles.levelLabel}>Lv {difficulty.level}</Text>
      </View>

      {phase === 'breathing' && <BreathingPhase count={breathCount} />}
      {phase === 'observe' && (
        <ObservePhase
          round={round}
          currentIndex={currentSymbolIndex}
          difficulty={difficulty}
        />
      )}
      {phase === 'interfere' && (
        <InterferencePhase
          round={round}
          answer={interferenceAnswer}
          correct={interferenceCorrect}
          onAnswer={handleInterferenceAnswer}
        />
      )}
      {phase === 'recall' && (
        <RecallPhase
          stream={activeRecallStream}
          recallList={currentRecallList}
          targetLength={currentRecallTarget}
          recallColor={recallColor}
          symbolPool={availableSymbolPool}
          onTap={handleRecallTap}
          onUndo={handleUndoRecall}
          onSubmit={handleSubmitRecall}
          canSubmit={canSubmit}
        />
      )}
      {phase === 'feedback' && result && (
        <FeedbackPhase
          result={result}
          round={round}
          replayIndex={replayIndex}
          blueRecall={blueRecall}
          orangeRecall={orangeRecall}
          onNextRound={startNewRound}
          onHome={handleBack}
        />
      )}
    </View>
  );
}

function BreathingPhase({ count }: { count: number }) {
  const scale = useSharedValue(1);
  
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.phaseContainer}>
      <Animated.View style={[styles.breathCircle, animStyle]}>
        <LinearGradient
          colors={[`${Colors.streamBlue}30`, `${Colors.streamOrange}20`]}
          style={styles.breathGradient}
        >
          <Text style={styles.breathText}>
            {count > 0 ? (count % 2 === 1 ? 'Inhale' : 'Exhale') : 'Begin'}
          </Text>
        </LinearGradient>
      </Animated.View>
      <Text style={styles.breathSubtext}>Clear your mind</Text>
    </View>
  );
}

function ObservePhase({ round, currentIndex, difficulty }: { round: GameRound; currentIndex: number; difficulty: DifficultyState }) {
  const currentSymbol = currentIndex >= 0 && currentIndex < round.interleaved.length
    ? round.interleaved[currentIndex]
    : null;

  const progress = round.interleaved.length > 0
    ? Math.min(currentIndex / round.interleaved.length, 1)
    : 0;

  return (
    <View style={styles.phaseContainer}>
      <Text style={styles.phaseTitle}>Observe the streams</Text>
      <View style={styles.streamIndicators}>
        <View style={styles.streamIndicator}>
          <View style={[styles.streamDot, { backgroundColor: Colors.streamBlue }]} />
          <Text style={styles.streamIndicatorText}>Stream A</Text>
        </View>
        <View style={styles.streamIndicator}>
          <View style={[styles.streamDot, { backgroundColor: Colors.streamOrange }]} />
          <Text style={styles.streamIndicatorText}>Stream B</Text>
        </View>
      </View>

      <View style={styles.symbolDisplay}>
        {currentSymbol ? (
          <Animated.View key={currentSymbol.id} entering={FadeIn.duration(150)} style={styles.symbolWrapper}>
            <View style={[styles.symbolGlow, {
              backgroundColor: currentSymbol.stream === 'blue' ? `${Colors.streamBlue}20` : `${Colors.streamOrange}20`,
            }]}>
              <SymbolIcon
                shape={currentSymbol.shape}
                size={80}
                color={currentSymbol.stream === 'blue' ? Colors.streamBlue : Colors.streamOrange}
              />
            </View>
            <Text style={[styles.symbolStreamLabel, {
              color: currentSymbol.stream === 'blue' ? Colors.streamBlue : Colors.streamOrange,
            }]}>
              {currentSymbol.stream === 'blue' ? 'A' : 'B'}
            </Text>
          </Animated.View>
        ) : (
          <View style={styles.symbolPlaceholder} />
        )}
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

function InterferencePhase({ round, answer, correct, onAnswer }: {
  round: GameRound;
  answer: string | null;
  correct: boolean;
  onAnswer: (answer: string) => void;
}) {
  const data = round.interferenceData;
  let prompt = '';
  if (data.type === 'tap-shape') {
    prompt = `Tap the ${data.target}`;
  } else if (data.type === 'tap-color') {
    prompt = `Which color was Stream A?`;
  } else {
    prompt = `How many symbols were there?`;
  }

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.phaseContainer}>
      <View style={[styles.interferenceHeader]}>
        <Ionicons name="flash" size={24} color={Colors.warning} />
        <Text style={styles.interferenceTitle}>Interference</Text>
      </View>
      <Text style={styles.interferencePrompt}>{prompt}</Text>

      <View style={styles.interferenceOptions}>
        {data.options.map((option, idx) => {
          const isSelected = answer === option;
          const isCorrectOption = option === data.correctAnswer;
          let bgColor = Colors.surface;
          if (answer !== null) {
            if (isCorrectOption) bgColor = `${Colors.success}30`;
            else if (isSelected && !correct) bgColor = `${Colors.error}30`;
          }

          return (
            <Pressable
              key={`${option}-${idx}`}
              onPress={() => onAnswer(option)}
              disabled={answer !== null}
              style={[styles.interferenceOption, { backgroundColor: bgColor, borderColor: isSelected ? (correct ? Colors.success : Colors.error) : Colors.border }]}
            >
              {data.type === 'tap-shape' ? (
                <SymbolIcon shape={option as SymbolShape} size={36} color={Colors.text} />
              ) : (
                <Text style={[styles.interferenceOptionText, {
                  color: data.type === 'tap-color' ? (option === 'blue' ? Colors.streamBlue : option === 'orange' ? Colors.streamOrange : option === 'green' ? Colors.streamGreen : Colors.error) : Colors.text,
                }]}>{option}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

function RecallPhase({ stream, recallList, targetLength, recallColor, symbolPool, onTap, onUndo, onSubmit, canSubmit }: {
  stream: 'blue' | 'orange';
  recallList: SymbolShape[];
  targetLength: number;
  recallColor: string;
  symbolPool: SymbolShape[];
  onTap: (s: SymbolShape) => void;
  onUndo: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
}) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.phaseContainer}>
      <View style={styles.recallHeader}>
        <View style={[styles.streamDot, { backgroundColor: recallColor, width: 12, height: 12, borderRadius: 6 }]} />
        <Text style={[styles.recallTitle, { color: recallColor }]}>
          Stream {stream === 'blue' ? 'A' : 'B'} - Recall
        </Text>
      </View>
      <Text style={styles.recallSubtitle}>
        Tap symbols in the order they appeared ({recallList.length}/{targetLength})
      </Text>

      <View style={styles.recallSlots}>
        {Array.from({ length: targetLength }).map((_, idx) => (
          <View key={idx} style={[styles.recallSlot, {
            borderColor: idx < recallList.length ? recallColor : Colors.border,
            backgroundColor: idx < recallList.length ? `${recallColor}15` : 'transparent',
          }]}>
            {idx < recallList.length ? (
              <SymbolIcon shape={recallList[idx]} size={32} color={recallColor} />
            ) : (
              <Text style={styles.slotNumber}>{idx + 1}</Text>
            )}
          </View>
        ))}
      </View>

      <ScrollView style={styles.symbolGridScroll} contentContainerStyle={styles.symbolGrid} showsVerticalScrollIndicator={false}>
        {symbolPool.map((shape) => (
          <Pressable
            key={shape}
            onPress={() => onTap(shape)}
            disabled={recallList.length >= targetLength}
            style={({ pressed }) => [styles.symbolGridItem, pressed && { opacity: 0.6, transform: [{ scale: 0.95 }] }]}
          >
            <SymbolIcon shape={shape} size={36} color={Colors.text} />
            <Text style={styles.symbolGridLabel}>{shape}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.recallActions}>
        <Pressable onPress={onUndo} disabled={recallList.length === 0} style={[styles.undoButton, recallList.length === 0 && { opacity: 0.3 }]}>
          <Ionicons name="arrow-undo" size={22} color={Colors.text} />
        </Pressable>
        <Pressable onPress={onSubmit} disabled={!canSubmit} style={[styles.submitButton, !canSubmit && { opacity: 0.3 }]}>
          <LinearGradient
            colors={canSubmit ? [recallColor, recallColor] : [Colors.surface, Colors.surface]}
            style={styles.submitGradient}
          >
            <Text style={styles.submitText}>
              {stream === 'blue' ? 'Next Stream' : 'Submit'}
            </Text>
            <Ionicons name={stream === 'blue' ? 'arrow-forward' : 'checkmark'} size={20} color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function FeedbackPhase({ result, round, replayIndex, blueRecall, orangeRecall, onNextRound, onHome }: {
  result: RoundResult;
  round: GameRound;
  replayIndex: number;
  blueRecall: SymbolShape[];
  orangeRecall: SymbolShape[];
  onNextRound: () => void;
  onHome: () => void;
}) {
  const pct = Math.round(result.accuracy * 100);
  const grade = pct >= 80 ? 'Excellent' : pct >= 60 ? 'Good' : pct >= 40 ? 'Keep Going' : 'Try Again';
  const gradeColor = pct >= 80 ? Colors.success : pct >= 60 ? Colors.streamBlue : pct >= 40 ? Colors.warning : Colors.error;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.feedbackScroll} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.duration(400)}>
        <View style={styles.feedbackHeader}>
          <Text style={[styles.feedbackGrade, { color: gradeColor }]}>{grade}</Text>
          <Text style={styles.feedbackPct}>{pct}%</Text>
        </View>

        <View style={styles.feedbackStatsRow}>
          <View style={styles.feedbackStat}>
            <View style={[styles.streamDot, { backgroundColor: Colors.streamBlue }]} />
            <Text style={styles.feedbackStatValue}>{result.blueCorrect}/{result.blueTotal}</Text>
            <Text style={styles.feedbackStatLabel}>Stream A</Text>
          </View>
          <View style={styles.feedbackStat}>
            <View style={[styles.streamDot, { backgroundColor: Colors.streamOrange }]} />
            <Text style={styles.feedbackStatValue}>{result.orangeCorrect}/{result.orangeTotal}</Text>
            <Text style={styles.feedbackStatLabel}>Stream B</Text>
          </View>
          <View style={styles.feedbackStat}>
            <Ionicons name={result.interferenceCorrect ? 'checkmark-circle' : 'close-circle'} size={10} color={result.interferenceCorrect ? Colors.success : Colors.error} />
            <Text style={styles.feedbackStatValue}>{result.interferenceCorrect ? '1/1' : '0/1'}</Text>
            <Text style={styles.feedbackStatLabel}>Interference</Text>
          </View>
        </View>

        <View style={styles.feedbackSection}>
          <Text style={styles.feedbackSectionTitle}>Stream A (Blue) - Your Answer vs Correct</Text>
          <View style={styles.comparisonRow}>
            {round.blueStream.map((s, idx) => {
              const isCorrect = idx < blueRecall.length && blueRecall[idx] === s.shape;
              return (
                <View key={s.id} style={styles.comparisonItem}>
                  <View style={[styles.comparisonSlot, { borderColor: isCorrect ? Colors.success : Colors.error }]}>
                    <SymbolIcon shape={idx < blueRecall.length ? blueRecall[idx] : s.shape} size={28} color={isCorrect ? Colors.success : Colors.error} />
                  </View>
                  {!isCorrect && (
                    <View style={styles.correctAnswer}>
                      <SymbolIcon shape={s.shape} size={20} color={Colors.streamBlue} opacity={0.6} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.feedbackSection}>
          <Text style={styles.feedbackSectionTitle}>Stream B (Orange) - Your Answer vs Correct</Text>
          <View style={styles.comparisonRow}>
            {round.orangeStream.map((s, idx) => {
              const isCorrect = idx < orangeRecall.length && orangeRecall[idx] === s.shape;
              return (
                <View key={s.id} style={styles.comparisonItem}>
                  <View style={[styles.comparisonSlot, { borderColor: isCorrect ? Colors.success : Colors.error }]}>
                    <SymbolIcon shape={idx < orangeRecall.length ? orangeRecall[idx] : s.shape} size={28} color={isCorrect ? Colors.success : Colors.error} />
                  </View>
                  {!isCorrect && (
                    <View style={styles.correctAnswer}>
                      <SymbolIcon shape={s.shape} size={20} color={Colors.streamOrange} opacity={0.6} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.feedbackActions}>
          <Pressable onPress={onNextRound} style={({ pressed }) => [styles.nextRoundButton, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}>
            <LinearGradient colors={[Colors.streamBlue, '#3A7BD5']} style={styles.nextRoundGradient}>
              <Text style={styles.nextRoundText}>Next Round</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </LinearGradient>
          </Pressable>
          <Pressable onPress={onHome} style={({ pressed }) => [styles.homeButton, pressed && { opacity: 0.7 }]}>
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </Pressable>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  roundLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
    color: Colors.text,
  },
  levelLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: Colors.textSecondary,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  phaseContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breathCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    overflow: 'hidden',
  },
  breathGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 90,
  },
  breathText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 22,
    color: Colors.text,
  },
  breathSubtext: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: Colors.textTertiary,
    marginTop: 20,
  },
  phaseTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 18,
    color: Colors.text,
    marginBottom: 12,
  },
  streamIndicators: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 30,
  },
  streamIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  streamIndicatorText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  symbolDisplay: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolGlow: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolStreamLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    marginTop: 10,
  },
  symbolPlaceholder: {
    width: 130,
    height: 130,
  },
  progressBar: {
    width: '80%',
    height: 4,
    backgroundColor: Colors.surface,
    borderRadius: 2,
    marginTop: 30,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.streamBlue,
    borderRadius: 2,
  },
  interferenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  interferenceTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 20,
    color: Colors.warning,
  },
  interferencePrompt: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    color: Colors.text,
    marginBottom: 30,
    textAlign: 'center',
  },
  interferenceOptions: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  interferenceOption: {
    width: 80,
    height: 80,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  interferenceOptionText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 18,
  },
  recallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  recallTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 20,
  },
  recallSubtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: Colors.textTertiary,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  recallSlots: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  recallSlot: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotNumber: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: Colors.textTertiary,
  },
  symbolGridScroll: {
    flex: 1,
    width: '100%',
  },
  symbolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingBottom: 10,
  },
  symbolGridItem: {
    width: 70,
    height: 78,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  symbolGridLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 9,
    color: Colors.textTertiary,
    textTransform: 'capitalize',
  },
  recallActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 10,
    width: '100%',
  },
  undoButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  submitButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    gap: 8,
  },
  submitText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
    color: '#fff',
  },
  feedbackScroll: {
    paddingBottom: 40,
    paddingTop: 10,
  },
  feedbackHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  feedbackGrade: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 28,
  },
  feedbackPct: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 48,
    color: Colors.text,
    marginTop: 4,
  },
  feedbackStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  feedbackStat: {
    alignItems: 'center',
    gap: 4,
  },
  feedbackStatValue: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 18,
    color: Colors.text,
  },
  feedbackStatLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: Colors.textTertiary,
  },
  feedbackSection: {
    marginBottom: 20,
  },
  feedbackSectionTitle: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  comparisonRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  comparisonItem: {
    alignItems: 'center',
    gap: 4,
  },
  comparisonSlot: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  correctAnswer: {
    alignItems: 'center',
  },
  feedbackActions: {
    gap: 12,
    marginTop: 20,
  },
  nextRoundButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  nextRoundGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    gap: 8,
  },
  nextRoundText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 17,
    color: '#fff',
  },
  homeButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButtonText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    color: Colors.textSecondary,
  },
});
