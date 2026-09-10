'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  MapPin, 
  CreditCard, 
  DollarSign, 
  History, 
  Plus, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Receipt,
  Edit,
  RotateCcw
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { repository } from '@/lib/services/repository';
import { formatMoney } from '@/lib/calculations/financials';
import { formatDate } from '@/lib/utils';
import { Customer, Debt, DebtPayment, Sale } from '@/types';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;
  const { success, error } = useToast();

  const [customerData, setCustomerData] = useState<(Customer & { debts: Debt[]; payments: DebtPayment[]; sales: Sale[] }) | null>(null);
  
  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('evc_plus');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // Edit Customer Modal State
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editReason, setEditReason] = useState('');

  // Correct Payment Modal State
  const [correctingPayment, setCorrectingPayment] = useState<DebtPayment | null>(null);
  const [correctPayAmount, setCorrectPayAmount] = useState<string>('');
  const [correctPayMethod, setCorrectPayMethod] = useState<string>('evc_plus');
  const [correctPayNotes, setCorrectPayNotes] = useState<string>('');
  const [correctPayReason, setCorrectPayReason] = useState<string>('');

  const loadData = async () => {
    try {
      const data = await repository.getCustomerById(customerId);
      if (!data) {
        error('Macmiilka lama helin');
        router.push('/customers');
        return;
      }
      setCustomerData(data);
      setPaymentAmount(data.remaining_debt ? String(data.remaining_debt) : '');
    } catch (err) {
      console.error('Error loading customer detail:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [customerId]);

  if (!customerData) {
    return (
      <AppShell title="Macmiilka">
        <div className="flex h-64 items-center justify-center text-slate-400">
          Xogta ayaa la soo rarayaa...
        </div>
      </AppShell>
    );
  }

  const handleRecordPayment = async () => {
    const numAmount = parseFloat(paymentAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      error('Lacagta la bixinayo waa inay ka weynaataa 0');
      return;
    }

    try {
      await repository.recordDebtPayment({
        customer_id: customerId,
        amount: numAmount,
        payment_method: paymentMethod,
        notes: paymentNotes,
      });

      success('Bixinta daynta si guul leh ayaa loo keydiyey!', `${formatMoney(numAmount)} ayaa la jaray`);
      setIsPaymentModalOpen(false);
      setPaymentNotes('');
      await loadData();
    } catch (err: any) {
      error('Khalad baa dhacay', err.message);
    }
  };

  const handleOpenEditCustomer = () => {
    setEditName(customerData.name || '');
    setEditPhone(customerData.phone || '');
    setEditAddress(customerData.address || '');
    setEditNotes(customerData.notes || '');
    setEditReason('');
    setIsEditCustomerOpen(true);
  };

  const handleSaveCustomerEdit = async () => {
    if (!editName.trim() || !editPhone.trim()) {
      error('Geli magaca iyo taleefanka macmiilka');
      return;
    }

    try {
      await repository.updateCustomer(customerId, {
        name: editName.trim(),
        phone: editPhone.trim(),
        address: editAddress.trim(),
        notes: editNotes.trim(),
      }, editReason.trim() || 'Wax ka beddel macmiil profile');

      success('Xogta macmiilka si guul leh ayaa loo saxay', editName);
      setIsEditCustomerOpen(false);
      await loadData();
    } catch (err: any) {
      error('Lama cusbooneysiin karin macmiilka', err.message);
    }
  };

  const handleOpenCorrectPayment = (p: DebtPayment) => {
    setCorrectingPayment(p);
    setCorrectPayAmount(String(p.amount));
    setCorrectPayMethod(p.payment_method || 'evc_plus');
    setCorrectPayNotes(p.notes || '');
    setCorrectPayReason('');
  };

  const handleSaveCorrectPayment = async () => {
    if (!correctingPayment) return;
    const numAmt = parseFloat(correctPayAmount);
    if (isNaN(numAmt) || numAmt <= 0) {
      error('Geli cadad lacageed oo sax ah (> 0)');
      return;
    }

    try {
      await repository.correctDebtPayment(correctingPayment.id, {
        amount: numAmt,
        paymentMethod: correctPayMethod,
        notes: correctPayNotes,
      }, correctPayReason.trim() || 'Sixid lacag-bixinta daynta');

      success('Lacag-bixinta si guul leh ayaa loo saxay', `Cadadka cusub: ${formatMoney(numAmt)}`);
      setCorrectingPayment(null);
      await loadData();
    } catch (err: any) {
      error('Lama sixi karin lacag-bixinta', err.message);
    }
  };

  const remaining = customerData.remaining_debt || 0;

  return (
    <AppShell title={customerData.name}>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Navigation & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Link href="/customers" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Dib ugu noqo Macaamiisha
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleOpenEditCustomer}
              className="font-bold gap-1.5"
            >
              <Edit className="h-4 w-4" />
              Wax ka beddel Macmiilka
            </Button>

            {remaining > 0 && (
              <Button
                onClick={() => setIsPaymentModalOpen(true)}
                className="font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 text-white"
              >
                <DollarSign className="h-4 w-4" />
                Diiwaangeli Lacag Bixin (Debt Payment)
              </Button>
            )}
          </div>
        </div>

        {/* Customer Profile Header */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 font-black text-2xl border border-emerald-200 dark:border-emerald-800">
              {customerData.name.charAt(0)}
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                {customerData.name}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="h-3.5 w-3.5" /> {customerData.phone}
                </span>
                {customerData.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {customerData.address}
                  </span>
                )}
                {customerData.notes && (
                  <span>Qoraal: <strong>{customerData.notes}</strong></span>
                )}
              </div>
            </div>
          </div>

          {/* Remaining Debt Highlight Box */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 min-w-[220px] text-left md:text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Haraaga Daynta (Remaining)</p>
            <p className={`text-3xl font-black mt-0.5 font-mono ${remaining > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'}`}>
              {formatMoney(remaining)}
            </p>
            <p className="text-[11px] text-slate-400">
              {remaining > 0 ? 'Waa in la soo xareeyo' : 'Dayn laguma laha ✓'}
            </p>
          </div>
        </div>

        {/* Debt Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5 border border-slate-200/80 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-500 uppercase">Wadarta Daynta Guud</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
              {formatMoney(customerData.total_debt)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Wadarta dhammaan daymihii uu qaatay</p>
          </Card>

          <Card className="p-5 border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20">
            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">Lacagta Laga Helay (Paid)</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
              {formatMoney(customerData.paid_debt)}
            </p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">Lacagihii uu soo bixiyey</p>
          </Card>

          <Card className="p-5 border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase">Haraaga Daynta (Balance)</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
              {formatMoney(remaining)}
            </p>
            <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">Daynta hadda taagan</p>
          </Card>
        </div>

        {/* Payment History Log */}
        <Card className="border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-5 w-5 text-emerald-600" />
                Taariikhda Bixinta Daynta (Payment History Log)
              </CardTitle>
              <p className="text-xs text-slate-500">Diiwaanka rasmi ah ee lacagaha uu bixiyey iyo sixitaankooda</p>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-y border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="px-5 py-3">Lambar / ID</th>
                    <th className="px-5 py-3">Taariikhda</th>
                    <th className="px-5 py-3 text-right">Cadadka La Bixiyey</th>
                    <th className="px-5 py-3">Habka Lacagta</th>
                    <th className="px-5 py-3">Faahfaahin / Qoraal</th>
                    <th className="px-5 py-3 text-right">Hawlaha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {customerData.payments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        Lacag bixin lama hayo weli
                      </td>
                    </tr>
                  ) : (
                    customerData.payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                          #{p.id.slice(-6).toUpperCase()}
                        </td>
                        <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                          {formatDate(p.created_at)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 text-base">
                          {formatMoney(p.amount)}
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 uppercase">
                            {p.payment_method}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-400 text-xs">
                          {p.notes || '—'}
                        </td>
                        <td className="px-5 py-3 text-right">
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Credit Sales History */}
        <Card className="border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-600" />
              Taariikhda Iibkii Daynta ahaa (Credit Sales History)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-y border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="px-5 py-3">Rasiidh #</th>
                    <th className="px-5 py-3">Taariikhda</th>
                    <th className="px-5 py-3 text-right">Wadarta Iibka</th>
                    <th className="px-5 py-3 text-right">Lacag La Bixiyey</th>
                    <th className="px-5 py-3 text-right">Daynta Qoran</th>
                    <th className="px-5 py-3">Xaaladda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {customerData.debts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        Dayn lama hayo
                      </td>
                    </tr>
                  ) : (
                    customerData.debts.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3 font-mono font-bold text-slate-900 dark:text-white">
                          #{d.sale_id ? d.sale_id.slice(-6).toUpperCase() : d.id.slice(-6).toUpperCase()}
                        </td>
                        <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                          {formatDate(d.created_at)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatMoney(d.original_amount)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-emerald-600 font-bold">
                          {formatMoney(d.amount_paid)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                          {formatMoney(d.remaining_balance)}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            d.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : d.status === 'partial'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}>
                            {d.status === 'paid' ? 'Waa La Bixiyey' : d.status === 'partial' ? 'Qeyb La Bixiyey' : 'Waa Taagan Tahay'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Modal: Record Debt Payment */}
        <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
          <DialogClose onClick={() => setIsPaymentModalOpen(false)} />
          <DialogHeader>
            <DialogTitle>Diiwaangeli Lacag Bixinta Daynta</DialogTitle>
            <DialogDescription>
              Macmiilka: <strong>{customerData.name}</strong> | Haraaga Daynta: <strong>{formatMoney(remaining)}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Cadadka Lacagta La Bixiyey ($) *
              </label>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="text-xl font-black font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Habka Lacag Bixinta (Payment Method) *
              </label>
              <select
                className="flex h-11 w-full rounded-xl border border-slate-300 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="evc_plus">EVC Plus (+252 61...)</option>
                <option value="zaad">ZAAD Service (+252 63...)</option>
                <option value="sahal">SAHAL (+252 90...)</option>
                <option value="cash">Lacag Caddaan ah (Cash)</option>
                <option value="bank">Xisaab Bangi (Bank Transfer)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Faahfaahin / Transaction ID
              </label>
              <Input
                placeholder="tusaale: EVC Trx #89283724"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)}>Ka Noqo</Button>
            <Button onClick={handleRecordPayment} className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white">Keydi Bixinta</Button>
          </DialogFooter>
        </Dialog>

        {/* Modal: Edit Customer Profile */}
        <Dialog open={isEditCustomerOpen} onOpenChange={setIsEditCustomerOpen}>
          <DialogClose onClick={() => setIsEditCustomerOpen(false)} />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-emerald-600" />
              Wax ka beddel Xogta Macmiilka
            </DialogTitle>
            <DialogDescription>
              Cusbooneysii xogta macmiilka <strong>{customerData.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Magaca Macmiilka *
              </label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Lambarka Taleefanka *
              </label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Cinwaanka / Xaafadda
              </label>
              <Input
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Faahfaahin Dheeraad ah (Notes)
              </label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Sababta Wax ka beddelka (Audit Reason)
              </label>
              <Input
                placeholder="Tusaale: Macluumaad saxid..."
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditCustomerOpen(false)}>Ka Noqo</Button>
            <Button onClick={handleSaveCustomerEdit} className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white">Keydi Isbeddelka</Button>
          </DialogFooter>
        </Dialog>

        {/* Modal: Correct Payment */}
        <Dialog open={!!correctingPayment} onOpenChange={(open) => !open && setCorrectingPayment(null)}>
          <DialogClose onClick={() => setCorrectingPayment(null)} />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Edit className="h-5 w-5 text-emerald-600" />
              Sax Lacag-bixinta Daynta (Payment Correction)
            </DialogTitle>
            <DialogDescription>
              Sax cadadka lacagta la bixiyey ama habka lacag bixinta. Nidaamku wuxuu toos u dib-u-xisaabinayaa haraaga daynta iyo lacagaha soo xarooday.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Cadadka Saxda ah ($) *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={correctPayAmount}
                onChange={(e) => setCorrectPayAmount(e.target.value)}
                className="text-xl font-black font-mono text-emerald-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Habka Lacag Bixinta (Payment Method) *
              </label>
              <select
                className="flex h-11 w-full rounded-xl border border-slate-300 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700"
                value={correctPayMethod}
                onChange={(e) => setCorrectPayMethod(e.target.value)}
              >
                <option value="evc_plus">EVC Plus (+252 61...)</option>
                <option value="zaad">ZAAD Service (+252 63...)</option>
                <option value="sahal">SAHAL (+252 90...)</option>
                <option value="cash">Lacag Caddaan ah (Cash)</option>
                <option value="bank">Xisaab Bangi (Bank Transfer)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Faahfaahin / Qoraal
              </label>
              <Input
                value={correctPayNotes}
                onChange={(e) => setCorrectPayNotes(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
              <label className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Sababta Sixitaanka (Audit Reason) *
              </label>
              <Input
                placeholder="Tusaale: Lacagta qalad baa loo qoray, xisaab celin..."
                value={correctPayReason}
                onChange={(e) => setCorrectPayReason(e.target.value)}
                className="bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectingPayment(null)}>Ka Noqo</Button>
            <Button onClick={handleSaveCorrectPayment} className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white">Keydi Sixitaanka</Button>
          </DialogFooter>
        </Dialog>
      </div>
    </AppShell>
  );
}
