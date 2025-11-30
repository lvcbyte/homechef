import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

interface Household {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  user_email?: string;
}

interface FamilySharingProps {
  userId: string;
}

export function FamilySharing({ userId }: FamilySharingProps) {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [members, setMembers] = useState<Record<string, HouseholdMember[]>>({});
  const [loading, setLoading] = useState(false);
  const [creatingHousehold, setCreatingHousehold] = useState(false);
  const [householdName, setHouseholdName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchHouseholds();
    }
  }, [userId]);

  const fetchHouseholds = async () => {
    setLoading(true);
    try {
      // Get households user is member of
      const { data: memberData, error: memberError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', userId);

      if (memberError) throw memberError;

      if (memberData && memberData.length > 0) {
        const householdIds = memberData.map((m) => m.household_id);

        // Get household details
        const { data: householdData, error: householdError } = await supabase
          .from('households')
          .select('*')
          .in('id', householdIds);

        if (householdError) throw householdError;

        setHouseholds((householdData || []) as Household[]);

        // Get members for each household
        const membersMap: Record<string, HouseholdMember[]> = {};
        for (const household of householdData || []) {
          const { data: memberList, error: memberListError } = await supabase
            .from('household_members')
            .select(`
              *,
              user:auth.users!household_members_user_id_fkey(email)
            `)
            .eq('household_id', household.id);

          if (!memberListError && memberList) {
            membersMap[household.id] = memberList.map((m: any) => ({
              ...m,
              user_email: m.user?.email,
            })) as HouseholdMember[];
          }
        }
        setMembers(membersMap);
      }
    } catch (error: any) {
      console.error('Error fetching households:', error);
      Alert.alert('Fout', 'Kon gezinnen niet laden: ' + (error.message || 'Onbekende fout'));
    } finally {
      setLoading(false);
    }
  };

  const createHousehold = async () => {
    if (!householdName.trim()) {
      Alert.alert('Fout', 'Geef je gezin een naam');
      return;
    }

    setCreatingHousehold(true);
    try {
      const { data: household, error: householdError } = await supabase
        .from('households')
        .insert({
          name: householdName.trim(),
          created_by: userId,
        })
        .select()
        .single();

      if (householdError) throw householdError;

      // Add creator as owner
      const { error: memberError } = await supabase.from('household_members').insert({
        household_id: household.id,
        user_id: userId,
        role: 'owner',
      });

      if (memberError) throw memberError;

      setHouseholdName('');
      setShowCreateModal(false);
      await fetchHouseholds();
      Alert.alert('Succes', 'Gezin aangemaakt!');
    } catch (error: any) {
      console.error('Error creating household:', error);
      Alert.alert('Fout', 'Kon gezin niet aanmaken: ' + (error.message || 'Onbekende fout'));
    } finally {
      setCreatingHousehold(false);
    }
  };

  const leaveHousehold = async (householdId: string) => {
    Alert.alert(
      'Gezin verlaten',
      'Weet je zeker dat je dit gezin wilt verlaten?',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Verlaten',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('household_members')
                .delete()
                .eq('household_id', householdId)
                .eq('user_id', userId);

              if (error) throw error;

              await fetchHouseholds();
            } catch (error: any) {
              Alert.alert('Fout', 'Kon gezin niet verlaten: ' + (error.message || 'Onbekende fout'));
            }
          },
        },
      ]
    );
  };

  if (loading && households.length === 0) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#047857" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>👨‍👩‍👧‍👦 Gezins Delen</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.createButtonText}>Nieuw Gezin</Text>
        </TouchableOpacity>
      </View>

      {households.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={64} color="#94a3b8" />
          <Text style={styles.emptyText}>Nog geen gezinnen</Text>
          <Text style={styles.emptySubtext}>
            Maak een gezin aan om je voorraad te delen met je familie
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.emptyButtonText}>Gezin Aanmaken</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {households.map((household) => {
            const householdMembers = members[household.id] || [];
            const isOwner = householdMembers.some((m) => m.user_id === userId && m.role === 'owner');

            return (
              <View key={household.id} style={styles.householdCard}>
                <View style={styles.householdHeader}>
                  <View>
                    <Text style={styles.householdName}>{household.name}</Text>
                    <Text style={styles.householdMeta}>
                      {householdMembers.length} {householdMembers.length === 1 ? 'lid' : 'leden'}
                    </Text>
                  </View>
                  {isOwner && (
                    <View style={styles.ownerBadge}>
                      <Ionicons name="star" size={16} color="#fbbf24" />
                      <Text style={styles.ownerBadgeText}>Eigenaar</Text>
                    </View>
                  )}
                </View>

                <View style={styles.membersList}>
                  {householdMembers.map((member) => (
                    <View key={member.id} style={styles.memberItem}>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberInitial}>
                          {member.user_email?.charAt(0).toUpperCase() || 'U'}
                        </Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberEmail}>{member.user_email || 'Onbekend'}</Text>
                        <Text style={styles.memberRole}>
                          {member.role === 'owner' ? 'Eigenaar' : member.role === 'admin' ? 'Beheerder' : 'Lid'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.leaveButton}
                  onPress={() => leaveHousehold(household.id)}
                >
                  <Ionicons name="exit-outline" size={16} color="#ef4444" />
                  <Text style={styles.leaveButtonText}>Gezin Verlaten</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Create Household Modal */}
      {showCreateModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nieuw Gezin Aanmaken</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Gezin naam (bijv. 'Lattré Gezin')"
              value={householdName}
              onChangeText={setHouseholdName}
              placeholderTextColor="#94a3b8"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowCreateModal(false);
                  setHouseholdName('');
                }}
              >
                <Text style={styles.modalCancelText}>Annuleren</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCreateButton, creatingHousehold && styles.modalCreateButtonDisabled]}
                onPress={createHousehold}
                disabled={creatingHousehold}
              >
                {creatingHousehold ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalCreateText}>Aanmaken</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.08)',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#065f46',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#047857',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 16,
    backgroundColor: '#047857',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  householdCard: {
    margin: 16,
    padding: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  householdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  householdName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  householdMeta: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ownerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
  },
  membersList: {
    gap: 12,
    marginBottom: 16,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: '#047857',
  },
  memberInfo: {
    flex: 1,
  },
  memberEmail: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  memberRole: {
    fontSize: 12,
    color: '#64748b',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,23,42,0.08)',
    marginTop: 8,
    paddingTop: 12,
  },
  leaveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.15)',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.15)',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  modalCreateButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#047857',
    alignItems: 'center',
  },
  modalCreateButtonDisabled: {
    opacity: 0.6,
  },
  modalCreateText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});

