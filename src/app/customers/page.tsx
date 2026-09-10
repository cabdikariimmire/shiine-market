'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  MapPin, 
  CreditCard, 
  Eye, 
  ArrowRight,
  UserCheck,
  Edit,
  MoreVertical,
  History,
  FileText
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
import { Customer } from '@/types';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Edit Customer Modal State
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editReason, setEditReason] = useState('');

  const { success, error } = useToast();

  const loadData = async () => {
    try {
      const data = await repository.getCustomers(search);
      setCustomers(data);
    } catch (err) {
      console.error('Error loading customers:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const totalOutstandingDebt = customers.reduce((sum, c) => sum + (c.remaining_debt || 0), 0);
  const totalPaidDebt = customers.reduce((sum, c) => sum + (c.paid_debt || 0), 0);

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      error('Geli magaca iyo taleefanka macmiilka');
      return;
    }

    try {
      await repository.createCustomer({
        name,
        phone,
        address,
        notes,
      });
      success('Macmiil cusub ayaa la diiwaangeliyey', name);
      setIsModalOpen(false);
      setName('');
      setPhone('');
      setAddress('');
      setNotes('');
      await loadData();
    } catch (err: any) {
      error('Khalad baa dhacay', err.message);
    }
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setEditName(c.name || '');
    setEditPhone(c.phone || '');
    setEditAddress(c.address || '');
    setEditNotes(c.notes || '');
    setEditReason('');
  };

  const handleSaveEdit = async () => {
    if (!editingCustomer) return;
    if (!editName.trim() || !editPhone.trim()) {
      error('Geli magaca iyo taleefanka macmiilka');
      return;
    }

    try {
      await repository.updateCustomer(editingCustomer.id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        address: editAddress.trim(),
        notes: editNotes.trim(),
      }, editReason.trim() || 'Wax ka beddel macmiil');
      success('Xogta macmiilka si guul leh ayaa loo saxay', editName);
      setEditingCustomer(null);
      await loadData();
    } catch (err: any) {
      error('Lama cusbooneysiin karin macmiilka', err.message);
    }
  };

  return (
    <AppShell title="Macaamiisha (Customers)">
      <div className="space-y-6">
        {/* Header & Add Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="h-6 w-6 text-emerald-600" />
              Macaamiisha Dukaanka ({customers.length})
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Maamul xogta macaamiisha, daymaha ku maqan iyo taariikhda bixinta
            </p>
          </div>

          <Button onClick={() => setIsModalOpen(true)} className="font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20">
            <Plus className="h-4 w-4" />
            Ku dar Macmiil Cusub
          </Button>
        </div>

        {/* Debt Highlight Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 border border-slate-200/80 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-500 uppercase">Tirada Macaamiisha</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {customers.length} Macmiil
            </p>
          </Card>

          <Card className="p-4 border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase">Wadarta Daynta Maqan</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
              {formatMoney(totalOutstandingDebt)}
            </p>
          </Card>

          <Card className="p-4 border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20">
            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">Dayn Horay Loo Bixiyey</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
              {formatMoney(totalPaidDebt)}
            </p>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Ka baadh magaca macmiilka, tel..."
            className="pl-10 h-10 bg-white dark:bg-slate-900"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Customers Table */}
        <Card className="border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Macmiilka</th>
                  <th className="px-5 py-3.5">Taleefanka</th>
                  <th className="px-5 py-3.5">Cinwaanka</th>
                  <th className="px-5 py-3.5 text-right">Daynta Guud</th>
                  <th className="px-5 py-3.5 text-right">La Bixiyey</th>
                  <th className="px-5 py-3.5 text-right">Haraaga Daynta</th>
                  <th className="px-5 py-3.5 text-right">Hawlaha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      Macmiil laguma helin
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => {
                    const hasDebt = (c.remaining_debt || 0) > 0;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-4">
                          <Link href={`/customers/${c.id}`} className="font-bold text-slate-900 dark:text-white hover:underline">
                            {c.name}
                          </Link>
                          {c.notes && (
                            <p className="text-[11px] text-slate-400 line-clamp-1">{c.notes}</p>
                          )}
                        </td>

                        <td className="px-5 py-4 font-mono text-slate-600 dark:text-slate-300">
                          {c.phone}
                        </td>

                        <td className="px-5 py-4 text-slate-500">
                          {c.address || '—'}
                        </td>

                        <td className="px-5 py-4 text-right font-mono text-slate-500">
                          {formatMoney(c.total_debt)}
                        </td>

                        <td className="px-5 py-4 text-right font-mono text-emerald-600 font-bold">
                          {formatMoney(c.paid_debt)}
                        </td>

                        <td className="px-5 py-4 text-right font-mono font-black text-base">
                          {hasDebt ? (
                            <span className="text-amber-600 dark:text-amber-400">
                              {formatMoney(c.remaining_debt)}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs font-normal">Dayn Ma Laha ✓</span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(c)}
                              className="h-8 px-2 text-xs font-bold text-slate-600 hover:text-emerald-600 gap-1"
                              title="Wax ka beddel macmiilka"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Wax ka beddel</span>
                            </Button>
                            <Link href={`/customers/${c.id}`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-emerald-600" title="Arag Xogta">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
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

        {/* Modal: Add Customer */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogClose onClick={() => setIsModalOpen(false)} />
          <DialogHeader>
            <DialogTitle>Diiwaangeli Macmiil Cusub</DialogTitle>
            <DialogDescription>Geli magaca, taleefanka iyo cinwaanka macmiilka</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Magaca Macmiilka *
              </label>
              <Input
                placeholder="tusaale: Axmed Cali Warsame"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Lambarka Taleefanka *
              </label>
              <Input
                placeholder="tusaale: +252 61 5123456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Cinwaanka / Xaafadda
              </label>
              <Input
                placeholder="tusaale: Hodan, Taleex, Mogadishu"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Faahfaahin Dheeraad ah (Notes)
              </label>
              <Input
                placeholder="tusaale: Macmiil joogto ah, mushaharle..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Ka Noqo</Button>
            <Button onClick={handleSave} className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white">Keydi Macmiilka</Button>
          </DialogFooter>
        </Dialog>

        {/* Modal: Edit Customer (In-Place Correction) */}
        <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
          <DialogClose onClick={() => setEditingCustomer(null)} />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-emerald-600" />
              Wax ka beddel Xogta Macmiilka
            </DialogTitle>
            <DialogDescription>
              Wax ka beddel macluumaadka macmiilka <strong>{editingCustomer?.name}</strong>. Ma abuurayo macmiil labaad.
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
                placeholder="Tusaale: Tel sax ah, magac sixid..."
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCustomer(null)}>Ka Noqo</Button>
            <Button onClick={handleSaveEdit} className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white">Keydi Isbeddelka</Button>
          </DialogFooter>
        </Dialog>
      </div>
    </AppShell>
  );
}
