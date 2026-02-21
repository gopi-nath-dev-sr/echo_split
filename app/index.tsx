import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Dimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, withDelay, FadeIn, FadeInDown } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { GameStats, DEFAULT_STATS } from '@/lib/game-engine';
import { loadStats } from '@/lib/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function PulsingOrb({ color, delay, x, y }: { color: string; delay: number; x: number; y: number }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.15);

  useEffect(() => {
    scale.value = withDelay(delay, withRepeat(withTiming(1.3, { duration: 3000 }), -1, true));
    opacity.value = withDelay(delay, withRepeat(withTiming(0.3, { duration: 3000 }), -1, true));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.orb, animStyle, { backgroundColor: color, left: x, top: y }]} />
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<GameStats>(DEFAULT_STATS);
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  useFocusEffect(
    useCallback(() => {
      loadStats().then(setStats);
    }, [])
  );

  const handlePlay = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/game');
  }, []);

  const scoreDisplay = stats.cognitiveScore > 0 ? stats.cognitiveScore : '--';
  const accuracyDisplay = stats.totalRounds > 0
    ? `${Math.round(stats.averageAccuracy * 100)}%`
    : '--';
  const levelDisplay = stats.difficulty?.level || 1;

  return (
    <View style={[styles.container, {
      paddingTop: insets.top + webTopInset,
      paddingBottom: insets.bottom + webBottomInset,
    }]}>
      <PulsingOrb color={Colors.streamBlue} delay={0} x={-40} y={120} />
      <PulsingOrb color={Colors.streamOrange} delay={1500} x={SCREEN_WIDTH - 60} y={200} />
      <PulsingOrb color={Colors.accent} delay={800} x={SCREEN_WIDTH / 2 - 40} y={SCREEN_WIDTH + 100} />

      <Animated.View entering={FadeIn.duration(800)} style={styles.header}>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons name="brain" size={28} color={Colors.streamBlue} />
          <Text style={styles.appTitle}>Echo Split</Text>
        </View>
        <Text style={styles.subtitle}>Train your cognitive split</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.scoreCard}>
        <LinearGradient
          colors={['rgba(74, 158, 255, 0.12)', 'rgba(255, 140, 66, 0.08)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.scoreCardGradient}
        >
          <Text style={styles.scoreLabel}>Cognitive Score</Text>
          <Text style={styles.scoreValue}>{scoreDisplay}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{accuracyDisplay}</Text>
              <Text style={styles.statLabel}>Accuracy</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.bestStreak}</Text>
              <Text style={styles.statLabel}>Best Streak</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{levelDisplay}</Text>
              <Text style={styles.statLabel}>Level</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.howItWorks}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        <View style={styles.phaseRow}>
          <PhaseStep icon="eye-outline" color={Colors.streamBlue} label="Observe" desc="Track two symbol streams" />
          <PhaseStep icon="flash-outline" color={Colors.warning} label="Interfere" desc="Brief distraction task" />
          <PhaseStep icon="git-compare-outline" color={Colors.streamOrange} label="Recall" desc="Reconstruct each stream" />
        </View>
      </Animated.View>

      <View style={styles.bottomSection}>
        <Animated.View entering={FadeInDown.delay(600).duration(600)}>
          <Pressable onPress={handlePlay} style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}>
            <LinearGradient
              colors={[Colors.streamBlue, '#3A7BD5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.playButtonGradient}
            >
              <Ionicons name="play" size={28} color="#fff" />
              <Text style={styles.playButtonText}>Start Training</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {stats.totalRounds > 0 && (
          <Animated.View entering={FadeInDown.delay(700).duration(600)}>
            <Text style={styles.roundsPlayed}>{stats.totalRounds} rounds completed</Text>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

function PhaseStep({ icon, color, label, desc }: { icon: string; color: string; label: string; desc: string }) {
  return (
    <View style={styles.phaseStep}>
      <View style={[styles.phaseIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={styles.phaseLabel}>{label}</Text>
      <Text style={styles.phaseDesc}>{desc}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
  },
  orb: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  header: {
    marginTop: 20,
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 32,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  scoreCard: {
    marginTop: 28,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scoreCardGradient: {
    padding: 24,
    alignItems: 'center',
  },
  scoreLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  scoreValue: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 48,
    color: Colors.text,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
    width: '100%',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 20,
    color: Colors.text,
  },
  statLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },
  howItWorks: {
    marginTop: 28,
  },
  sectionTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  phaseRow: {
    flexDirection: 'row',
    gap: 12,
  },
  phaseStep: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  phaseIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    color: Colors.text,
    marginTop: 8,
  },
  phaseDesc: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 14,
  },
  bottomSection: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 20,
    gap: 12,
  },
  playButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  playButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  playButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  playButtonText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 18,
    color: '#fff',
  },
  roundsPlayed: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});
