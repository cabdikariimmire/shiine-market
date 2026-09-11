'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Clock,
  AlertTriangle,
  ArrowRight,
  FileText,
  Edit,
  History,
  RotateCcw
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { repository } from '@/lib/services/repository';
import { formatMoney } from '@/lib/calculations/financials';
import { formatDate } from '@/lib/utils';
import { Debt, Customer, DebtPayment } from '@/types';

export default function DebtsPage() {
  const { success, error } = useToast();

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

  // Payment Modal State
  const [selectedDebtForPay, setSelectedDebtForPay] = useState<Debt | null>(null);
  const [paymentToday, setPaymentToday] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('evc_plus');
  const [payNotes, setPayNotes] = useState<string>('');

  // Create Debt Modal State (Empty Inputs Rule: strings start "")
  const [isCreateDebtOpen, setIsCreateDebtOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newItemsSummary, setNewItemsSummary] = useState('');
  const [newTotalDebt, setNewTotalDebt] = useState<string>('');
  const [newPaidInitially, setNewPaidInitially] = useState<string>('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDebtNotes, setNewDebtNotes] = useState('');

  // Edit/Correct Debt Modal State
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

  const [allDebts, setAllDebts] = useState<Debt[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [filtered, payments, cal, all] = await Promise.all([
        repository.getDebts(statusFilter),
        repository.getDebtPayments(),
        repository.getDebtCalendarSummary(),
        repository.getDebts('all'),
      ]);
      setDebts(filtered);
      setDebtPayments(payments);
      setCalendarData(cal);
      setAllDebts(all);
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
    } catch (err: any) {
      error('Khalad baa dhacay', err.message);
    }
  };

  // Create Debt Directly
  const handleSaveCreateDebt = async () => {
    const total = parseFloat(newTotalDebt);
    const paid = parseFloat(newPaidInitially) || 0;

    if (!newCustName.trim() || !newCustPhone.trim()) {
      error('Geli magaca iyo taleefanka macmiilka');
      return;
    }
    if (isNaN(total) || total <= 0) {
      error('Geli wadarta daynta');
      return;
    }

    try {
      await repository.createDebtDirectly({
        customerName: newCustName,
        customerPhone: newCustPhone,
        itemsSummary: newItemsSummary || 'Alaab guud',
        totalAmount: total,
        amountPaidInitially: paid,
        dueDate: newDueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        notes: newDebtNotes,
      });

      success('Dayn cusub ayaa la diiwaangeliyey!', `${newCustName} (${formatMoney(Math.max(0, total - paid))} haraa)`);
      setIsCreateDebtOpen(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewItemsSummary('');
      setNewTotalDebt('');
      setNewPaidInitially('');
      setNewDueDate('');
      setNewDebtNotes('');
      await loadData();
    } catch (err: any) {
      error('Khalad baa dhacay', err.message);
    }
  };

  // Open Edit Debt Modal
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
              Kormeerka xisaabaadka daymaha, jadwal bixinta, sixitaanka iyo lacagaha soo xarooday
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => setIsCreateDebtOpen(true)}
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
            Diiwaanka Lacag-bixinta ({debtPayments.length})
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
                            #{d.id.slice(-6).toUpperCase()}
                          </td>

                          <td className="px-4 py-4">
                            <p className="font-bold text-slate-900 dark:text-white">{d.customer?.name || 'Macmiil'}</p>
                            {d.customer?.phone && (
                              <a href={`tel:${d.customer.phone}`} className="text-[11px] font-mono text-emerald-600 hover:underline flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {d.customer.phone}
                              </a>
                            )}
                          </td>

                          <td className="px-4 py-4 text-xs text-slate-600 dark:text-slate-400 max-w-[200px] truncate">
                            {d.items_summary || 'Iib POS'}
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
                              {d.remaining_balance > 0 && (
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenPay(d)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-7 px-2.5 text-xs shadow-xs"
                                >
                                  Bixi Dayn
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenEditDebt(d)}
                                className="h-7 px-2 text-xs font-bold text-slate-600 hover:text-emerald-600 gap-1"
                                title="Wax ka beddel daynta"
                              >
                                <Edit className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Sax</span>
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
                          <Button size="sm" onClick={() => handleOpenPay(d)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-7 px-2 text-xs">
                            Bixi
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleOpenEditDebt(d)} className="h-7 px-1.5 text-xs text-slate-500 hover:text-emerald-600">
                            <Edit className="h-3.5 w-3.5" />
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
                          <Button size="sm" onClick={() => handleOpenPay(d)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-7 px-2 text-xs">
                            Bixi
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleOpenEditDebt(d)} className="h-7 px-1.5 text-xs text-slate-500 hover:text-emerald-600">
                            <Edit className="h-3.5 w-3.5" />
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
                          <Button size="sm" onClick={() => handleOpenPay(d)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-7 px-2 text-xs">
                            Bixi
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleOpenEditDebt(d)} className="h-7 px-1.5 text-xs text-slate-500 hover:text-emerald-600">
                            <Edit className="h-3.5 w-3.5" />
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

        {/* MODAL 1: RECORD DEBT PAYMENT */}
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

        {/* MODAL 2: CREATE DEBT DIRECTLY */}
        <Dialog open={isCreateDebtOpen} onOpenChange={setIsCreateDebtOpen}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black">
              <Plus className="h-5 w-5 text-emerald-600" />
              Diiwaangeli Dayn Cusub
            </DialogTitle>
            <DialogDescription>
              Geli xogta macmiilka, alaabta iyo xadiga daynta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Magaca Macmiilka *</label>
                <Input
                  placeholder="Tusaale: Cali Faarax"
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

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Alaabta La Qaatay (Items Summary)</label>
              <Input
                placeholder="Tusaale: 1 Jawan Baris Xamse, 5 kg Sonkor"
                value={newItemsSummary}
                onChange={(e) => setNewItemsSummary(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Wadarta Daynta ($) *</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder=""
                  value={newTotalDebt}
                  onChange={(e) => setNewTotalDebt(e.target.value)}
                  className="mt-1 font-mono font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Hore u Bixiyey ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder=""
                  value={newPaidInitially}
                  onChange={(e) => setNewPaidInitially(e.target.value)}
                  className="mt-1 font-mono text-emerald-600 font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Ballanta (Due Date)</label>
                <Input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Qoraal Dheeraad ah</label>
              <Input
                placeholder="Faahfaahin ku saabsan heshiiska daynta"
                value={newDebtNotes}
                onChange={(e) => setNewDebtNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsCreateDebtOpen(false)}>
              Ka noqo
            </Button>
            <Button onClick={handleSaveCreateDebt} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              Keydi Daynta
            </Button>
          </DialogFooter>
        </Dialog>

        {/* MODAL 3: EDIT / CORRECT DEBT */}
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

        {/* MODAL 4: CORRECT DEBT PAYMENT */}
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

        {/* MODAL 5: RECORD PHONE CALL LOG */}
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
