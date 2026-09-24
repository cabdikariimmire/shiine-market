import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { mobileApi, DashboardData } from '../services/api';

interface DashboardScreenProps {
  onNavigateToPos: () => void;
  onNavigateToProducts: (filterStock?: string) => void;
  onNavigateToDebts: () => void;
}

export function DashboardScreen({
  onNavigateToPos,
  onNavigateToProducts,
  onNavigateToDebts,
}: DashboardScreenProps) {
  const { user, role, shop } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setErrorMsg(null);
      const res = await mobileApi.getDashboardData();
      setData(res);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Khalad baa dhacay intii xogta la soo qaadayay.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0284c7" />
        <Text style={styles.loadingText}>Soo dejinaya xogta tooska ah...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Quick POS Call to Action for Seller and Admin */}
      {(role === 'seller' || role === 'admin') && (
        <TouchableOpacity
          style={styles.heroButton}
          onPress={onNavigateToPos}
          activeOpacity={0.85}
        >
          <View>
            <Text style={styles.heroButtonTitle}>+ Iib Cusub (POS)</Text>
            <Text style={styles.heroButtonSub}>Furo miiska iibka si degdeg ah</Text>
          </View>
          <View style={styles.heroArrow}>
            <Text style={styles.heroArrowText}>➔</Text>
          </View>
        </TouchableOpacity>
      )}

      {errorMsg ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
            <Text style={styles.retryText}>Dib u tijaabi</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Main Metrics Grid */}
      <Text style={styles.sectionHeader}>Xisaabta Maanta (Today's Summary)</Text>
      <View style={styles.grid}>
        {/* Today's Revenue */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Dakhliga Iibka Maanta</Text>
          <Text style={styles.cardValue}>${(data?.todayRevenue || 0).toFixed(2)}</Text>
          <Text style={styles.cardSub}>
            {data?.todaySalesCount || 0} xawaaladood oo iib ah
          </Text>
        </View>

        {/* Outstanding Debts */}
        <TouchableOpacity
          style={styles.card}
          onPress={onNavigateToDebts}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardLabel}>Deymaha Furan</Text>
            <Text style={styles.cardLink}>Fiiri ➔</Text>
          </View>
          <Text style={[styles.cardValue, { color: (data?.openDebtsTotal || 0) > 0 ? '#b91c1c' : '#0f172a' }]}>
            ${(data?.openDebtsTotal || 0).toFixed(2)}
          </Text>
          <Text style={styles.cardSub}>
            {data?.openDebtsCount || 0} macaamiil oo deyn lagu leeyahay
          </Text>
        </TouchableOpacity>

        {/* Stock Alerts */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => onNavigateToProducts('low_stock')}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardLabel}>Digniinta Stock-ga</Text>
            <Text style={styles.cardLink}>Fiiri ➔</Text>
          </View>
          <View style={styles.stockAlertRow}>
            <View style={styles.badgeAlertOrange}>
              <Text style={styles.badgeAlertOrangeText}>
                {data?.lowStockCount || 0} Waa Yaraysaa
              </Text>
            </View>
            <View style={styles.badgeAlertRed}>
              <Text style={styles.badgeAlertRedText}>
                {data?.outOfStockCount || 0} Dhamaatay
              </Text>
            </View>
          </View>
          <Text style={styles.cardSub}>
            Isku darka: {data?.activeProductsCount || 0} nooc oo firfircoon
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recent Sales List */}
      <View style={styles.recentSection}>
        <View style={styles.recentHeaderRow}>
          <Text style={styles.sectionHeader}>Iibkii Ugu Dambeeyay</Text>
          <TouchableOpacity onPress={onNavigateToPos}>
            <Text style={styles.viewAllText}>Gali Iib ➔</Text>
          </TouchableOpacity>
        </View>

        {(!data?.recentSales || data.recentSales.length === 0) ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>Weli wax iib ah ma dhicin maanta</Text>
            <Text style={styles.emptySub}>
              Iibka aad sameyso wuxuu si toos ah uga muuqan doonaa halkan iyo web-ka.
            </Text>
          </View>
        ) : (
          <View style={styles.salesList}>
            {data.recentSales.map((sale) => {
              const dateObj = new Date(sale.created_at);
              const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });

              return (
                <View key={sale.id} style={styles.saleItemRow}>
                  <View style={styles.saleInfoCol}>
                    <Text style={styles.saleCustomer}>{sale.customer_name}</Text>
                    <Text style={styles.saleMeta}>
                      {dateStr} saacadda {timeStr} • Habka: {sale.payment_method.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.saleAmountCol}>
                    <Text style={styles.salePrice}>${sale.total_amount.toFixed(2)}</Text>
                    <Text style={styles.saleItemsCount}>{sale.items_count || 1} shay</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  heroButton: {
    backgroundColor: '#0284c7',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  heroButtonTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  heroButtonSub: {
    color: '#e0f2fe',
    fontSize: 13,
    marginTop: 2,
  },
  heroArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroArrowText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
  },
  retryBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  retryText: {
    color: '#0284c7',
    fontWeight: '600',
    fontSize: 13,
  },
  sectionHeader: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  grid: {
    gap: 12,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  cardLink: {
    fontSize: 12,
    color: '#0284c7',
    fontWeight: '600',
  },
  cardValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  cardSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  stockAlertRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  badgeAlertOrange: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeAlertOrangeText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeAlertRed: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeAlertRedText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '700',
  },
  recentSection: {
    marginTop: 8,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 13,
    color: '#0284c7',
    fontWeight: '600',
  },
  salesList: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  saleItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  saleInfoCol: {
    flex: 1,
  },
  saleCustomer: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  saleMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  saleAmountCol: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  salePrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16a34a',
  },
  saleItemsCount: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
});
