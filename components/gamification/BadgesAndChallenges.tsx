import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';

interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string | null;
  category: string;
  requirement_value: number | null;
}

interface UserBadge {
  id: string;
  badge_id: string;
  earned_at: string;
  progress: number;
  badge: Badge;
}

interface Challenge {
  id: string;
  code: string;
  name: string;
  description: string;
  badge_id: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

interface UserChallenge {
  id: string;
  challenge_id: string;
  progress: number;
  completed: boolean;
  completed_at: string | null;
  challenge: Challenge;
}

interface BadgesAndChallengesProps {
  userId: string;
}

export function BadgesAndChallenges({ userId }: BadgesAndChallengesProps) {
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchBadgesAndChallenges();
    }
  }, [userId]);

  const fetchBadgesAndChallenges = async () => {
    setLoading(true);
    try {
      // Fetch user badges
      const { data: badges, error: badgesError } = await supabase
        .from('user_badges')
        .select(`
          *,
          badge:badges(*)
        `)
        .eq('user_id', userId)
        .order('earned_at', { ascending: false });

      if (badgesError) throw badgesError;

      // Fetch active challenges
      const { data: challenges, error: challengesError } = await supabase
        .from('user_challenges')
        .select(`
          *,
          challenge:challenges(*)
        `)
        .eq('user_id', userId)
        .order('started_at', { ascending: false });

      if (challengesError) throw challengesError;

      setUserBadges((badges || []) as UserBadge[]);
      setUserChallenges((challenges || []) as UserChallenge[]);
    } catch (error: any) {
      console.error('Error fetching badges and challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'zero_waste':
        return '#10b981';
      case 'ingredient_master':
        return '#f59e0b';
      case 'recipe_creator':
        return '#8b5cf6';
      case 'streak':
        return '#ef4444';
      case 'community':
        return '#3b82f6';
      default:
        return '#64748b';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#047857" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Challenges Section */}
      {userChallenges.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏆 Actieve Challenges</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.challengesList}>
            {userChallenges.map((uc) => {
              const challenge = uc.challenge;
              const progress = uc.progress;
              const isCompleted = uc.completed;

              return (
                <View key={uc.id} style={styles.challengeCard}>
                  <View style={styles.challengeHeader}>
                    <Text style={styles.challengeName}>{challenge.name}</Text>
                    {isCompleted && (
                      <View style={styles.completedBadge}>
                        <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                      </View>
                    )}
                  </View>
                  <Text style={styles.challengeDescription} numberOfLines={2}>
                    {challenge.description}
                  </Text>
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${progress}%`, backgroundColor: isCompleted ? '#10b981' : '#047857' },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>{progress}%</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Badges Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎖️ Verdiende Badges</Text>
        {userBadges.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={48} color="#94a3b8" />
            <Text style={styles.emptyText}>Nog geen badges verdiend</Text>
            <Text style={styles.emptySubtext}>
              Gebruik je voorraad slim en verdien badges voor zero-waste prestaties
            </Text>
          </View>
        ) : (
          <View style={styles.badgesGrid}>
            {userBadges.map((ub) => {
              const badge = ub.badge;
              const categoryColor = getCategoryColor(badge.category);

              return (
                <View key={ub.id} style={styles.badgeCard}>
                  <View style={[styles.badgeIconContainer, { backgroundColor: categoryColor + '20' }]}>
                    <Text style={styles.badgeIcon}>{badge.icon || '🏆'}</Text>
                  </View>
                  <Text style={styles.badgeName} numberOfLines={1}>
                    {badge.name}
                  </Text>
                  <Text style={styles.badgeDescription} numberOfLines={2}>
                    {badge.description}
                  </Text>
                  <Text style={styles.badgeDate}>
                    {new Date(ub.earned_at).toLocaleDateString('nl-NL', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#065f46',
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  challengesList: {
    paddingHorizontal: 24,
  },
  challengeCard: {
    width: 280,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    padding: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  challengeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  completedBadge: {
    marginLeft: 8,
  },
  challengeDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    minWidth: 40,
    textAlign: 'right',
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    gap: 12,
  },
  badgeCard: {
    width: '48%',
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    alignItems: 'center',
  },
  badgeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeIcon: {
    fontSize: 32,
  },
  badgeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 4,
  },
  badgeDescription: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 8,
  },
  badgeDate: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
  },
  emptyState: {
    padding: 48,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
});

