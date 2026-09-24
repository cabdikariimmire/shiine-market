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
import { Debt } from '../types';

export function DebtsScreen() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Payment Modal
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNotes, setPayNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchDebts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await mobileApi.getDebts(statusFilter);
      setDebts(res);
    } catch (err) {
      console.warn('Debts load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDebts();
  };

  const openPaymentModal = (debt: Debt) => {
    setSelectedDebt(debt);
    setPayAmount(debt.remaining_balance.toString());
    setPayMethod('cash');
    setPayNotes('');
    setPaymentModalVisible(true);
  };

  const handleRecordPayment = async () => {
    if (!selectedDebt) return;
    const amount = parseFloat(payAmount);

    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Tiro Khaldan', 'Fadlan geli lacag sax ah oo ka weyn $0.');
      return;
    }

    if (amount > selectedDebt.remaining_balance + 0.01) {
      Alert.alert(
        'Lacagtu Way Ka Badan Tahay',
        `Lacagta aad gelinayso ($${amount.toFixed(2)}) kama badnaan karto deynta haray ($${selectedDebt.remaining_balance.toFixed(2)}).`
      );
      return;
    }

    setSubmittingPayment(true);
    const res = await mobileApi.recordDebtPayment({
      customerId: selectedDebt.customer_id,
      debtId: selectedDebt.id,
      amount,
      paymentMethod: payMethod,
      notes: payNotes,
    });
    setSubmittingPayment(false);

    if (!res.success) {
      Alert.alert('Khalad', res.error || 'Diiwaangelinta lacag-bixinta way fashilantay.');
    } else {
      Alert.alert(
        'Lacagta Waa La Diiwaangeliyay',
        `Waxaa la bixiyay $${amount.toFixed(2)}. Deynta hadda haray waa $${res.remainingBalance?.toFixed(2)}.`
      );
      setPaymentModalVisible(false);
      setSelectedDebt(null);
      setPayAmount('');
      fetchDebts();
    }
  };

  const filteredDebts = debts.filter((d) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const custName = (d.customer?.name || '').toLowerCase();
    const custPhone = (d.customer?.phone || '').toLowerCase();
    const items = (d.items_summary || '').toLowerCase();
    return custName.includes(term) || custPhone.includes(term) || items.includes(term);
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'unpaid':
        return { label: 'Aan La Bixin', bg: '#fee2e2', text: '#b91c1c' };
      case 'partial':
        return { label: 'Qeyb La Bixiyay', bg: '#fef3c7', text: '#b45309' };
      case 'paid':
        return { label: 'Waa La Bixiyay', bg: '#dcfce7', text: '#15803d' };
      case 'overdue':
        return { label: 'Waa Dhacday', bg: '#fee2e2', text: '#dc2626' };
      default:
        return { label: status, bg: '#f1f5f9', text: '#64748b' };
    }
  };

  const previewNewRemaining = () => {
    if (!selectedDebt) return 0;
    const amount = parseFloat(payAmount) || 0;
    return Math.max(0, Number((selectedDebt.remaining_balance - amount).toFixed(2)));
  };

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Raadi magaca macmiilka ama taleefanka..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {[
          { id: 'all', label: 'Dhammaan' },
          { id: 'unpaid', label: 'Aan La Bixin' },
          { id: 'partial', label: 'Qeyb' },
          { id: 'paid', label: 'La Bixiyay' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.filterTab, statusFilter === tab.id && styles.filterTabActive]}
            onPress={() => setStatusFilter(tab.id)}
          >
            <Text style={[styles.filterTabText, statusFilter === tab.id && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Debt List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Soo dejinaya demaha...</Text>
        </View>
      ) : filteredDebts.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyIcon}>📝</Text>
          <Text style={styles.emptyTitle}>Ma jiraan deymo furan</Text>
          <Text style={styles.emptySub}>
            {statusFilter === 'all'
              ? 'Weli wax deyn ah looma diiwaangelin macaamiisha.'
              : 'Qeybtaan wax deyn ah kuma jiraan.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredDebts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onRefresh={onRefresh}
          refreshing={refreshing}
          renderItem={({ item }) => {
            const badge = getStatusBadge(item.status);
            const dateStr = new Date(item.created_at).toLocaleDateString();

            return (
              <View style={styles.debtCard}>
                <View style={styles.debtHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customerName}>{item.customer?.name || 'Macmiil'}</Text>
                    <Text style={styles.customerPhone}>{item.customer?.phone || 'Telefoon la\'aan'}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                  </View>
                </View>

                {item.items_summary ? (
                  <Text style={styles.itemsSummary}>Alaabta: {item.items_summary}</Text>
                ) : null}

                <View style={styles.amountGrid}>
                  <View style={styles.amountCol}>
                    <Text style={styles.amountLabel}>Wadarta:</Text>
                    <Text style={styles.amountVal}>${item.original_amount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.amountCol}>
                    <Text style={styles.amountLabel}>La Bixiyay:</Text>
                    <Text style={[styles.amountVal, { color: '#16a34a' }]}>${item.amount_paid.toFixed(2)}</Text>
                  </View>
                  <View style={styles.amountCol}>
                    <Text style={styles.amountLabel}>Deynta Haray:</Text>
                    <Text style={[styles.amountVal, { color: '#b91c1c' }]}>
                      ${item.remaining_balance.toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardBottomRow}>
                  <Text style={styles.dateText}>Taariikhda: {dateStr}</Text>
                  {item.remaining_balance > 0 && (
                    <TouchableOpacity
                      style={styles.payBtn}
                      onPress={() => openPaymentModal(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.payBtnText}>+ Bixi Deyn</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Payment Modal */}
      <Modal visible={paymentModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Diiwaangelinta Lacag-Bixinta Deynta</Text>
            <Text style={styles.modalSub}>
              Macmiilka: {selectedDebt?.customer?.name} ({selectedDebt?.customer?.phone})
            </Text>

            <View style={styles.balancePreviewCard}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Deynta Hadda Haray:</Text>
                <Text style={[styles.previewVal, { color: '#b91c1c' }]}>
                  ${selectedDebt?.remaining_balance.toFixed(2)}
                </Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Deynta Hari Doonta:</Text>
                <Text style={[styles.previewVal, { color: '#0f172a' }]}>
                  ${previewNewRemaining().toFixed(2)}
                </Text>
              </View>
            </View>

            <Text style={styles.inputLabel}>Lacagta Hadda La Bixinayo ($):</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={payAmount}
              onChangeText={setPayAmount}
              placeholder="0.00"
            />

            <Text style={styles.inputLabel}>Habka Lacag-bixinta:</Text>
            <View style={styles.methodRow}>
              {['cash', 'evc', 'zaad', 'sahal'].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.methodBtn, payMethod === m && styles.methodBtnActive]}
                  onPress={() => setPayMethod(m)}
                >
                  <Text style={[styles.methodText, payMethod === m && styles.methodTextActive]}>
                    {m.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Faahfaahin / Xusuusin (Ikhtiyaar):</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Tusaale: Lacag caddaan ah lagu dhiibay"
              value={payNotes}
              onChangeText={setPayNotes}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setPaymentModalVisible(false)}
                disabled={submittingPayment}
              >
                <Text style={styles.cancelBtnText}>Ka Noqo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, submittingPayment && { backgroundColor: '#94a3b8' }]}
                onPress={handleRecordPayment}
                disabled={submittingPayment}
              >
                {submittingPayment ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Xaqiiji Lacagta</Text>
                )}
              </TouchableOpacity>
            </View>
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
  searchBox: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchInput: {
    height: 46,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#0f172a',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 10,
  },
  filterTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterTabActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterTabTextActive: {
    color: '#ffffff',
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
    gap: 12,
  },
  debtCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  debtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  customerPhone: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemsSummary: {
    fontSize: 13,
    color: '#475569',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  amountGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 10,
  },
  amountCol: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 2,
  },
  amountVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  payBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  payBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  modalSub: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 14,
  },
  balancePreviewCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  previewVal: {
    fontSize: 14,
    fontWeight: '700',
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
  methodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  methodBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  methodBtnActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  methodText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  methodTextActive: {
    color: '#ffffff',
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
    backgroundColor: '#16a34a',
  },
  confirmBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
