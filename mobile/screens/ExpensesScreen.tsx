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
import { Expense } from '../types';

const EXPENSE_CATEGORIES = [
  { id: 'koronto', label: '⚡ Koronto (Electricity)' },
  { id: 'biyo', label: '💧 Biyo (Water)' },
  { id: 'kiro', label: '🏢 Kiro (Rent)' },
  { id: 'mushahar', label: '👥 Mushahar (Salaries)' },
  { id: 'gaadiid', label: '🚚 Gaadiid (Transport)' },
  { id: 'dayactir', label: '🔧 Dayactir (Maintenance)' },
  { id: 'dheeraad', label: '📦 Dheeraad (Other)' },
];

export function ExpensesScreen() {
  const { role } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Add Expense Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(EXPENSE_CATEGORIES[0].id);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  const fetchExpenses = useCallback(async () => {
    if (role !== 'admin') {
      setLoading(false);
      return;
    }
    try {
      const data = await mobileApi.getExpenses(role);
      setExpenses(data);
    } catch (err: any) {
      console.error('Error fetching expenses:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchExpenses();
  };

  const handleAddExpense = async () => {
    if (role !== 'admin') {
      Alert.alert('Ogaysiis', 'Kaliya maamulaha ayaa kharash diiwaangelin kara.');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Fadlan Hubi', 'Geli lacag sax ah oo ka weyn $0.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Fadlan Hubi', 'Sharaxaadda kharashka waa qasab.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await mobileApi.createExpense(
        {
          category: selectedCategory,
          amount: numAmount,
          description: description.trim(),
          notes: notes.trim() || undefined,
        },
        role
      );

      if (!res.success) {
        Alert.alert('Khalad', res.error || 'Kharashka lama diiwaangelin.');
      } else {
        Alert.alert('Guul', 'Kharashka si sax ah ayaa loo diiwaangeliyay.');
        setModalVisible(false);
        setAmount('');
        setDescription('');
        setNotes('');
        setSelectedCategory(EXPENSE_CATEGORIES[0].id);
        fetchExpenses();
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
        <Text style={styles.restrictedTitle}>Maareynta Kharashaadka</Text>
        <Text style={styles.restrictedMessage}>
          Kaliya maamulaha dukaanka (Admin) ayaa awood u leh inuu arko ama diiwaangeliyo kharashaadka.
        </Text>
      </View>
    );
  }

  const filteredExpenses = categoryFilter === 'all'
    ? expenses
    : expenses.filter((e) => e.category?.toLowerCase() === categoryFilter.toLowerCase());

  const totalExpenseAmount = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Wadarta Kharashaadka</Text>
          <Text style={styles.summaryValue}>${totalExpenseAmount.toFixed(2)}</Text>
          <Text style={styles.summaryCount}>{filteredExpenses.length} jeer la bixiyay</Text>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>+ Ku Dar Kharash</Text>
        </TouchableOpacity>
      </View>

      {/* Category filter pills */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterPill, categoryFilter === 'all' && styles.filterPillActive]}
            onPress={() => setCategoryFilter('all')}
          >
            <Text style={[styles.filterPillText, categoryFilter === 'all' && styles.filterPillTextActive]}>
              Dhammaan
            </Text>
          </TouchableOpacity>
          {EXPENSE_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.filterPill, categoryFilter === cat.id && styles.filterPillActive]}
              onPress={() => setCategoryFilter(cat.id)}
            >
              <Text style={[styles.filterPillText, categoryFilter === cat.id && styles.filterPillTextActive]}>
                {cat.label.split(' ')[0]} {cat.id}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Soo dejinaya kharashaadka...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredExpenses}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💸</Text>
              <Text style={styles.emptyTitle}>Kharash lama diiwaangelin</Text>
              <Text style={styles.emptySub}>
                Weli wax kharash ah laguma darin qaybtan.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.expenseCard}>
              <View style={styles.cardTop}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{item.category?.toUpperCase() || 'KHARASH'}</Text>
                </View>
                <Text style={styles.cardAmount}>-${Number(item.amount).toFixed(2)}</Text>
              </View>

              <Text style={styles.cardDesc}>{item.description}</Text>

              <View style={styles.cardBottom}>
                <Text style={styles.cardDate}>
                  📅 {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {item.notes ? <Text style={styles.cardNotes}>📝 {item.notes}</Text> : null}
              </View>
            </View>
          )}
        />
      )}

      {/* Add Expense Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Diiwaangeli Kharash Cusub</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Qaybta Kharashka (Category) *</Text>
                <View style={styles.categoryPicker}>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.catOption,
                        selectedCategory === cat.id && styles.catOptionActive,
                      ]}
                      onPress={() => setSelectedCategory(cat.id)}
                    >
                      <Text
                        style={[
                          styles.catOptionText,
                          selectedCategory === cat.id && styles.catOptionTextActive,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Lacagta ($ USD) *</Text>
                <TextInput
                  style={[styles.input, styles.amountInput]}
                  placeholder="0.00"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Sharaxaadda / Ujeeddada *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="tusaale: Biilka korontada bisha Maarso"
                  value={description}
                  onChangeText={setDescription}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Xusuusin Dheeraad ah</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Faahfaahin dheeraad ah..."
                  multiline
                  numberOfLines={2}
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
                  onPress={handleAddExpense}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Diiwaangeli Kharashka</Text>
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
    padding: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryCard: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#dc2626',
    marginVertical: 2,
  },
  summaryCount: {
    fontSize: 12,
    color: '#94a3b8',
  },
  addBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  filterBar: {
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  filterScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterPillActive: {
    backgroundColor: '#fee2e2',
  },
  filterPillText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#dc2626',
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
  expenseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },
  cardAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#dc2626',
  },
  cardDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  cardBottom: {
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardDate: {
    fontSize: 11,
    color: '#94a3b8',
  },
  cardNotes: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
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
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  categoryPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  catOptionActive: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  catOptionText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  catOptionTextActive: {
    color: '#dc2626',
    fontWeight: '700',
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
  amountInput: {
    fontSize: 18,
    fontWeight: '700',
    color: '#dc2626',
  },
  textArea: {
    minHeight: 56,
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
    backgroundColor: '#dc2626',
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
