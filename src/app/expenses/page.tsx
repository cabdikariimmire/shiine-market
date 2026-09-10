'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Receipt, 
  Plus, 
  Search, 
  DollarSign, 
  Calendar, 
  Zap, 
  Droplet, 
  Truck, 
  Home, 
  Users, 
  Wrench, 
  Globe, 
  Tag,
  MoreVertical,
  Edit,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { repository } from '@/lib/services/repository';
import { formatMoney } from '@/lib/calculations/financials';
import { Expense, ExpenseCategory } from '@/types';
import { useAuth } from '@/lib/auth/auth-context';

export default function ExpensesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { success, error } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Create Modal State (Empty input rule: blank string)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createDescription, setCreateDescription] = useState('');
  const [createCategory, setCreateCategory] = useState<ExpenseCategory>('koronto');
  const [createAmount, setCreateAmount] = useState<string>('');
  const [createDate, setCreateDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [createNotes, setCreateNotes] = useState('');

  // Edit Modal State (Prefilled with actual stored value)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<ExpenseCategory>('koronto');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editNotes, setEditNotes] = useState('');
  const [editReason, setEditReason] = useState('');

  // Delete Modal State
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await repository.getExpenses();
      setExpenses(res);
    } catch (err: any) {
      console.error('Error loading expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getCategoryMeta = (cat: string) => {
    switch (cat) {
      case 'koronto':
      case 'electricity':
        return { label: 'Koronto (Electricity)', icon: Zap, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50' };
      case 'biyo':
      case 'water':
        return { label: 'Biyo (Water)', icon: Droplet, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50' };
      case 'gaadiid':
      case 'transport':
        return { label: 'Gaadiid (Transport)', icon: Truck, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50' };
      case 'kiro':
      case 'rent':
        return { label: 'Kiro (Rent)', icon: Home, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/50' };
      case 'mushahar':
      case 'salary':
        return { label: 'Mushahar (Salary)', icon: Users, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50' };
      case 'dayactir':
      case 'maintenance':
        return { label: 'Dayactir (Maintenance)', icon: Wrench, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/50' };
      case 'internet_tel':
      case 'internet_phone':
        return { label: 'Internet & Tel', icon: Globe, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/50' };
      default:
        return { label: 'Kharash Kale', icon: Tag, color: 'text-slate-600 bg-slate-50 dark:bg-slate-800' };
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setCreateDescription('');
    setCreateCategory('koronto');
    setCreateAmount(''); // genuine empty input rule
    setCreateDate(new Date().toISOString().split('T')[0]);
    setCreateNotes('');
    setIsCreateModalOpen(true);
  };

  // Handle Save New Expense
  const handleSaveCreate = async () => {
    const numAmount = parseFloat(createAmount);
    if (!createDescription.trim() || isNaN(numAmount) || numAmount <= 0) {
      error('Geli faahfaahinta kharashka iyo lacag ka weyn 0');
      return;
    }

    try {
      await repository.createExpense({
        description: createDescription.trim(),
        category: createCategory,
        amount: numAmount,
        date: createDate || new Date().toISOString().split('T')[0],
        notes: createNotes.trim(),
      });

      success('Kharash cusub ayaa la diiwaangeliyey', `${createDescription} (${formatMoney(numAmount)})`);
      setIsCreateModalOpen(false);
      await loadData();
    } catch (err: any) {
      error('Khalad baa dhacay', err?.message || 'Lama diiwaangelin karin');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (e: Expense) => {
    setEditingExpense(e);
    setEditDescription(e.description);
    setEditCategory(e.category);
    // Real stored zero rule: display actual stored numeric value
    setEditAmount(String(e.amount ?? ''));
    setEditDate(e.date || new Date().toISOString().split('T')[0]);
    setEditNotes(e.notes || '');
    setEditReason('');
    setActiveActionMenuId(null);
  };

  // Handle Save Edited Expense (In-place update, NO duplicates)
  const handleSaveEdit = async () => {
    if (!editingExpense) return;
    const numAmount = parseFloat(editAmount);
    if (!editDescription.trim() || isNaN(numAmount) || numAmount <= 0) {
      error('Geli faahfaahinta kharashka iyo lacag ka weyn 0');
      return;
    }

    try {
      await repository.updateExpense(
        editingExpense.id,
        {
          description: editDescription.trim(),
          category: editCategory,
          amount: numAmount,
          date: editDate,
          notes: editNotes.trim(),
        },
        editReason.trim() || `Wax ka beddel kharashka: ${editDescription}`
      );

      success('Xogta si guul leh ayaa loo saxay.', `${editDescription} (${formatMoney(numAmount)})`);
      setEditingExpense(null);
      await loadData();
    } catch (err: any) {
      error('Xogta lama sixi karin. Fadlan mar kale isku day.', err?.message);
    }
  };

  // Handle Delete Expense
  const handleConfirmDelete = async () => {
    if (!deletingExpense) return;
    try {
      await repository.deleteExpense(deletingExpense.id, `Tirtiray kharashka: ${deletingExpense.description}`);
      success('Kharashka waa la tirtiray', deletingExpense.description);
      setDeletingExpense(null);
      await loadData();
    } catch (err: any) {
      error('Lama tirtiri karin kharashka', err?.message);
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const q = search.toLowerCase();
      const descMatch = (e.description || '').toLowerCase().includes(q) || ((e.notes || '').toLowerCase().includes(q));
      const catMatch = selectedCategory === 'all' || e.category === selectedCategory;
      return descMatch && catMatch;
    });
  }, [expenses, search, selectedCategory]);

  const totalExpenseAmount = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses]);

  const topCategorySummary = useMemo(() => {
    if (expenses.length === 0) return { label: 'Ma jiro', amount: 0 };
    const catMap: Record<string, number> = {};
    for (const e of expenses) {
      const catKey = e.category || 'kale';
      catMap[catKey] = (catMap[catKey] || 0) + (e.amount || 0);
    }
    let topCat = '';
    let maxVal = 0;
    for (const [cat, val] of Object.entries(catMap)) {
      if (val > maxVal) {
        maxVal = val;
        topCat = cat;
      }
    }
    const meta = getCategoryMeta(topCat);
    return { label: meta.label, amount: maxVal };
  }, [expenses]);

  return (
    <AppShell title="Expenses">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="h-6 w-6 text-emerald-600" />
              Kharashaadka Dukaanka (Operating Expenses) ({expenses.length})
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Kharashaadka howlgalinta (Koronto, Kiro, Mushahar, Biyo). Wax ka beddel toos ah oo la xisaabinayo.
            </p>
          </div>

          {isAdmin && (
            <Button
              onClick={handleOpenCreate}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20"
            >
              <Plus className="h-4 w-4" />
              Ku dar Kharash Cusub
            </Button>
          )}
        </div>

        {/* Highlight Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <p className="text-xs font-bold text-slate-400 uppercase">Wadarta Kharashaadka Guud</p>
            <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1 font-mono">
              {formatMoney(totalExpenseAmount)}
            </p>
            <p className="text-[11px] text-slate-500">Kharashaadka hoos u dhigaya Net Profit-ka</p>
          </Card>

          <Card className="p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <p className="text-xs font-bold text-slate-400 uppercase">Qeybta Ugu Badan</p>
            <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1 line-clamp-1">
              {topCategorySummary.label}
            </p>
            <p className="text-[11px] text-slate-500">{formatMoney(topCategorySummary.amount)} ayaa ku baxday</p>
          </Card>

          <Card className="p-4 border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs">
            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">Xisaabinta Faa'iidada</p>
            <p className="text-base font-black text-emerald-700 dark:text-emerald-300 mt-1">
              Net Profit = Gross Profit - Expenses
            </p>
            <p className="text-[11px] text-slate-500">Sixidda kharashka waxay si toos ah u cusbooneysiisaa Net Profit</p>
          </Card>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'all', label: 'Dhammaan' },
              { id: 'koronto', label: 'Koronto' },
              { id: 'biyo', label: 'Biyo' },
              { id: 'gaadiid', label: 'Gaadiid' },
              { id: 'kiro', label: 'Kiro' },
              { id: 'mushahar', label: 'Mushahar' },
              { id: 'dayactir', label: 'Dayactir' },
              { id: 'kale', label: 'Kale' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedCategory(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedCategory === f.id
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
              placeholder="Ka baadh kharashka..."
              className="pl-9 h-9 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* EXPENSES TABLE */}
        <Card className="border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 w-12 text-center">#</th>
                  <th className="px-4 py-3.5">Kharashka (Description)</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5 text-right">Lacagta (Amount)</th>
                  <th className="px-4 py-3.5">Taariikhda</th>
                  <th className="px-4 py-3.5">Qoraal</th>
                  <th className="px-4 py-3.5 text-right">Hawlaha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      Kharash laguma helin
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((e, idx) => {
                    const meta = getCategoryMeta(e.category);
                    const Icon = meta.icon;

                    return (
                      <tr key={e.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-4 text-center font-mono text-slate-400 font-bold">
                          {idx + 1}
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-bold text-slate-900 dark:text-white">{e.description}</p>
                        </td>

                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${meta.color}`}>
                            <Icon className="h-3.5 w-3.5" />
                            {meta.label}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-right font-mono font-black text-red-600 dark:text-red-400 text-sm">
                          {formatMoney(e.amount)}
                        </td>

                        <td className="px-4 py-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                          {e.date}
                        </td>

                        <td className="px-4 py-4 text-slate-500 text-xs">
                          {e.notes || '—'}
                        </td>

                        <td className="px-4 py-4 text-right relative">
                          <div className="flex items-center justify-end gap-1">
                            {isAdmin && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenEdit(e)}
                                  className="h-8 px-2.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-1"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                  Wax ka beddel
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeletingExpense(e)}
                                  className="h-8 px-2 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                                  title="Tirtir"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* CREATE EXPENSE MODAL */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-lg">
            <Plus className="h-5 w-5 text-emerald-600" />
            Diiwaangeli Kharash Cusub
          </DialogTitle>
          <DialogDescription>
            Geli faahfaahinta kharashka howlgalinta ee dukaanka
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Faahfaahinta Kharashka *</label>
            <Input
              placeholder="Tusaale: Biilka korontada bisha, Shidaal gaari..."
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Qaybta Kharashka (Category)</label>
              <select
                value={createCategory}
                onChange={(e) => setCreateCategory(e.target.value as any)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium"
              >
                <option value="koronto">Koronto (Electricity)</option>
                <option value="biyo">Biyo (Water)</option>
                <option value="gaadiid">Gaadiid (Transport)</option>
                <option value="kiro">Kiro (Rent)</option>
                <option value="mushahar">Mushahar (Salary)</option>
                <option value="dayactir">Dayactir (Maintenance)</option>
                <option value="internet_tel">Internet & Tel</option>
                <option value="kale">Kharash Kale (Other)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Lacagta ($) *</label>
              <Input
                type="number"
                step="0.01"
                placeholder=""
                value={createAmount}
                onChange={(e) => setCreateAmount(e.target.value)}
                className="mt-1 font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Taariikhda</label>
            <Input
              type="date"
              value={createDate}
              onChange={(e) => setCreateDate(e.target.value)}
              className="mt-1 font-mono"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Qoraal Dheeraad ah</label>
            <Input
              placeholder="Faahfaahin kale haddii ay jirto"
              value={createNotes}
              onChange={(e) => setCreateNotes(e.target.value)}
              className="mt-1"
            />
          </div>
        </DialogBody>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
            Ka noqo
          </Button>
          <Button onClick={handleSaveCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            Keydi Kharashka
          </Button>
        </DialogFooter>
      </Dialog>

      {/* EDIT EXPENSE MODAL */}
      <Dialog open={!!editingExpense} onOpenChange={(open) => !open && setEditingExpense(null)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-lg">
            <Edit className="h-5 w-5 text-emerald-600" />
            Wax ka beddel Kharashka (Edit Expense)
          </DialogTitle>
          <DialogDescription>
            Sax xogta kharashka hore u diiwaangashanaa. Xogta maaliyadda iyo faa'iidada si toos ah ayay u cusbooneysiismi doonaan.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Faahfaahinta Kharashka *</label>
            <Input
              placeholder="Magaca kharashka"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="mt-1 font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Qaybta Kharashka</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as any)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium"
              >
                <option value="koronto">Koronto (Electricity)</option>
                <option value="biyo">Biyo (Water)</option>
                <option value="gaadiid">Gaadiid (Transport)</option>
                <option value="kiro">Kiro (Rent)</option>
                <option value="mushahar">Mushahar (Salary)</option>
                <option value="dayactir">Dayactir (Maintenance)</option>
                <option value="internet_tel">Internet & Tel</option>
                <option value="kale">Kharash Kale (Other)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Lacagta ($) *</label>
              <Input
                type="number"
                step="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="mt-1 font-mono font-black text-base text-red-600 dark:text-red-400"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Taariikhda</label>
            <Input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="mt-1 font-mono"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Qoraal Dheeraad ah</label>
            <Input
              placeholder="Faahfaahin dheeraad ah"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Sababta Wax Ka Beddelka (Reason for Audit)</label>
            <Input
              placeholder="Tusaale: Qiimaha ayaa si qalad ah loo qoray..."
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              className="mt-1 text-slate-600"
            />
          </div>
        </DialogBody>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setEditingExpense(null)}>
            Ka noqo
          </Button>
          <Button onClick={handleSaveEdit} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            Keydi Isbeddelka
          </Button>
        </DialogFooter>
      </Dialog>

      {/* CONFIRM DELETE MODAL */}
      <Dialog open={!!deletingExpense} onOpenChange={(open) => !open && setDeletingExpense(null)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 font-black text-lg">
            <AlertCircle className="h-5 w-5" />
            Ma hubtaa inaad tirtirayso xogtan?
          </DialogTitle>
          <DialogDescription>
            Kharashka "{deletingExpense?.description}" ({formatMoney(deletingExpense?.amount || 0)}) waa laga saari doonaa xisaabaadka.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setDeletingExpense(null)}>
            Ka noqo
          </Button>
          <Button onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700 text-white font-bold">
            Haa, Tirtir
          </Button>
        </DialogFooter>
      </Dialog>
    </AppShell>
  );
}
