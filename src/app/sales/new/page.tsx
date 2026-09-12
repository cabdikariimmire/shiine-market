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
  Calendar
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
  getVariantStep,
  isValidSellableQuantity 
} from '@/lib/calculations/stock';
import { CartItem, Category, Customer, PaymentMethod, ProductVariant, Sale } from '@/types';

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

  // Helper to update confirmed cart quantity and line total
  const updateCartItemQuantity = (variantId: string, quantity: number, quantityInput?: string) => {
    setCart(prev => prev.map(i => {
      if (i.variant.id === variantId) {
        const pMode = i.pricing_mode || i.variant?.pricing_mode || 'fixed';
        const sPrice = i.sosPrice ?? i.variant?.sos_price;
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

  // Add Variant to Cart with Fractional & Minimum Sellable Quantity Validation
  const addToCart = (variant: ProductVariant, customAddQty?: number) => {
    const step = getVariantStep(variant);

    if (variant.stock_quantity <= 0) {
      error(`Lama iibin karo — "${variant.product?.name} (${variant.variant_name})" way dhammaatay (🔴 Out of Stock)!`);
      return;
    }

    if (variant.stock_quantity < step) {
      error(`Lama iibin karo — Kaydka haray (${variant.stock_quantity} ${variant.selling_unit}) wuxuu ka yar yahay qiyaasta ugu yar ee la iibin karo (${step} ${variant.selling_unit}).`);
      return;
    }

    // Default quantity when adding is 1 (or step if available stock is less than 1)
    const defaultAdd = customAddQty !== undefined 
      ? customAddQty 
      : (variant.stock_quantity < 1 ? step : 1);

    const existingIndex = cart.findIndex(item => item.variant.id === variant.id);
    const existingQty = existingIndex !== -1 ? cart[existingIndex].quantity : 0;
    const targetQty = Number((existingQty + defaultAdd).toFixed(4));

    if (targetQty > variant.stock_quantity) {
      error(`Stock-ku kuma filna "${variant.product?.name} (${variant.variant_name})". Waxaa haray kaliya ${variant.stock_quantity} ${variant.selling_unit}.`);
      return;
    }

    const validation = isValidSellableQuantity(targetQty, step, variant.selling_unit);
    if (!validation.valid) {
      error(validation.reason || 'Tirada ma aha qeyb sax ah');
      return;
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

  // Quantity Increment (+) button using dynamic fractional step
  const handleIncrement = (item: CartItem) => {
    const step = getVariantStep(item.variant);
    const targetQty = Number((item.quantity + step).toFixed(4));

    if (targetQty > item.variant.stock_quantity) {
      error(`Stock-ku kuma filna. Waxaa haray kaliya ${item.variant.stock_quantity} ${item.variant.selling_unit}.`);
      return;
    }

    const safeQty = Math.min(item.variant.stock_quantity, targetQty);
    updateCartItemQuantity(item.variant.id, safeQty, String(safeQty));
  };

  // Quantity Decrement (-) button using dynamic fractional step (stops at step)
  const handleDecrement = (item: CartItem) => {
    const step = getVariantStep(item.variant);
    const targetQty = Number((item.quantity - step).toFixed(4));

    // When '-' reaches the minimum allowed quantity, stop there (do not go below step, do not delete item)
    if (targetQty < step - 0.0001) {
      return;
    }

    const safeQty = Math.max(step, targetQty);
    updateCartItemQuantity(item.variant.id, safeQty, String(safeQty));
  };

  // Direct Quantity input typing (allows deleting '1' temporarily without crashing or removing item)
  const handleQuantityInputChange = (variantId: string, rawVal: string) => {
    const item = cart.find(i => i.variant.id === variantId);
    if (!item) return;

    const parsed = parseFloat(rawVal);

    if (rawVal === '' || isNaN(parsed) || parsed <= 0) {
      // Keep cart item alive with temporary input string
      setCart(prev => prev.map(i => {
        if (i.variant.id === variantId) {
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
      if (i.variant.id === variantId) {
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
  const handleQuantityInputBlur = (variantId: string) => {
    const item = cart.find(i => i.variant.id === variantId);
    if (!item) return;

    const step = getVariantStep(item.variant);
    const rawVal = item.quantityInput !== undefined ? item.quantityInput.trim() : String(item.quantity);
    const parsed = parseFloat(rawVal);

    if (rawVal === '' || isNaN(parsed) || parsed <= 0) {
      const fallback = item.variant.stock_quantity < 1 ? step : (step <= 1 ? 1 : step);
      const safeQty = Math.min(item.variant.stock_quantity, fallback);
      updateCartItemQuantity(variantId, safeQty, String(safeQty));
      return;
    }

    if (parsed > item.variant.stock_quantity) {
      error(`Stock-ku kuma filna. Waxaa haray kaliya ${item.variant.stock_quantity} ${item.variant.selling_unit}.`);
      updateCartItemQuantity(variantId, item.variant.stock_quantity, String(item.variant.stock_quantity));
      return;
    }

    if (parsed < step - 0.0001) {
      error(`Tirada ugu yar ee la iibin karo waa ${step} ${item.variant.selling_unit}.`);
      updateCartItemQuantity(variantId, step, String(step));
      return;
    }

    const validation = isValidSellableQuantity(parsed, step, item.variant.selling_unit);
    if (!validation.valid) {
      error(validation.reason || 'Tirada ma aha qeyb sax ah');
      // Snap to nearest valid step multiple
      const snapped = Number((Math.max(1, Math.round(parsed / step)) * step).toFixed(4));
      const safeSnapped = Math.min(item.variant.stock_quantity, snapped);
      updateCartItemQuantity(variantId, safeSnapped, String(safeSnapped));
      return;
    }

    const safeQty = Number(parsed.toFixed(4));
    updateCartItemQuantity(variantId, safeQty, String(safeQty));
  };

  // Quick fractional step addition (+0.25, +0.5, +1, +5)
  const handleAddQuickQty = (item: CartItem, addQty: number) => {
    const targetQty = Number((item.quantity + addQty).toFixed(4));
    if (targetQty > item.variant.stock_quantity) {
      error(`Stock-ku kuma filna. Waxaa haray kaliya ${item.variant.stock_quantity} ${item.variant.selling_unit}.`);
      updateCartItemQuantity(item.variant.id, item.variant.stock_quantity, String(item.variant.stock_quantity));
      return;
    }
    updateCartItemQuantity(item.variant.id, targetQty, String(targetQty));
  };

  // Update Cart Line Price or Discount
  const updateCartPrice = (variantId: string, newPrice: number) => {
    setCart(prev => prev.map(item => {
      if (item.variant.id === variantId) {
        const line = calculateCartItemLine(newPrice, item.unitCost, item.quantity, item.discount);
        return {
          ...item,
          unitPrice: newPrice,
          totalPrice: line.totalPrice,
          grossProfit: line.grossProfit,
        };
      }
      return item;
    }));
  };

  const removeFromCart = (variantId: string) => {
    setCart(prev => prev.filter(item => item.variant.id !== variantId));
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

    // Strict validation of fractional units and remaining stock before submission
    for (const item of cart) {
      const step = getVariantStep(item.variant);
      if (item.quantity <= 0) {
        error(`Qalad tirada: "${item.product.name}" (${item.variant.variant_name}) — Fadlan geli tiro sax ah.`);
        return;
      }
      const val = isValidSellableQuantity(item.quantity, step, item.variant.selling_unit);
      if (!val.valid) {
        error(`Qalad tirada: "${item.product.name}" (${item.variant.variant_name}): ${val.reason}`);
        return;
      }
      if (item.quantity > item.variant.stock_quantity) {
        error(`Stock-ku kuma filna "${item.product.name} (${item.variant.variant_name})". Waxaa haray kaliya ${item.variant.stock_quantity} ${item.variant.selling_unit}.`);
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

                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      if (isOutOfStock) {
                        error(`Lama iibin karo — alaabta "${v.product?.name} (${v.variant_name})" way dhammaatay (🔴 Out of Stock).`);
                        return;
                      }
                      addToCart(v);
                    }}
                    className={`group flex flex-col justify-between text-left p-3.5 rounded-2xl border transition-all relative overflow-hidden ${
                      isOutOfStock
                        ? 'border-red-200 dark:border-red-950/60 bg-slate-50/80 dark:bg-slate-900/60 opacity-60 cursor-not-allowed'
                        : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-bold text-slate-900 dark:text-white text-xs line-clamp-1">
                          {v.product?.name}
                        </p>
                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded shrink-0 ${
                          isOutOfStock 
                            ? 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950/80 border border-red-200 dark:border-red-800'
                            : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60'
                        }`}>
                          {isOutOfStock ? '🔴 Out of Stock' : v.variant_name}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        <span className="text-slate-400">
                          Unit: <strong className="text-slate-700 dark:text-slate-300 uppercase">{v.selling_unit}</strong>
                        </span>
                        <span className="text-slate-400">
                          Kaydka: <strong className={`font-mono ${isOutOfStock ? 'text-red-600 dark:text-red-400 font-black' : 'text-slate-700 dark:text-slate-300'}`}>{v.stock_quantity} {v.selling_unit}</strong>
                        </span>
                      </div>

                      {v.unit_division && v.unit_division > 1 && (
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold mt-0.5">
                          Min: {minSellable} {v.selling_unit}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      {v.pricing_mode === 'denomination' && v.sos_price ? (
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

          {/* Cart Items List (Supports Bulk Decimal Quantities) */}
          <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Dambiishu waa maran tahay. Taabo alaabta bidixda ku taal.
              </div>
            ) : (
              cart.map((item) => {
                const step = getVariantStep(item.variant);

                return (
                  <div
                    key={item.variant.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-slate-900 dark:text-white text-xs">
                            {item.product.name} <span className="text-emerald-600">({item.variant.variant_name})</span>
                          </p>
                          {item.pricing_mode === 'denomination' ? (
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
                          {item.pricing_mode === 'denomination' ? (
                            <>Qiimaha: {formatSos(item.sosPrice || 0)} SOS/{item.variant.selling_unit} (${formatMoney(item.unitPrice)})</>
                          ) : (
                            <>{formatMoney(item.unitPrice)}/{item.variant.selling_unit}</>
                          )} | Faa'iido: +{formatMoney(item.grossProfit)}
                        </p>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.variant.id)}
                        className="text-slate-400 hover:text-red-600 p-1"
                        title="Ka saar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Decimal Quantity Controls */}
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
                          onChange={(e) => handleQuantityInputChange(item.variant.id, e.target.value)}
                          onBlur={() => handleQuantityInputBlur(item.variant.id)}
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
