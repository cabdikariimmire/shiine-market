'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  Plus, 
  Search, 
  Phone, 
  MapPin, 
  Eye, 
  Truck,
  DollarSign,
  Calendar,
  Layers,
  ArrowRight,
  Edit
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { repository } from '@/lib/services/repository';
import { formatMoney } from '@/lib/calculations/financials';
import { Supplier } from '@/types';

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Edit Supplier Modal State
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editReason, setEditReason] = useState('');

  const { success, error } = useToast();

  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await repository.getSuppliers();
      setSuppliers(data);
    } catch (err: any) {
      console.error('Error loading suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      error('Geli magaca iyo taleefanka alaab-qeybiyaha');
      return;
    }

    try {
      await repository.createSupplier({
        name: name.trim(),
        phone: phone.trim(),
        company: company.trim(),
        address: address.trim(),
        notes: notes.trim(),
      });
      success('Alaab-qeybiye cusub ayaa la keydiyey', name);
      setIsModalOpen(false);
      setName('');
      setPhone('');
      setCompany('');
      setAddress('');
      setNotes('');
      await loadData();
    } catch (err: any) {
      error('Khalad baa dhacay', err.message);
    }
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setEditName(s.name || '');
    setEditPhone(s.phone || '');
    setEditCompany(s.company || '');
    setEditAddress(s.address || '');
    setEditNotes(s.notes || '');
    setEditReason('');
  };

  const handleSaveEdit = async () => {
    if (!editingSupplier) return;
    if (!editName.trim() || !editPhone.trim()) {
      error('Geli magaca iyo taleefanka alaab-qeybiyaha');
      return;
    }

    try {
      await repository.updateSupplier(editingSupplier.id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        company: editCompany.trim(),
        address: editAddress.trim(),
        notes: editNotes.trim(),
      }, editReason.trim() || 'Wax ka beddel alaab-qeybiye');
      success('Xogta alaab-qeybiyaha si guul leh ayaa loo saxay', editName);
      setEditingSupplier(null);
      await loadData();
    } catch (err: any) {
      error('Lama cusbooneysiin karin alaab-qeybiyaha', err.message);
    }
  };

  const filtered = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search) ||
    (s.company && s.company.toLowerCase().includes(search.toLowerCase())) ||
    (s.address && s.address.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <AppShell title="Suppliers">
      <div className="space-y-6">
        {/* Header with Add & AI Scan Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="h-6 w-6 text-emerald-600" />
              Alaab-qeybiyeyaasha (Suppliers) ({suppliers.length})
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Kormeerka shirkadaha, taariikhda iibsashada bishii iyo xisaabaadka alaab-qeybiyaha
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button 
              onClick={() => setIsModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20"
            >
              <Plus className="h-4 w-4" />
              Ku dar Alaab-qeybiye Cusub
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Ka baadh magaca, shirkadda, tel..."
            className="pl-10 h-10 bg-white dark:bg-slate-900"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* SUPPLIERS TABLE */}
        <Card className="border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 w-12 text-center">#</th>
                  <th className="px-4 py-3.5">Supplier (Qofka/Shirkadda)</th>
                  <th className="px-4 py-3.5">Phone (Tel)</th>
                  <th className="px-4 py-3.5 text-center">Iibsiyo (Invoices)</th>
                  <th className="px-4 py-3.5 text-right">Wadarta Guud</th>
                  <th className="px-4 py-3.5">Iibkii Ugu Dambeeyey</th>
                  <th className="px-4 py-3.5 text-right">Hawlaha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      Alaab-qeybiye laguma helin
                    </td>
                  </tr>
                ) : (
                  filtered.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-4 text-center font-mono text-slate-400 font-bold">
                        {idx + 1}
                      </td>

                      <td className="px-4 py-4">
                        <Link href={`/suppliers/${s.id}`} className="hover:underline">
                          <p className="font-bold text-slate-900 dark:text-white">{s.name}</p>
                        </Link>
                        {s.company && (
                          <p className="text-[11px] text-slate-500 font-medium">{s.company}</p>
                        )}
                        {s.address && (
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" /> {s.address}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        <a href={`tel:${s.phone}`} className="hover:text-emerald-600 flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {s.phone}
                        </a>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span className="font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                          {s.total_purchases || 0}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        {formatMoney(s.total_spend || 0)}
                      </td>

                      <td className="px-4 py-4 text-xs font-mono text-slate-500">
                        {s.last_purchase_date || '—'}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEdit(s)}
                            className="h-8 px-2 text-xs font-bold text-slate-600 hover:text-emerald-600 gap-1"
                            title="Wax ka beddel xogta"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Wax ka beddel</span>
                          </Button>
                          <Link href={`/suppliers/${s.id}`}>
                            <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs font-bold gap-1">
                              <Eye className="h-3.5 w-3.5" />
                              Arag
                            </Button>
                          </Link>
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

      {/* CREATE SUPPLIER MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black">
            <Building2 className="h-5 w-5 text-emerald-600" />
            Ku dar Alaab-qeybiye Cusub
          </DialogTitle>
          <DialogDescription>
            Geli xogta shirkadda ama qofka alaabta laga soo iibsado
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Magaca Qofka / Shirkadda *</label>
            <Input
              placeholder="Tusaale: Xamse Ganacsi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Taleefanka *</label>
              <Input
                placeholder="61xxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Magaca Ganacsiga (Company)</label>
              <Input
                placeholder="Xamse Trade Ltd"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Cinwaanka (Address)</label>
            <Input
              placeholder="Suuqa Bakaaraha, Mogadishu"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Faahfaahin / Qoraal</label>
            <Input
              placeholder="Qeybiye bariis, saliid, iwm..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1"
            />
          </div>
        </DialogBody>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setIsModalOpen(false)}>
            Ka noqo
          </Button>
          <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            Keydi Alaab-qeybiye
          </Button>
        </DialogFooter>
      </Dialog>

      {/* EDIT SUPPLIER MODAL */}
      <Dialog open={!!editingSupplier} onOpenChange={(open) => !open && setEditingSupplier(null)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black">
            <Edit className="h-5 w-5 text-emerald-600" />
            Wax ka beddel Alaab-qeybiyaha
          </DialogTitle>
          <DialogDescription>
            Wax ka beddel macluumaadka <strong>{editingSupplier?.name}</strong>. Ma abuurayo supplier labaad.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 text-xs">
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
        </DialogBody>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setEditingSupplier(null)}>
            Ka noqo
          </Button>
          <Button onClick={handleSaveEdit} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            Keydi Isbeddelka
          </Button>
        </DialogFooter>
      </Dialog>
    </AppShell>
  );
}
