'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  FolderTree, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Package, 
  Boxes, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { repository } from '@/lib/services/repository';
import { Category } from '@/types';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDesc, setCategoryDesc] = useState('');
  const [editReason, setEditReason] = useState('');
  const { success, error } = useToast();

  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await repository.getCategories();
      setCategories(data);
    } catch (err: any) {
      console.error('Error loading categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryDesc('');
    setEditReason('');
    setIsModalOpen(true);
  };

  const openEditModal = (c: Category) => {
    setEditingCategory(c);
    setCategoryName(c.name);
    setCategoryDesc(c.description || '');
    setEditReason('');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!categoryName.trim()) {
      error('Magaca qaybta geli');
      return;
    }

    try {
      if (editingCategory) {
        await repository.updateCategory(editingCategory.id, {
          name: categoryName.trim(),
          description: categoryDesc.trim(),
        }, editReason.trim() || 'Wax ka beddel qayb');
        success('Xogta qaybta si guul leh ayaa loo saxay', categoryName);
      } else {
        await repository.createCategory({
          name: categoryName.trim(),
          description: categoryDesc.trim(),
        });
        success('Qayb cusub ayaa lagu daray', categoryName);
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      error('Khalad baa dhacay', err.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Ma hubtaa inaad tirtirto qaybta: "${name}"?`)) {
      try {
        await repository.deleteCategory(id);
        success('Qaybta waa la tirtiray', name);
        await loadData();
      } catch (err: any) {
        error('Khalad baa dhacay', err.message);
      }
    }
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <AppShell title="Qaybaha Alaabta (Categories)">
      <div className="space-y-6">
        {/* Header with Add Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FolderTree className="h-6 w-6 text-emerald-600" />
              Qaybaha Alaabta ({categories.length})
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              U habee alaabta dukaanka qaybo gaar ah si fudud loogu baaro
            </p>
          </div>

          <Button onClick={openAddModal} className="font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="h-4 w-4" />
            Ku dar Qayb Cusub
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Ka baadh qaybaha..."
            className="pl-10 h-10 bg-white dark:bg-slate-900"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredCategories.map((cat) => (
            <Card key={cat.id} className="border border-slate-200/80 dark:border-slate-800 hover:shadow-md transition-all flex flex-col justify-between">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400">
                    <Boxes className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(cat)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="Wax ka beddel"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id, cat.name)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                      title="Tirtir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 min-h-[32px]">
                    {cat.description || 'Qaybta alaabooyinka dukaanka'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {cat._count?.products || 0} Nooc oo Alaab ah
                  </span>
                  <Link
                    href={`/products?category=${cat.id}`}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 font-semibold"
                  >
                    Arag <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Modal: Add/Edit Category */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogClose onClick={() => setIsModalOpen(false)} />
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Wax ka beddel Qaybta' : 'Ku dar Qayb Cusub'}
            </DialogTitle>
            <DialogDescription>
              Geli magaca qaybta iyo faahfaahinta kooban
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Magaca Qaybta (Category Name) *
              </label>
              <Input
                placeholder="tusaale: Raashin, Cabitaan, Nadaafad..."
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Sharaxaad (Description)
              </label>
              <Input
                placeholder="tusaale: Bariis, Sonkor, Bur, Baasto..."
                value={categoryDesc}
                onChange={(e) => setCategoryDesc(e.target.value)}
              />
            </div>

            {editingCategory && (
              <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Sababta Wax ka beddelka (Audit Reason)
                </label>
                <Input
                  placeholder="Tusaale: Magac saxid, qayb cusbooneysiin..."
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Ka Noqo</Button>
            <Button onClick={handleSave} className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white">Keydi Qaybta</Button>
          </DialogFooter>
        </Dialog>
      </div>
    </AppShell>
  );
}
