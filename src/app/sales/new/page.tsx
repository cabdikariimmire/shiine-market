'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { 
  ShoppingCart, 
  Search, 
  Barcode, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  User, 
  DollarSign, 
  Sparkles, 
  ArrowLeft,
  CheckCircle2,
  Percent,
  Receipt,
  UserPlus,
  Layers,
  Calendar,
  Droplet,
  Package,
  AlertTriangle,
  Check
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { BarcodeScannerModal } from '@/components/pos/barcode-modal';
import { ReceiptModal } from '@/components/pos/receipt-modal';
import { useToast } from '@/components/ui/toast';
import { repository } from '@/lib/services/repository';
import { calculateCartItemLine, calculateSaleTotal, formatMoney } from '@/lib/calculations/financials';
import { calculateSosDenomination, formatSos } from '@/lib/calculations/denominations';
import { 
  calculateCostPerBaseUnit, 
  calculateUnitProfit, 
  calculateMinSellableQty, 
  calculateOilMoneyToLiters,
  getVariantStep,
  isValidSellableQuantity 
} from '@/lib/calculations/stock';
import { AmountSellingOption, CartItem, Category, Customer, PaymentMethod, ProductVariant, Sale } from '@/types';

export default function POSTerminalPage() {
  const { success, error, info } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // POS Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [overallDiscount, setOverallDiscount] = useState<string>('');
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [saleNotes, setNotes] = useState<string>('');

  // Quick Customer Creation (for Credit/Partial sales)
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  // Modals
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // Oil / Amount-Based Selling Modal State (Dual Mode: Liter & Money)
  const [isOilModalOpen, setIsOilModalOpen] = useState(false);
  const [selectedOilVariant, setSelectedOilVariant] = useState<ProductVariant | null>(null);
  const [oilSellingMethod, setOilSellingMethod] = useState<'liter' | 'money'>('money');
  const [oilLiterQuantity, setOilLiterQuantity] = useState<string>('1');
  const [selectedOilOption, setSelectedOilOption] = useState<AmountSellingOption | null>(null);
  const [isCustomOilOption, setIsCustomOilOption] = useState(false);
  const [customOilLabel, setCustomOilLabel] = useState('');
  const [customOilAmount, setCustomOilAmount] = useState('');
  const [customOilCurrency, setCustomOilCurrency] = useState<'$' | 'SOS'>('SOS');

  const loadData = useCallback(async () => {
    try {
      const [res, cats, custs] = await Promise.all([
        repository.getVariantsPaginated(search, selectedCategory, 'all', 1, 40),
        repository.getCategories(),
        repository.getCustomers(),
      ]);
      setVariants(res.data.filter(v => !v.is_pending));
      setCategories(cats);
      setCustomers(custs);
    } catch (err) {
      console.error('Error loading POS data:', err);
    }
  }, [search, selectedCategory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set default due date (7 days from now)
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setDueDate(d.toISOString().split('T')[0]);
  }, []);

  // POS Totals
  const numDiscount = parseFloat(overallDiscount) || 0;
  const totals = calculateSaleTotal(cart, numDiscount);

  // Auto-sync amount paid when payment method changes
  useEffect(() => {
    if (paymentMethod === 'cash') {
      setAmountPaidInput(totals.totalAmount > 0 ? String(totals.totalAmount) : '');
    } else if (paymentMethod === 'credit') {
      setAmountPaidInput('');
    }
  }, [paymentMethod, totals.totalAmount]);

  // Helper to get item key in cart
  const getItemKey = (item: CartItem): string => item.cartItemId || item.variant.id;

  // Helper to update confirmed cart quantity and line total
  const updateCartItemQuantity = (itemKey: string, quantity: number, quantityInput?: string) => {
    setCart(prev => prev.map(i => {
      if (getItemKey(i) === itemKey) {
        const isOil = i.variant?.management_mode === 'amount_based' || i.actual_quantity_used !== undefined;
        const isOilLiter = isOil && i.selling_method === 'liter';
        const pMode = i.pricing_mode || i.variant?.pricing_mode || 'fixed';
        const sPrice = i.sosPrice ?? i.variant?.sos_price;
        const costPerBase = i.unitCost;

        if (isOilLiter) {
          const lineTotal = Math.round(quantity * i.unitPrice * 100) / 100;
          const lineCost = Math.round(quantity * costPerBase * 100) / 100;
          const lineProfit = Math.round((lineTotal - lineCost) * 100) / 100;
          return {
            ...i,
            quantity,
            quantityInput: quantityInput !== undefined ? quantityInput : String(quantity),
            actual_quantity_used: quantity,
            selling_option_label: `${quantity} L`,
            totalPrice: lineTotal,
            grossProfit: lineProfit,
          };
        }

        const line = calculateCartItemLine(i.unitPrice, i.unitCost, quantity, i.discount, pMode, sPrice);
        return {
          ...i,
          quantity,
          quantityInput: quantityInput !== undefined ? quantityInput : String(quantity),
          pricing_mode: pMode,
          sosPrice: sPrice,
          sosTotal: line.sosTotal,
          totalPrice: line.totalPrice,
          grossProfit: line.grossProfit,
        };
      }
      return i;
    }));
  };

  // Helper to update actual liters used for oil items in cart
  const updateCartItemActualLiters = (itemKey: string, liters: number) => {
    setCart(prev => prev.map(i => {
      if (getItemKey(i) === itemKey) {
        const costPerBase = i.unitCost;
        const lineTotal = i.totalPrice;
        const itemCost = Number((liters * costPerBase).toFixed(4));
        const itemProfit = Math.round((lineTotal - itemCost) * 100) / 100;
        return {
          ...i,
          actual_quantity_used: liters,
          grossProfit: itemProfit,
        };
      }
      return i;
    }));
  };

  // Open Oil Selling Modal for amount_based products (Dual Mode: Liter & Money)
  const openOilModal = (variant: ProductVariant) => {
    if (variant.stock_quantity <= 0) {
      error(`Lama iibin karo — "${variant.product?.name} (${variant.variant_name})" way dhammaatay (🔴 Out of Stock)!`);
      return;
    }
    setSelectedOilVariant(variant);
    setOilSellingMethod('money');
    setOilLiterQuantity('1');

    const defaultOptions: AmountSellingOption[] = (variant.selling_options && variant.selling_options.length > 0)
      ? variant.selling_options
      : [
          { id: 'opt-3k', label: '3,000 SOS', amount: 3000, currency: 'SOS' },
          { id: 'opt-4k', label: '4,000 SOS', amount: 4000, currency: 'SOS' },
          { id: 'opt-5k', label: '5,000 SOS', amount: 5000, currency: 'SOS' },
          { id: 'opt-6k', label: '6,000 SOS', amount: 6000, currency: 'SOS' },
          { id: 'opt-7k', label: '7,000 SOS', amount: 7000, currency: 'SOS' },
          { id: 'opt-rubac-50', label: 'Rubac weyn $0.50', amount: 0.50, currency: '$' },
          { id: 'opt-rubac-45', label: 'Rubac weyn $0.45', amount: 0.45, currency: '$' },
        ];
    
    const initialOpt = defaultOptions.find(o => o.amount === 5000) || defaultOptions[0];
    setSelectedOilOption(initialOpt);
    setIsCustomOilOption(false);
    setCustomOilLabel('');
    setCustomOilAmount('');
    setIsOilModalOpen(true);
  };

  // Add Oil Option or Liter Sale to Cart
  const handleAddOilToCart = () => {
    if (!selectedOilVariant) return;

    const currentUsageOthers = cart
      .filter(i => i.variant.id === selectedOilVariant.id)
      .reduce((sum, i) => sum + (i.actual_quantity_used ?? i.quantity), 0);

    const availableStock = selectedOilVariant.stock_quantity;
    const remainingStock = Number((availableStock - currentUsageOthers).toFixed(4));
    const costPerBase = calculateCostPerBaseUnit(selectedOilVariant.buy_price, selectedOilVariant.conversion_factor);

    if (oilSellingMethod === 'liter') {
      const parsedLiters = parseFloat(oilLiterQuantity);
      if (isNaN(parsedLiters) || parsedLiters <= 0) {
        error('Fadlan geli qiyaas litir sax ah (e.g. 1 L ama 0.5 L)');
        return;
      }

      if (parsedLiters > remainingStock) {
        error(`Stock-ga saliidda kuma filna! Waxaa haray kaliya ${remainingStock} L, laakiin waxaad isku dayday ${parsedLiters} L.`);
        return;
      }

      const lineTotal = Math.round(parsedLiters * selectedOilVariant.sell_price * 100) / 100;
      const lineCost = Math.round(parsedLiters * costPerBase * 100) / 100;
      const lineProfit = Math.round((lineTotal - lineCost) * 100) / 100;

      const cartItemId = `${selectedOilVariant.id}_liter_${Date.now()}`;

      setCart(prev => [
        ...prev,
        {
          cartItemId,
          product: selectedOilVariant.product || { id: selectedOilVariant.product_id, name: 'Cooking Oil', created_at: '', updated_at: '' },
          variant: selectedOilVariant,
          quantity: parsedLiters,
          quantityInput: String(parsedLiters),
          actual_quantity_used: parsedLiters,
          selling_method: 'liter',
          selling_option_label: `${parsedLiters} L`,
          unitPrice: selectedOilVariant.sell_price,
          unitCost: costPerBase,
          pricing_mode: 'fixed',
          discount: 0,
          totalPrice: lineTotal,
          grossProfit: lineProfit,
        }
      ]);

      setIsOilModalOpen(false);
      success(`Ku daray dambiisha: ${selectedOilVariant.product?.name || 'Saliid'} (${parsedLiters} L - ${formatMoney(lineTotal)})`);
    } else {
      let opt: AmountSellingOption;
      if (isCustomOilOption) {
        const customAmt = parseFloat(customOilAmount);
        if (isNaN(customAmt) || customAmt <= 0) {
          error('Fadlan geli qiimaha lacagta saxda ah');
          return;
        }
        opt = {
          id: `custom-${Date.now()}`,
          label: customOilLabel.trim() || `${customAmt} ${customOilCurrency}`,
          amount: customAmt,
          currency: customOilCurrency,
          pricing_mode: customOilCurrency === 'SOS' ? 'denomination' : 'fixed',
        };
      } else {
        if (!selectedOilOption) {
          error('Fadlan dooro ikhtiyaarka lacagta');
          return;
        }
        opt = selectedOilOption;
      }

      const calc = calculateOilMoneyToLiters(opt.amount, opt.currency || 'SOS', selectedOilVariant.sell_price);
      const calculatedLiters = calc.litersSold;

      if (calculatedLiters <= 0) {
        error('Qiyaasta litirrada ma noqon karto 0');
        return;
      }

      if (calculatedLiters > remainingStock) {
        error(`Stock-ga saliidda kuma filna! Waxaa haray kaliya ${remainingStock} L, laakiin xaddiga lacagtan u dhigma waa ${calculatedLiters} L.`);
        return;
      }

      const isSos = opt.currency === 'SOS';
      const pMode: 'fixed' | 'denomination' = isSos ? 'denomination' : 'fixed';
      const sPrice = isSos ? opt.amount : null;
      const uPrice = calc.amountUsd;
      const lineCost = Math.round(calculatedLiters * costPerBase * 100) / 100;
      const lineProfit = Math.round((uPrice - lineCost) * 100) / 100;

      const cartItemId = `${selectedOilVariant.id}_money_${opt.id}_${Date.now()}`;

      setCart(prev => [
        ...prev,
        {
          cartItemId,
          product: selectedOilVariant.product || { id: selectedOilVariant.product_id, name: 'Cooking Oil', created_at: '', updated_at: '' },
          variant: selectedOilVariant,
          quantity: 1,
          quantityInput: '1',
          actual_quantity_used: calculatedLiters,
          selling_method: 'money',
          selling_option_label: opt.label,
          selling_option_id: opt.id,
          amount_based_currency: opt.currency === 'SOS' ? 'SOS' : 'USD',
          amount_based_value: opt.amount,
          unitPrice: uPrice,
          unitCost: costPerBase,
          pricing_mode: pMode,
          sosPrice: sPrice,
          sosTotal: isSos ? opt.amount : undefined,
          discount: 0,
          totalPrice: uPrice,
          grossProfit: lineProfit,
        }
      ]);

      setIsOilModalOpen(false);
      success(`Ku daray dambiisha: ${selectedOilVariant.product?.name || 'Saliid'} (${opt.label} -> ${calculatedLiters} L)`);
    }
  };

  // Add Variant to Cart with Fractional & Pack Validation
  const addToCart = (variant: ProductVariant, customAddQty?: number) => {
    // If amount_based oil, open dedicated oil selling flow
    if (variant.management_mode === 'amount_based') {
      openOilModal(variant);
      return;
    }

    const isPackBased = variant.management_mode === 'pack_based';
    const step = getVariantStep(variant);

    if (variant.stock_quantity <= 0) {
      error(`Lama iibin karo — "${variant.product?.name} (${variant.variant_name})" way dhammaatay (🔴 Out of Stock)!`);
      return;
    }

    if (!isPackBased && variant.stock_quantity < step) {
      error(`Lama iibin karo — Kaydka haray (${variant.stock_quantity} ${variant.selling_unit}) wuxuu ka yar yahay qiyaasta ugu yar ee la iibin karo (${step} ${variant.selling_unit}).`);
      return;
    }

    // Default quantity when adding is 1 (or step for bulk fractional)
    const defaultAdd = customAddQty !== undefined 
      ? customAddQty 
      : (isPackBased ? 1 : (variant.stock_quantity < 1 ? step : 1));

    const existingIndex = cart.findIndex(item => item.variant.id === variant.id && !item.actual_quantity_used);
    const existingQty = existingIndex !== -1 ? cart[existingIndex].quantity : 0;
    const targetQty = Number((existingQty + defaultAdd).toFixed(4));

    if (targetQty > variant.stock_quantity) {
      error(`Stock-ku kuma filna "${variant.product?.name} (${variant.variant_name})". Waxaa haray kaliya ${variant.stock_quantity} ${variant.selling_unit}.`);
      return;
    }

    if (!isPackBased) {
      const validation = isValidSellableQuantity(targetQty, step, variant.selling_unit);
      if (!validation.valid) {
        error(validation.reason || 'Tirada ma aha qeyb sax ah');
        return;
      }
    }

    const costPerBase = calculateCostPerBaseUnit(variant.buy_price, variant.conversion_factor);
    const pMode = variant.pricing_mode || 'fixed';
    const sPrice = variant.sos_price;

    setCart(prev => {
      if (existingIndex !== -1) {
        const existing = prev[existingIndex];
        const line = calculateCartItemLine(existing.unitPrice, existing.unitCost, targetQty, existing.discount, pMode, sPrice);

        const updated = [...prev];
        updated[existingIndex] = {
          ...existing,
          quantity: targetQty,
          quantityInput: String(targetQty),
          pricing_mode: pMode,
          sosPrice: sPrice,
          sosTotal: line.sosTotal,
          totalPrice: line.totalPrice,
          grossProfit: line.grossProfit,
        };
        return updated;
      } else {
        const line = calculateCartItemLine(variant.sell_price, costPerBase, defaultAdd, 0, pMode, sPrice);
        return [
          ...prev,
          {
            cartItemId: variant.id,
            product: variant.product || { id: variant.product_id, name: 'Alaab', created_at: '', updated_at: '' },
            variant,
            quantity: defaultAdd,
            quantityInput: String(defaultAdd),
            unitPrice: variant.sell_price,
            unitCost: costPerBase,
            pricing_mode: pMode,
            sosPrice: sPrice,
            sosTotal: line.sosTotal,
            discount: 0,
            totalPrice: line.totalPrice,
            grossProfit: line.grossProfit,
          }
        ];
      }
    });

    info(`Ku daray dambiisha: ${variant.product?.name} (${variant.variant_name}) +${defaultAdd} ${variant.selling_unit}`);
  };

  // Quantity Increment (+) button
  const handleIncrement = (item: CartItem) => {
    const itemKey = getItemKey(item);
    const isPackBased = item.variant.management_mode === 'pack_based';
    const step = isPackBased ? 1 : getVariantStep(item.variant);
    const targetQty = Number((item.quantity + step).toFixed(4));

    if (targetQty > item.variant.stock_quantity) {
      error(`Stock-ku kuma filna. Waxaa haray kaliya ${item.variant.stock_quantity} ${item.variant.selling_unit}.`);
      return;
    }

    const safeQty = Math.min(item.variant.stock_quantity, targetQty);
    updateCartItemQuantity(itemKey, safeQty, String(safeQty));
  };

  // Quantity Decrement (-) button
  const handleDecrement = (item: CartItem) => {
    const itemKey = getItemKey(item);
    const isPackBased = item.variant.management_mode === 'pack_based';
    const step = isPackBased ? 1 : getVariantStep(item.variant);
    const targetQty = Number((item.quantity - step).toFixed(4));

    if (targetQty < step - 0.0001) {
      return;
    }

    const safeQty = Math.max(step, targetQty);
    updateCartItemQuantity(itemKey, safeQty, String(safeQty));
  };

  // Direct Quantity input typing
  const handleQuantityInputChange = (itemKey: string, rawVal: string) => {
    const item = cart.find(i => getItemKey(i) === itemKey);
    if (!item) return;

    const parsed = parseFloat(rawVal);

    if (rawVal === '' || isNaN(parsed) || parsed <= 0) {
      setCart(prev => prev.map(i => {
        if (getItemKey(i) === itemKey) {
          return {
            ...i,
            quantityInput: rawVal,
          };
        }
        return i;
      }));
      return;
    }

    const cappedQty = Math.min(item.variant.stock_quantity, parsed);
    setCart(prev => prev.map(i => {
      if (getItemKey(i) === itemKey) {
        const pMode = i.pricing_mode || i.variant?.pricing_mode || 'fixed';
        const sPrice = i.sosPrice ?? i.variant?.sos_price;
        const line = calculateCartItemLine(i.unitPrice, i.unitCost, cappedQty, i.discount, pMode, sPrice);
        return {
          ...i,
          quantity: cappedQty,
          quantityInput: rawVal,
          pricing_mode: pMode,
          sosPrice: sPrice,
          sosTotal: line.sosTotal,
          totalPrice: line.totalPrice,
          grossProfit: line.grossProfit,
        };
      }
      return i;
    }));
  };

  // Validate on input blur
  const handleQuantityInputBlur = (itemKey: string) => {
    const item = cart.find(i => getItemKey(i) === itemKey);
    if (!item) return;

    const isPackBased = item.variant.management_mode === 'pack_based';
    const step = isPackBased ? 1 : getVariantStep(item.variant);
    const rawVal = item.quantityInput !== undefined ? item.quantityInput.trim() : String(item.quantity);
    const parsed = parseFloat(rawVal);

    if (rawVal === '' || isNaN(parsed) || parsed <= 0) {
      const fallback = item.variant.stock_quantity < 1 ? step : (step <= 1 ? 1 : step);
      const safeQty = Math.min(item.variant.stock_quantity, fallback);
      updateCartItemQuantity(itemKey, safeQty, String(safeQty));
      return;
    }

    if (parsed > item.variant.stock_quantity) {
      error(`Stock-ku kuma filna. Waxaa haray kaliya ${item.variant.stock_quantity} ${item.variant.selling_unit}.`);
      updateCartItemQuantity(itemKey, item.variant.stock_quantity, String(item.variant.stock_quantity));
      return;
    }

    if (parsed < step - 0.0001) {
      error(`Tirada ugu yar ee la iibin karo waa ${step} ${item.variant.selling_unit}.`);
      updateCartItemQuantity(itemKey, step, String(step));
      return;
    }

    if (!isPackBased) {
      const validation = isValidSellableQuantity(parsed, step, item.variant.selling_unit);
      if (!validation.valid) {
        error(validation.reason || 'Tirada ma aha qeyb sax ah');
        const snapped = Number((Math.max(1, Math.round(parsed / step)) * step).toFixed(4));
        const safeSnapped = Math.min(item.variant.stock_quantity, snapped);
        updateCartItemQuantity(itemKey, safeSnapped, String(safeSnapped));
        return;
      }
    }

    const safeQty = Number(parsed.toFixed(4));
    updateCartItemQuantity(itemKey, safeQty, String(safeQty));
  };

  // Quick fractional / bag step addition
  const handleAddQuickQty = (item: CartItem, addQty: number) => {
    const itemKey = getItemKey(item);
    const targetQty = Number((item.quantity + addQty).toFixed(4));
    if (targetQty > item.variant.stock_quantity) {
      error(`Stock-ku kuma filna. Waxaa haray kaliya ${item.variant.stock_quantity} ${item.variant.selling_unit}.`);
      updateCartItemQuantity(itemKey, item.variant.stock_quantity, String(item.variant.stock_quantity));
      return;
    }
    updateCartItemQuantity(itemKey, targetQty, String(targetQty));
  };

  const removeFromCart = (itemKey: string) => {
    setCart(prev => prev.filter(item => getItemKey(item) !== itemKey));
  };

  const clearCart = () => {
    setCart([]);
    setOverallDiscount('');
    setAmountPaidInput('');
    setSelectedCustomerId('');
    setNotes('');
  };

  // Execute Sale Checkout with Full Validation
  const handleCheckout = async () => {
    if (cart.length === 0) {
      error('Dambiisha waxba kuma jiraan!');
      return;
    }

    // Strict validation of fractional units, oil liters and remaining stock before submission
    for (const item of cart) {
      const isOil = item.variant?.management_mode === 'amount_based' || item.actual_quantity_used !== undefined;
      const isPack = item.variant?.management_mode === 'pack_based';
      const step = isPack ? 1 : getVariantStep(item.variant);

      if (isOil) {
        const liters = item.actual_quantity_used !== undefined ? Number(item.actual_quantity_used) : 0;
        if (liters <= 0) {
          error(`Qalad qiyaasta litirrada: "${item.product.name}" (${item.selling_option_label || 'Saliid'}) — Fadlan geli qiyaas sax ah.`);
          return;
        }
      } else {
        if (item.quantity <= 0) {
          error(`Qalad tirada: "${item.product.name}" (${item.variant.variant_name}) — Fadlan geli tiro sax ah.`);
          return;
        }
        if (!isPack) {
          const val = isValidSellableQuantity(item.quantity, step, item.variant.selling_unit);
          if (!val.valid) {
            error(`Qalad tirada: "${item.product.name}" (${item.variant.variant_name}): ${val.reason}`);
            return;
          }
        }
      }
    }

    // Validate cumulative stock requirement per variant
    const variantUsageMap: Record<string, { totalRequired: number; unit: string; name: string; available: number }> = {};
    for (const item of cart) {
      const vId = item.variant.id;
      const isOil = item.variant?.management_mode === 'amount_based' || item.actual_quantity_used !== undefined;
      const qtyUsed = isOil ? Number(item.actual_quantity_used || 0) : Number(item.quantity);

      if (!variantUsageMap[vId]) {
        variantUsageMap[vId] = {
          totalRequired: 0,
          unit: item.variant.selling_unit,
          name: item.product.name,
          available: Number(item.variant.stock_quantity),
        };
      }
      variantUsageMap[vId].totalRequired += qtyUsed;
    }

    for (const [vId, usage] of Object.entries(variantUsageMap)) {
      if (usage.totalRequired > usage.available) {
        error(`Stock-ku kuma filna "${usage.name}". Waxaa la doonayaa ${usage.totalRequired} ${usage.unit}, laakiin waxaa haray kaliya ${usage.available} ${usage.unit}.`);
        return;
      }
    }

    if (paymentMethod === 'credit' || paymentMethod === 'partial') {
      if (!selectedCustomerId && (!newCustName.trim() || !newCustPhone.trim())) {
        error('Daynta ama Qeyb-bixintu waxay u baahan tahay macmiil (Dooro ama Geli Magaca & Tel)!');
        setIsNewCustomerModalOpen(true);
        return;
      }
    }

    const numDiscount = parseFloat(overallDiscount) || 0;
    const numPaid = paymentMethod === 'cash' ? totals.totalAmount : (parseFloat(amountPaidInput) || 0);

    try {
      const sale = await repository.executeSale({
        cartItems: cart,
        paymentMethod,
        overallDiscount: numDiscount,
        amountPaid: numPaid,
        customerId: selectedCustomerId || undefined,
        newCustomer: newCustName && newCustPhone ? { name: newCustName, phone: newCustPhone } : undefined,
        dueDate: paymentMethod !== 'cash' ? dueDate : undefined,
        notes: saleNotes,
      });

      setCompletedSale(sale);
      success('Iibka waa la dhameystiray!', `Wadarta: ${formatMoney(sale.total_amount)}`);
      clearCart();
      await loadData();
    } catch (err: any) {
      error('Khalad baa dhacay', err.message);
    }
  };

  // Calculate remaining stock for oil modal
  const getOilRemainingStock = (variant: ProductVariant | null): number => {
    if (!variant) return 0;
    const currentUsageInCart = cart
      .filter(i => i.variant.id === variant.id)
      .reduce((sum, i) => sum + (i.actual_quantity_used ?? i.quantity), 0);
    return Math.max(0, Number((variant.stock_quantity - currentUsageInCart).toFixed(4)));
  };

  const oilRemaining = getOilRemainingStock(selectedOilVariant);
  const parsedLiterQty = parseFloat(oilLiterQuantity) || 0;

  const currentOilOption = isCustomOilOption 
    ? {
        id: 'custom',
        label: customOilLabel || `${customOilAmount} ${customOilCurrency}`,
        amount: parseFloat(customOilAmount) || 0,
        currency: customOilCurrency,
      }
    : selectedOilOption;

  const currentOilCalc = (selectedOilVariant && currentOilOption && currentOilOption.amount > 0)
    ? calculateOilMoneyToLiters(currentOilOption.amount, currentOilOption.currency || 'SOS', selectedOilVariant.sell_price)
    : { amountUsd: 0, litersSold: 0, displayText: '0 L' };

  const isOilLiterStockExceeded = oilSellingMethod === 'liter' && (parsedLiterQty <= 0 || parsedLiterQty > oilRemaining);
  const isOilMoneyStockExceeded = oilSellingMethod === 'money' && (currentOilCalc.litersSold <= 0 || currentOilCalc.litersSold > oilRemaining);
  const isOilStockExceeded = isOilLiterStockExceeded || isOilMoneyStockExceeded;

  return (
    <AppShell title="Iibka / POS">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================== */}
        {/* LEFT COLUMN: PRODUCT SELECTION & SEARCH (7 COLS)        */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search Bar & Barcode Scanner Button */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <Input
                ref={searchInputRef}
                placeholder="Raadi alaabta, nooca (variant), barcode..."
                className="pl-10 h-11 bg-white dark:bg-slate-900 text-sm font-medium shadow-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            <Button
              variant="outline"
              onClick={() => setIsBarcodeOpen(true)}
              className="h-11 px-3.5 gap-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs"
              title="Fur Kaamirada Barcode-ka"
            >
              <Barcode className="h-5 w-5 text-emerald-600" />
              <span className="hidden sm:inline text-xs font-bold">Scan Barcode</span>
            </Button>
          </div>

          {/* Quick Categories Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              Dhammaan Qaybaha
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === c.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Products & Variants Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {variants.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <p>Alaab laguma helin baadhitaankan</p>
              </div>
            ) : (
              variants.map((v) => {
                const costPerBase = calculateCostPerBaseUnit(v.buy_price, v.conversion_factor);
                const profit = calculateUnitProfit(v.sell_price, costPerBase);
                const isOutOfStock = v.stock_quantity <= 0;
                const minSellable = getVariantStep(v);
                const isPack = v.management_mode === 'pack_based';
                const isOil = v.management_mode === 'amount_based';
                const packGrams = (v.source_quantity && v.pack_count && v.pack_count > 0)
                  ? Math.round(v.source_quantity / v.pack_count)
                  : 50;

                return (
                  <div
                    key={v.id}
                    className={`group flex flex-col justify-between text-left p-3.5 rounded-2xl border transition-all relative overflow-hidden ${
                      isOutOfStock
                        ? 'border-red-200 dark:border-red-950/60 bg-slate-50/80 dark:bg-slate-900/60 opacity-60'
                        : isOil 
                          ? 'border-amber-200/90 dark:border-amber-900/60 bg-white dark:bg-slate-900 hover:border-amber-500 hover:shadow-md'
                          : isPack
                            ? 'border-blue-200/90 dark:border-blue-900/60 bg-white dark:bg-slate-900 hover:border-blue-500 hover:shadow-md'
                            : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 hover:shadow-md'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (isOutOfStock) {
                          error(`Lama iibin karo — alaabta "${v.product?.name} (${v.variant_name})" way dhammaatay (🔴 Out of Stock).`);
                          return;
                        }
                        if (isOil) {
                          openOilModal(v);
                        } else {
                          addToCart(v);
                        }
                      }}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-bold text-slate-900 dark:text-white text-xs line-clamp-1">
                          {v.product?.name}
                        </p>
                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded shrink-0 ${
                          isOutOfStock 
                            ? 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950/80 border border-red-200 dark:border-red-800'
                            : isOil
                              ? 'text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800'
                              : isPack
                                ? 'text-blue-800 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/70 border border-blue-300 dark:border-blue-800'
                                : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60'
                        }`}>
                          {isOutOfStock ? '🔴 Out of Stock' : isOil ? '💧 Saliid' : isPack ? '📦 Baakad' : v.variant_name}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        <span className="text-slate-400">
                          Unit: <strong className="text-slate-700 dark:text-slate-300 uppercase">{v.selling_unit}</strong>
                        </span>
                        <span className="text-slate-400">
                          Kaydka: <strong className={`font-mono ${isOutOfStock ? 'text-red-600 dark:text-red-400 font-black' : 'text-slate-700 dark:text-slate-300'}`}>
                            {v.stock_quantity} {v.selling_unit}
                          </strong>
                        </span>
                      </div>

                      {isPack && (
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                          1 Bac = {packGrams}g ({v.source_quantity || 500}g / {v.pack_count || 10} Bac)
                        </p>
                      )}

                      {isOil && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                          Ikhtiyaarro Lacageed (4k, 5k, 6k, Rubac)
                        </p>
                      )}

                      {!isPack && !isOil && v.unit_division && v.unit_division > 1 && (
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold mt-0.5">
                          Min: {minSellable} {v.selling_unit}
                        </p>
                      )}

                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        {isOil ? (
                          <span className="text-xs font-black text-amber-700 dark:text-amber-400">
                            💧 Dooro Qiimaha
                          </span>
                        ) : v.pricing_mode === 'denomination' && v.sos_price ? (
                          <div>
                            <span className={`text-sm font-black font-mono ${isOutOfStock ? 'text-slate-400 line-through' : 'text-purple-600 dark:text-purple-400'}`}>
                              {formatSos(v.sos_price)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal block">
                              (${calculateSosDenomination(v.sos_price).denominationUsd.toFixed(2)})
                            </span>
                          </div>
                        ) : (
                          <span className={`text-sm font-black font-mono ${isOutOfStock ? 'text-slate-400 line-through' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {formatMoney(v.sell_price)}
                            <span className="text-[10px] text-slate-400 font-normal no-underline">/{v.selling_unit}</span>
                          </span>
                        )}

                        {isOutOfStock ? (
                          <span className="text-[10px] font-bold text-red-500">
                            Lama iibin karo
                          </span>
                        ) : isOil ? (
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.5 rounded">
                            Amount POS
                          </span>
                        ) : v.pricing_mode === 'denomination' ? (
                          <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/80 px-1.5 py-0.5 rounded">
                            Mode A
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500">
                            +{formatMoney(profit)}
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Quick Add Buttons for Pack-based Powder (1 Bac, 2 Bac, 3 Bac, 5 Bac) */}
                    {isPack && !isOutOfStock && (
                      <div className="grid grid-cols-4 gap-1 mt-2 pt-2 border-t border-blue-100 dark:border-blue-900/40">
                        {[1, 2, 3, 5].map((bagQty) => (
                          <button
                            key={bagQty}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(v, bagQty);
                            }}
                            className="py-1 px-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-600 hover:text-white text-blue-700 dark:text-blue-300 rounded text-[10px] font-bold border border-blue-200 dark:border-blue-800 transition-colors text-center"
                            title={`Ku dar ${bagQty} Bac`}
                          >
                            +{bagQty} Bac
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: POS CART & CHECKOUT (5 COLS)              */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-emerald-600" />
              <h3 className="font-black text-slate-900 dark:text-white text-base">
                Dambiisha Iibka ({cart.length})
              </h3>
            </div>

            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-red-500 hover:text-red-700 font-bold"
              >
                Faaruqi
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Dambiishu waa maran tahay. Taabo alaabta bidixda ku taal.
              </div>
            ) : (
              cart.map((item) => {
                const itemKey = getItemKey(item);
                const isOil = item.variant?.management_mode === 'amount_based' || item.actual_quantity_used !== undefined;
                const isPack = item.variant?.management_mode === 'pack_based';
                const step = isPack ? 1 : getVariantStep(item.variant);

                return (
                  <div
                    key={itemKey}
                    className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-slate-900 dark:text-white text-xs">
                            {item.product.name}{' '}
                            <span className={isOil ? "text-amber-600 font-semibold" : "text-emerald-600 font-semibold"}>
                              ({item.selling_option_label || item.variant.variant_name})
                            </span>
                          </p>

                          {isOil ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              💧 Saliid: {item.selling_option_label || 'Amount Option'}
                            </span>
                          ) : isPack ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                              📦 Pack: {item.quantity} Bac
                            </span>
                          ) : item.pricing_mode === 'denomination' ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              Mode A: {formatSos(item.sosPrice || 0)} SOS
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                              Mode B: Fixed
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-slate-400 font-mono">
                          {isOil ? (
                            <>Qiyaasta: <strong className="text-slate-800 dark:text-slate-200 font-bold">{item.actual_quantity_used} L</strong> | Qiimaha: {item.selling_option_label}</>
                          ) : item.pricing_mode === 'denomination' ? (
                            <>Qiimaha: {formatSos(item.sosPrice || 0)} SOS/{item.variant.selling_unit} (${formatMoney(item.unitPrice)})</>
                          ) : (
                            <>{formatMoney(item.unitPrice)}/{item.variant.selling_unit}</>
                          )} | Faa'iido: +{formatMoney(item.grossProfit)}
                        </p>
                      </div>

                      <button
                        onClick={() => removeFromCart(itemKey)}
                        className="text-slate-400 hover:text-red-600 p-1"
                        title="Ka saar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Oil Actual Liters Editing in Cart */}
                    {isOil ? (
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                            Litirrada La Shubay:
                          </label>
                          <Input
                            type="number"
                            step="0.05"
                            min="0.1"
                            value={item.actual_quantity_used ?? 1.25}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              updateCartItemActualLiters(itemKey, val);
                            }}
                            className="h-7 w-20 text-center font-mono font-bold text-xs p-1 bg-white dark:bg-slate-900 border-amber-300"
                          />
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">L</span>
                        </div>

                        <div className="text-right">
                          <span className="font-mono font-black text-slate-900 dark:text-white text-sm block">
                            {formatMoney(item.totalPrice)}
                          </span>
                          {item.pricing_mode === 'denomination' && (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 font-mono block">
                              {formatSos(item.sosTotal || 0)} SOS
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Standard & Pack-based Quantity Controls */
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDecrement(item)}
                            disabled={item.quantity <= step}
                            className="h-7 w-7 flex items-center justify-center rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            title={`Jar ${step} ${item.variant.selling_unit}`}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>

                          <Input
                            type="text"
                            inputMode="decimal"
                            value={item.quantityInput !== undefined ? item.quantityInput : item.quantity}
                            onChange={(e) => handleQuantityInputChange(itemKey, e.target.value)}
                            onBlur={() => handleQuantityInputBlur(itemKey)}
                            className="h-7 w-20 text-center font-mono font-bold text-xs p-1 bg-white dark:bg-slate-900"
                          />

                          <button
                            type="button"
                            onClick={() => handleIncrement(item)}
                            disabled={item.quantity >= item.variant.stock_quantity}
                            className="h-7 w-7 flex items-center justify-center rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            title={`Ku dar ${step} ${item.variant.selling_unit}`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>

                          {/* Fractional Quick Steps */}
                          {step < 1 ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleAddQuickQty(item, step)}
                                className="h-7 px-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                                title={`Ku dar ${step} ${item.variant.selling_unit}`}
                              >
                                +{step}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddQuickQty(item, Number((step * 2).toFixed(4)))}
                                className="h-7 px-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                                title={`Ku dar ${Number((step * 2).toFixed(4))} ${item.variant.selling_unit}`}
                              >
                                +{Number((step * 2).toFixed(4))}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddQuickQty(item, 1)}
                                className="h-7 px-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                                title={`Ku dar 1 ${item.variant.selling_unit}`}
                              >
                                +1
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleAddQuickQty(item, 1)}
                                className="h-7 px-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                                title={`Ku dar 1 ${item.variant.selling_unit}`}
                              >
                                +1
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddQuickQty(item, 5)}
                                className="h-7 px-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                                title={`Ku dar 5 ${item.variant.selling_unit}`}
                              >
                                +5
                              </button>
                            </>
                          )}
                          <span className="text-[10px] text-slate-500 font-mono font-bold uppercase ml-0.5">
                            {item.variant.selling_unit}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="font-mono font-black text-slate-900 dark:text-white text-sm block">
                            {formatMoney(item.totalPrice)}
                          </span>
                          {item.pricing_mode === 'denomination' && (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 font-mono block">
                              {formatSos(item.sosTotal || 0)} SOS
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Habka Bixinta (Payment Method)</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'cash', label: 'Caddaan (Cash)' },
                { id: 'credit', label: 'Dayn (Credit)' },
                { id: 'partial', label: 'Qeyb (Partial)' },
              ].map((pm) => (
                <button
                  key={pm.id}
                  onClick={() => setPaymentMethod(pm.id as any)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                    paymentMethod === pm.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {pm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Customer Selection (Optional for Cash, Required for Credit/Partial) */}
          {(paymentMethod === 'credit' || paymentMethod === 'partial') && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <label className="font-bold text-amber-900 dark:text-amber-300">Macmiilka Daynta *</label>
                <button
                  onClick={() => setIsNewCustomerModalOpen(true)}
                  className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <UserPlus className="h-3 w-3" /> Macmiil Cusub
                </button>
              </div>

              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-amber-300 bg-white dark:bg-slate-900 px-3 py-1 text-xs"
              >
                <option value="">Dooro Macmiil Joogto ah...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-medium text-slate-600 dark:text-slate-400">Lacagta La Bixiyey ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amountPaidInput}
                    onChange={(e) => setAmountPaidInput(e.target.value)}
                    className="h-8 font-mono font-bold bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-600 dark:text-slate-400">Ballanta (Due Date)</label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-8 font-mono text-xs bg-white dark:bg-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Discount & Totals Summary */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            {totals.hasDenominationItems && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 space-y-1 text-[11px]">
                <div className="flex items-center justify-between font-bold text-amber-900 dark:text-amber-300">
                  <span>Qiimaha Alaabta (SOS Value):</span>
                  <span className="font-mono">{formatSos(totals.totalSos)} SOS</span>
                </div>
                <div className="flex items-center justify-between text-amber-800 dark:text-amber-300">
                  <span>Denomination-ka La Bixinayo:</span>
                  <span className="font-mono font-bold">${formatMoney(totals.denominationUsd)} ({formatSos(totals.denominationSos)} SOS)</span>
                </div>
                {totals.differenceSos > 0 && (
                  <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
                    <span>Farqiga Dhiman (Difference):</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-300">+{formatSos(totals.differenceSos)} SOS</span>
                  </div>
                )}
                {totals.fixedSubtotal > 0 && (
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 pt-1 border-t border-amber-200/50">
                    <span>Alaabta Fixed Price:</span>
                    <span className="font-mono">{formatMoney(totals.fixedSubtotal)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Subtotal:</span>
              <span className="font-mono">{formatMoney(totals.subtotal)}</span>
            </div>

            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>Qiimo Dhimis Guud ($):</span>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={overallDiscount}
                onChange={(e) => setOverallDiscount(e.target.value)}
                className="h-7 w-20 text-right font-mono text-xs p-1"
              />
            </div>

            <div className="flex justify-between text-base font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
              <span>WADARTA GUUD:</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                {formatMoney(totals.totalAmount)}
              </span>
            </div>

            {paymentMethod === 'partial' && (
              <div className="flex justify-between text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950/40 p-2 rounded-lg">
                <span>Haraaga Daynta:</span>
                <span className="font-mono">{formatMoney(Math.max(0, totals.totalAmount - (parseFloat(amountPaidInput) || 0)))}</span>
              </div>
            )}
          </div>

          {/* Checkout Button */}
          <Button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-md shadow-emerald-600/20"
          >
            Dhameystir Iibka ({formatMoney(totals.totalAmount)})
          </Button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* OIL / DUAL-MODE SELLING MODAL (LITER & MONEY AMOUNT)      */}
      {/* ======================================================== */}
      <Dialog open={isOilModalOpen} onOpenChange={setIsOilModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-base">
            <Droplet className="h-5 w-5 text-amber-600" />
            Iibka Saliidda (Cooking Oil POS)
          </DialogTitle>
          <DialogDescription>
            Dooro habka iibka: <strong>Litir toos ah (Liter)</strong> ama <strong>Lacag go'an (Money: 3k, 4k, 5k, Rubac...)</strong>
          </DialogDescription>
        </DialogHeader>

        {selectedOilVariant && (
          <div className="space-y-4 py-2 text-xs">
            {/* Product & Stock Status Card */}
            <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900 flex items-center justify-between">
              <div>
                <p className="font-black text-slate-900 dark:text-white text-sm">
                  {selectedOilVariant.product?.name} ({selectedOilVariant.variant_name})
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Qiimaha Litirka: <strong className="text-emerald-700 dark:text-emerald-300 font-mono font-bold">${selectedOilVariant.sell_price.toFixed(2)} / L</strong>
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Kaydka Haray:</span>
                <span className={`text-sm font-black font-mono ${oilRemaining <= 2 ? 'text-red-600' : 'text-amber-700 dark:text-amber-300'}`}>
                  {oilRemaining} L
                </span>
              </div>
            </div>

            {/* Two Selling Methods Segmented Tab Switcher */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setOilSellingMethod('liter')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  oilSellingMethod === 'liter'
                    ? 'bg-emerald-600 text-white shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Droplet className="h-3.5 w-3.5" />
                <span>SECTION 1: BY LITER</span>
              </button>

              <button
                type="button"
                onClick={() => setOilSellingMethod('money')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  oilSellingMethod === 'money'
                    ? 'bg-amber-600 text-white shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <DollarSign className="h-3.5 w-3.5" />
                <span>SECTION 2: BY MONEY</span>
              </button>
            </div>

            {/* SECTION 1: BY LITER */}
            {oilSellingMethod === 'liter' && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-emerald-200 dark:border-emerald-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900 dark:text-white text-xs block">
                    Geli ama Dooro Tirada Litirrada (Quantity in Liters):
                  </label>
                </div>

                <div className="relative">
                  <Input
                    type="number"
                    step="0.05"
                    min="0.05"
                    placeholder="1.0"
                    value={oilLiterQuantity}
                    onChange={(e) => setOilLiterQuantity(e.target.value)}
                    className={`h-11 text-center font-mono font-black text-base bg-white dark:bg-slate-900 ${
                      isOilLiterStockExceeded ? 'border-red-500 text-red-600 focus:ring-red-500' : 'border-emerald-400 focus:ring-emerald-500'
                    }`}
                  />
                  <span className="absolute right-3.5 top-3 text-xs font-black text-slate-500">LITERS</span>
                </div>

                {/* Quick Liter Preset Chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-slate-400 font-bold mr-1">Qiyaasaha:</span>
                  {[0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((quickL) => (
                    <button
                      key={quickL}
                      type="button"
                      onClick={() => setOilLiterQuantity(String(quickL))}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                        parsedLiterQty === quickL
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-emerald-50'
                      }`}
                    >
                      {quickL} L
                    </button>
                  ))}
                </div>

                {/* Realtime Liter Calculation Preview */}
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-medium">
                  <div>
                    <span className="text-slate-500">Wadarta Qiimaha: </span>
                    <strong className="text-emerald-700 dark:text-emerald-300 font-mono font-black text-sm">
                      {formatMoney(parsedLiterQty * selectedOilVariant.sell_price)}
                    </strong>
                    <span className="text-[10px] text-slate-400 ml-1 font-mono">
                      ({parsedLiterQty} L × ${selectedOilVariant.sell_price.toFixed(2)}/L)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px]">Stock Haraya: </span>
                    <strong className="font-mono text-slate-800 dark:text-slate-200">
                      {Math.max(0, Number((oilRemaining - parsedLiterQty).toFixed(4)))} L
                    </strong>
                  </div>
                </div>

                {/* Stock Insufficiency Warning */}
                {isOilLiterStockExceeded && (
                  <div className="p-2 bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300 text-[11px] font-bold">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                      Stock-ga saliidda kuma filna! Waxaa haray kaliya {oilRemaining} L, laakiin waxaad isku dayday {parsedLiterQty} L.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 2: BY MONEY AMOUNT */}
            {oilSellingMethod === 'money' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    Dooro Lacagta (Money Selling Option):
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomOilOption(!isCustomOilOption)}
                    className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    {isCustomOilOption ? '← Dooro Qiimo Diyaarsan' : '+ Geli Qiimo Kale'}
                  </button>
                </div>

                {!isCustomOilOption ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {((selectedOilVariant.selling_options && selectedOilVariant.selling_options.length > 0)
                      ? selectedOilVariant.selling_options
                      : [
                          { id: 'opt-3k', label: '3,000 SOS', amount: 3000, currency: 'SOS' },
                          { id: 'opt-4k', label: '4,000 SOS', amount: 4000, currency: 'SOS' },
                          { id: 'opt-5k', label: '5,000 SOS', amount: 5000, currency: 'SOS' },
                          { id: 'opt-6k', label: '6,000 SOS', amount: 6000, currency: 'SOS' },
                          { id: 'opt-7k', label: '7,000 SOS', amount: 7000, currency: 'SOS' },
                          { id: 'opt-rubac-50', label: 'Rubac weyn $0.50', amount: 0.50, currency: '$' },
                          { id: 'opt-rubac-45', label: 'Rubac weyn $0.45', amount: 0.45, currency: '$' },
                        ]
                    ).map((opt) => {
                      const isSelected = selectedOilOption?.id === opt.id || selectedOilOption?.label === opt.label;
                      const optCalc = calculateOilMoneyToLiters(opt.amount, opt.currency || 'SOS', selectedOilVariant.sell_price);

                      return (
                        <button
                          key={opt.id || opt.label}
                          type="button"
                          onClick={() => setSelectedOilOption(opt)}
                          className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                            isSelected
                              ? 'border-amber-600 bg-amber-500 text-white shadow-xs font-black'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-400 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <span className="text-xs font-bold">{opt.label}</span>
                          <span className={`text-[10px] mt-1 font-mono font-bold ${isSelected ? 'text-amber-100' : 'text-amber-600 dark:text-amber-400'}`}>
                            = {optCalc.litersSold} L
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Lacagta (Amount) *</label>
                        <Input
                          type="number"
                          placeholder="Tusaale: 5000 ama 0.50"
                          value={customOilAmount}
                          onChange={(e) => setCustomOilAmount(e.target.value)}
                          className="mt-1 font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Nooca Lacagta *</label>
                        <select
                          value={customOilCurrency}
                          onChange={(e) => setCustomOilCurrency(e.target.value as any)}
                          className="flex h-9 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-xs mt-1"
                        >
                          <option value="SOS">SOS (Shilin Soomaali)</option>
                          <option value="$">USD ($ Dollar)</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Magaca Ikhtiyaarka (Ikhtiyaari)</label>
                      <Input
                        placeholder="Tusaale: 5,000 SOS ama Rubac weyn"
                        value={customOilLabel}
                        onChange={(e) => setCustomOilLabel(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}

                {/* Dynamic Money-to-Liter Calculation Card */}
                {(() => {
                  const targetAmt = isCustomOilOption ? parseFloat(customOilAmount) || 0 : (selectedOilOption?.amount || 0);
                  const targetCurr = isCustomOilOption ? customOilCurrency : (selectedOilOption?.currency || 'SOS');
                  const calc = calculateOilMoneyToLiters(targetAmt, targetCurr, selectedOilVariant.sell_price);
                  const isStockShort = calc.litersSold > oilRemaining;

                  return (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200 block">
                            Xaddiga Litirrada ee U Dhigma (Calculated Liters):
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            ${calc.amountUsd.toFixed(2)} ÷ ${selectedOilVariant.sell_price.toFixed(2)}/L = {calc.litersSold} L
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-black font-mono text-amber-800 dark:text-amber-300 block">
                            {calc.litersSold} L
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Stock haraya: {Math.max(0, Number((oilRemaining - calc.litersSold).toFixed(4)))} L
                          </span>
                        </div>
                      </div>

                      {isStockShort && (
                        <div className="p-2 bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300 text-[11px] font-bold">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>
                            Stock-ga saliidda kuma filna! Waxaa haray kaliya {oilRemaining} L, laakiin lacagtani waxay u baahan tahay {calc.litersSold} L.
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setIsOilModalOpen(false)}>
            Ka noqo
          </Button>
          <Button
            onClick={handleAddOilToCart}
            disabled={!selectedOilVariant || isOilStockExceeded || (oilSellingMethod === 'liter' && parsedLiterQty <= 0)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black"
          >
            {oilSellingMethod === 'liter'
              ? `Ku dar Dambiisha (${parsedLiterQty} L - ${formatMoney(parsedLiterQty * (selectedOilVariant?.sell_price || 1.5))})`
              : `Ku dar Dambiisha (${(isCustomOilOption ? customOilLabel || 'Lacag' : selectedOilOption?.label) || 'Lacag'} -> ${currentOilCalc.litersSold} L)`}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* QUICK CUSTOMER CREATE MODAL */}
      <Dialog open={isNewCustomerModalOpen} onOpenChange={setIsNewCustomerModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
            <UserPlus className="h-5 w-5 text-emerald-600" />
            Diiwaangeli Macmiil Cusub
          </DialogTitle>
          <DialogDescription>
            Xogta macmiilka daynta qaadanaya
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Magaca Macmiilka *</label>
            <Input
              placeholder="Tusaale: Axmed Cali"
              value={newCustName}
              onChange={(e) => setNewCustName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Taleefanka *</label>
            <Input
              placeholder="61xxxxxxx"
              value={newCustPhone}
              onChange={(e) => setNewCustPhone(e.target.value)}
              className="mt-1 font-mono"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setIsNewCustomerModalOpen(false)}>
            Ka noqo
          </Button>
          <Button
            onClick={async () => {
              if (newCustName.trim() && newCustPhone.trim()) {
                try {
                  const c = await repository.createCustomer({ name: newCustName, phone: newCustPhone });
                  setSelectedCustomerId(c.id);
                  setIsNewCustomerModalOpen(false);
                  await loadData();
                } catch (err: any) {
                  error('Khalad baa dhacay', err.message);
                }
              }
            }}
            className="bg-emerald-600 text-white font-bold"
          >
            Keydi & Dooro
          </Button>
        </DialogFooter>
      </Dialog>

      {/* BARCODE SCANNER MODAL */}
      <BarcodeScannerModal
        isOpen={isBarcodeOpen}
        onClose={() => setIsBarcodeOpen(false)}
        onScan={async (code) => {
          const match = await repository.findVariantByBarcode(code);
          if (match) {
            addToCart(match, 1);
            setIsBarcodeOpen(false);
          } else {
            error(`Alaab leh barcode "${code}" laguma helin kaydka.`);
          }
        }}
      />

      {/* THERMAL PRINTABLE RECEIPT MODAL */}
      <ReceiptModal
        isOpen={!!completedSale}
        onClose={() => setCompletedSale(null)}
        sale={completedSale}
      />
    </AppShell>
  );
}
