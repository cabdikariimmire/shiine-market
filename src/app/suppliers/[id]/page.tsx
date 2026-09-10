'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Building2, 
  ArrowLeft, 
  Phone, 
  MapPin, 
  Calendar, 
  Truck, 
  DollarSign, 
  Layers, 
  Camera, 
  FileText,
  Clock,
  ChevronRight,
  Edit,
  RotateCcw
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { repository } from '@/lib/services/repository';
import { formatMoney } from '@/lib/calculations/financials';
import { Supplier, SupplierTransaction } from '@/types';

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params?.id as string;
  const { success, error } = useToast();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  
  // Monthly History Filter (Default current month, e.g. "2026-09")
  const currentMonth = '2026-09';
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [monthlyHistory, setMonthlyHistory] = useState<{
    purchasesCount: number;
    variantsCount: number;
    totalAmount: number;
    transactions: SupplierTransaction[];
  } | null>(null);

  // Edit Supplier Modal State
  const [isEditSupplierOpen, setIsEditSupplierOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editReason, setEditReason] = useState('');

  // Correct Supplier Transaction Modal State
  const [correctingTx, setCorrectingTx] = useState<SupplierTransaction | null>(null);
  const [txRef, setTxRef] = useState('');
  const [txDate, setTxDate] = useState('');
  const [txItems, setTxItems] = useState<any[]>([]);
  const [txReason, setTxReason] = useState('');

  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const s = await repository.getSupplierById(supplierId);
      if (s) {
        setSupplier(s);
        const history = await repository.getSupplierMonthlyHistory(supplierId, selectedMonth);
        setMonthlyHistory(history);
      }
    } catch (err: any) {
      console.error('Error loading supplier details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (supplierId) {
      loadData();
    }
  }, [supplierId, selectedMonth]);

  if (loading && !supplier) {
    return (
      <AppShell title="Alaab-qeybiye">
        <div className="text-center py-20">
          <p className="text-slate-500">Xogta alaab-qeybiyaha ayaa la soo gelinayaa...</p>
        </div>
      </AppShell>
    );
  }

  if (!supplier) {
    return (
      <AppShell title="Alaab-qeybiye">
        <div className="text-center py-20">
          <p className="text-slate-500">Alaab-qeybiyaha lama helin...</p>
          <Link href="/suppliers">
            <Button className="mt-4">Ku laabo Liiska</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const handleOpenEditSupplier = () => {
    setEditName(supplier.name || '');
    setEditPhone(supplier.phone || '');
    setEditCompany(supplier.company || '');
    setEditAddress(supplier.address || '');
    setEditNotes(supplier.notes || '');
    setEditReason('');
    setIsEditSupplierOpen(true);
  };

  const handleSaveEditSupplier = async () => {
    if (!editName.trim() || !editPhone.trim()) {
      error('Geli magaca iyo taleefanka alaab-qeybiyaha');
      return;
    }

    try {
      await repository.updateSupplier(supplierId, {
        name: editName.trim(),
        phone: editPhone.trim(),
        company: editCompany.trim(),
        address: editAddress.trim(),
        notes: editNotes.trim(),
      }, editReason.trim() || 'Wax ka beddel supplier profile');

      success('Xogta alaab-qeybiyaha si guul leh ayaa loo saxay', editName);
      setIsEditSupplierOpen(false);
      await loadData();
    } catch (err: any) {
      error('Lama cusbooneysiin karin alaab-qeybiyaha', err.message);
    }
  };

  const handleOpenCorrectTx = (tx: SupplierTransaction) => {
    setCorrectingTx(tx);
    setTxRef(tx.reference_number || '');
    setTxDate(tx.transaction_date || tx.created_at.split('T')[0]);
    setTxItems(
      (tx.items || []).map((it) => ({
        product_variant_id: it.product_variant_id,
        product_name: it.product_name,
        variant_name: it.variant_name,
        quantity: it.quantity,
        purchase_unit: it.purchase_unit,
        conversion_factor: it.conversion_factor || 1,
        buy_price: it.buy_price,
      }))
    );
    setTxReason('');
  };

  const handleUpdateTxItem = (index: number, field: string, value: any) => {
    setTxItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSaveCorrectTx = async () => {
    if (!correctingTx) return;

    try {
      await repository.correctSupplierTransaction(correctingTx.id, {
        supplierId: supplierId,
        referenceNumber: txRef.trim(),
        transactionDate: txDate,
        items: txItems.map(it => ({
          productVariantId: it.product_variant_id,
          productName: it.product_name,
          variantName: it.variant_name,
          quantity: parseFloat(it.quantity) || 0,
          purchaseUnit: it.purchase_unit,
          conversionFactor: parseFloat(it.conversion_factor) || 1,
          buyPrice: parseFloat(it.buy_price) || 0,
        })),
      }, txReason.trim() || 'Sixid iibsashada alaab-qeybiyaha');

      success('Iibsashada alaab-qeybiyaha si guul leh ayaa loo saxay', 'Kaydka iyo xisaabaadka waa la dib-u-heshiisiiyey');
      setCorrectingTx(null);
      await loadData();
    } catch (err: any) {
      error('Lama sixi karin iibsashada', err.message);
    }
  };

  return (
    <AppShell title={supplier.name}>
      <div className="space-y-6">
        {/* Navigation & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Link href="/suppliers">
            <Button variant="ghost" size="sm" className="gap-2 text-slate-600 hover:text-slate-900 font-bold">
              <ArrowLeft className="h-4 w-4" />
              Ku laabo Qeybiyeyaasha (Suppliers)
            </Button>
          </Link>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              onClick={handleOpenEditSupplier}
              className="gap-2 font-bold text-xs"
            >
              <Edit className="h-4 w-4 text-emerald-600" />
              Wax ka beddel Qeybiyaha
            </Button>

            <Link href="/ai-camera">
              <Button variant="outline" className="gap-2 border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300 font-bold">
                <Camera className="h-4 w-4" />
                Scan Invoice
              </Button>
            </Link>
          </div>
        </div>

        {/* Supplier Master Info Card */}
        <Card className="p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                <Building2 className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                  {supplier.name}
                </h1>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                  {supplier.company && <span className="font-semibold text-slate-700 dark:text-slate-300">{supplier.company}</span>}
                  <a href={`tel:${supplier.phone}`} className="flex items-center gap-1 font-mono text-emerald-600 font-bold hover:underline">
                    <Phone className="h-3.5 w-3.5" /> {supplier.phone}
                  </a>
                  {supplier.address && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <MapPin className="h-3.5 w-3.5" /> {supplier.address}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right sm:border-l sm:border-slate-200 dark:sm:border-slate-800 sm:pl-6">
              <p className="text-xs text-slate-400">Wadarta Guud ee Laga Iibsaday</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {formatMoney(supplier.total_spend || 0)}
              </p>
              <p className="text-[11px] text-slate-500">
                {supplier.total_purchases || 0} iibsiyo guud
              </p>
            </div>
          </div>

          {supplier.notes && (
            <p className="mt-4 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
              Qoraal: {supplier.notes}
            </p>
          )}
        </Card>

        {/* SUPPLIER MONTHLY HISTORY SELECTOR */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-emerald-600" />
                Xisaabta Bishii (Monthly History Breakdown)
              </h2>
              <p className="text-xs text-slate-500">
                Dooro bisha aad rabto inaad aragto tirada iibsiyada, alaabaha iyo lacagta la bixiyey
              </p>
            </div>

            {/* Month Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Dooro Bisha:</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="flex h-10 rounded-xl border border-slate-300 bg-background px-3 py-1 text-xs font-bold font-mono focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700"
              >
                <option value="2026-09">September 2026</option>
                <option value="2026-08">August 2026</option>
                <option value="2026-07">July 2026</option>
                <option value="2026-06">June 2026</option>
              </select>
            </div>
          </div>

          {/* Monthly KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <p className="text-xs font-bold text-slate-400 uppercase">Tirada Iibsiyada (Invoices)</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                {monthlyHistory?.purchasesCount || 0}
              </p>
              <p className="text-[11px] text-slate-500">Iibsiyo bishan {selectedMonth}</p>
            </Card>

            <Card className="p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <p className="text-xs font-bold text-slate-400 uppercase">Noocyada Alaabta (Variants)</p>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 font-mono">
                {monthlyHistory?.variantsCount || 0}
              </p>
              <p className="text-[11px] text-slate-500">Xariiqyo alaab ah</p>
            </Card>

            <Card className="p-4 border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs">
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">Wadarta Lacagta Bishan</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                {formatMoney(monthlyHistory?.totalAmount || 0)}
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Total amount spent</p>
            </Card>
          </div>

          {/* Transactions / Invoices Table for Selected Month */}
          <Card className="border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-600" />
                Liiska Iibsiyada Bishan ({selectedMonth})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Lambar / Reference</th>
                    <th className="px-4 py-3">Taariikhda</th>
                    <th className="px-4 py-3">Alaabta & Noocyada</th>
                    <th className="px-4 py-3 text-right">Wadarta Lacagta</th>
                    <th className="px-4 py-3">Xaaladda</th>
                    <th className="px-4 py-3 text-right">Hawlaha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {!monthlyHistory?.transactions || monthlyHistory.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        Bishan ma jiro iib la diiwaangeliyey
                      </td>
                    </tr>
                  ) : (
                    monthlyHistory.transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-4 font-mono font-bold text-slate-900 dark:text-white">
                          {tx.reference_number || `#${tx.id.slice(-6).toUpperCase()}`}
                        </td>
                        <td className="px-4 py-4 font-mono text-slate-500 whitespace-nowrap">
                          {tx.transaction_date || tx.created_at.split('T')[0]}
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            {tx.items?.map((item, i) => (
                              <div key={i} className="text-xs flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-white">{item.product_name}</span>
                                <span className="text-emerald-600 font-medium">({item.variant_name})</span>
                                <span className="font-mono text-slate-500">{item.quantity} {item.purchase_unit} @ {formatMoney(item.buy_price)}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                          {formatMoney(tx.total_amount)}
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Completed
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenCorrectTx(tx)}
                            className="h-7 px-2 text-xs font-bold text-slate-600 hover:text-emerald-600 gap-1"
                            title="Sax iibsashadan"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span>Sax</span>
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* MODAL 1: EDIT SUPPLIER */}
        <Dialog open={isEditSupplierOpen} onOpenChange={setIsEditSupplierOpen}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black">
              <Edit className="h-5 w-5 text-emerald-600" />
              Wax ka beddel Alaab-qeybiyaha
            </DialogTitle>
            <DialogDescription>
              Cusbooneysii xogta <strong>{supplier.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Magaca Qofka / Shirkadda *</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Taleefanka *</label>
                <Input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Magaca Ganacsiga (Company)</label>
                <Input
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Cinwaanka (Address)</label>
              <Input
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Faahfaahin / Qoraal</label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Sababta Wax ka beddelka (Audit Reason)
              </label>
              <Input
                placeholder="Tusaale: Tel sax ah, magac sixid..."
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditSupplierOpen(false)}>
              Ka noqo
            </Button>
            <Button onClick={handleSaveEditSupplier} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              Keydi Isbeddelka
            </Button>
          </DialogFooter>
        </Dialog>

        {/* MODAL 2: CORRECT SUPPLIER TRANSACTION */}
        <Dialog open={!!correctingTx} onOpenChange={(open) => !open && setCorrectingTx(null)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black">
              <Edit className="h-5 w-5 text-emerald-600" />
              Sax Iibsashada Alaab-qeybiyaha
            </DialogTitle>
            <DialogDescription>
              Sax tirada, qiimaha xabbadda ama taariikhda. Nidaamku wuxuu si toos ah u sixi doonaa kaydka stock-ga iyo xisaabaadka.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Invoice / Reference #</label>
                <Input
                  value={txRef}
                  onChange={(e) => setTxRef(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Taariikhda</label>
                <Input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-bold text-slate-700 dark:text-slate-300">Xariiqyada Alaabta (Items):</label>
              <div className="space-y-2 max-h-56 overflow-y-auto border border-slate-200 dark:border-slate-800 p-2 rounded-xl">
                {txItems.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg space-y-2 border border-slate-100 dark:border-slate-800">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                      <span>{item.product_name} ({item.variant_name})</span>
                      <span className="font-mono text-emerald-600">
                        {formatMoney((parseFloat(item.quantity) || 0) * (parseFloat(item.buy_price) || 0))}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400">Tirada ({item.purchase_unit})</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateTxItem(idx, 'quantity', e.target.value)}
                          className="h-8 text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">Qiimaha Iibka ($)</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.buy_price}
                          onChange={(e) => handleUpdateTxItem(idx, 'buy_price', e.target.value)}
                          className="h-8 text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">Halbeeg Beddelka</label>
                        <Input
                          type="number"
                          step="1"
                          value={item.conversion_factor}
                          onChange={(e) => handleUpdateTxItem(idx, 'conversion_factor', e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
              <label className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Sababta Sixitaanka (Audit Reason) *
              </label>
              <Input
                placeholder="Tusaale: Tirada alaabta oo qalad loo qoray, xisaab celin..."
                value={txReason}
                onChange={(e) => setTxReason(e.target.value)}
                className="bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setCorrectingTx(null)}>
              Ka noqo
            </Button>
            <Button onClick={handleSaveCorrectTx} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              Keydi Sixitaanka
            </Button>
          </DialogFooter>
        </Dialog>
      </div>
    </AppShell>
  );
}
