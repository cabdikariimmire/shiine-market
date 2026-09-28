'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { 
  CreditCard, 
  Search, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Calendar as CalendarIcon, 
  User, 
  Eye, 
  Phone,
  PhoneCall,
  Plus,
  Minus,
  Trash2,
  Clock,
  AlertTriangle,
  ArrowRight,
  FileText,
  Edit,
  History,
  RotateCcw,
  Mail,
  Loader2,
  ShoppingBag,
  Package,
  Receipt,
  Check,
  X,
  Printer
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogBody } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { repository } from '@/lib/services/repository';
import { formatMoney, cleanPrecision } from '@/lib/calculations/financials';
import { formatDate } from '@/lib/utils';
import { Debt, Customer, DebtPayment, ProductVariant, CartItem, Sale } from '@/types';
import { getVariantStep, isValidSellableQuantity, calculateCostPerBaseUnit } from '@/lib/calculations/stock';
import { ReceiptModal } from '@/components/pos/receipt-modal';

export default function DebtsPage() {
  const { success, error } = useToast();
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);

  // Active Tab: 'debts' (Daymaha) vs 'calendar' (Calendar) vs 'payments' (Bixinnada)
  const [activeTab, setActiveTab] = useState<'debts' | 'calendar' | 'payments'>('debts');

  // Debts List State
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  // Calendar State
  const [calendarData, setCalendarData] = useState<{
    dueToday: Debt[];
    upcoming: Debt[];
    overdue: Debt[];
  }>({ dueToday: [], upcoming: [], overdue: [] });

  const [allDebts, setAllDebts] = useState<Debt[]>([]);
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [catalogVariants, setCatalogVariants] = useState<ProductVariant[]>([]);

  // Payment Modal State
  const [selectedDebtForPay, setSelectedDebtForPay] = useState<Debt | null>(null);
  const [paymentToday, setPaymentToday] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('evc_plus');
  const [payNotes, setPayNotes] = useState<string>('');

  // ==========================================
  // PRODUCT-BASED CREATE DEBT STATE
  // ==========================================
  const [isCreateDebtOpen, setIsCreateDebtOpen] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [debtCart, setDebtCart] = useState<CartItem[]>([]);
  const [paidNowInput, setPaidNowInput] = useState<string>('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDebtNotes, setNewDebtNotes] = useState('');
  const [debtPaymentMethod, setDebtPaymentMethod] = useState<string>('cash');
  const [isSubmittingDebt, setIsSubmittingDebt] = useState(false);

  // Product Picker Modal State
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // View Debt Details Modal State
  const [viewingDebt, setViewingDebt] = useState<Debt | null>(null);

  // Confirmation Modal State after creating Debt
  const [savedDebtConfirmation, setSavedDebtConfirmation] = useState<{ debt: Debt; sale: Sale } | null>(null);

  // Receipt Modal State (Print Thermal Receipt)
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<Sale | null>(null);

  // Edit/Correct Debt Modal State (Audit/Correction)
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [editItemsSummary, setEditItemsSummary] = useState('');
  const [editOriginalAmount, setEditOriginalAmount] = useState<string>('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editDebtNotes, setEditDebtNotes] = useState('');
  const [editDebtReason, setEditDebtReason] = useState('');

  // Correct Debt Payment Modal State
  const [correctingPayment, setCorrectingPayment] = useState<DebtPayment | null>(null);
  const [correctPayAmount, setCorrectPayAmount] = useState<string>('');
  const [correctPayMethod, setCorrectPayMethod] = useState<string>('evc_plus');
  const [correctPayNotes, setCorrectPayNotes] = useState<string>('');
  const [correctPayReason, setCorrectPayReason] = useState<string>('');

  // Call Logger Modal State
  const [callDebt, setCallDebt] = useState<Debt | null>(null);
  const [callNote, setCallNote] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [filtered, payments, cal, all, custs, varsRes] = await Promise.all([
        repository.getDebts(statusFilter),
        repository.getDebtPayments(),
        repository.getDebtCalendarSummary(),
        repository.getDebts('all'),
        repository.getCustomers(),
        repository.getVariantsPaginated('', 'all', 'all', 1, 1000),
      ]);
      setDebts(filtered);
      setDebtPayments(payments);
      setCalendarData(cal);
      setAllDebts(all);
      setCustomersList(custs);
      setCatalogVariants(varsRes.data.filter(v => !v.is_pending));
    } catch (err) {
      console.error('Error loading debts:', err);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Overall KPI Metrics
  const totalOriginal = allDebts.reduce((sum, d) => sum + d.original_amount, 0);
  const totalPaid = allDebts.reduce((sum, d) => sum + d.amount_paid, 0);
  const totalRemaining = allDebts.reduce((sum, d) => sum + d.remaining_balance, 0);
  const overdueCount = allDebts.filter(d => d.status === 'overdue').length;

  // Selected existing customer object
  const selectedCustomerObj = useMemo(() => {
    return customersList.find(c => c.id === selectedCustomerId) || null;
  }, [customersList, selectedCustomerId]);

  // Filtered Products in Picker
  const filteredPickerVariants = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return catalogVariants;
    return catalogVariants.filter(v => {
      const pName = (v.product?.name || '').toLowerCase();
      const vName = (v.variant_name || '').toLowerCase();
      const bc = (v.barcode || '').toLowerCase();
      const sku = (v.sku || '').toLowerCase();
      return pName.includes(q) || vName.includes(q) || bc.includes(q) || sku.includes(q);
    });
  }, [catalogVariants, pickerSearch]);

  // Debt Cart Totals
  const cartSubtotal = useMemo(() => {
    return debtCart.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [debtCart]);

  const paidNowNum = parseFloat(paidNowInput) || 0;
  const isOverpaid = paidNowNum > cartSubtotal;
  const cartRemainingDebt = Math.max(0, cleanPrecision(cartSubtotal - paidNowNum));

  // Open Create Debt Modal
  const handleOpenCreateDebt = () => {
    setIsCreateDebtOpen(true);
    setIsNewCustomer(false);
    setSelectedCustomerId('');
    setNewCustName('');
    setNewCustPhone('');
    setDebtCart([]);
    setPaidNowInput('');
    setNewDebtNotes('');
    setDebtPaymentMethod('cash');
    // Default due date to 7 days ahead
    setNewDueDate(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
  };

  // Add Product to Debt Cart
  const handleAddProductToCart = (variant: ProductVariant, customQty?: number) => {
    if (variant.stock_quantity <= 0) {
      error(`Kaydka alaabtan kuma filna. "${variant.product?.name || variant.variant_name}" way dhammaatay (Out of Stock)!`);
      return;
    }

    const step = getVariantStep(variant);
    const existingIndex = debtCart.findIndex(item => item.variant.id === variant.id);

    if (existingIndex !== -1) {
      const existing = debtCart[existingIndex];
      const targetQty = Number((existing.quantity + (customQty !== undefined ? customQty : step)).toFixed(4));

      if (targetQty > variant.stock_quantity) {
        error(`Kaydka alaabtan kuma filna. Waxaa haray kaliya ${variant.stock_quantity} ${variant.selling_unit}.`);
        return;
      }

      const newLineTotal = Math.round(targetQty * existing.unitPrice * 100) / 100;
      const newLineCost = Math.round(targetQty * existing.unitCost * 100) / 100;

      setDebtCart(prev => prev.map((item, idx) => {
        if (idx === existingIndex) {
          return {
            ...item,
            quantity: targetQty,
            totalPrice: newLineTotal,
            grossProfit: Math.round((newLineTotal - newLineCost) * 100) / 100,
          };
        }
        return item;
      }));

      success(`Waxaa la kordhiyey: ${variant.product?.name || variant.variant_name} (${targetQty} ${variant.selling_unit})`);
    } else {
      const initialQty = customQty !== undefined ? customQty : (variant.stock_quantity < 1 ? step : (step < 1 ? step : 1));

      if (initialQty > variant.stock_quantity) {
        error(`Kaydka alaabtan kuma filna. Waxaa haray kaliya ${variant.stock_quantity} ${variant.selling_unit}.`);
        return;
      }

      const costPerBase = variant.cost_per_unit || calculateCostPerBaseUnit(variant.buy_price, variant.conversion_factor, variant);
      const lineTotal = Math.round(initialQty * variant.sell_price * 100) / 100;
      const lineCost = Math.round(initialQty * costPerBase * 100) / 100;

      const newItem: CartItem = {
        cartItemId: `${variant.id}_debt_${Date.now()}`,
        product: variant.product || { id: variant.product_id, name: variant.variant_name, created_at: '', updated_at: '' },
        variant,
        quantity: initialQty,
        quantityInput: String(initialQty),
        unitPrice: variant.sell_price,
        unitCost: costPerBase,
        discount: 0,
        totalPrice: lineTotal,
        grossProfit: Math.round((lineTotal - lineCost) * 100) / 100,
      };

      setDebtCart(prev => [...prev, newItem]);
      success(`Ku daray: ${variant.product?.name || variant.variant_name} (${initialQty} ${variant.selling_unit})`);
    }
  };

  // Update item quantity in debt cart
  const handleUpdateCartItemQty = (variantId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveCartItem(variantId);
      return;
    }

    const item = debtCart.find(i => i.variant.id === variantId);
    if (!item) return;

    if (newQty > item.variant.stock_quantity) {
      error(`Kaydka alaabtan kuma filna. Waxaa haray kaliya ${item.variant.stock_quantity} ${item.variant.selling_unit}.`);
      return;
    }

    const roundedQty = Number(newQty.toFixed(4));
    const newLineTotal = Math.round(roundedQty * item.unitPrice * 100) / 100;
    const newLineCost = Math.round(roundedQty * item.unitCost * 100) / 100;

    setDebtCart(prev => prev.map(i => {
      if (i.variant.id === variantId) {
        return {
          ...i,
          quantity: roundedQty,
          quantityInput: String(roundedQty),
          totalPrice: newLineTotal,
          grossProfit: Math.round((newLineTotal - newLineCost) * 100) / 100,
        };
      }
      return i;
    }));
  };

  // Remove item from debt cart
  const handleRemoveCartItem = (variantId: string) => {
    setDebtCart(prev => prev.filter(i => i.variant.id !== variantId));
  };

  // Save Product-Based Debt Transaction
  const handleSaveProductDebt = async () => {
    // 1. Customer validation
    if (!isNewCustomer && !selectedCustomerId) {
      error('Fadlan dooro macmiilka ama riix "+ Macmiil Cusub"');
      return;
    }
    if (isNewCustomer && (!newCustName.trim() || !newCustPhone.trim())) {
      error('Fadlan geli magaca iyo taleefanka macmiilka cusub');
      return;
    }

    // 2. Cart items validation
    if (debtCart.length === 0) {
      error('Fadlan ku dar ugu yaraan hal alaab oo macmiilku qaatay');
      return;
    }

    // 3. Overpayment validation
    if (isOverpaid) {
      error('Lacagta la bixiyey kama badnaan karto wadarta daynta.');
      return;
    }

    // 4. Stock validation
    for (const item of debtCart) {
      if (item.quantity > item.variant.stock_quantity) {
        error(`Kaydka alaabtan kuma filna. (${item.product?.name || item.variant?.variant_name})`);
        return;
      }
    }

    setIsSubmittingDebt(true);
    try {
      const res = await repository.createProductDebtTransaction({
        customerId: isNewCustomer ? undefined : selectedCustomerId,
        customerName: isNewCustomer ? newCustName.trim() : undefined,
        customerPhone: isNewCustomer ? newCustPhone.trim() : undefined,
        items: debtCart,
        amountPaidInitially: paidNowNum,
        dueDate: newDueDate || undefined,
        notes: newDebtNotes.trim() || undefined,
        paymentMethod: debtPaymentMethod,
      });

      setIsCreateDebtOpen(false);
      setSavedDebtConfirmation(res);
      success(
        'Daynta si guul leh ayaa loo keydiyey!',
        `${res.debt.customer?.name} - Wadarta: ${formatMoney(res.debt.original_amount)}`
      );

      // Reset cart and reload
      setDebtCart([]);
      setSelectedCustomerId('');
      setIsNewCustomer(false);
      setNewCustName('');
      setNewCustPhone('');
      setPaidNowInput('');
      setNewDebtNotes('');
      await loadData();
    } catch (err: any) {
      error('Khalad baa dhacay', err.message);
    } finally {
      setIsSubmittingDebt(false);
    }
  };

  // Open Payment Modal
  const handleOpenPay = (debt: Debt) => {
    setSelectedDebtForPay(debt);
    setPaymentToday(String(debt.remaining_balance));
    setPayNotes('');
  };

  // Submit Payment
  const handleRecordPayment = async () => {
    if (!selectedDebtForPay) return;
    const numPay = parseFloat(paymentToday);
    if (isNaN(numPay) || numPay <= 0) {
      error('Lacagta la bixinayo waa inay ka weynaataa 0');
      return;
    }

    try {
      await repository.recordDebtPayment({
        customer_id: selectedDebtForPay.customer_id,
        debt_id: selectedDebtForPay.id,
        amount: numPay,
        payment_method: paymentMethod,
        notes: payNotes,
      });

      success('Bixinta daynta waa la diiwaangeliyey!', `${formatMoney(numPay)} ayaa lagu daray lacagaha soo xarooday (Cash Received).`);
      setSelectedDebtForPay(null);
      await loadData();
      if (viewingDebt && viewingDebt.id === selectedDebtForPay.id) {
        const refreshed = await repository.getDebtById(selectedDebtForPay.id);
        if (refreshed) setViewingDebt(refreshed);
      }
    } catch (err: any) {
      error('Khalad baa dhacay', err.message);
    }
  };

  // Open Edit Debt Modal (for legacy/audit corrections)
  const handleOpenEditDebt = (d: Debt) => {
    setEditingDebt(d);
    setEditItemsSummary(d.items_summary || '');
    setEditOriginalAmount(String(d.original_amount));
    setEditDueDate(d.due_date || '');
    setEditDebtNotes(d.notes || '');
    setEditDebtReason('');
  };

  // Save Edit/Correct Debt
  const handleSaveEditDebt = async () => {
    if (!editingDebt) return;
    const numAmt = parseFloat(editOriginalAmount);
    if (isNaN(numAmt) || numAmt < 0) {
      error('Geli wadarta saxda ah ee daynta');
      return;
    }

    try {
      await repository.correctDebt(editingDebt.id, {
        itemsSummary: editItemsSummary.trim(),
        originalAmount: numAmt,
        dueDate: editDueDate,
        notes: editDebtNotes.trim(),
      }, editDebtReason.trim() || 'Wax ka beddel dayn');

      success('Xogta daynta si guul leh ayaa loo saxay', `Wadarta cusub: ${formatMoney(numAmt)}`);
      setEditingDebt(null);
      await loadData();
    } catch (err: any) {
      error('Lama sixi karin daynta', err.message);
    }
  };

  // Open Correct Payment Modal
  const handleOpenCorrectPayment = (p: DebtPayment) => {
    setCorrectingPayment(p);
    setCorrectPayAmount(String(p.amount));
    setCorrectPayMethod(p.payment_method || 'evc_plus');
    setCorrectPayNotes(p.notes || '');
    setCorrectPayReason('');
  };

  // Save Correct Payment
  const handleSaveCorrectPayment = async () => {
    if (!correctingPayment) return;
    const numAmt = parseFloat(correctPayAmount);
    if (isNaN(numAmt) || numAmt <= 0) {
      error('Geli cadadka saxda ah ee lacagta (> 0)');
      return;
    }

    try {
      await repository.correctDebtPayment(correctingPayment.id, {
        amount: numAmt,
        paymentMethod: correctPayMethod,
        notes: correctPayNotes.trim(),
      }, correctPayReason.trim() || 'Sixid lacag-bixinta daynta');

      success('Lacag-bixinta si guul leh ayaa loo saxay', `Cadadka cusub: ${formatMoney(numAmt)}`);
      setCorrectingPayment(null);
      await loadData();
    } catch (err: any) {
      error('Lama sixi karin lacag-bixinta', err.message);
    }
  };

  // Record Phone Call Log
  const handleSaveCallLog = async () => {
    if (!callDebt || !callNote.trim()) return;

    try {
      await repository.recordCallLog(callDebt.id, callNote);
      success('Qoraalka wicitaanka waa la keydiyey', callDebt.customer?.name);
      setCallDebt(null);
      setCallNote('');
      await loadData();
    } catch (err: any) {
      error('Khalad baa dhacay', err.message);
    }
  };

  // Send Single Debt Reminder via Resend Email
  const handleSendDebtReminder = async (debt: Debt) => {
    try {
      setSendingReminderId(debt.id);
      const res = await repository.triggerDebtReminderAlert(debt);
      if (res.skipped) {
        success('Digniinta waa la diray horay', res.reason || 'Email-ka dayntan waxaa la diray 24-kii saac ee la soo dhaafay.');
      } else if (res.success) {
        success('Xasuusinta daynta waa la diray!', `Email xasuusin ah ayaa loo diray: ${debt.customer?.name || 'Macmiil'}`);
      } else {
        error('Diritaanka xasuusinta wuu fashilmay', res.error || 'Fadlan hubi email settings.');
      }
    } catch (err: any) {
      error('Khalad', err.message || 'Lama diri karin xasuusinta');
    } finally {
      setSendingReminderId(null);
    }
  };

  const filteredDebts = debts.filter(d => {
    const q = search.toLowerCase();
    const cName = (d.customer?.name || '').toLowerCase();
    const cPhone = (d.customer?.phone || '').toLowerCase();
    const items = (d.items_summary || '').toLowerCase();
    return cName.includes(q) || cPhone.includes(q) || items.includes(q);
  });

  return (
    <AppShell title="Debts">
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="h-6 w-6 text-emerald-600" />
              Maamulka Daymaha & Calendar-ka ({debts.length})
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Kormeerka xisaabaadka daymaha, jadwal bixinta, alaabaha lagu qaatay iyo lacagaha soo xarooday
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              onClick={handleOpenCreateDebt}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20"
            >
              <Plus className="h-4 w-4" />
              Diiwaangeli Dayn Cusub
            </Button>
          </div>
        </div>

        {/* Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <p className="text-xs font-bold text-slate-400 uppercase">Wadarta Daymaha Guud</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
              {formatMoney(totalOriginal)}
            </p>
            <p className="text-[11px] text-slate-500">Iibka daynta lagu bixiyey</p>
          </Card>

          <Card className="p-4 border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs">
            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">Lacagta La Helay (Paid)</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
              {formatMoney(totalPaid)}
            </p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Cash received from debts</p>
          </Card>

          <Card className="p-4 border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20 shadow-xs">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase">Daynta Hadda Maqan (Balance)</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
              {formatMoney(totalRemaining)}
            </p>
            <p className="text-[11px] text-amber-700 dark:text-amber-300">Haraaga dukaanka ka maqan</p>
          </Card>

          <Card className="p-4 border border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20 shadow-xs">
            <p className="text-xs font-bold text-red-800 dark:text-red-300 uppercase">Waa Dhacday (Overdue)</p>
            <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1 font-mono">
              {overdueCount}
            </p>
            <p className="text-[11px] text-red-700 dark:text-red-300">Muddadii la ballamay dhaaftay</p>
          </Card>
        </div>

        {/* TABS: [Daymaha] vs [Calendar] vs [Bixinnada] */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('debts')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'debts'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            Daymaha (Debts Table)
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'calendar'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <CalendarIcon className="h-4 w-4" />
            Calendar-ka Daymaha (Due Date Tracker)
            {overdueCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {overdueCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'payments'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <History className="h-4 w-4" />
            Taariikhda Bixinta Daymaha (Payments)
          </button>
        </div>

        {/* TAB 1: DAYMAHA TABLE */}
        {activeTab === 'debts' && (
          <div className="space-y-4">
            {/* Filter Pills & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'all', label: 'Dhammaan Daymaha' },
                  { id: 'unpaid', label: 'Waa Taagan Tahay (Unpaid)' },
                  { id: 'partial', label: 'Qeyb La Bixiyey (Partial)' },
                  { id: 'overdue', label: 'Waa Dhacday (Overdue)' },
                  { id: 'paid', label: 'Waa La Bixiyey (Paid)' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      statusFilter === f.id
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Ka baadh macmiilka, tel..."
                  className="pl-9 h-9 text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Debts Table */}
            <Card className="border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3.5">Lambar</th>
                      <th className="px-4 py-3.5">Macmiilka (Customer)</th>
                      <th className="px-4 py-3.5">Alaabta La Qaatay</th>
                      <th className="px-4 py-3.5 text-right">Wadarta</th>
                      <th className="px-4 py-3.5 text-right">La Bixiyey</th>
                      <th className="px-4 py-3.5 text-right">Haraaga (Remaining)</th>
                      <th className="px-4 py-3.5 text-center">Xaaladda</th>
                      <th className="px-4 py-3.5">Muddada (Due Date)</th>
                      <th className="px-4 py-3.5 text-right">Hawlaha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {filteredDebts.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-slate-400">
                          Dayn laguma helin shuruudahan
                        </td>
                      </tr>
                    ) : (
                      filteredDebts.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-4 font-mono font-bold text-slate-900 dark:text-white">
                            <button
                              onClick={() => setViewingDebt(d)}
                              className="hover:underline text-emerald-600 font-mono"
                              title="Arag taariikhda iyo alaabta"
                            >
                              #{d.id.slice(-6).toUpperCase()}
                            </button>
                          </td>

                          <td className="px-4 py-4">
                            <button
                              onClick={() => setViewingDebt(d)}
                              className="font-bold text-slate-900 dark:text-white hover:underline text-left"
                            >
                              {d.customer?.name || 'Macmiil'}
                            </button>
                            {d.customer?.phone && (
                              <a href={`tel:${d.customer.phone}`} className="text-[11px] font-mono text-emerald-600 hover:underline flex items-center gap-1 mt-0.5">
                                <Phone className="h-3 w-3" /> {d.customer.phone}
                              </a>
                            )}
                          </td>

                          <td className="px-4 py-4 text-xs text-slate-600 dark:text-slate-400 max-w-[220px] truncate" title={d.items_summary || ''}>
                            {d.items_summary || 'Dayn Alaabeed'}
                          </td>

                          <td className="px-4 py-4 text-right font-mono text-slate-500">
                            {formatMoney(d.original_amount)}
                          </td>

                          <td className="px-4 py-4 text-right font-mono text-emerald-600 font-bold">
                            {formatMoney(d.amount_paid)}
                          </td>

                          <td className="px-4 py-4 text-right font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                            {formatMoney(d.remaining_balance)}
                          </td>

                          <td className="px-4 py-4 text-center">
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                              d.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : d.status === 'overdue'
                                ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-black animate-pulse'
                                : d.status === 'partial'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              {d.status === 'paid' ? 'Waa La Bixiyey' : d.status === 'overdue' ? 'Waa Dhacday (Overdue)' : d.status === 'partial' ? 'Qeyb La Bixiyey' : 'Waa Taagan Tahay'}
                            </span>
                          </td>

                          <td className="px-4 py-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                            {d.due_date || '—'}
                          </td>

                          <td className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* VIEW DETAILS BUTTON */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setViewingDebt(d)}
                                className="h-7 px-2 text-xs font-bold text-slate-600 hover:text-emerald-600 gap-1"
                                title="Arag xogta iyo alaabaha"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Eeg</span>
                              </Button>

                              {d.remaining_balance > 0 && (
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenPay(d)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-7 px-2.5 text-xs shadow-xs"
                                >
                                  Bixi Dayn
                                </Button>
                              )}

                              {d.remaining_balance > 0 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={sendingReminderId === d.id}
                                  onClick={() => handleSendDebtReminder(d)}
                                  className="h-7 px-2 text-xs font-bold text-slate-600 hover:text-emerald-600 gap-1"
                                  title="Dir Email Xasuusin Dayn ah"
                                >
                                  {sendingReminderId === d.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                                  ) : (
                                    <Mail className="h-3.5 w-3.5 text-slate-500 hover:text-emerald-600" />
                                  )}
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenEditDebt(d)}
                                className="h-7 px-1.5 text-xs text-slate-500 hover:text-emerald-600"
                                title="Wax ka beddel daynta"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>

                              {d.customer?.phone && (
                                <a
                                  href={`tel:${d.customer.phone}`}
                                  onClick={() => setCallDebt(d)}
                                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 hover:text-emerald-600 hover:bg-slate-50"
                                  title="Wac Macmiilka"
                                >
                                  <PhoneCall className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 2: DEBT CALENDAR */}
        {activeTab === 'calendar' && (
          <div className="space-y-6">
            {/* 1. DUE TODAY */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Maanta Lagu Ballamay (Due Today) ({calendarData.dueToday.length})
              </h3>

              {calendarData.dueToday.length === 0 ? (
                <Card className="p-6 text-center text-xs text-slate-400">
                  Maanta ma jirto dayn lagu ballamay
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {calendarData.dueToday.map((d) => (
                    <Card key={d.id} className="p-4 border-l-4 border-l-amber-500 shadow-xs space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm">{d.customer?.name}</p>
                          <a href={`tel:${d.customer?.phone}`} className="text-xs font-mono text-emerald-600 flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3" /> {d.customer?.phone}
                          </a>
                        </div>
                        <span className="text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-md">
                          Maanta
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <p className="text-slate-400">Haraaga:</p>
                          <p className="font-mono font-black text-amber-600 dark:text-amber-400 text-base">
                            {formatMoney(d.remaining_balance)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" onClick={() => setViewingDebt(d)} variant="ghost" className="h-7 px-2 text-xs">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" onClick={() => handleOpenPay(d)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-7 px-2 text-xs">
                            Bixi
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* 2. OVERDUE */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Waa Dhacday (Overdue) ({calendarData.overdue.length})
              </h3>

              {calendarData.overdue.length === 0 ? (
                <Card className="p-6 text-center text-xs text-slate-400">
                  Ma jirto dayn xilligeedii dhaaftay ✓
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {calendarData.overdue.map((d) => (
                    <Card key={d.id} className="p-4 border-l-4 border-l-red-500 shadow-xs space-y-3 bg-red-50/20 dark:bg-red-950/10">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm">{d.customer?.name}</p>
                          <a href={`tel:${d.customer?.phone}`} className="text-xs font-mono text-emerald-600 flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3" /> {d.customer?.phone}
                          </a>
                        </div>
                        <span className="text-[10px] font-black bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 px-2 py-0.5 rounded-md font-mono">
                          {d.due_date}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <p className="text-slate-400">Haraaga:</p>
                          <p className="font-mono font-black text-red-600 dark:text-red-400 text-base">
                            {formatMoney(d.remaining_balance)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" onClick={() => setViewingDebt(d)} variant="ghost" className="h-7 px-2 text-xs">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" onClick={() => handleOpenPay(d)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-7 px-2 text-xs">
                            Bixi
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* 3. UPCOMING */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-emerald-600" />
                Kuwa Soo Socda (Upcoming) ({calendarData.upcoming.length})
              </h3>

              {calendarData.upcoming.length === 0 ? (
                <Card className="p-6 text-center text-xs text-slate-400">
                  Ma jiraan daymo kale oo soo socda
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {calendarData.upcoming.map((d) => (
                    <Card key={d.id} className="p-4 border-l-4 border-l-blue-500 shadow-xs space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm">{d.customer?.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{d.customer?.phone}</p>
                        </div>
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 rounded-md font-mono">
                          {d.due_date}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <p className="text-slate-400">Haraaga:</p>
                          <p className="font-mono font-black text-slate-900 dark:text-white text-base">
                            {formatMoney(d.remaining_balance)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" onClick={() => setViewingDebt(d)} variant="ghost" className="h-7 px-2 text-xs">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" onClick={() => handleOpenPay(d)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-7 px-2 text-xs">
                            Bixi
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: DEBT PAYMENTS HISTORY */}
        {activeTab === 'payments' && (
          <Card className="border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <History className="h-4 w-4 text-emerald-600" />
                Dhammaan Diiwaanka Bixinta Daymaha ({debtPayments.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Lambar / ID</th>
                    <th className="px-4 py-3">Taariikhda</th>
                    <th className="px-4 py-3">Macmiilka</th>
                    <th className="px-4 py-3 text-right">Cadadka La Bixiyey</th>
                    <th className="px-4 py-3">Habka Lacagta</th>
                    <th className="px-4 py-3">Qoraal / Notes</th>
                    <th className="px-4 py-3 text-right">Hawlaha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {debtPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        Weli ma jirto lacag bixin la diiwaangeliyey
                      </td>
                    </tr>
                  ) : (
                    debtPayments.map((p) => {
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                            #{p.id.slice(-6).toUpperCase()}
                          </td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                            {formatDate(p.created_at)}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                            {p.customer?.name || 'Macmiil'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                            {formatMoney(p.amount)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 uppercase">
                              {p.payment_method}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">
                            {p.notes || '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenCorrectPayment(p)}
                              className="h-7 px-2 text-xs font-bold text-slate-600 hover:text-emerald-600 gap-1"
                              title="Sax lacag-bixintan"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              <span>Sax</span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ========================================================================= */}
        {/* MODAL: PRODUCT-BASED CREATE DEBT TRANSACTION                             */}
        {/* ========================================================================= */}
        <Dialog open={isCreateDebtOpen} onOpenChange={setIsCreateDebtOpen} maxWidth="max-w-3xl">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    DIIWAANGELI DAYN CUSUB
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Dooro macmiilka iyo alaabaha dukaanka ee uu daynta ku qaatay
                  </DialogDescription>
                </div>
              </div>
              <DialogClose onClick={() => setIsCreateDebtOpen(false)} />
            </div>
          </DialogHeader>

          <DialogBody className="space-y-5 p-4 sm:p-6 overflow-y-auto max-h-[75vh]">
            {/* 1. CUSTOMER SECTION */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-4 w-4 text-emerald-600" />
                  Macmiilka (Customer) *
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsNewCustomer(!isNewCustomer);
                    setSelectedCustomerId('');
                  }}
                  className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
                >
                  {isNewCustomer ? (
                    <>← Dooro Macmiil Hore</>
                  ) : (
                    <><Plus className="h-3.5 w-3.5" /> Macmiil Cusub</>
                  )}
                </button>
              </div>

              {!isNewCustomer ? (
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Dooro macmiil hore u diiwaangashan
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full mt-1 h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-bold focus:outline-emerald-600"
                  >
                    <option value="">-- Dooro Macmiil --</option>
                    {customersList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone}) {c.remaining_debt && c.remaining_debt > 0 ? `— Haraaga Hadda: $${c.remaining_debt}` : ''}
                      </option>
                    ))}
                  </select>

                  {selectedCustomerObj && (
                    <div className="mt-2.5 p-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{selectedCustomerObj.name}</p>
                        <p className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300">{selectedCustomerObj.phone}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Haraaga Hore:</span>
                        <p className="font-mono font-black text-amber-600 dark:text-amber-400">
                          {formatMoney(selectedCustomerObj.remaining_debt || 0)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Magaca Macmiilka Cusub *</label>
                    <Input
                      placeholder="Tusaale: Cali Faarax"
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Taleefanka (Mobile) *</label>
                    <Input
                      placeholder="61xxxxxxx"
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                      className="mt-1 h-9 text-xs font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 col-span-full">
                    * Haddii lambarkan hore u jiray, nidaamku si toos ah ayuu ugu darayaa macmiilkaas hore iyadoo aan la abuurin laba macmiil oo isku mid ah.
                  </p>
                </div>
              )}
            </div>

            {/* 2. SELECTED PRODUCTS SECTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-emerald-600" />
                  ALAABAHA UU QAATAY ({debtCart.length}) *
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setPickerSearch('');
                    setIsProductPickerOpen(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 px-3 text-xs flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ku dar Alaab
                </Button>
              </div>

              {debtCart.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                  <Package className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    Weli ma jirto wax alaab ah oo lagu daray dayntan
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Guji badhanka <strong className="text-emerald-600 font-bold">&quot;Ku dar Alaab&quot;</strong> si aad uga doorato alaabaha dukaanka yaalla.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPickerSearch('');
                      setIsProductPickerOpen(true);
                    }}
                    className="mt-2 text-xs font-bold"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Dooro Alaabta
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {debtCart.map((item) => {
                    const step = getVariantStep(item.variant);
                    const isExceedingStock = item.quantity > item.variant.stock_quantity;

                    return (
                      <div
                        key={item.cartItemId || item.variant.id}
                        className={`p-3 rounded-xl border transition-all ${
                          isExceedingStock
                            ? 'border-red-400 bg-red-50/30 dark:bg-red-950/20'
                            : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate">
                              {item.product?.name || item.variant?.variant_name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                              <span className="font-mono text-emerald-600 font-bold">
                                {formatMoney(item.unitPrice)} / {item.variant?.selling_unit}
                              </span>
                              <span>•</span>
                              <span>Kaydka: {item.variant?.stock_quantity} {item.variant?.selling_unit}</span>
                            </div>
                            {isExceedingStock && (
                              <p className="text-[11px] font-bold text-red-600 mt-1 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Kaydka alaabtan kuma filna.
                              </p>
                            )}
                          </div>

                          {/* Stepper & Controls */}
                          <div className="flex items-center justify-between sm:justify-end gap-3">
                            <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800">
                              <button
                                type="button"
                                onClick={() => handleUpdateCartItemQty(item.variant.id, item.quantity - step)}
                                className="h-8 w-8 flex items-center justify-center text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <input
                                type="number"
                                step={step}
                                min={step}
                                max={item.variant.stock_quantity}
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val)) handleUpdateCartItemQty(item.variant.id, val);
                                }}
                                className="w-14 h-8 text-center text-xs font-bold font-mono bg-white dark:bg-slate-900 border-x border-slate-200 dark:border-slate-700 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateCartItemQty(item.variant.id, item.quantity + step)}
                                className="h-8 w-8 flex items-center justify-center text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <span className="text-xs font-bold text-slate-500 uppercase min-w-[32px]">
                              {item.variant.selling_unit}
                            </span>

                            <div className="text-right min-w-[70px]">
                              <p className="text-xs font-mono font-black text-slate-900 dark:text-white">
                                {formatMoney(item.totalPrice)}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveCartItem(item.variant.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                              title="Ka saar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. TOTALS & INITIAL PAYMENT */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Subtotal */}
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Wadarta Alaabta (Total Debt)</span>
                  <p className="text-xl font-black font-mono text-slate-900 dark:text-white mt-0.5">
                    {formatMoney(cartSubtotal)}
                  </p>
                </div>

                {/* Amount Paid Now */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                    Lacag uu hadda bixiyey ($)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={paidNowInput}
                    onChange={(e) => setPaidNowInput(e.target.value)}
                    className="mt-1 h-9 font-mono font-bold text-emerald-600"
                  />
                  <div className="flex gap-1.5 mt-1">
                    <button
                      type="button"
                      onClick={() => setPaidNowInput('0')}
                      className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300"
                    >
                      $0 (Dayn buuxda)
                    </button>
                    {cartSubtotal > 0 && (
                      <button
                        type="button"
                        onClick={() => setPaidNowInput(String(cartSubtotal))}
                        className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded hover:bg-emerald-200"
                      >
                        Wadarta (Dhan)
                      </button>
                    )}
                  </div>
                </div>

                {/* Remaining Debt */}
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Haraaga Daynta (Balance)</span>
                  <p className="text-xl font-black font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                    {formatMoney(cartRemainingDebt)}
                  </p>
                </div>
              </div>

              {/* Overpayment Error */}
              {isOverpaid && (
                <div className="p-2.5 bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-lg flex items-center gap-2 text-xs font-bold text-red-700 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Lacagta la bixiyey kama badnaan karto wadarta daynta.
                </div>
              )}

              {/* Due Date & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Ballanta Bixinta (Due Date)
                  </label>
                  <Input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="mt-1 h-9 font-mono text-xs"
                  />
                </div>

                {paidNowNum > 0 && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Habka Lacagta La Bixiyey
                    </label>
                    <select
                      value={debtPaymentMethod}
                      onChange={(e) => setDebtPaymentMethod(e.target.value)}
                      className="w-full mt-1 h-9 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-bold"
                    >
                      <option value="cash">Lacag Caddaan ah (Cash)</option>
                      <option value="evc_plus">EVC Plus (+252 61...)</option>
                      <option value="zaad">ZAAD Service (+252 63...)</option>
                      <option value="sahal">Sahal (+252 90...)</option>
                      <option value="bank">Xawaalad / Bangi</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Qoraal / Faahfaahin (Notes - Optional)
                </label>
                <Input
                  placeholder="Heshiiska daynta, cidda dammaanad qaadday..."
                  value={newDebtNotes}
                  onChange={(e) => setNewDebtNotes(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="border-t pt-3 p-4 sm:p-6 flex flex-row items-center justify-end gap-2 bg-slate-50 dark:bg-slate-900">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateDebtOpen(false)}
              disabled={isSubmittingDebt}
            >
              Jooji
            </Button>
            <Button
              type="button"
              onClick={handleSaveProductDebt}
              disabled={isSubmittingDebt || isOverpaid || debtCart.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20"
            >
              {isSubmittingDebt ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Waa la keydinayaa...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Keydi Daynta ({formatMoney(cartSubtotal)})
                </>
              )}
            </Button>
          </DialogFooter>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL: PRODUCT PICKER FOR DEBT                                            */}
        {/* ========================================================================= */}
        <Dialog open={isProductPickerOpen} onOpenChange={setIsProductPickerOpen} maxWidth="max-w-2xl">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-emerald-600" />
                <DialogTitle className="text-base font-black">
                  Dooro Alaabta (Select Products)
                </DialogTitle>
              </div>
              <DialogClose onClick={() => setIsProductPickerOpen(false)} />
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Ka baadh magaca alaabta, nooca, barcode..."
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
                autoFocus
              />
            </div>
          </DialogHeader>

          <DialogBody className="p-3 sm:p-4 overflow-y-auto max-h-[60vh] space-y-2">
            {filteredPickerVariants.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                Alaab laguma helin raadintan &quot;{pickerSearch}&quot;
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredPickerVariants.map((v) => {
                  const inStock = v.stock_quantity > 0;
                  const inCartItem = debtCart.find(i => i.variant.id === v.id);

                  return (
                    <div
                      key={v.id}
                      onClick={() => {
                        if (inStock) handleAddProductToCart(v);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        !inStock
                          ? 'border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900'
                          : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 hover:shadow-xs cursor-pointer'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 pr-2">
                          <p className="font-bold text-slate-900 dark:text-white text-xs truncate">
                            {v.product?.name}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">{v.variant_name}</p>
                        </div>
                        <span className="font-mono font-black text-emerald-600 text-xs shrink-0">
                          {formatMoney(v.sell_price)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                        <span className={`font-medium ${
                          !inStock
                            ? 'text-red-500 font-bold'
                            : v.stock_quantity <= (v.minimum_stock || 10)
                            ? 'text-amber-600 font-bold'
                            : 'text-slate-500'
                        }`}>
                          {inStock ? `Kaydka: ${v.stock_quantity} ${v.selling_unit}` : 'Dhammaatay (Out of Stock)'}
                        </span>

                        {inCartItem && (
                          <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                            {inCartItem.quantity} {v.selling_unit} ku jira
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DialogBody>

          <DialogFooter className="border-t pt-2 p-3 sm:p-4 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
            <span className="text-xs text-slate-500">
              {debtCart.length} nooc oo alaab ah ayaa ku jira daynta
            </span>
            <Button
              type="button"
              onClick={() => setIsProductPickerOpen(false)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-xs"
            >
              Dhammeystir Xulashada ({formatMoney(cartSubtotal)})
            </Button>
          </DialogFooter>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL: VIEW DEBT TRANSACTION DETAILS (Complete History & Products)       */}
        {/* ========================================================================= */}
        <Dialog open={!!viewingDebt} onOpenChange={(open) => !open && setViewingDebt(null)} maxWidth="max-w-2xl">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                <DialogTitle className="text-base font-black">
                  Faahfaahinta Daynta #{viewingDebt?.id.slice(-6).toUpperCase()}
                </DialogTitle>
              </div>
              <DialogClose onClick={() => setViewingDebt(null)} />
            </div>
            <DialogDescription className="text-xs">
              Taariikhda: {viewingDebt && formatDate(viewingDebt.created_at)} | Xaaladda: <strong className="uppercase">{viewingDebt?.status}</strong>
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4 p-4 sm:p-6 overflow-y-auto max-h-[70vh]">
            {/* Customer Summary Card */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <p className="text-[11px] text-slate-400 uppercase font-bold">Macmiilka</p>
                <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{viewingDebt?.customer?.name}</p>
                {viewingDebt?.customer?.phone && (
                  <p className="font-mono text-emerald-600 mt-0.5 flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {viewingDebt.customer.phone}
                  </p>
                )}
              </div>

              <div className="text-left sm:text-right">
                <p className="text-[11px] text-slate-400 uppercase font-bold">Ballanta Bixinta (Due Date)</p>
                <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                  {viewingDebt?.due_date || 'Lama cayimin'}
                </p>
                {viewingDebt?.notes && (
                  <p className="text-[11px] text-slate-500 italic mt-0.5">{viewingDebt.notes}</p>
                )}
              </div>
            </div>

            {/* Products Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Package className="h-4 w-4 text-emerald-600" />
                Alaabaha Ku Jira Dayntan
              </h4>

              {viewingDebt?.sale?.items && viewingDebt.sale.items.length > 0 ? (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="px-3.5 py-2.5">Alaabta</th>
                        <th className="px-3.5 py-2.5 text-center">Tirada</th>
                        <th className="px-3.5 py-2.5 text-right">Qiimaha</th>
                        <th className="px-3.5 py-2.5 text-right">Wadarta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {viewingDebt.sale.items.map((it) => (
                        <tr key={it.id}>
                          <td className="px-3.5 py-2.5">
                            <p className="font-bold text-slate-900 dark:text-white">
                              {it.product_variant?.product?.name || it.product_variant?.variant_name || 'Alaab'}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {it.product_variant?.variant_name} {it.selling_option_label ? `(${it.selling_option_label})` : ''}
                            </p>
                          </td>
                          <td className="px-3.5 py-2.5 text-center font-mono font-bold">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-slate-500">
                            {formatMoney(it.unit_price)}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-black text-slate-900 dark:text-white">
                            {formatMoney(it.total_price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
                  <p className="text-slate-500">Alaabta la qaatay:</p>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {viewingDebt?.items_summary || 'Alaab guud'}
                  </p>
                </div>
              )}
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-3 gap-2.5 p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Wadarta Daynta:</span>
                <p className="font-mono font-bold text-slate-900 dark:text-white text-sm mt-0.5">
                  {formatMoney(viewingDebt?.original_amount)}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-bold">La Bixiyey:</span>
                <p className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">
                  {formatMoney(viewingDebt?.amount_paid)}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-amber-700 dark:text-amber-300 uppercase font-bold">Haraaga:</span>
                <p className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm mt-0.5">
                  {formatMoney(viewingDebt?.remaining_balance)}
                </p>
              </div>
            </div>

            {/* Payment History on this Debt */}
            {viewingDebt?.payments && viewingDebt.payments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <History className="h-4 w-4 text-emerald-600" />
                  Taariikhda Lacag-bixinta Dayntan
                </h4>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="px-3 py-2">Taariikhda</th>
                        <th className="px-3 py-2 text-right">Cadadka</th>
                        <th className="px-3 py-2">Habka</th>
                        <th className="px-3 py-2">Qoraal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {viewingDebt.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{formatDate(p.created_at)}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600">{formatMoney(p.amount)}</td>
                          <td className="px-3 py-2 uppercase text-[10px]">{p.payment_method}</td>
                          <td className="px-3 py-2 text-slate-400 text-[11px]">{p.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter className="border-t pt-3 p-4 sm:p-6 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
            <div>
              {viewingDebt?.sale && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedSaleForReceipt(viewingDebt.sale || null);
                  }}
                  className="text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Daabac Rasiidh
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {viewingDebt && viewingDebt.remaining_balance > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    handleOpenPay(viewingDebt);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                >
                  Bixi Dayn
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setViewingDebt(null)}>
                Xidh
              </Button>
            </div>
          </DialogFooter>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL: SUCCESS CONFIRMATION RECEIPT (DAYNTA WAA LA KEYDIYAY)             */}
        {/* ========================================================================= */}
        <Dialog open={!!savedDebtConfirmation} onOpenChange={(open) => !open && setSavedDebtConfirmation(null)} maxWidth="max-w-md">
          <DialogHeader className="border-b pb-3 text-center">
            <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 mx-auto flex items-center justify-center mb-2">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <DialogTitle className="text-lg font-black text-slate-900 dark:text-white">
              DAYNTA WAA LA KEYDIYAY
            </DialogTitle>
            <DialogDescription className="text-xs">
              Waxaa si sax ah loo dhimay kaydka dukaanka loona diiwaangeliyey macmiilka.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="p-4 sm:p-6 space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">Macmiilka:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {savedDebtConfirmation?.debt.customer?.name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">Wadarta Daynta:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatMoney(savedDebtConfirmation?.debt.original_amount)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">La Bixiyey:</span>
                <span className="font-mono font-bold text-emerald-600">
                  {formatMoney(savedDebtConfirmation?.debt.amount_paid)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700 font-black">
                <span className="text-slate-700 dark:text-slate-300">Haraaga Daynta:</span>
                <span className="font-mono text-base text-amber-600 dark:text-amber-400">
                  {formatMoney(savedDebtConfirmation?.debt.remaining_balance)}
                </span>
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="border-t pt-3 p-4 flex gap-2">
            <Button
              variant="outline"
              className="flex-1 text-xs font-bold flex items-center justify-center gap-1.5"
              onClick={() => {
                if (savedDebtConfirmation?.sale) {
                  setSelectedSaleForReceipt(savedDebtConfirmation.sale);
                }
              }}
            >
              <Printer className="h-4 w-4" />
              Daabac Rasiidh
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              onClick={() => setSavedDebtConfirmation(null)}
            >
              Dhammeystir
            </Button>
          </DialogFooter>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL: THERMAL PRINTABLE RECEIPT                                          */}
        {/* ========================================================================= */}
        <ReceiptModal
          isOpen={!!selectedSaleForReceipt}
          onClose={() => setSelectedSaleForReceipt(null)}
          sale={selectedSaleForReceipt}
        />

        {/* ========================================================================= */}
        {/* MODAL 1: RECORD DEBT PAYMENT                                              */}
        {/* ========================================================================= */}
        <Dialog open={!!selectedDebtForPay} onOpenChange={(open) => !open && setSelectedDebtForPay(null)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              Diiwaangeli Lacag Bixinta Daynta
            </DialogTitle>
            <DialogDescription>
              Macmiilka: <strong>{selectedDebtForPay?.customer?.name}</strong> | Haraaga Daynta: <strong className="font-mono text-amber-600">{formatMoney(selectedDebtForPay?.remaining_balance)}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Lacagta Maanta La Bixinayo ($) *</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={selectedDebtForPay?.remaining_balance}
                value={paymentToday}
                onChange={(e) => setPaymentToday(e.target.value)}
                className="mt-1 font-mono text-base font-black text-emerald-600"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Habka Lacagta *</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full mt-1 h-9 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-bold"
              >
                <option value="evc_plus">EVC Plus (+252 61...)</option>
                <option value="zaad">ZAAD Service (+252 63...)</option>
                <option value="sahal">Sahal (+252 90...)</option>
                <option value="cash">Lacag Caddaan ah (Cash)</option>
                <option value="bank">Xawaalad / Bangi</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Faahfaahin / Qoraal</label>
              <Input
                placeholder="Tusaale: Trx ID, qofka keenay..."
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setSelectedDebtForPay(null)}>
              Ka noqo
            </Button>
            <Button onClick={handleRecordPayment} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              Keydi Bixinta
            </Button>
          </DialogFooter>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL: EDIT / CORRECT DEBT (AUDIT REASON)                                 */}
        {/* ========================================================================= */}
        <Dialog open={!!editingDebt} onOpenChange={(open) => !open && setEditingDebt(null)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black">
              <Edit className="h-5 w-5 text-emerald-600" />
              Sax Xogta Daynta (Correct Debt)
            </DialogTitle>
            <DialogDescription>
              Macmiilka: <strong>{editingDebt?.customer?.name}</strong>. Nidaamku wuxuu si toos ah u dib-u-xisaabinayaa haraaga daynta iyo xaaladdeeda.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Alaabta La Qaatay (Items Summary)</label>
              <Input
                value={editItemsSummary}
                onChange={(e) => setEditItemsSummary(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Wadarta Guud ee Daynta ($) *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editOriginalAmount}
                  onChange={(e) => setEditOriginalAmount(e.target.value)}
                  className="mt-1 font-mono font-black text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Ballanta (Due Date)</label>
                <Input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Faahfaahin / Notes</label>
              <Input
                value={editDebtNotes}
                onChange={(e) => setEditDebtNotes(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="space-y-1.5 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
              <label className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Sababta Sixitaanka (Audit Reason) *
              </label>
              <Input
                placeholder="Tusaale: Wadarta daynta oo qalad loo qoray, xisaab celin..."
                value={editDebtReason}
                onChange={(e) => setEditDebtReason(e.target.value)}
                className="bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setEditingDebt(null)}>
              Ka noqo
            </Button>
            <Button onClick={handleSaveEditDebt} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              Keydi Isbeddelka
            </Button>
          </DialogFooter>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL: CORRECT DEBT PAYMENT                                               */}
        {/* ========================================================================= */}
        <Dialog open={!!correctingPayment} onOpenChange={(open) => !open && setCorrectingPayment(null)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black">
              <Edit className="h-5 w-5 text-emerald-600" />
              Sax Lacag-bixinta Daynta
            </DialogTitle>
            <DialogDescription>
              Sax cadadka lacagta la bixiyey. Nidaamku wuxuu toos u cusbooneysiinayaa haraaga daynta iyo lacagaha soo xarooday (Cash Received).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Cadadka Saxda ah ($) *</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={correctPayAmount}
                onChange={(e) => setCorrectPayAmount(e.target.value)}
                className="mt-1 font-mono text-base font-black text-emerald-600"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Habka Lacagta *</label>
              <select
                value={correctPayMethod}
                onChange={(e) => setCorrectPayMethod(e.target.value)}
                className="w-full mt-1 h-9 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-bold"
              >
                <option value="evc_plus">EVC Plus (+252 61...)</option>
                <option value="zaad">ZAAD Service (+252 63...)</option>
                <option value="sahal">Sahal (+252 90...)</option>
                <option value="cash">Lacag Caddaan ah (Cash)</option>
                <option value="bank">Xawaalad / Bangi</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Faahfaahin / Qoraal</label>
              <Input
                value={correctPayNotes}
                onChange={(e) => setCorrectPayNotes(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="space-y-1.5 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
              <label className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Sababta Sixitaanka (Audit Reason) *
              </label>
              <Input
                placeholder="Tusaale: Lacagta qalad baa loo qoray..."
                value={correctPayReason}
                onChange={(e) => setCorrectPayReason(e.target.value)}
                className="bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setCorrectingPayment(null)}>
              Ka noqo
            </Button>
            <Button onClick={handleSaveCorrectPayment} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              Keydi Sixitaanka
            </Button>
          </DialogFooter>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL: RECORD PHONE CALL LOG                                              */}
        {/* ========================================================================= */}
        <Dialog open={!!callDebt} onOpenChange={(open) => !open && setCallDebt(null)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black">
              <PhoneCall className="h-5 w-5 text-emerald-600" />
              Diiwaangeli Wicitaanka: {callDebt?.customer?.name}
            </DialogTitle>
            <DialogDescription>
              Qor waxa aad ku wada hadasheen macmiilka iyo ballanta cusub.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="font-medium text-slate-600 dark:text-slate-400">
              Haraaga Daynta: <strong className="font-mono text-slate-900 dark:text-white">{formatMoney(callDebt?.remaining_balance)}</strong> | Ballantii Hore: <span className="font-mono">{callDebt?.due_date}</span>
            </p>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Qoraalka Wicitaanka *</label>
              <Input
                placeholder="Tusaale: Waan wacay, wuxuu yiri Jimcaha ayaan keenayaa $50..."
                value={callNote}
                onChange={(e) => setCallNote(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setCallDebt(null)}>
              Xidh
            </Button>
            <Button onClick={handleSaveCallLog} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              Keydi Qoraalka
            </Button>
          </DialogFooter>
        </Dialog>
      </div>
    </AppShell>
  );
}
