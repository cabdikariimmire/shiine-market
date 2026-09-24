import React, { useState, useEffect, useCallback } from 'react';
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
import { mobileApi } from '../services/api';

type PeriodType = 'today' | 'week' | 'month';

export function ReportsScreen() {
  const { role } = useAuth();
  const [period, setPeriod] = useState<PeriodType>('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<{
    salesCount: number;
    revenue: number;
    grossProfit: number;
    costAmount: number;
    expensesTotal: number;
    netProfit: number;
    debtsOutstanding: number;
    stockCostValuation: number;
    stockRetailValuation: number;
  } | null>(null);

  const fetchReport = useCallback(async (p: PeriodType) => {
    try {
      const data = await mobileApi.getReportsSummary(p);
      setSummary(data);
    } catch (err: any) {
      console.error('Error fetching reports summary:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchReport(period);
  }, [period, fetchReport]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReport(period);
  };

  if (role === 'seller') {
    return (
      <View style={styles.restrictedContainer}>
        <Text style={styles.restrictedIcon}>📊</Text>
        <Text style={styles.restrictedTitle}>Warbixinnada Maaliyadda</Text>
        <Text style={styles.restrictedMessage}>
          Warbixinnada guud ee dakhliga iyo faa'iidada waxay u furan yihiin maamulaha (Admin) iyo warbixiyaha (Reporter).
        </Text>
      </View>
    );
  }

  const getPeriodLabel = () => {
    switch (period) {
      case 'today':
        return 'Maanta';
      case 'week':
        return '7-dii Maalmood ee u Dambeeyay';
      case 'month':
        return 'Bishan (Bilow illaa Maanta)';
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0284c7']} />
      }
    >
      {/* Period Selection Bar */}
      <View style={styles.periodBar}>
        <TouchableOpacity
          style={[styles.periodBtn, period === 'today' && styles.periodBtnActive]}
          onPress={() => setPeriod('today')}
        >
          <Text style={[styles.periodText, period === 'today' && styles.periodTextActive]}>
            Maanta
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.periodBtn, period === 'week' && styles.periodBtnActive]}
          onPress={() => setPeriod('week')}
        >
          <Text style={[styles.periodText, period === 'week' && styles.periodTextActive]}>
            Toddobaadkan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.periodBtn, period === 'month' && styles.periodBtnActive]}
          onPress={() => setPeriod('month')}
        >
          <Text style={[styles.periodText, period === 'month' && styles.periodTextActive]}>
            Bishan
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.periodIndicator}>
        <Text style={styles.periodIndicatorText}>📅 Muddada: {getPeriodLabel()}</Text>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Xisaabinaya warbixinta...</Text>
        </View>
      ) : summary ? (
        <View style={styles.content}>
          {/* Section 1: Sales & Revenue */}
          <Text style={styles.sectionTitle}>💰 Dakhliga & Iibka</Text>
          <View style={styles.cardRow}>
            <View style={[styles.metricCard, { borderLeftColor: '#0284c7' }]}>
              <Text style={styles.cardLabel}>Wadarta Dakhliga</Text>
              <Text style={[styles.cardValue, { color: '#0284c7' }]}>
                ${summary.revenue.toFixed(2)}
              </Text>
              <Text style={styles.cardSub}>{summary.salesCount} heshiis iib</Text>
            </View>

            <View style={[styles.metricCard, { borderLeftColor: '#16a34a' }]}>
              <Text style={styles.cardLabel}>Faa'iidada Guud</Text>
              <Text style={[styles.cardValue, { color: '#16a34a' }]}>
                ${summary.grossProfit.toFixed(2)}
              </Text>
              <Text style={styles.cardSub}>
                Kharashka alaabta: ${summary.costAmount.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Section 2: Expenses & Net Profit */}
          <Text style={styles.sectionTitle}>📉 Kharashaadka & Faa'iidada Saafiga</Text>
          <View style={styles.cardRow}>
            <View style={[styles.metricCard, { borderLeftColor: '#dc2626' }]}>
              <Text style={styles.cardLabel}>Kharashaadka Baxay</Text>
              <Text style={[styles.cardValue, { color: '#dc2626' }]}>
                ${summary.expensesTotal.toFixed(2)}
              </Text>
              <Text style={styles.cardSub}>Biilasha & howlaha</Text>
            </View>

            <View
              style={[
                styles.metricCard,
                { borderLeftColor: summary.netProfit >= 0 ? '#10b981' : '#ef4444' },
              ]}
            >
              <Text style={styles.cardLabel}>Faa'iidada Saafiga ah</Text>
              <Text
                style={[
                  styles.cardValue,
                  { color: summary.netProfit >= 0 ? '#10b981' : '#ef4444' },
                ]}
              >
                ${summary.netProfit.toFixed(2)}
              </Text>
              <Text style={styles.cardSub}>Faa'iido - Kharash</Text>
            </View>
          </View>

          {/* Section 3: Debts */}
          <Text style={styles.sectionTitle}>🤝 Deymaha Macaamiisha</Text>
          <View style={styles.fullCard}>
            <View style={styles.fullCardHeader}>
              <Text style={styles.fullCardTitle}>Wadarta Deymaha Maqan</Text>
              <Text style={styles.debtValue}>${summary.debtsOutstanding.toFixed(2)}</Text>
            </View>
            <Text style={styles.fullCardSub}>
              Waa lacagta macaamiishu ku leeyihiin dukaanka ee weli bixin la'dahay ama qabyada ah.
            </Text>
          </View>

          {/* Section 4: Inventory Valuation */}
          <Text style={styles.sectionTitle}>📦 Qiimaha Raasamaalka Alaabta (Stock)</Text>
          <View style={styles.inventoryCard}>
            <View style={styles.invRow}>
              <Text style={styles.invLabel}>Qiimaha Soo Iibinta (Cost Value):</Text>
              <Text style={styles.invVal}>${summary.stockCostValuation.toFixed(2)}</Text>
            </View>
            <View style={styles.invRow}>
              <Text style={styles.invLabel}>Qiimaha Iibinta Tukaanka (Retail Value):</Text>
              <Text style={[styles.invVal, { color: '#16a34a' }]}>
                ${summary.stockRetailValuation.toFixed(2)}
              </Text>
            </View>
            <View style={[styles.invRow, styles.invRowBorder]}>
              <Text style={styles.invLabelBold}>Faa'iidada la Filan karo (Potential):</Text>
              <Text style={styles.invValBold}>
                ${(summary.stockRetailValuation - summary.stockCostValuation).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  periodBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  periodBtnActive: {
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#0284c7',
  },
  periodText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  periodTextActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
  periodIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f1f5f9',
  },
  periodIndicatorText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748b',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 12,
    marginBottom: 8,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
  },
  cardLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 11,
    color: '#94a3b8',
  },
  fullCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  fullCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fullCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  debtValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#d97706',
  },
  fullCardSub: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  inventoryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    gap: 8,
  },
  invRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    marginTop: 4,
  },
  invLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  invVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  invLabelBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  invValBold: {
    fontSize: 15,
    fontWeight: '800',
    color: '#16a34a',
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
});
