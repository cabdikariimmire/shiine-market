import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useAuth } from '../context/AuthContext';
import { mobileApi } from '../services/api';
import { ProductVariant, Category } from '../types';
import { getStockStatus, calculateCostPerBaseUnit } from '../lib/calculations/stock';
import { formatUnitMoney } from '../lib/calculations/financials';

interface ProductsScreenProps {
  initialStockFilter?: string;
  onSelectForPos?: (variant: ProductVariant) => void;
}

export function ProductsScreen({ initialStockFilter, onSelectForPos }: ProductsScreenProps) {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';

  // Search and filter states
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStockStatus, setSelectedStockStatus] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>(
    (initialStockFilter as any) || 'all'
  );

  // Pagination states
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modals for Admin
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [selectedVariantForAdjust, setSelectedVariantForAdjust] = useState<ProductVariant | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // Debounce search input by 300ms
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(text);
      setPage(1);
    }, 300);
  };

  // Load categories
  useEffect(() => {
    const fetchCats = async () => {
      const cats = await mobileApi.getCategories();
      setCategories(cats);
    };
    fetchCats();
  }, []);

  // Fetch products
  const fetchProducts = useCallback(async (pageNum: number, isRefresh: boolean = false) => {
    if (pageNum === 1) {
      if (!isRefresh) setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await mobileApi.getProductsPaginated({
        search: debouncedSearch,
        categoryId: selectedCategory === 'all' ? undefined : selectedCategory,
        stockStatus: selectedStockStatus,
        page: pageNum,
        pageSize: 20,
      });

      if (pageNum === 1) {
        setVariants(res.variants);
      } else {
        setVariants((prev) => [...prev, ...res.variants]);
      }
      setTotalPages(res.totalPages);
      setTotalCount(res.totalCount);
      setPage(pageNum);
    } catch (err) {
      console.warn('Products fetch error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [debouncedSearch, selectedCategory, selectedStockStatus]);

  useEffect(() => {
    setPage(1);
    fetchProducts(1);
  }, [fetchProducts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts(1, true);
  };

  const onEndReached = () => {
    if (!loading && !loadingMore && page < totalPages) {
      fetchProducts(page + 1);
    }
  };

  // Admin Stock Adjustment Handler
  const handleStockAdjustment = async () => {
    if (!selectedVariantForAdjust) return;
    const qtyChange = parseFloat(adjustQty);

    if (isNaN(qtyChange) || qtyChange === 0) {
      Alert.alert('Khalad', 'Fadlan geli tiro sax ah (tusaale: 10 ama -5).');
      return;
    }

    setAdjustSubmitting(true);
    const res = await mobileApi.adjustStock(
      selectedVariantForAdjust.id,
      qtyChange,
      adjustReason || 'Sixid stock oo laga sameeyay mobaylka',
      role || 'seller'
    );
    setAdjustSubmitting(false);

    if (!res.success) {
      Alert.alert('Khalad', res.error || 'Sixitaanka stock-ga wuu fashilmay.');
    } else {
      Alert.alert('Guul', `Stock-ga waxaa loo beddelay ${res.newStock} ${selectedVariantForAdjust.selling_unit}.`);
      setAdjustModalVisible(false);
      setSelectedVariantForAdjust(null);
      setAdjustQty('');
      setAdjustReason('');
      fetchProducts(1, true);
    }
  };

  const renderProductItem = ({ item }: { item: ProductVariant }) => {
    const status = getStockStatus(item.stock_quantity, item.minimum_stock);
    const productName = item.product?.name || item.variant_name || 'Alaab';
    const isDenomination = item.pricing_mode === 'denomination' && item.sos_price;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleCol}>
            <Text style={styles.productName}>{productName}</Text>
            {item.variant_name && item.variant_name !== 'Default' && (
              <Text style={styles.variantName}>{item.variant_name}</Text>
            )}
            <View style={styles.skuRow}>
              {item.sku ? <Text style={styles.skuText}>SKU: {item.sku}</Text> : null}
              {item.barcode ? <Text style={styles.skuText}>Barcode: {item.barcode}</Text> : null}
            </View>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: status.badgeBg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.icon} {status.labelSomali}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Stock-ga Yaalla</Text>
            <Text style={[styles.metricBold, item.stock_quantity <= 0 && { color: '#dc2626' }]}>
              {item.stock_quantity} {item.selling_unit}
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Qiimaha Iibka</Text>
            <Text style={styles.metricBold}>
              {isDenomination ? `${item.sos_price?.toLocaleString()} SOS` : `$${item.sell_price.toFixed(2)}`}
              <Text style={styles.unitText}>/{item.selling_unit}</Text>
            </Text>
          </View>

          {/* Buy price is strictly ADMIN-ONLY */}
          {isAdmin && (
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Qiimaha Soo Iibka</Text>
              <Text style={[styles.metricBold, { color: '#475569' }]}>
                ${item.buy_price.toFixed(2)}
                <Text style={styles.unitText}>/{item.purchase_unit}</Text>
              </Text>
              {item.conversion_factor > 1 && (
                <Text style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                  (Cost: {formatUnitMoney(calculateCostPerBaseUnit(item.buy_price, item.conversion_factor))}/{item.selling_unit})
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Footer Actions */}
        <View style={styles.cardFooter}>
          {onSelectForPos && item.stock_quantity > 0 && (
            <TouchableOpacity
              style={styles.posSelectBtn}
              onPress={() => onSelectForPos(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.posSelectText}>+ Ku Dar POS-ka</Text>
            </TouchableOpacity>
          )}

          {isAdmin && (
            <TouchableOpacity
              style={styles.adjustBtn}
              onPress={() => {
                setSelectedVariantForAdjust(item);
                setAdjustModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.adjustBtnText}>Beddel Stock-ga</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Raadi magaca, SKU, ama Barcode..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={handleSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity
            style={styles.clearSearchBtn}
            onPress={() => handleSearchChange('')}
          >
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Categories Horizontal Filter */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, selectedCategory === 'all' && styles.filterChipActive]}
            onPress={() => setSelectedCategory('all')}
          >
            <Text style={[styles.filterChipText, selectedCategory === 'all' && styles.filterChipTextActive]}>
              Dhammaan Qeybaha
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.filterChip, selectedCategory === cat.id && styles.filterChipActive]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text style={[styles.filterChipText, selectedCategory === cat.id && styles.filterChipTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Stock Status Pills */}
      <View style={styles.stockFilterRow}>
        {[
          { id: 'all', label: 'Dhammaan' },
          { id: 'in_stock', label: 'Buuxda' },
          { id: 'low_stock', label: 'Yaraysaa' },
          { id: 'out_of_stock', label: 'Dhamaatay' },
        ].map((pill) => (
          <TouchableOpacity
            key={pill.id}
            style={[styles.stockPill, selectedStockStatus === pill.id && styles.stockPillActive]}
            onPress={() => setSelectedStockStatus(pill.id as any)}
          >
            <Text style={[styles.stockPillText, selectedStockStatus === pill.id && styles.stockPillTextActive]}>
              {pill.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Product List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Soo dejinaya alaabta...</Text>
        </View>
      ) : variants.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>Lama helin wax alaab ah</Text>
          <Text style={styles.emptySub}>Isku day inaad bedesho erayga raadinta ama shaandhada.</Text>
        </View>
      ) : (
        <FlatList
          data={variants}
          keyExtractor={(item) => item.id}
          renderItem={renderProductItem}
          contentContainerStyle={styles.listContent}
          onRefresh={onRefresh}
          refreshing={refreshing}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#0284c7" />
              </View>
            ) : (
              <View style={styles.listEndTextContainer}>
                <Text style={styles.listEndText}>Wadarta: {totalCount} nooc oo alaab ah</Text>
              </View>
            )
          }
        />
      )}

      {/* Admin Stock Adjustment Modal */}
      <Modal visible={adjustModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sixidda Stock-ga (Admin Only)</Text>
            <Text style={styles.modalSub}>
              Alaabta: {selectedVariantForAdjust?.product?.name || selectedVariantForAdjust?.variant_name}
            </Text>
            <Text style={styles.modalCurrentStock}>
              Hadda yaalla: {selectedVariantForAdjust?.stock_quantity} {selectedVariantForAdjust?.selling_unit}
            </Text>

            <Text style={styles.inputLabel}>Tirada aad ku darayso ama ka dhimayso (+ / -)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Tusaale: 20 ama -5"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={adjustQty}
              onChangeText={setAdjustQty}
            />

            <Text style={styles.inputLabel}>Sababta (Sabab sharci ah)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Tusaale: Soo iib cusub, waxyeello..."
              placeholderTextColor="#94a3b8"
              value={adjustReason}
              onChangeText={setAdjustReason}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setAdjustModalVisible(false)}
                disabled={adjustSubmitting}
              >
                <Text style={styles.modalCancelText}>Jooji</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, adjustSubmitting && { backgroundColor: '#94a3b8' }]}
                onPress={handleStockAdjustment}
                disabled={adjustSubmitting}
              >
                {adjustSubmitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Xaqiiji Sixidda</Text>
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
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    position: 'relative',
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
  clearSearchBtn: {
    position: 'absolute',
    right: 28,
    top: 24,
  },
  clearSearchText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '700',
  },
  filterBar: {
    marginBottom: 6,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
  },
  filterChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  filterChipText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  stockFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 8,
  },
  stockPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stockPillActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  stockPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  stockPillTextActive: {
    color: '#ffffff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
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
    marginBottom: 10,
  },
  cardTitleCol: {
    flex: 1,
    marginRight: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  variantName: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 1,
  },
  skuRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 3,
  },
  skuText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 2,
  },
  metricBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  unitText: {
    fontSize: 11,
    fontWeight: '400',
    color: '#64748b',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  posSelectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#0284c7',
    borderRadius: 6,
  },
  posSelectText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  adjustBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  adjustBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  centerContainer: {
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
  footerLoader: {
    paddingVertical: 16,
  },
  listEndTextContainer: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  listEndText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
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
    marginBottom: 2,
  },
  modalCurrentStock: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284c7',
    marginBottom: 16,
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
    marginBottom: 14,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  modalCancelText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 14,
  },
  modalSubmitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0284c7',
  },
  modalSubmitText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});
