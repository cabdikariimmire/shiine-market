import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { mobileApi } from '../services/api';
import { SystemUser, UserRole } from '../types';

export function SettingsScreen() {
  const { user, role, shop, logout } = useAuth();
  const [usersList, setUsersList] = useState<SystemUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Change Role Modal
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [updatingRole, setUpdatingRole] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (role !== 'admin') return;
    setLoadingUsers(true);
    try {
      const data = await mobileApi.getProfiles(role);
      setUsersList(data);
    } catch (err: any) {
      console.error('Error fetching users:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, [role]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleUpdateRole = async (newRole: UserRole) => {
    if (!selectedUser || role !== 'admin') return;
    setUpdatingRole(true);
    try {
      const res = await mobileApi.updateProfileRole(selectedUser.id, newRole, role);
      if (!res.success) {
        Alert.alert('Khalad', res.error || 'Lama beddeli karin doorka.');
      } else {
        Alert.alert('Guul', `Doorka ${selectedUser.name} waxaa loo beddelay ${newRole}.`);
        setRoleModalVisible(false);
        setSelectedUser(null);
        fetchUsers();
      }
    } catch (err: any) {
      Alert.alert('Khalad', err?.message || 'Khalad baa dhacay.');
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Ka Bax Nidaamka',
      'Ma hubtaa inaad rabto inaad ka baxdo akoonkaaga?',
      [
        { text: 'Maya', style: 'cancel' },
        { text: 'Haa, Ka Bax', style: 'destructive', onPress: logout },
      ]
    );
  };

  const getRoleBadge = (r: string) => {
    switch (r) {
      case 'admin':
        return { label: 'Maamule (Admin)', bg: '#e0f2fe', color: '#0284c7' };
      case 'seller':
        return { label: 'Iibiye (Seller)', bg: '#dcfce7', color: '#16a34a' };
      case 'reporter':
        return { label: 'Warbixiye (Reporter)', bg: '#fef3c7', color: '#d97706' };
      default:
        return { label: r || 'Isticmaale', bg: '#f1f5f9', color: '#64748b' };
    }
  };

  const currentUserBadge = getRoleBadge(role || '');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. User Profile Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>👤 Xogta Isticmaalaha</Text>
        <View style={styles.userProfileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{user?.name || 'Isticmaale'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <View style={[styles.badge, { backgroundColor: currentUserBadge.bg }]}>
              <Text style={[styles.badgeText, { color: currentUserBadge.color }]}>
                {currentUserBadge.label}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 2. Shop Information Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🏪 Xogta Dukaanka</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Magaca Dukaanka:</Text>
          <Text style={styles.infoValue}>{shop?.name || 'Shiine Supermarket'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Lacagta Dukaanka:</Text>
          <Text style={styles.infoValue}>{shop?.currency || 'USD ($) / SOS'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Telefoonka:</Text>
          <Text style={styles.infoValue}>{shop?.phone || '+252 61 5000000'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Cinwaanka:</Text>
          <Text style={styles.infoValue}>{shop?.address || 'Muqdisho, Soomaaliya'}</Text>
        </View>
      </View>

      {/* 3. System Users Management (Admin Only) */}
      {role === 'admin' && (
        <View style={styles.card}>
          <View style={styles.cardHeaderWithAction}>
            <Text style={styles.cardTitle}>👥 Maareynta Shaqaalaha (Users)</Text>
            <TouchableOpacity onPress={fetchUsers}>
              <Text style={styles.refreshText}>Dib u cusbooneysii</Text>
            </TouchableOpacity>
          </View>

          {loadingUsers ? (
            <ActivityIndicator size="small" color="#0284c7" style={{ marginVertical: 12 }} />
          ) : usersList.length === 0 ? (
            <Text style={styles.emptyText}>Ma jiraan shaqaale kale oo la helay.</Text>
          ) : (
            <View style={styles.usersList}>
              {usersList.map((u) => {
                const b = getRoleBadge(u.role);
                return (
                  <View key={u.id} style={styles.userItem}>
                    <View style={styles.userItemInfo}>
                      <Text style={styles.userItemName}>{u.name}</Text>
                      <Text style={styles.userItemEmail}>{u.email}</Text>
                      <View style={[styles.badgeSmall, { backgroundColor: b.bg }]}>
                        <Text style={[styles.badgeTextSmall, { color: b.color }]}>
                          {b.label}
                        </Text>
                      </View>
                    </View>

                    {u.id !== user?.id && (
                      <TouchableOpacity
                        style={styles.changeRoleBtn}
                        onPress={() => {
                          setSelectedUser(u);
                          setRoleModalVisible(true);
                        }}
                      >
                        <Text style={styles.changeRoleText}>Beddel Doorka</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* 4. Language & System Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚙️ Dookhyada Nidaamka</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Luuqadda:</Text>
          <Text style={styles.infoValue}>🇸🇴 Soomaali (Somali-first)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Qaabka Iibka (Offline):</Text>
          <Text style={styles.infoValue}>Online-only (Amni & Toos ah)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Platform:</Text>
          <Text style={styles.infoValue}>React Native / Expo 57</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Nooca (Version):</Text>
          <Text style={styles.infoValue}>v2.0.0 (Production)</Text>
        </View>
      </View>

      {/* 5. Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutButtonText}>🚪 Ka Bax Nidaamka (Logout)</Text>
      </TouchableOpacity>

      {/* Change Role Modal */}
      <Modal visible={roleModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Beddel Doorka Isticmaalaha</Text>
            <Text style={styles.modalSub}>
              Dooro doorka cusub ee {selectedUser?.name}:
            </Text>

            <TouchableOpacity
              style={[styles.roleOption, selectedUser?.role === 'admin' && styles.roleOptionActive]}
              onPress={() => handleUpdateRole('admin')}
              disabled={updatingRole}
            >
              <Text style={styles.roleOptionTitle}>Maamule (Admin)</Text>
              <Text style={styles.roleOptionDesc}>Awood buuxda u leh alaabta, kharashaadka, qiimaha, iyo warbixinnada.</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleOption, selectedUser?.role === 'seller' && styles.roleOptionActive]}
              onPress={() => handleUpdateRole('seller')}
              disabled={updatingRole}
            >
              <Text style={styles.roleOptionTitle}>Iibiye (Seller)</Text>
              <Text style={styles.roleOptionDesc}>Awood u leh POS, alaabta daawasho, iyo diiwaanka macaamiisha.</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleOption, selectedUser?.role === 'reporter' && styles.roleOptionActive]}
              onPress={() => handleUpdateRole('reporter')}
              disabled={updatingRole}
            >
              <Text style={styles.roleOptionTitle}>Warbixiye (Reporter)</Text>
              <Text style={styles.roleOptionDesc}>Awood akhris oo kaliya (Read-only) ee warbixinnada iyo iibka.</Text>
            </TouchableOpacity>

            {updatingRole && (
              <ActivityIndicator color="#0284c7" style={{ marginVertical: 8 }} />
            )}

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => {
                setRoleModalVisible(false);
                setSelectedUser(null);
              }}
            >
              <Text style={styles.modalCloseText}>Ka Noqo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeaderWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  refreshText: {
    fontSize: 12,
    color: '#0284c7',
    fontWeight: '600',
  },
  userProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  userEmail: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    paddingVertical: 8,
  },
  usersList: {
    gap: 10,
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  userItemInfo: {
    flex: 1,
  },
  userItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  userItemEmail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  badgeSmall: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  badgeTextSmall: {
    fontSize: 10,
    fontWeight: '700',
  },
  changeRoleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  changeRoleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  logoutButton: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#dc2626',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
  },
  roleOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    marginBottom: 10,
  },
  roleOptionActive: {
    borderColor: '#0284c7',
    backgroundColor: '#e0f2fe',
  },
  roleOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  roleOptionDesc: {
    fontSize: 12,
    color: '#64748b',
  },
  modalCloseBtn: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
});
