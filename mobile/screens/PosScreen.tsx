import React, { useState, useEffect, useRef } from 'react';
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
  SafeAreaView,
} from 'react-native';
import { mobileApi } from '../services/api';
import { ProductVariant, CartItem, PaymentMethod, Customer } from '../types';
import { calculateCartItemLine, calculateSaleTotal, roundToCents } from '../lib/calculations/financials';
import { calculateCostPerBaseUnit, calculateOilMoneyToLiters, getVariantStep, isValidSellableQuantity, getStockStatus } from '../lib/calculations/stock';
import { calculateSosDenomination } from '../lib/calculations/denominations';

interface PosScreenProps {
  initialSelectedVariant?: ProductVariant | null;
  onClearInitialVariant?: () => void;
}

export function PosScreen({ initialSelectedVariant, onClearInitialVariant }: PosScreenProps) {
  // Search & Catalog
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ProductVariant[]>([]);
  const [searching, setSearching] = useState(false);

  // Cart
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [overallDiscount, setOverallDiscount] = useState<string>('0');

  // Quantity Modal for selected product
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantityModalVisible, setQuantityModalVisible] = useState(false);
  const [inputQty, setInputQty] = useState('1');

  // Cooking Oil Dual Mode
  const [oilMode, setOilMode] = useState<'liter' | 'money'>('liter');
  const [oilMoneyOption, setOilMoneyOption] = useState<{ amount: number; currency: 'SOS' | 'USD'; label: string } | null>(null);
  const [customOilMoney, setCustomOilMoney] = useState('');

  // Checkout Modal
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [partialAmountPaid, setPartialAmountPaid] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomerModalVisible, setNewCustomerModalVisible] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [submittingSale, setSubmittingSale] = useState(false);

  // Receipt Modal
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);

  // Handle incoming variant from Products tab
  useEffect(() => {
    if (initialSelectedVariant) {
      openQuantityModal(initialSelectedVariant);
      if (onClearInitialVariant) onClearInitialVariant();
    }
  }, [initialSelectedVariant]);

  // Product Search with 250ms debouncing
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!text.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await mobileApi.getProductsPaginated({
          search: text.trim(),
          page: 1,
          pageSize: 25,
        });
        setSearchResults(res.variants);
      } catch (err) {
        console.warn('POS search error:', err);
      } finally {
        setSearching(false);
      }
    }, 250);
  };

  // Open Quantity Selection
  const openQuantityModal = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    const isAmountBased = variant.management_mode === 'amount_based';
    const isPackBased = variant.management_mode === 'pack_based';

    if (isAmountBased) {
      setOilMode('liter');
      setInputQty('1');
      setOilMoneyOption(null);
      setCustomOilMoney('');
    } else if (isPackBased) {
      setInputQty('1');
    } else {
      const step = getVariantStep(variant);
      setInputQty(step.toString());
    }
    setQuantityModalVisible(true);
  };

  // Add Item to Cart
  const handleAddToCart = () => {
    if (!selectedVariant) return;

    const isAmountBased = selectedVariant.management_mode === 'amount_based';
    const isPackBased = selectedVariant.management_mode === 'pack_based';
    let qty = parseFloat(inputQty);

    if (isAmountBased && oilMode === 'money') {
      const moneyVal = oilMoneyOption ? oilMoneyOption.amount : parseFloat(customOilMoney);
      const currency = oilMoneyOption ? oilMoneyOption.currency : 'SOS';

      if (isNaN(moneyVal) || moneyVal <= 0) {
        Alert.alert('Khalad', 'Fadlan dooro ama geli lacag sax ah.');
        return;
      }

      const oilCalc = calculateOilMoneyToLiters(moneyVal, currency, selectedVariant.sell_price);
      qty = oilCalc.litersSold;

      if (qty > selectedVariant.stock_quantity) {
        Alert.alert('Stock-ku Kuma Filna', `Waxaa hadhay kaliya ${selectedVariant.stock_quantity} L. Iibkan wuxuu u baahan yahay ${qty} L.`);
        return;
      }

      const cartLine = calculateCartItemLine(
        selectedVariant.sell_price,
        selectedVariant.cost_per_unit || calculateCostPerBaseUnit(selectedVariant.buy_price, selectedVariant.conversion_factor, selectedVariant),
        qty,
        0,
        'fixed',
        0,
        {
          managementMode: 'amount_based',
          actualQuantityUsed: qty,
          amountBasedCurrency: currency,
          amountBasedValue: moneyVal,
        }
      );

      const newItem: CartItem = {
        id: `${selectedVariant.id}_${Date.now()}`,
        product: selectedVariant.product || ({ id: selectedVariant.product_id, name: selectedVariant.variant_name } as any),
        variant: selectedVariant,
        quantity: qty,
        unitPrice: selectedVariant.sell_price,
        unitCost: selectedVariant.cost_per_unit || calculateCostPerBaseUnit(selectedVariant.buy_price, selectedVariant.conversion_factor, selectedVariant),
        discount: 0,
        totalPrice: cartLine.totalPrice,
        actual_quantity_used: qty,
        selling_method: 'money',
        selling_option_label: oilMoneyOption ? oilMoneyOption.label : `${moneyVal} ${currency}`,
        amount_based_currency: currency,
        amount_based_value: moneyVal,
      };

      setCartItems((prev) => [...prev, newItem]);
      setQuantityModalVisible(false);
      setSearch('');
      setSearchResults([]);
      return;
    }

    // Liter / Standard / Pack-based
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Khalad', 'Fadlan geli tiro sax ah.');
      return;
    }

    const valResult = isValidSellableQuantity(qty, getVariantStep(selectedVariant), selectedVariant.selling_unit, selectedVariant.management_mode);
    if (!valResult.valid) {
      Alert.alert('Tiro Khaldan', valResult.reason || 'Tiradu ma waafaqsana shuruudaha alaabtan.');
      return;
    }

    if (qty > selectedVariant.stock_quantity) {
      Alert.alert('Stock-ku Kuma Filna', `Stock-ga yaalla waa ${selectedVariant.stock_quantity} ${selectedVariant.selling_unit}.`);
      return;
    }

    const isDenom = selectedVariant.pricing_mode === 'denomination' && Boolean(selectedVariant.sos_price);
    const cartLine = calculateCartItemLine(
      selectedVariant.sell_price,
      selectedVariant.cost_per_unit || calculateCostPerBaseUnit(selectedVariant.buy_price, selectedVariant.conversion_factor, selectedVariant),
      qty,
      0,
      isDenom ? 'denomination' : 'fixed',
      selectedVariant.sos_price || 0
    );

    const existingIndex = cartItems.findIndex((ci) => ci.variant.id === selectedVariant.id && !ci.selling_option_label);

    if (existingIndex >= 0) {
      const existing = cartItems[existingIndex];
      const newQty = existing.quantity + qty;
      if (newQty > selectedVariant.stock_quantity) {
        Alert.alert('Stock-ku Kuma Filna', `Wadarta tirada (${newQty}) waxay ka badan tahay stock-ga yaalla (${selectedVariant.stock_quantity}).`);
        return;
      }
      const updatedLine = calculateCartItemLine(
        selectedVariant.sell_price,
        existing.unitCost,
        newQty,
        existing.discount,
        isDenom ? 'denomination' : 'fixed',
        selectedVariant.sos_price || 0
      );

      const updated = [...cartItems];
      updated[existingIndex] = {
        ...existing,
        quantity: newQty,
        totalPrice: updatedLine.totalPrice,
      };
      setCartItems(updated);
    } else {
      const newItem: CartItem = {
        id: `${selectedVariant.id}_${Date.now()}`,
        product: selectedVariant.product || ({ id: selectedVariant.product_id, name: selectedVariant.variant_name } as any),
        variant: selectedVariant,
        quantity: qty,
        unitPrice: selectedVariant.sell_price,
        unitCost: selectedVariant.cost_per_unit || calculateCostPerBaseUnit(selectedVariant.buy_price, selectedVariant.conversion_factor, selectedVariant),
        discount: 0,
        totalPrice: cartLine.totalPrice,
        pricing_mode: selectedVariant.pricing_mode,
        sosPrice: selectedVariant.sos_price,
        selling_method: 'liter',
      };
      setCartItems((prev) => [...prev, newItem]);
    }

    setQuantityModalVisible(false);
    setSearch('');
    setSearchResults([]);
  };

  // Remove Item
  const handleRemoveItem = (id: string) => {
    setCartItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Update Item Quantity in Cart
  const handleUpdateItemQty = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const step = getVariantStep(item.variant);
        const newQty = Math.max(step, Number((item.quantity + delta * step).toFixed(4)));

        if (newQty > item.variant.stock_quantity) {
          Alert.alert('Stock-ku Kuma Filna', `Stock-ga yaalla waa ${item.variant.stock_quantity} ${item.variant.selling_unit}.`);
          return item;
        }

        const isDenom = item.pricing_mode === 'denomination' && Boolean(item.sosPrice);
        const line = calculateCartItemLine(
          item.unitPrice,
          item.unitCost,
          newQty,
          item.discount,
          isDenom ? 'denomination' : 'fixed',
          item.sosPrice || 0
        );

        return {
          ...item,
          quantity: newQty,
          totalPrice: line.totalPrice,
        };
      })
    );
  };

  // Calculate Totals
  const saleTotals = calculateSaleTotal(cartItems, parseFloat(overallDiscount) || 0);

  // Open Checkout
  const handleOpenCheckout = async () => {
    if (cartItems.length === 0) {
      Alert.alert('Gaariga Waa Maran', 'Fadlan ku dar ugu yaraan hal alaab.');
      return;
    }

    try {
      const custs = await mobileApi.getCustomers();
      setCustomers(custs);
    } catch (err) {
      console.warn('Customer load error:', err);
    }

    setPaymentMethod('cash');
    setPartialAmountPaid('');
    setCheckoutModalVisible(true);
  };

  // Create Quick Customer
  const handleCreateQuickCustomer = async () => {
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
      Alert.alert('Khalad', 'Magaca iyo taleefanka waa qasab.');
      return;
    }

    try {
      const created = await mobileApi.createCustomer({
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
      });
      setCustomers((prev) => [created, ...prev]);
      setSelectedCustomer(created);
      setNewCustomerModalVisible(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      Alert.alert('Guul', 'Macmiilka cusub waa la diiwaangeliyay.');
    } catch (err: any) {
      Alert.alert('Khalad', err?.message || 'Macmiilka lama abuuri karin.');
    }
  };

  // Submit POS Sale
  const handleSubmitSale = async () => {
    if ((paymentMethod === 'credit' || paymentMethod === 'partial') && !selectedCustomer) {
      Alert.alert('Macmiil Baa Loo Baahan Yahay', 'Iibka deynta ama qeybta ah wuxuu u baahan yahay in macmiil la doorto.');
      return;
    }

    let amountPaid = saleTotals.totalAmount;
    if (paymentMethod === 'credit') {
      amountPaid = 0;
    } else if (paymentMethod === 'partial') {
      amountPaid = parseFloat(partialAmountPaid);
      if (isNaN(amountPaid) || amountPaid < 0 || amountPaid >= saleTotals.totalAmount) {
        Alert.alert('Tiro Khaldan', `Lacagta la bixiyay waa inay u dhaxaysaa $0 iyo $${saleTotals.totalAmount.toFixed(2)}.`);
        return;
      }
    }

    setSubmittingSale(true);
    const res = await mobileApi.executeSale({
      items: cartItems,
      paymentMethod,
      amountPaid,
      overallDiscount: parseFloat(overallDiscount) || 0,
      customerId: selectedCustomer?.id,
      notes: `Mobile POS Sale (${paymentMethod.toUpperCase()})`,
    });
    setSubmittingSale(false);

    if (!res.success) {
      Alert.alert('Iibku Wuu Fashilmay', res.error || 'Waxbaa khaldamay intii iibka la xaqiijinayay.');
    } else {
      setCompletedSale({
        id: res.saleId || res.sale?.id || 'SM-RECEIPT',
        date: new Date().toISOString(),
        items: [...cartItems],
        totals: { ...saleTotals, amountPaid, debtAmount: saleTotals.totalAmount - amountPaid },
        paymentMethod,
        customerName: selectedCustomer?.name || 'Macaamiil Guud (Cash)',
      });

      setCheckoutModalVisible(false);
      setCartItems([]);
      setOverallDiscount('0');
      setSelectedCustomer(null);
      setReceiptModalVisible(true);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Product Search Bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Raadi alaabta, SKU, ama Barcode..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={handleSearchChange}
          autoCapitalize="none"
        />
        {searching && <ActivityIndicator size="small" color="#0284c7" style={styles.searchSpinner} />}
      </View>

      {/* Search Results Dropdown/Overlay */}
      {search.trim().length > 0 && (
        <View style={styles.searchResultsBox}>
          {searchResults.length === 0 ? (
            <Text style={styles.noSearchText}>
              {searching ? 'Raadinaya...' : 'Lama helin alaab magacan leh.'}
            </Text>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const stockStatus = getStockStatus(item.stock_quantity, item.minimum_stock);
                const isDenom = item.pricing_mode === 'denomination' && item.sos_price;
                const isOil = item.management_mode === 'amount_based';

                return (
                  <TouchableOpacity
                    style={styles.searchItemRow}
                    onPress={() => openQuantityModal(item)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.searchItemName}>
                        {item.product?.name || item.variant_name}
                        {isOil ? ' 🛢️ (Saliid)' : ''}
                      </Text>
                      <Text style={styles.searchItemMeta}>
                        Stock: {item.stock_quantity} {item.selling_unit} • {stockStatus.labelSomali}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.searchItemPrice}>
                        {isDenom ? `${item.sos_price?.toLocaleString()} SOS` : `$${item.sell_price.toFixed(2)}`}
                      </Text>
                      <Text style={styles.searchAddLabel}>+ Xulo</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {/* Cart Content */}
      <View style={styles.cartSection}>
        <View style={styles.cartHeaderRow}>
          <Text style={styles.cartTitle}>
            Alaabta Gaariga ({cartItems.length})
          </Text>
          {cartItems.length > 0 && (
            <TouchableOpacity onPress={() => setCartItems([])}>
              <Text style={styles.clearCartText}>Faaruqi</Text>
            </TouchableOpacity>
          )}
        </View>

        {cartItems.length === 0 ? (
          <View style={styles.emptyCartBox}>
            <Text style={styles.emptyCartIcon}>🛒</Text>
            <Text style={styles.emptyCartTitle}>Gaariga iibku waa maran yahay</Text>
            <Text style={styles.emptyCartSub}>
              Ka raadi alaabta xagga sare si aad ugu darto miiska iibka.
            </Text>
          </View>
        ) : (
          <FlatList
            data={cartItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.cartList}
            renderItem={({ item }) => (
              <View style={styles.cartItemCard}>
                <View style={styles.cartItemHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartItemName}>{item.product.name}</Text>
                    {item.selling_option_label ? (
                      <Text style={styles.oilOptionBadge}>{item.selling_option_label}</Text>
                    ) : null}
                    <Text style={styles.cartItemUnitPrice}>
                      ${item.unitPrice.toFixed(2)}/{item.variant.selling_unit}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleRemoveItem(item.id)}
                  >
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.cartItemBottomRow}>
                  {/* Stepper controls */}
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => handleUpdateItemQty(item.id, -1)}
                    >
                      <Text style={styles.stepBtnText}>−</Text>
                    </TouchableOpacity>

                    <Text style={styles.stepperQty}>
                      {item.quantity} {item.variant.selling_unit}
                    </Text>

                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => handleUpdateItemQty(item.id, 1)}
                    >
                      <Text style={styles.stepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.cartItemTotal}>${item.totalPrice.toFixed(2)}</Text>
                </View>
              </View>
            )}
          />
        )}
      </View>

      {/* Cart Summary & Checkout Trigger */}
      {cartItems.length > 0 && (
        <View style={styles.summaryBar}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Isku darka (Subtotal):</Text>
            <Text style={styles.summaryVal}>${saleTotals.subtotal.toFixed(2)}</Text>
          </View>

          {saleTotals.hasDenominationItems && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Denomination SOS:</Text>
              <Text style={styles.summaryVal}>{saleTotals.totalSos.toLocaleString()} SOS</Text>
            </View>
          )}

          <View style={[styles.summaryRow, { marginTop: 4 }]}>
            <Text style={styles.totalLabel}>Wadarta Guud (Total):</Text>
            <Text style={styles.totalVal}>${saleTotals.totalAmount.toFixed(2)}</Text>
          </View>

          <TouchableOpacity
            style={styles.checkoutBtn}
            onPress={handleOpenCheckout}
            activeOpacity={0.8}
          >
            <Text style={styles.checkoutBtnText}>Xaqiiji Iibka (${saleTotals.totalAmount.toFixed(2)}) ➔</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal 1: Product Quantity / Cooking Oil Selector */}
      <Modal visible={quantityModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {selectedVariant?.product?.name || selectedVariant?.variant_name}
            </Text>
            <Text style={styles.modalSubtitle}>
              Stock: {selectedVariant?.stock_quantity} {selectedVariant?.selling_unit} • Qiimaha: ${selectedVariant?.sell_price.toFixed(2)}
            </Text>

            {/* Cooking Oil Options */}
            {selectedVariant?.management_mode === 'amount_based' ? (
              <View>
                <View style={styles.oilModeToggle}>
                  <TouchableOpacity
                    style={[styles.oilModeTab, oilMode === 'liter' && styles.oilModeTabActive]}
                    onPress={() => setOilMode('liter')}
                  >
                    <Text style={[styles.oilModeTabText, oilMode === 'liter' && styles.oilModeTabTextActive]}>
                      Habka A: Litir
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.oilModeTab, oilMode === 'money' && styles.oilModeTabActive]}
                    onPress={() => setOilMode('money')}
                  >
                    <Text style={[styles.oilModeTabText, oilMode === 'money' && styles.oilModeTabTextActive]}>
                      Habka B: Lacag
                    </Text>
                  </TouchableOpacity>
                </View>

                {oilMode === 'liter' ? (
                  <View>
                    <Text style={styles.pickerLabel}>Xulo Litir:</Text>
                    <View style={styles.quickChipsGrid}>
                      {['0.25', '0.5', '0.75', '1', '1.5', '2'].map((l) => (
                        <TouchableOpacity
                          key={l}
                          style={[styles.quickChip, inputQty === l && styles.quickChipActive]}
                          onPress={() => setInputQty(l)}
                        >
                          <Text style={[styles.quickChipText, inputQty === l && styles.quickChipTextActive]}>
                            {l} L
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Geli litir kale (tusaale: 1.25)"
                      keyboardType="numeric"
                      value={inputQty}
                      onChangeText={setInputQty}
                    />
                  </View>
                ) : (
                  <View>
                    <Text style={styles.pickerLabel}>Xulo Qiimaha Lacagta:</Text>
                    <View style={styles.quickChipsGrid}>
                      {[
                        { amount: 3000, currency: 'SOS' as const, label: '3,000 SOS' },
                        { amount: 4000, currency: 'SOS' as const, label: '4,000 SOS' },
                        { amount: 5000, currency: 'SOS' as const, label: '5,000 SOS' },
                        { amount: 6000, currency: 'SOS' as const, label: '6,000 SOS' },
                        { amount: 7000, currency: 'SOS' as const, label: '7,000 SOS' },
                        { amount: 0.50, currency: 'USD' as const, label: '$0.50 USD' },
                      ].map((opt) => (
                        <TouchableOpacity
                          key={opt.label}
                          style={[styles.quickChip, oilMoneyOption?.label === opt.label && styles.quickChipActive]}
                          onPress={() => {
                            setOilMoneyOption(opt);
                            setCustomOilMoney('');
                          }}
                        >
                          <Text style={[styles.quickChipText, oilMoneyOption?.label === opt.label && styles.quickChipTextActive]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              /* Standard / Pack-based Quantity Selector */
              <View>
                <Text style={styles.pickerLabel}>Tirada aad iibinayso ({selectedVariant?.selling_unit}):</Text>
                <View style={styles.quickChipsGrid}>
                  {selectedVariant?.management_mode === 'pack_based'
                    ? ['1', '2', '3', '4', '5'].map((q) => (
                        <TouchableOpacity
                          key={q}
                          style={[styles.quickChip, inputQty === q && styles.quickChipActive]}
                          onPress={() => setInputQty(q)}
                        >
                          <Text style={[styles.quickChipText, inputQty === q && styles.quickChipTextActive]}>
                            {q} Bac
                          </Text>
                        </TouchableOpacity>
                      ))
                    : ['0.25', '0.5', '0.75', '1', '2', '5'].map((q) => (
                        <TouchableOpacity
                          key={q}
                          style={[styles.quickChip, inputQty === q && styles.quickChipActive]}
                          onPress={() => setInputQty(q)}
                        >
                          <Text style={[styles.quickChipText, inputQty === q && styles.quickChipTextActive]}>
                            {q} {selectedVariant?.selling_unit}
                          </Text>
                        </TouchableOpacity>
                      ))}
                </View>

                <TextInput
                  style={styles.modalInput}
                  placeholder={`Geli tiro (tusaale: ${getVariantStep(selectedVariant || {})})`}
                  keyboardType="numeric"
                  value={inputQty}
                  onChangeText={setInputQty}
                />
              </View>
            )}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setQuantityModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Ka Noqo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.confirmBtn} onPress={handleAddToCart}>
                <Text style={styles.confirmBtnText}>+ Ku Dar Gaariga</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal 2: Checkout & Payment Confirmation */}
      <Modal visible={checkoutModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Xaqiijinta Iibka (Checkout)</Text>
            <Text style={styles.modalSubtitle}>Wadarta Bixinta: ${saleTotals.totalAmount.toFixed(2)}</Text>

            {/* Payment Method Toggle */}
            <Text style={styles.inputLabel}>Habka Lacag-bixinta:</Text>
            <View style={styles.paymentMethodRow}>
              {[
                { id: 'cash', label: 'Kaash' },
                { id: 'credit', label: 'Deyn Buuxda' },
                { id: 'partial', label: 'Deyn Qeyb ah' },
              ].map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.paymentMethodTab, paymentMethod === m.id && styles.paymentMethodTabActive]}
                  onPress={() => setPaymentMethod(m.id as any)}
                >
                  <Text style={[styles.paymentMethodText, paymentMethod === m.id && styles.paymentMethodTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Partial Payment Input */}
            {paymentMethod === 'partial' && (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>Lacagta Hadda La Bixiyay ($):</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={`0 illaa ${saleTotals.totalAmount}`}
                  keyboardType="numeric"
                  value={partialAmountPaid}
                  onChangeText={setPartialAmountPaid}
                />
              </View>
            )}

            {/* Customer Picker (Required for Credit & Partial) */}
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.inputLabel}>
                  Macmiilka {paymentMethod !== 'cash' ? '(Waa Qasab):' : '(Ikhtiyaar):'}
                </Text>
                <TouchableOpacity onPress={() => setNewCustomerModalVisible(true)}>
                  <Text style={{ fontSize: 12, color: '#0284c7', fontWeight: '700' }}>+ Macmiil Cusub</Text>
                </TouchableOpacity>
              </View>

              {selectedCustomer ? (
                <View style={styles.selectedCustomerCard}>
                  <Text style={styles.selectedCustomerName}>{selectedCustomer.name}</Text>
                  <Text style={styles.selectedCustomerPhone}>{selectedCustomer.phone}</Text>
                  <TouchableOpacity onPress={() => setSelectedCustomer(null)}>
                    <Text style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>Beddel ✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Raadi magaca macmiilka..."
                    value={customerSearch}
                    onChangeText={setCustomerSearch}
                  />
                  <ScrollView style={{ maxHeight: 100 }}>
                    {customers
                      .filter((c) => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch))
                      .slice(0, 5)
                      .map((c) => (
                        <TouchableOpacity
                          key={c.id}
                          style={styles.customerDropdownItem}
                          onPress={() => setSelectedCustomer(c)}
                        >
                          <Text style={{ fontWeight: '600', color: '#0f172a' }}>{c.name}</Text>
                          <Text style={{ fontSize: 12, color: '#64748b' }}>{c.phone}</Text>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Checkout Action Buttons */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setCheckoutModalVisible(false)}
                disabled={submittingSale}
              >
                <Text style={styles.cancelBtnText}>Ka Noqo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, submittingSale && { backgroundColor: '#94a3b8' }]}
                onPress={handleSubmitSale}
                disabled={submittingSale}
              >
                {submittingSale ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Diiwaangeli Iibka</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal 3: Quick Add Customer */}
      <Modal visible={newCustomerModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ku Dar Macmiil Cusub</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Magaca macmiilka (tusaale: Axmed Cali)"
              value={newCustomerName}
              onChangeText={setNewCustomerName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Telefoonka (tusaale: +252 61 ...)"
              keyboardType="phone-pad"
              value={newCustomerPhone}
              onChangeText={setNewCustomerPhone}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setNewCustomerModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Jooji</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleCreateQuickCustomer}>
                <Text style={styles.confirmBtnText}>Kaydi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal 4: Mobile Receipt */}
      <Modal visible={receiptModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.receiptCard}>
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptShopName}>TUKAAN SHIINE SUPERMARKET</Text>
              <Text style={styles.receiptSuccessBadge}>✓ IIBKU WAA GUULEYSTAY</Text>
              <Text style={styles.receiptMeta}>
                Tixraaca: #{completedSale?.id?.slice(0, 8)} • {new Date(completedSale?.date || '').toLocaleDateString()}
              </Text>
              <Text style={styles.receiptCustomer}>Macmiilka: {completedSale?.customerName}</Text>
            </View>

            <ScrollView style={styles.receiptItemsScroll}>
              {(completedSale?.items || []).map((it: CartItem, idx: number) => (
                <View key={idx} style={styles.receiptItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.receiptItemName}>{it.product.name}</Text>
                    <Text style={styles.receiptItemQty}>
                      {it.quantity} {it.variant.selling_unit} × ${it.unitPrice.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={styles.receiptItemTotal}>${it.totalPrice.toFixed(2)}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.receiptSummary}>
              <View style={styles.receiptSummaryRow}>
                <Text style={styles.receiptSummaryLabel}>Wadarta Guud:</Text>
                <Text style={styles.receiptSummaryVal}>${completedSale?.totals?.totalAmount?.toFixed(2)}</Text>
              </View>
              <View style={styles.receiptSummaryRow}>
                <Text style={styles.receiptSummaryLabel}>La Bixiyay ({completedSale?.paymentMethod?.toUpperCase()}):</Text>
                <Text style={styles.receiptSummaryVal}>${completedSale?.totals?.amountPaid?.toFixed(2)}</Text>
              </View>
              {(completedSale?.totals?.debtAmount || 0) > 0 && (
                <View style={styles.receiptSummaryRow}>
                  <Text style={[styles.receiptSummaryLabel, { color: '#b91c1c' }]}>Deynta Haray:</Text>
                  <Text style={[styles.receiptSummaryVal, { color: '#b91c1c' }]}>
                    ${completedSale?.totals?.debtAmount?.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.newSaleBtn}
              onPress={() => setReceiptModalVisible(false)}
            >
              <Text style={styles.newSaleBtnText}>Bilow Iib Cusub</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  searchBar: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    position: 'relative',
  },
  searchInput: {
    height: 46,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#0f172a',
  },
  searchSpinner: {
    position: 'absolute',
    right: 24,
    top: 24,
  },
  searchResultsBox: {
    maxHeight: 250,
    backgroundColor: '#ffffff',
    borderBottomWidth: 2,
    borderBottomColor: '#0284c7',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  searchItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  searchItemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  searchItemMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  searchItemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#16a34a',
  },
  searchAddLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
    marginTop: 2,
  },
  noSearchText: {
    padding: 16,
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
  },
  cartSection: {
    flex: 1,
    padding: 12,
  },
  cartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  clearCartText: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyCartBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyCartIcon: {
    fontSize: 44,
    marginBottom: 8,
  },
  emptyCartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  emptyCartSub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  cartList: {
    gap: 10,
    paddingBottom: 16,
  },
  cartItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cartItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cartItemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  oilOptionBadge: {
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  cartItemUnitPrice: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  deleteBtn: {
    padding: 6,
  },
  deleteBtnText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700',
  },
  cartItemBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  stepBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  stepperQty: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  cartItemTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16a34a',
  },
  summaryBar: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  totalVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0284c7',
  },
  checkoutBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  checkoutBtnText: {
    color: '#ffffff',
    fontSize: 16,
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
  modalSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 14,
  },
  oilModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  oilModeTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  oilModeTabActive: {
    backgroundColor: '#0284c7',
  },
  oilModeTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  oilModeTabTextActive: {
    color: '#ffffff',
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  quickChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  quickChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  quickChipTextActive: {
    color: '#ffffff',
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
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
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
  paymentMethodRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  paymentMethodTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  paymentMethodTabActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  paymentMethodText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  paymentMethodTextActive: {
    color: '#ffffff',
  },
  selectedCustomerCard: {
    backgroundColor: '#f0fdf4',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  selectedCustomerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#15803d',
  },
  selectedCustomerPhone: {
    fontSize: 12,
    color: '#166534',
  },
  customerDropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  receiptCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    maxHeight: '85%',
  },
  receiptHeader: {
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  receiptShopName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  receiptSuccessBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16a34a',
    marginVertical: 4,
  },
  receiptMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  receiptCustomer: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 4,
  },
  receiptItemsScroll: {
    maxHeight: 200,
    marginBottom: 12,
  },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  receiptItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  receiptItemQty: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  receiptItemTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  receiptSummary: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 4,
  },
  receiptSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  receiptSummaryLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  receiptSummaryVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  newSaleBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  newSaleBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
