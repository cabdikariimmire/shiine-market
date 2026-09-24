import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { DashboardScreen } from './DashboardScreen';
import { ProductsScreen } from './ProductsScreen';
import { PosScreen } from './PosScreen';
import { DebtsScreen } from './DebtsScreen';
import { CustomersScreen } from './CustomersScreen';
import { SuppliersScreen } from './SuppliersScreen';
import { ExpensesScreen } from './ExpensesScreen';
import { ReportsScreen } from './ReportsScreen';
import { SettingsScreen } from './SettingsScreen';
import { ProductVariant } from '../types';

type TabType = 'dashboard' | 'pos' | 'products' | 'debts' | 'more';
type MoreSubTab = 'customers' | 'suppliers' | 'expenses' | 'reports' | 'settings';

export function MainApp() {
  const { user, role, shop, logout, canAccess } = useAuth();

  // Sellers default to POS, others default to Dashboard
  const [activeTab, setActiveTab] = useState<TabType>(role === 'seller' ? 'pos' : 'dashboard');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [selectedVariantForPos, setSelectedVariantForPos] = useState<ProductVariant | null>(null);

  // Tab 5 (More) sub-tab state
  const [moreSubTab, setMoreSubTab] = useState<MoreSubTab>('customers');

  const getRoleLabel = () => {
    switch (role) {
      case 'admin':
        return { label: 'Maamule (Admin)', color: '#0284c7', bg: '#e0f2fe' };
      case 'seller':
        return { label: 'Iibiye (Seller)', color: '#16a34a', bg: '#dcfce7' };
      case 'reporter':
        return { label: 'Warbixiye (Reporter)', color: '#d97706', bg: '#fef3c7' };
      default:
        return { label: 'Isticmaale', color: '#64748b', bg: '#f1f5f9' };
    }
  };

  const roleInfo = getRoleLabel();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Top App Header */}
      <View style={styles.topHeader}>
        <View style={styles.shopInfo}>
          <Text style={styles.shopName}>{shop?.name || 'Shiine Market'}</Text>
          <View style={styles.userRow}>
            <Text style={styles.userName}>{user?.name || user?.email}</Text>
            <View style={[styles.roleBadge, { backgroundColor: roleInfo.bg }]}>
              <Text style={[styles.roleText, { color: roleInfo.color }]}>{roleInfo.label}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.7}>
          <Text style={styles.logoutText}>Ka Bax</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      <View style={styles.contentArea}>
        {/* Tab 1: Dashboard */}
        {activeTab === 'dashboard' && (
          <DashboardScreen
            onNavigateToPos={() => setActiveTab('pos')}
            onNavigateToProducts={(filter) => {
              if (filter) setStockFilter(filter);
              setActiveTab('products');
            }}
            onNavigateToDebts={() => setActiveTab('debts')}
          />
        )}

        {/* Tab 2: POS */}
        {activeTab === 'pos' && (
          <PosScreen
            initialSelectedVariant={selectedVariantForPos}
            onClearInitialVariant={() => setSelectedVariantForPos(null)}
          />
        )}

        {/* Tab 3: Products */}
        {activeTab === 'products' && (
          <ProductsScreen
            initialStockFilter={stockFilter}
            onSelectForPos={(variant) => {
              setSelectedVariantForPos(variant);
              setActiveTab('pos');
            }}
          />
        )}

        {/* Tab 4: Debts */}
        {activeTab === 'debts' && <DebtsScreen />}

        {/* Tab 5: More (Customers, Suppliers, Expenses, Reports, Settings) */}
        {activeTab === 'more' && (
          <View style={styles.moreContainer}>
            {/* Sub-navigation bar */}
            <View style={styles.subNavBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.subNavScroll}
              >
                <TouchableOpacity
                  style={[styles.subPill, moreSubTab === 'customers' && styles.subPillActive]}
                  onPress={() => setMoreSubTab('customers')}
                >
                  <Text style={[styles.subPillText, moreSubTab === 'customers' && styles.subPillTextActive]}>
                    👥 Macaamiisha
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.subPill, moreSubTab === 'suppliers' && styles.subPillActive]}
                  onPress={() => setMoreSubTab('suppliers')}
                >
                  <Text style={[styles.subPillText, moreSubTab === 'suppliers' && styles.subPillTextActive]}>
                    🏢 Qeybiyeyaasha
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.subPill, moreSubTab === 'expenses' && styles.subPillActive]}
                  onPress={() => setMoreSubTab('expenses')}
                >
                  <Text style={[styles.subPillText, moreSubTab === 'expenses' && styles.subPillTextActive]}>
                    💸 Kharashka
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.subPill, moreSubTab === 'reports' && styles.subPillActive]}
                  onPress={() => setMoreSubTab('reports')}
                >
                  <Text style={[styles.subPillText, moreSubTab === 'reports' && styles.subPillTextActive]}>
                    📊 Warbixinno
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.subPill, moreSubTab === 'settings' && styles.subPillActive]}
                  onPress={() => setMoreSubTab('settings')}
                >
                  <Text style={[styles.subPillText, moreSubTab === 'settings' && styles.subPillTextActive]}>
                    ⚙️ Dejinta
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Sub-tab view */}
            <View style={styles.subTabContent}>
              {moreSubTab === 'customers' && <CustomersScreen />}
              {moreSubTab === 'suppliers' && <SuppliersScreen />}
              {moreSubTab === 'expenses' && <ExpensesScreen />}
              {moreSubTab === 'reports' && <ReportsScreen />}
              {moreSubTab === 'settings' && <SettingsScreen />}
            </View>
          </View>
        )}
      </View>

      {/* Role-Aware Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        {/* Dashboard */}
        <TouchableOpacity
          style={[styles.navBtn, activeTab === 'dashboard' && styles.navBtnActive]}
          onPress={() => setActiveTab('dashboard')}
          activeOpacity={0.7}
        >
          <Text style={[styles.navBtnText, activeTab === 'dashboard' && styles.navBtnTextActive]}>
            Hordhac
          </Text>
        </TouchableOpacity>

        {/* POS */}
        {canAccess('pos') && (
          <TouchableOpacity
            style={[styles.navBtn, activeTab === 'pos' && styles.navBtnActive]}
            onPress={() => setActiveTab('pos')}
            activeOpacity={0.7}
          >
            <Text style={[styles.navBtnText, activeTab === 'pos' && styles.navBtnTextActive]}>
              Iibka (POS)
            </Text>
          </TouchableOpacity>
        )}

        {/* Products */}
        {canAccess('products') && (
          <TouchableOpacity
            style={[styles.navBtn, activeTab === 'products' && styles.navBtnActive]}
            onPress={() => {
              setStockFilter('all');
              setActiveTab('products');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.navBtnText, activeTab === 'products' && styles.navBtnTextActive]}>
              Alaabta
            </Text>
          </TouchableOpacity>
        )}

        {/* Debts */}
        {canAccess('debts') && (
          <TouchableOpacity
            style={[styles.navBtn, activeTab === 'debts' && styles.navBtnActive]}
            onPress={() => setActiveTab('debts')}
            activeOpacity={0.7}
          >
            <Text style={[styles.navBtnText, activeTab === 'debts' && styles.navBtnTextActive]}>
              Deymaha
            </Text>
          </TouchableOpacity>
        )}

        {/* More */}
        <TouchableOpacity
          style={[styles.navBtn, activeTab === 'more' && styles.navBtnActive]}
          onPress={() => setActiveTab('more')}
          activeOpacity={0.7}
        >
          <Text style={[styles.navBtnText, activeTab === 'more' && styles.navBtnTextActive]}>
            Dheeraad
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 8,
  },
  userName: {
    fontSize: 13,
    color: '#475569',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fee2e2',
    borderRadius: 6,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },
  contentArea: {
    flex: 1,
  },
  moreContainer: {
    flex: 1,
  },
  subNavBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 8,
  },
  subNavScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  subPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  subPillActive: {
    backgroundColor: '#0284c7',
  },
  subPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  subPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  subTabContent: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  navBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  navBtnActive: {
    backgroundColor: '#f1f5f9',
  },
  navBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  navBtnTextActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
});
