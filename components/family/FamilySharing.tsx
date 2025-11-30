import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

interface UserSearchResult {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
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
  const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null);
  const [showHouseholdModal, setShowHouseholdModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingInvitation, setSendingInvitation] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchHouseholds();
    }
  }, [userId]);

  const fetchHouseholds = async () => {
    setLoading(true);
    try {
      // Use helper function to get all households for user (avoids RLS recursion)
      // First, get household IDs where user is a member
      const { data: memberData, error: memberError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', userId);

      if (memberError) {
        // If direct query fails due to RLS, try using a simpler approach
        console.warn('Direct query failed, trying alternative:', memberError);
        // Fallback: use RPC function if available, or skip
        setLoading(false);
        return;
      }

      if (memberData && memberData.length > 0) {
        const householdIds = memberData.map((m) => m.household_id);

        // Get household details
        const { data: householdData, error: householdError } = await supabase
          .from('households')
          .select('*')
          .in('id', householdIds);

        if (householdError) throw householdError;

        setHouseholds((householdData || []) as Household[]);

        // Get members for each household using helper function (avoids RLS recursion)
        const membersMap: Record<string, HouseholdMember[]> = {};
        for (const household of householdData || []) {
          try {
            const { data: memberList, error: memberListError } = await supabase.rpc(
              'get_household_members',
              { p_household_id: household.id }
            );

            if (!memberListError && memberList) {
              membersMap[household.id] = memberList as HouseholdMember[];
            }
          } catch (err) {
            console.warn('Error fetching members for household:', household.id, err);
            // Continue with other households even if one fails
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
      // Try using the helper function first
      const { data: householdId, error: rpcError } = await supabase.rpc('create_household', {
        p_name: householdName.trim(),
      });

      if (rpcError) {
        console.warn('RPC function failed, trying direct insert:', rpcError);
        
        // Fallback to direct insert if RPC fails
        const { data: household, error: householdError } = await supabase
          .from('households')
          .insert({
            name: householdName.trim(),
            created_by: userId,
          })
          .select()
          .single();

        if (householdError) {
          console.error('Error creating household:', householdError);
          throw new Error(householdError.message || 'Kon gezin niet aanmaken');
        }

        if (!household) {
          throw new Error('Geen gezin data teruggekregen');
        }

        // Add creator as owner
        const { error: memberError } = await supabase.from('household_members').insert({
          household_id: household.id,
          user_id: userId,
          role: 'owner',
        });

        if (memberError) {
          console.error('Error adding member:', memberError);
          // Try to clean up household if member insert fails
          await supabase.from('households').delete().eq('id', household.id);
          throw new Error(memberError.message || 'Kon jezelf niet toevoegen als eigenaar');
        }
      } else if (!householdId) {
        throw new Error('Geen gezin ID teruggekregen van functie');
      }

      setHouseholdName('');
      setShowCreateModal(false);
      await fetchHouseholds();
      Alert.alert('Succes', 'Gezin aangemaakt!');
    } catch (error: any) {
      console.error('Error creating household:', error);
      Alert.alert('Fout', error.message || 'Kon gezin niet aanmaken. Probeer het opnieuw.');
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
              console.log('Leaving household:', householdId, 'User:', userId);
              
              const { data, error } = await supabase.rpc('remove_household_member', {
                p_household_id: householdId,
                p_user_id: userId,
              });

              if (error) {
                console.error('RPC error:', error);
                // Fallback to direct delete
                const { error: deleteError } = await supabase
                  .from('household_members')
                  .delete()
                  .eq('household_id', householdId)
                  .eq('user_id', userId);

                if (deleteError) {
                  console.error('Delete error:', deleteError);
                  throw deleteError;
                }
              } else {
                console.log('Successfully left household:', data);
              }

              // Close modal first
              if (selectedHousehold?.id === householdId) {
                setShowHouseholdModal(false);
                setSelectedHousehold(null);
              }

              // Refresh households
              await fetchHouseholds();
              
              Alert.alert('Succes', 'Je hebt het gezin verlaten');
            } catch (error: any) {
              console.error('Error leaving household:', error);
              Alert.alert('Fout', 'Kon gezin niet verlaten: ' + (error.message || 'Onbekende fout'));
            }
          },
        },
      ]
    );
  };

  const fetchMembersForHousehold = async (householdId: string) => {
    try {
      const { data: memberList, error: memberListError } = await supabase.rpc(
        'get_household_members',
        { p_household_id: householdId }
      );

      if (!memberListError && memberList) {
        setMembers((prev) => ({
          ...prev,
          [householdId]: memberList as HouseholdMember[],
        }));
      } else if (memberListError) {
        console.error('Error fetching members:', memberListError);
      }
    } catch (err) {
      console.error('Error fetching members for household:', householdId, err);
    }
  };

  const handleHouseholdPress = async (household: Household) => {
    setSelectedHousehold(household);
    setShowHouseholdModal(true);
    // Ensure members are loaded for this household
    if (!members[household.id] || members[household.id].length === 0) {
      await fetchMembersForHousehold(household.id);
    }
  };

  const handleAddMember = () => {
    setShowAddMemberModal(true);
    setSearchTerm('');
    setSearchResults([]);
  };

  const searchUsers = async () => {
    if (!searchTerm.trim() || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase.rpc('search_users', {
        p_search_term: searchTerm.trim(),
        p_limit: 10,
      });

      if (error) throw error;
      setSearchResults((data || []) as UserSearchResult[]);
    } catch (error: any) {
      console.error('Error searching users:', error);
      Alert.alert('Fout', 'Kon gebruikers niet zoeken: ' + (error.message || 'Onbekende fout'));
    } finally {
      setSearching(false);
    }
  };

  const sendInvitation = async (inviteeId: string, inviteeEmail: string) => {
    if (!selectedHousehold) return;

    setSendingInvitation(true);
    try {
      const { error } = await supabase.rpc('send_household_invitation', {
        p_household_id: selectedHousehold.id,
        p_invitee_id: inviteeId,
      });

      if (error) throw error;

      Alert.alert('Succes', `Uitnodiging verstuurd naar ${inviteeEmail}`);
      setShowAddMemberModal(false);
      setSearchTerm('');
      setSearchResults([]);
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      Alert.alert('Fout', 'Kon uitnodiging niet versturen: ' + (error.message || 'Onbekende fout'));
    } finally {
      setSendingInvitation(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        searchUsers();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

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
        <View>
          <Text style={styles.title}>Gezin Delen</Text>
          <Text style={styles.subtitle}>Deel je voorraad en boodschappenlijsten met je gezin</Text>
        </View>
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
              <TouchableOpacity
                key={household.id}
                style={styles.householdCard}
                onPress={() => handleHouseholdPress(household)}
                activeOpacity={0.7}
              >
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
                  {householdMembers.slice(0, 3).map((member) => (
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
                  {householdMembers.length > 3 && (
                    <Text style={styles.moreMembersText}>+{householdMembers.length - 3} meer</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Create Household Modal */}
      <Modal
        visible={showCreateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowCreateModal(false);
          setHouseholdName('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nieuw Gezin Aanmaken</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCreateModal(false);
                  setHouseholdName('');
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Gezin naam (bijv. 'Lattré Gezin')"
              value={householdName}
              onChangeText={setHouseholdName}
              placeholderTextColor="#94a3b8"
              autoFocus
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
      </Modal>

      {/* Household Detail Modal */}
      <Modal
        visible={showHouseholdModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowHouseholdModal(false);
          setSelectedHousehold(null);
        }}
      >
        {selectedHousehold && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedHousehold.name}</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowHouseholdModal(false);
                  setSelectedHousehold(null);
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.membersList}>
                <Text style={styles.sectionLabel}>Leden</Text>
                {(() => {
                  const householdMembers = members[selectedHousehold.id] || [];
                  const currentUserMember = householdMembers.find((m) => m.user_id === userId);
                  const isOwnerOrAdmin = currentUserMember && (currentUserMember.role === 'owner' || currentUserMember.role === 'admin');
                  
                  return (
                    <>
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

                      {isOwnerOrAdmin && (
                        <TouchableOpacity
                          style={styles.addMemberButton}
                          onPress={handleAddMember}
                        >
                          <Ionicons name="person-add" size={20} color="#047857" />
                          <Text style={styles.addMemberButtonText}>Lid Toevoegen</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  );
                })()}
              </View>

              <TouchableOpacity
                style={styles.leaveButton}
                onPress={() => leaveHousehold(selectedHousehold.id)}
              >
                <Ionicons name="exit-outline" size={16} color="#ef4444" />
                <Text style={styles.leaveButtonText}>Gezin Verlaten</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        )}
      </Modal>

      {/* Add Member Modal */}
      <Modal
        visible={showAddMemberModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowAddMemberModal(false);
          setSearchTerm('');
          setSearchResults([]);
        }}
      >
        {selectedHousehold && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lid Toevoegen</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddMemberModal(false);
                  setSearchTerm('');
                  setSearchResults([]);
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Zoek op naam of email..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoFocus
            />

            {searching && (
              <View style={styles.searchingContainer}>
                <ActivityIndicator size="small" color="#047857" />
                <Text style={styles.searchingText}>Zoeken...</Text>
              </View>
            )}

            {!searching && searchResults.length > 0 && (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.searchResultItem}
                    onPress={() => sendInvitation(item.id, item.email)}
                    disabled={sendingInvitation}
                  >
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberInitial}>
                        {(item.full_name || item.email).charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberEmail}>{item.full_name || item.email}</Text>
                      <Text style={styles.memberRole}>{item.email}</Text>
                    </View>
                    <Ionicons name="person-add" size={20} color="#047857" />
                  </TouchableOpacity>
                )}
                style={styles.searchResultsList}
              />
            )}

            {!searching && searchTerm.length >= 2 && searchResults.length === 0 && (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>Geen gebruikers gevonden</Text>
              </View>
            )}

            {searchTerm.length < 2 && (
              <View style={styles.hintContainer}>
                <Text style={styles.hintText}>Typ minimaal 2 karakters om te zoeken</Text>
              </View>
            )}
            </View>
          </View>
        )}
      </Modal>
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
    alignItems: 'flex-start',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.08)',
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScroll: {
    maxHeight: 400,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#047857',
    backgroundColor: '#ecfdf5',
    marginTop: 16,
    marginBottom: 12,
  },
  addMemberButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#047857',
  },
  moreMembersText: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 8,
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 20,
  },
  searchingText: {
    fontSize: 14,
    color: '#64748b',
  },
  searchResultsList: {
    maxHeight: 300,
    marginTop: 12,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  noResultsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: '#64748b',
  },
  hintContainer: {
    padding: 20,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
});

