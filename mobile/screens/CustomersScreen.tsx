import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { mobileApi } from '../services/api';
import { Customer } from '../types';

export function CustomersScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Create Customer Modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Customer Detail Modal
  const [selectedCustDetails, setSelectedCustDetails] = useState<any | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await mobileApi.getCustomers(search);
      setCustomers(res);
    } catch (err) {
      console.warn('Customers fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCustomers();
  };

  const handleCreateCustomer = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Khalad', 'Magaca iyo taleefanka waa qasab.');
      return;
    }

    setSubmitting(true);
    try {
      await mobileApi.createCustomer({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim() || undefined,
      });
      setCreateModalVisible(false);
      setName('');
      setPhone('');
      setAddress('');
      Alert.alert('Guul', 'Macmiilka waa la diiwaangeliyay.');
      fetchCustomers();
    } catch (err: any) {
      Alert.alert('Khalad', err?.message || 'Macmiilka lama diiwaangelin karin.');
    } finally {
      setSubmitting(false);
    }
  };

  const openCustomerDetails = async (customer: Customer) => {
    setLoadingDetails(true);
    setDetailModalVisible(true);
    try {
      const details = await mobileApi.getCustomerDetails(customer.id);
      setSelectedCustDetails(details);
    } catch (err) {
      console.warn('Customer detail error:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Search and Add Header */}
      <View style={styles.headerBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Raadi magaca ama taleefanka..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setCreateModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.addBtnText}>+ Macmiil</Text>
        </TouchableOpacity>
      </View>

      {/* Customer List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Soo dejinaya macaamiisha...</Text>
        </View>
      ) : customers.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>Lama helin wax macaamiil ah</Text>
          <Text style={styles.emptySub}>Guji badhanka kore si aad macmiil cusub ugu darto.</Text>
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onRefresh={onRefresh}
          refreshing={refreshing}
          renderItem={({ item }) => {
            const hasDebt = (item.remaining_debt || 0) > 0;

            return (
              <TouchableOpacity
                style={styles.customerCard}
                onPress={() => openCustomerDetails(item)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nameText}>{item.name}</Text>
                    <Text style={styles.phoneText}>📞 {item.phone}</Text>
                    {item.address ? <Text style={styles.addressText}>📍 {item.address}</Text> : null}
                  </View>

                  <View style={[styles.debtBadge, { backgroundColor: hasDebt ? '#fee2e2' : '#dcfce7' }]}>
                    <Text style={[styles.debtBadgeText, { color: hasDebt ? '#b91c1c' : '#15803d' }]}>
                      {hasDebt ? `$${(item.remaining_debt || 0).toFixed(2)} Deyn` : 'Deyn Ma Leh'}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.footerText}>
                    Isku darka Deynta: ${(item.total_debt || 0).toFixed(2)} • Bixiyay: ${(item.paid_debt || 0).toFixed(2)}
                  </Text>
                  <Text style={styles.detailLink}>Taariikhda ➔</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Modal: Create Customer */}
      <Modal visible={createModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ku Dar Macmiil Cusub</Text>
            <Text style={styles.modalSub}>Diiwaangeli macmiil cusub oo tukaanka ah</Text>

            <Text style={styles.inputLabel}>Magaca Buuxa (Qasab):</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Tusaale: Maxamed Xasan"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.inputLabel}>Telefoonka (Qasab):</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Tusaale: +252 61 5000000"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <Text style={styles.inputLabel}>Cinwaanka / Xaafadda (Ikhtiyaar):</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Tusaale: Bakaaraha, Muqdisho"
              value={address}
              onChangeText={setAddress}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setCreateModalVisible(false)}
                disabled={submitting}
              >
                <Text style={styles.cancelBtnText}>Ka Noqo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, submitting && { backgroundColor: '#94a3b8' }]}
                onPress={handleCreateCustomer}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Kaydi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Customer Details History */}
      <Modal visible={detailModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>{selectedCustDetails?.customer?.name}</Text>
            <Text style={styles.modalSub}>
              📞 {selectedCustDetails?.customer?.phone} • Deynta: ${(selectedCustDetails?.customer?.remaining_debt || 0).toFixed(2)}
            </Text>

            {loadingDetails ? (
              <ActivityIndicator size="large" color="#0284c7" style={{ marginVertical: 20 }} />
            ) : (
              <ScrollView style={{ marginTop: 8 }}>
                <Text style={styles.subSectionTitle}>Deymaha Ugu Dambeeyay:</Text>
                {(selectedCustDetails?.debts || []).length === 0 ? (
                  <Text style={styles.emptyNotice}>Ma jiraan deymo diiwaangashan.</Text>
                ) : (
                  (selectedCustDetails?.debts || []).map((d: any) => (
                    <View key={d.id} style={styles.historyRow}>
                      <Text style={{ fontWeight: '600', color: '#0f172a' }}>{d.items_summary || 'Deyn'}</Text>
                      <Text style={{ fontSize: 13, color: '#b91c1c', fontWeight: '700' }}>
                        ${d.remaining_balance.toFixed(2)} haray
                      </Text>
                    </View>
                  ))
                )}

                <Text style={[styles.subSectionTitle, { marginTop: 14 }]}>Lacag-Bixinnadii Ugu Dambeeyay:</Text>
                {(selectedCustDetails?.payments || []).length === 0 ? (
                  <Text style={styles.emptyNotice}>Weli wax lacag ah ma bixin.</Text>
                ) : (
                  (selectedCustDetails?.payments || []).map((p: any) => (
                    <View key={p.id} style={styles.historyRow}>
                      <Text style={{ color: '#475569' }}>
                        {new Date(p.created_at).toLocaleDateString()} ({p.payment_method?.toUpperCase()})
                      </Text>
                      <Text style={{ fontSize: 13, color: '#16a34a', fontWeight: '700' }}>
                        +${p.amount.toFixed(2)}
                      </Text>
                    </View>
                  ))
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.cancelBtn, { alignSelf: 'flex-end', marginTop: 14 }]}
              onPress={() => setDetailModalVisible(false)}
            >
              <Text style={styles.cancelBtnText}>Xir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 46,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  addBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748b',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 10,
  },
  customerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  phoneText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  addressText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  debtBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  debtBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  footerText: {
    fontSize: 11,
    color: '#64748b',
  },
  detailLink: {
    fontSize: 12,
    color: '#0284c7',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  modalSub: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  modalInput: {
    height: 46,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    marginBottom: 12,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 14,
  },
  confirmBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0284c7',
  },
  confirmBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  emptyNotice: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    paddingVertical: 4,
  },
});
