import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

interface Badge {
  badge_id: string;
  badge_code: string;
  badge_name: string;
  badge_description: string;
  badge_icon: string | null;
  badge_category: string;
  requirement_value: number | null;
  user_progress: number;
  user_earned_at: string | null;
  is_earned: boolean;
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
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [zeroWasteStats, setZeroWasteStats] = useState<any>(null);

  useEffect(() => {
    if (userId) {
      fetchBadgesAndChallenges();
      fetchZeroWasteStats();
    }
  }, [userId]);

  const fetchBadgesAndChallenges = async () => {
    setLoading(true);
    try {
      // Fetch all badges with progress using RPC function
      const { data: badges, error: badgesError } = await supabase.rpc('get_all_badges_with_progress', {
        p_user_id: userId,
      });

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

      setAllBadges((badges || []) as Badge[]);
      setUserChallenges((challenges || []) as UserChallenge[]);
    } catch (error: any) {
      console.error('Error fetching badges and challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchZeroWasteStats = async () => {
    try {
      const { data, error } = await supabase.rpc('track_zero_waste_progress', {
        p_user_id: userId,
      });

      if (error) throw error;
      setZeroWasteStats(data);
    } catch (error: any) {
      console.error('Error fetching zero waste stats:', error);
    }
  };

  const handleCheckBadges = async () => {
    setLoading(true);
    try {
      await supabase.rpc('check_and_award_badges', {
        p_user_id: userId,
      });
      // Refresh badges after check
      await fetchBadgesAndChallenges();
      await fetchZeroWasteStats();
    } catch (error: any) {
      console.error('Error checking badges:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'zero_waste':
        return '#047857';
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

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'zero_waste':
        return 'leaf';
      case 'ingredient_master':
        return 'cube';
      case 'recipe_creator':
        return 'book';
      case 'streak':
        return 'flame';
      case 'community':
        return 'people';
      default:
        return 'trophy';
    }
  };

  const getIconName = (iconName: string | null, category: string): string => {
    if (iconName) {
      // Map common icon names to Ionicons
      const iconMap: Record<string, string> = {
        'leaf': 'leaf',
        'shield': 'shield',
        'cube': 'cube',
        'barcode': 'barcode',
        'book': 'book',
        'restaurant': 'restaurant',
        'flame': 'flame',
        'scan': 'scan',
        'archive': 'archive',
        'time': 'time',
      };
      return iconMap[iconName] || getCategoryIcon(category);
    }
    return getCategoryIcon(category);
  };

  const earnedBadges = allBadges.filter((b) => b.is_earned);
  const availableBadges = allBadges.filter((b) => !b.is_earned);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#047857" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Zero Waste Stats */}
      {zeroWasteStats && (
        <View style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <Ionicons name="leaf" size={24} color="#047857" />
            <Text style={styles.statsTitle}>Zero-Waste Tracker</Text>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Ionicons name="flame" size={20} color="#f97316" />
              </View>
              <Text style={styles.statValue}>{zeroWasteStats.streak_days || 0}</Text>
              <Text style={styles.statLabel}>Dagen streak</Text>
            </View>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Ionicons name="checkmark-circle" size={20} color="#047857" />
              </View>
              <Text style={styles.statValue}>{zeroWasteStats.items_saved || 0}</Text>
              <Text style={styles.statLabel}>Items gebruikt</Text>
            </View>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Ionicons name="trending-down" size={20} color="#10b981" />
              </View>
              <Text style={styles.statValue}>
                {zeroWasteStats.waste_percentage ? `${zeroWasteStats.waste_percentage.toFixed(1)}%` : '0%'}
              </Text>
              <Text style={styles.statLabel}>Waste</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.checkButton} onPress={handleCheckBadges} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#047857" />
            ) : (
              <Ionicons name="refresh" size={16} color="#047857" />
            )}
            <Text style={styles.checkButtonText}>Badges bijwerken</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Challenges Section */}
      {userChallenges.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actieve Challenges</Text>
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
                        <Ionicons name="checkmark-circle" size={16} color="#047857" />
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
                          { width: `${progress}%`, backgroundColor: isCompleted ? '#047857' : '#047857' },
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

      {/* All Badges Section - Mobile First Grid */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Badges</Text>
          <View style={styles.badgeCountBadge}>
            <Text style={styles.badgeCountText}>
              {earnedBadges.length}/{allBadges.length}
            </Text>
          </View>
        </View>
        
        {allBadges.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyText}>Geen badges beschikbaar</Text>
            <Text style={styles.emptySubtext}>
              Badges worden binnenkort toegevoegd
            </Text>
          </View>
        ) : (
          <View style={styles.badgesGrid}>
            {allBadges.map((badge) => {
              const categoryColor = getCategoryColor(badge.badge_category);
              const iconName = getIconName(badge.badge_icon, badge.badge_category);
              const progress = badge.user_progress || 0;
              const isEarned = badge.is_earned;
              const iconColor = isEarned ? categoryColor : '#cbd5e1';
              const bgColor = isEarned ? categoryColor + '15' : '#f8fafc';
              const borderColor = isEarned ? categoryColor : '#e2e8f0';

              return (
                <TouchableOpacity
                  key={badge.badge_id}
                  style={[
                    styles.badgeCard,
                    isEarned ? styles.badgeCardEarned : styles.badgeCardLocked,
                    { borderColor },
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.badgeIconContainer, { backgroundColor: bgColor, borderColor: isEarned ? categoryColor : '#e2e8f0' }]}>
                    <Ionicons 
                      name={iconName as any} 
                      size={40} 
                      color={iconColor}
                      style={!isEarned && styles.badgeIconLocked}
                    />
                    {isEarned && (
                      <View style={[styles.earnedBadge, { backgroundColor: categoryColor }]}>
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      </View>
                    )}
                    {!isEarned && progress > 0 && (
                      <View style={styles.progressOverlay}>
                        <Text style={styles.progressOverlayText}>{progress}%</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.badgeContent}>
                    <Text style={[styles.badgeName, !isEarned && styles.badgeNameLocked]} numberOfLines={1}>
                      {badge.badge_name}
                    </Text>
                    <Text style={[styles.badgeDescription, !isEarned && styles.badgeDescriptionLocked]} numberOfLines={2}>
                      {badge.badge_description}
                    </Text>
                    
                    {badge.requirement_value && (
                      <View style={styles.requirementContainer}>
                        <View style={styles.progressBar}>
                          <View
                            style={[
                              styles.progressFill,
                              { 
                                width: `${progress}%`, 
                                backgroundColor: isEarned ? categoryColor : '#cbd5e1',
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.requirementText}>
                          {isEarned ? (
                            badge.user_earned_at ? (
                              new Date(badge.user_earned_at).toLocaleDateString('nl-NL', {
                                day: 'numeric',
                                month: 'short',
                              })
                            ) : 'Verdiend'
                          ) : (
                            `${Math.round((progress / 100) * badge.requirement_value)}/${badge.requirement_value}`
                          )}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
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
  statsCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.2)',
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#047857',
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#047857',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#047857',
  },
  checkButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#047857',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  badgeCountBadge: {
    backgroundColor: '#047857',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
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
    paddingBottom: 24,
  },
  badgeCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  badgeCardEarned: {
    borderColor: '#047857',
    backgroundColor: '#f0fdf4',
  },
  badgeCardLocked: {
    borderColor: '#e2e8f0',
    backgroundColor: '#fafbfc',
  },
  badgeContent: {
    width: '100%',
    alignItems: 'center',
    gap: 4,
  },
  badgeIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  badgeIconLocked: {
    opacity: 0.4,
  },
  earnedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  progressOverlay: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    backgroundColor: '#047857',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    minWidth: 36,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  progressOverlayText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  requirementContainer: {
    width: '100%',
    marginTop: 8,
    gap: 4,
  },
  requirementText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '600',
  },
  badgeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  badgeNameLocked: {
    color: '#64748b',
  },
  badgeDescription: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 14,
  },
  badgeDescriptionLocked: {
    color: '#94a3b8',
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

