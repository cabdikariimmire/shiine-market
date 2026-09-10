'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Receipt, 
  Search, 
  Eye, 
  ShoppingCart, 
  Plus, 
  Calendar, 
  CreditCard,
  DollarSign,
  Printer,
  Edit,
  RotateCcw,
  AlertTriangle,
  User,
  Trash2
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ReceiptModal } from '@/components/pos/receipt-modal';
import { useToast } from '@/components/ui/toast';
import { repository } from '@/lib/services/repository';
import { formatMoney } from '@/lib/calculations/financials';
import { formatDate } from '@/lib/utils';
import { Customer, Sale, SaleItem } from '@/types';
import { useAuth } from '@/lib/auth/auth-context';

export default function SalesHistoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { success, error } = useToast();

  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<Sale | null>(null);

  // Edit / Correct Sale Modal State
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editCustomerId, setEditCustomerId] = useState<string>('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<'cash' | 'credit' | 'partial'>('cash');
  const [editAmountPaid, setEditAmountPaid] = useState<string>('');
  const [editOverallDiscount, setEditOverallDiscount] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editCreatedAt, setEditCreatedAt] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [editItems, setEditItems] = useState<Array<{
    id: string;
    productVariantId: string;
    productName: string;
    variantName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    discount: number;
  }>>([]);

  // Void Sale Modal State
  const [voidingSale, setVoidingSale] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');

  const loadData = async () => {
    try {
      const [salesData, customersData] = await Promise.all([
        repository.getSales(),
        repository.getCustomers(),
      ]);
      setSales(salesData);
      setCustomers(customersData);
    } catch (err) {
      console.error('Error loading sales:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSales = sales.filter(s => {
    const q = search.toLowerCase();
    const idMatch = s.id.toLowerCase().includes(q);
    const custMatch = (s.customer?.name || '').toLowerCase().includes(q);
    const methodMatch = selectedPaymentMethod === 'all' || s.payment_method === selectedPaymentMethod;
    return (idMatch || custMatch) && methodMatch;
  });

  const totalSalesAmount = sales.reduce((sum, s) => sum + s.total_amount, 0);
  const totalCashCollected = sales.reduce((sum, s) => sum + s.amount_paid, 0);
  const totalDebtGenerated = sales.reduce((sum, s) => sum + s.debt_amount, 0);

  // Open Edit Sale Modal
  const handleOpenEditSale = (s: Sale) => {
    setEditingSale(s);
    setEditCustomerId(s.customer_id || '');
    setEditPaymentMethod(s.payment_method);
    setEditAmountPaid(String(s.amount_paid ?? '0'));
    setEditOverallDiscount(String(s.discount ?? '0'));
    setEditNotes(s.notes || '');
    setEditCreatedAt(s.created_at ? s.created_at.split('T')[0] : '');
    setEditReason('');
    
    if (s.items) {
      setEditItems(s.items.map(i => ({
        id: i.id,
        productVariantId: i.product_variant_id,
        productName: i.product_variant?.product?.name || 'Alaab',
        variantName: i.product_variant?.variant_name || 'Default',
        quantity: i.quantity,
        unit: i.unit,
        unitPrice: i.unit_price,
        discount: i.discount || 0
      })));
    } else {
      setEditItems([]);
    }
  };

  const handleUpdateItemQuantity = (index: number, val: number) => {
    const updated = [...editItems];
    updated[index].quantity = val;
    setEditItems(updated);
  };

  const handleUpdateItemPrice = (index: number, val: number) => {
    const updated = [...editItems];
    updated[index].unitPrice = val;
    setEditItems(updated);
  };

  const handleUpdateItemDiscount = (index: number, val: number) => {
    const updated = [...editItems];
    updated[index].discount = val;
    setEditItems(updated);
  };

  // Calculated Preview Totals
  const previewSubtotal = editItems.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
  const previewItemDiscounts = editItems.reduce((sum, i) => sum + (i.discount || 0), 0);
  const previewOverallDiscount = parseFloat(editOverallDiscount) || 0;
  const previewTotal = Math.max(0, previewSubtotal - previewItemDiscounts - previewOverallDiscount);

  // Save Sale Correction
  const handleSaveCorrection = async () => {
    if (!editingSale) return;

    for (const item of editItems) {
      if (item.quantity <= 0) {
        error(`Tirada "${item.productName}" waa inay ka weynaataa 0`);
        return;
      }
      if (item.unitPrice < 0) {
        error(`Qiimaha "${item.productName}" ma noqon karo mid ka yar 0`);
        return;
      }
    }

    try {
      await repository.correctSale(
        editingSale.id,
        {
          customerId: editCustomerId || undefined,
          paymentMethod: editPaymentMethod,
          amountPaid: parseFloat(editAmountPaid) || 0,
          overallDiscount: previewOverallDiscount,
          notes: editNotes.trim(),
          createdAt: editCreatedAt ? `${editCreatedAt}T${new Date().toISOString().split('T')[1]}` : undefined,
          items: editItems.map(i => ({
            id: i.id,
            productVariantId: i.productVariantId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: i.discount
          }))
        },
        editReason.trim() || `Saxay iibka #${editingSale.id.slice(-6).toUpperCase()}`
      );

      success('Xogta si guul leh ayaa loo saxay.', `Iibka #${editingSale.id.slice(-6).toUpperCase()} iyo kaydka waa la reconcil-gareeyey.`);
      setEditingSale(null);
      await loadData();
    } catch (err: any) {
      error('Xogta lama sixi karin. Fadlan mar kale isku day.', err?.message);
    }
  };

  // Confirm Void Sale
  const handleConfirmVoid = async () => {
    if (!voidingSale) return;
    try {
      await repository.voidSale(
        voidingSale.id,
        voidReason.trim() || 'Iibka waa la laalay (Void)'
      );
      success('Iibka waa la laalay (Voided)', `Alaabtii waxay ku laabatay kaydka.`);
      setVoidingSale(null);
      setVoidReason('');
      await loadData();
    } catch (err: any) {
      error('Lama laali karin iibka', err?.message);
    }
  };

  return (
    <AppShell title="Taariikhda Iibka">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="h-6 w-6 text-emerald-600" />
              Taariikhda Iibka Guud ({sales.length})
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Liiska dhammaan iibyadii ka dhacay dukaanka, saxidda iibka (correction), iyo rasiidhada
            </p>
          </div>

          <Link href="/sales/new">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20">
              <Plus className="h-4 w-4" />
              Iib Cusub Samee (POS)
            </Button>
          </Link>
        </div>

        {/* Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <p className="text-xs font-bold text-slate-400 uppercase">Wadarta Iibka (Sales Revenue)</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
              {formatMoney(totalSalesAmount)}
            </p>
          </Card>

          <Card className="p-4 border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs">
            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">Caddaan La Qabtay (Cash In)</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
              {formatMoney(totalCashCollected)}
            </p>
          </Card>

          <Card className="p-4 border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20 shadow-xs">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase">Dayn Lagu Qaatay (Credit)</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
              {formatMoney(totalDebtGenerated)}
            </p>
          </Card>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: 'Dhammaan' },
              { id: 'cash', label: 'Caddaan (Cash)' },
              { id: 'credit', label: 'Dayn (Credit)' },
              { id: 'partial', label: 'Qeyb (Partial)' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedPaymentMethod(f.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedPaymentMethod === f.id
                    ? 'bg-emerald-600 text-white shadow-xs'
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
              placeholder="Ka baadh rasiidhka, macmiilka..."
              className="pl-9 h-9 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Sales Table */}
        <Card className="border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Rasiidh #</th>
                  <th className="px-4 py-3.5">Macmiilka</th>
                  <th className="px-4 py-3.5">Habka Bixinta</th>
                  <th className="px-4 py-3.5 text-right">Wadarta Iibka</th>
                  <th className="px-4 py-3.5 text-right">La Bixiyey</th>
                  <th className="px-4 py-3.5 text-right">Dayn</th>
                  <th className="px-4 py-3.5 text-right">Faa'iido</th>
                  <th className="px-4 py-3.5">Taariikhda</th>
                  <th className="px-4 py-3.5 text-right">Hawlaha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
                      Iib laguma helin
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-4 font-mono font-bold text-slate-900 dark:text-white">
                        #{s.id.slice(-6).toUpperCase()}
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-900 dark:text-white">
                          {s.customer?.name || <span className="text-slate-400 font-normal">Caddaan (Anonymous)</span>}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.payment_method === 'cash'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : s.payment_method === 'credit'
                            ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                        }`}>
                          {s.payment_method === 'cash' ? 'Caddaan' : s.payment_method === 'credit' ? 'Dayn' : 'Qeyb'}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                        {formatMoney(s.total_amount)}
                      </td>

                      <td className="px-4 py-4 text-right font-mono font-bold text-emerald-600">
                        {formatMoney(s.amount_paid)}
                      </td>

                      <td className="px-4 py-4 text-right font-mono font-bold text-amber-600">
                        {s.debt_amount > 0 ? formatMoney(s.debt_amount) : '—'}
                      </td>

                      <td className="px-4 py-4 text-right font-mono text-emerald-600 font-semibold text-xs">
                        +{formatMoney(s.gross_profit)}
                      </td>

                      <td className="px-4 py-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(s.created_at)}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenEditSale(s)}
                              className="h-8 px-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-1"
                              title="Sax Iibka"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              Sax
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedSaleForReceipt(s)}
                            className="h-8 px-2 text-xs font-bold gap-1"
                            title="Arag Rasiidhka"
                          >
                            <Printer className="h-3.5 w-3.5 text-slate-600" />
                            Rasiidh
                          </Button>

                          {isAdmin && s.total_amount > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setVoidingSale(s); setVoidReason(''); }}
                              className="h-8 px-1.5 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                              title="Laal Iibka (Void)"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
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

      {/* CORRECT SALE MODAL */}
      <Dialog open={!!editingSale} onOpenChange={(open) => !open && setEditingSale(null)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-lg">
            <Edit className="h-5 w-5 text-emerald-600" />
            Sax Iibka (Correct Sale #{editingSale?.id.slice(-6).toUpperCase()})
          </DialogTitle>
          <DialogDescription>
            Sax tirada, qiimaha, ama macmiilka. Nidaamku wuxuu si toos ah u xisaabinayaa Kaydka (Stock), Faa'iidada (Profit) iyo Daynta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs max-h-[70vh] overflow-y-auto pr-1">
          {/* Customer & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Macmiilka (Customer)</label>
              <select
                value={editCustomerId}
                onChange={(e) => setEditCustomerId(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium"
              >
                <option value="">Caddaan (Anonymous Customer)</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Habka Bixinta (Payment Method)</label>
              <select
                value={editPaymentMethod}
                onChange={(e) => setEditPaymentMethod(e.target.value as any)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium"
              >
                <option value="cash">Caddaan (Cash)</option>
                <option value="credit">Dayn Buuxda (Credit)</option>
                <option value="partial">Qeyb Caddaan / Qeyb Dayn (Partial)</option>
              </select>
            </div>
          </div>

          {/* Items Table in Sale */}
          <div className="space-y-2">
            <label className="font-bold text-slate-700 dark:text-slate-300 block">Alaabta Iibka (Sale Items)</label>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5">Alaabta</th>
                    <th className="p-2.5 w-24">Tirada</th>
                    <th className="p-2.5 w-24">Qiimaha ($)</th>
                    <th className="p-2.5 w-20">Gooni Dhimis</th>
                    <th className="p-2.5 text-right w-24">Wadarta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {editItems.map((item, idx) => {
                    const lineTotal = Math.max(0, (item.quantity * item.unitPrice) - (item.discount || 0));
                    return (
                      <tr key={item.id || idx}>
                        <td className="p-2.5">
                          <p className="font-bold text-slate-900 dark:text-white">{item.productName}</p>
                          <p className="text-[11px] text-slate-500">{item.variantName} ({item.unit})</p>
                        </td>
                        <td className="p-2.5">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItemQuantity(idx, parseFloat(e.target.value) || 0)}
                            className="h-8 font-mono font-bold text-xs"
                          />
                        </td>
                        <td className="p-2.5">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateItemPrice(idx, parseFloat(e.target.value) || 0)}
                            className="h-8 font-mono text-xs"
                          />
                        </td>
                        <td className="p-2.5">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.discount}
                            onChange={(e) => handleUpdateItemDiscount(idx, parseFloat(e.target.value) || 0)}
                            className="h-8 font-mono text-xs"
                          />
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatMoney(lineTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Details & Overall Discount */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Wadarta Guud (Calculated Total)</label>
              <p className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
                {formatMoney(previewTotal)}
              </p>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Dhimis Guud ($)</label>
              <Input
                type="number"
                step="0.01"
                value={editOverallDiscount}
                onChange={(e) => setEditOverallDiscount(e.target.value)}
                className="mt-1 font-mono font-bold h-9"
              />
            </div>

            {editPaymentMethod !== 'cash' && (
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Lacagta La Bixiyey ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editAmountPaid}
                  onChange={(e) => setEditAmountPaid(e.target.value)}
                  className="mt-1 font-mono font-bold text-emerald-600 h-9"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Taariikhda Iibka</label>
              <Input
                type="date"
                value={editCreatedAt}
                onChange={(e) => setEditCreatedAt(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Qoraal (Notes)</label>
              <Input
                placeholder="Faahfaahin ku saabsan iibka"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Sababta Sixidda (Reason for Audit Log) *</label>
            <Input
              placeholder="Tusaale: Tirada bariiska ayaa 10kg laga dhigay 8kg..."
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              className="mt-1 text-slate-600"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setEditingSale(null)}>
            Ka noqo
          </Button>
          <Button onClick={handleSaveCorrection} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            Keydi Isbeddelka
          </Button>
        </DialogFooter>
      </Dialog>

      {/* VOID SALE MODAL */}
      <Dialog open={!!voidingSale} onOpenChange={(open) => !open && setVoidingSale(null)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 font-black text-lg">
            <AlertTriangle className="h-5 w-5" />
            Ma hubtaa inaad laalayso Iibkan?
          </DialogTitle>
          <DialogDescription>
            Iibka #{voidingSale?.id.slice(-6).toUpperCase()} ({formatMoney(voidingSale?.total_amount || 0)}) waa la laali doonaa. Alaabta waxay ku laaban doontaa kaydka, dayntana waa la tirtiri doonaa.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 text-xs">
          <label className="font-bold text-slate-700 dark:text-slate-300">Sababta loo laalay (Void Reason) *</label>
          <Input
            placeholder="Tusaale: Macmiilku wuxuu ka noqday iibka..."
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            className="mt-1"
          />
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setVoidingSale(null)}>
            Ka noqo
          </Button>
          <Button onClick={handleConfirmVoid} className="bg-red-600 hover:bg-red-700 text-white font-bold">
            Haa, Laal Iibka
          </Button>
        </DialogFooter>
      </Dialog>

      {/* RECEIPT MODAL */}
      <ReceiptModal
        isOpen={!!selectedSaleForReceipt}
        onClose={() => setSelectedSaleForReceipt(null)}
        sale={selectedSaleForReceipt}
      />
    </AppShell>
  );
}
