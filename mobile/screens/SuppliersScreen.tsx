import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { mobileApi } from '../services/api';
import { Supplier } from '../types';

export function SuppliersScreen() {
  const { role } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Supplier Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const fetchSuppliers = useCallback(async () => {
    if (role !== 'admin') {
      setLoading(false);
      return;
    }
    try {
      const data = await mobileApi.getSuppliers(role);
      setSuppliers(data);
    } catch (err: any) {
      console.error('Error loading suppliers:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSuppliers();
  };

  const handleAddSupplier = async () => {
    if (role !== 'admin') {
      Alert.alert('Ogaysiis', 'Kaliya maamulaha ayaa qeybiye abuuri kara.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Fadlan Hubi', 'Magaca alaab-qeybiyaha waa qasab.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Fadlan Hubi', 'Telefoonka alaab-qeybiyaha waa qasab.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await mobileApi.createSupplier(
        {
          name: name.trim(),
          phone: phone.trim(),
          company: company.trim() || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        role
      );

      if (!res.success) {
        Alert.alert('Khalad', res.error || 'Lama guuleysan abuurista.');
      } else {
        Alert.alert('Guul', 'Alaab-qeybiyaha si guul leh ayaa loo diiwaangeliyay.');
        setModalVisible(false);
        setName('');
        setPhone('');
        setCompany('');
        setAddress('');
        setNotes('');
        fetchSuppliers();
      }
    } catch (err: any) {
      Alert.alert('Khalad', err?.message || 'Khalad baa dhacay.');
    } finally {
      setSubmitting(false);
    }
  };

  if (role !== 'admin') {
    return (
      <View style={styles.restrictedContainer}>
        <Text style={styles.restrictedIcon}>🔒</Text>
        <Text style={styles.restrictedTitle}>Maareynta Alaab-qeybiyeyaasha</Text>
        <Text style={styles.restrictedMessage}>
          Kaliya maamulaha dukaanka (Admin) ayaa awood u leh inuu arko ama wax ka beddelo alaab-qeybiyeyaasha.
        </Text>
      </View>
    );
  }

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.company && s.company.toLowerCase().includes(search.toLowerCase())) ||
      s.phone.includes(search)
  );

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Raadi magac, shirkad ama tel..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>+ Qeybiye Cusub</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Soo dejinaya alaab-qeybiyeyaasha...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredSuppliers}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>Alaab-qeybiye lama helin</Text>
              <Text style={styles.emptySub}>
                {search
                  ? 'Wax natiijo ah kuma habboona raadintaada.'
                  : 'Weli ma jiro wax alaab-qeybiye ah oo la diiwaangeliyay.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.supplierCard}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.headerInfo}>
                  <Text style={styles.supplierName}>{item.name}</Text>
                  {item.company ? (
                    <Text style={styles.companyName}>🏢 {item.company}</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.cardDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>📞 Telefoon:</Text>
                  <Text style={styles.detailValue}>{item.phone}</Text>
                </View>
                {item.address ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>📍 Goobta:</Text>
                    <Text style={styles.detailValue}>{item.address}</Text>
                  </View>
                ) : null}
                {item.notes ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>📝 Faahfaahin:</Text>
                    <Text style={styles.detailValue}>{item.notes}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          )}
        />
      )}

      {/* Add Supplier Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ku Dar Alaab-qeybiye Cusub</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Magaca Qeybiyaha *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="tusaale: Maxamed Xasan"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Telefoonka *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="tusaale: +252 61 5000000"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Magaca Shirkadda / Shirkad</Text>
                <TextInput
                  style={styles.input}
                  placeholder="tusaale: Barakaat Trading Co."
                  value={company}
                  onChangeText={setCompany}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Cinwaanka / Goobta</Text>
                <TextInput
                  style={styles.input}
                  placeholder="tusaale: Suuqa Bakaaraha, Muqdisho"
                  value={address}
                  onChangeText={setAddress}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Xusuusin / Faahfaahin</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Qoraal kooban..."
                  multiline
                  numberOfLines={3}
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Ka Noqo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, submitting && styles.btnDisabled]}
                  onPress={handleAddSupplier}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Keydi Qeybiyaha</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 42,
  },
  searchIcon: {
    marginRight: 6,
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  clearBtn: {
    fontSize: 14,
    color: '#94a3b8',
    paddingHorizontal: 6,
  },
  addBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748b',
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
  supplierCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0284c7',
  },
  headerInfo: {
    flex: 1,
  },
  supplierName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  companyName: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  cardDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  restrictedIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  restrictedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  restrictedMessage: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeBtn: {
    fontSize: 20,
    color: '#64748b',
    padding: 4,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  textArea: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
