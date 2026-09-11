'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  Trash2, 
  Barcode, 
  MoreVertical,
  History,
  ShoppingCart,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Layers,
  Camera,
  Scale,
  X
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { repository } from '@/lib/services/repository';
import { formatMoney } from '@/lib/calculations/financials';
import { 
  calculateCostPerBaseUnit, 
  calculateUnitProfit, 
  getStockStatus,
  calculateMinSellableQty,
  ALLOWED_INCOMING_UNITS,
  ALLOWED_SELLING_UNITS 
} from '@/lib/calculations/stock';
import { Category, ProductVariant, StockMovement, Supplier } from '@/types';
import { useAuth } from '@/lib/auth/auth-context';

export default function ProductsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { success, error, info } = useToast();

  // Data & Pagination States
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'pending'>('all');

  // Modals & Action States
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  // Stock In Modal ("Soo Xaree Alaab") - Empty input rule: blank string
  const [isStockInOpen, setIsStockInOpen] = useState(false);
  const [stockInProduct, setStockInProduct] = useState('');
  const [stockInVariant, setStockInVariant] = useState('');
  const [stockInQty, setStockInQty] = useState<string>('');
  const [stockInPUnit, setStockInPUnit] = useState('jawan');
  const [stockInSUnit, setStockInSUnit] = useState('kg');
  const [stockInConv, setStockInConv] = useState<string>('');
  const [stockInDivision, setStockInDivision] = useState<string>('1');
  const [stockInBuy, setStockInBuy] = useState<string>('');
  const [stockInSell, setStockInSell] = useState<string>('');
  const [stockInSupplier, setStockInSupplier] = useState('');
  const [stockInCat, setStockInCat] = useState('');
  const [stockInMin, setStockInMin] = useState<string>('');

  // Edit / Finalize Modal (Real zero rule: prefilled with actual values)
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [editProductName, setEditProductName] = useState('');
  const [editVariantName, setEditVariantName] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editBuyPrice, setEditBuyPrice] = useState<string>('');
  const [editPurchaseUnit, setEditPurchaseUnit] = useState('jawan');
  const [editSellPrice, setEditSellPrice] = useState<string>('');
  const [editSellingUnit, setEditSellingUnit] = useState('kg');
  const [editConversion, setEditConversion] = useState<string>('');
  const [editDivision, setEditDivision] = useState<string>('1');
  const [editMinStock, setEditMinStock] = useState<string>('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editSupplierId, setEditSupplierId] = useState('');
  const [editIncomingQty, setEditIncomingQty] = useState<string>('');
  const [editReason, setEditReason] = useState('');

  // Stock Adjustment Modal State (Physical count correction)
  const [adjustingVariant, setAdjustingVariant] = useState<ProductVariant | null>(null);
  const [adjustMode, setAdjustMode] = useState<'physical_count' | 'delta'>('physical_count');
  const [physicalCountInput, setPhysicalCountInput] = useState<string>('');
  const [deltaInput, setDeltaInput] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('');

  // Stock History Modal
  const [historyVariant, setHistoryVariant] = useState<ProductVariant | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [res, cats, supps] = await Promise.all([
        repository.getVariantsPaginated(search, selectedCategory, statusFilter, currentPage, pageSize),
        repository.getCategories(),
        repository.getSuppliers(),
      ]);
      setVariants(res.data);
      setTotalCount(res.totalCount);
      setTotalPages(res.totalPages);
      setCategories(cats);
      setSuppliers(supps);
    } catch (err) {
      console.error('Error loading products:', err);
    }
  }, [search, selectedCategory, statusFilter, currentPage, pageSize]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Edit Modal
  const handleOpenEdit = (v: ProductVariant) => {
    setEditingVariant(v);
    setEditProductName(v.product?.name || '');
    setEditVariantName(v.variant_name);
    setEditSku(v.sku || '');
    setEditBarcode(v.barcode || '');
    setEditBuyPrice(String(v.buy_price ?? 0));
    setEditPurchaseUnit(v.purchase_unit || 'jawan');
    setEditSellPrice(String(v.sell_price ?? 0));
    setEditSellingUnit(v.selling_unit || 'kg');
    setEditConversion(String(v.conversion_factor || 1));
    setEditDivision(String(v.unit_division || 1));
    setEditMinStock(String(v.minimum_stock ?? 0));
    setEditCategoryId(v.product?.category_id || '');
    setEditSupplierId(v.supplier_id || '');
    setEditIncomingQty(String(v.is_pending ? v.stock_quantity : 0));
    setEditReason('');
    setActiveActionMenuId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingVariant) return;

    if (!editProductName.trim() || !editVariantName.trim()) {
      error('Geli magaca alaabta iyo nooca (variant)');
      return;
    }

    const buyPrice = parseFloat(editBuyPrice) || 0;
    const sellPrice = parseFloat(editSellPrice) || 0;
    const conversion = parseFloat(editConversion) || 1;
    const division = Math.max(1, parseFloat(editDivision) || 1);
    const minSellable = calculateMinSellableQty(division);
    const minStock = parseFloat(editMinStock) || 0;
    const incomingQty = parseFloat(editIncomingQty) || 0;

    try {
      if (editingVariant.is_pending) {
        await repository.finalizePendingVariant(editingVariant.id, {
          productName: editProductName.trim(),
          variantName: editVariantName.trim(),
          buyPrice: buyPrice,
          purchaseUnit: editPurchaseUnit,
          sellPrice: sellPrice,
          sellingUnit: editSellingUnit,
          conversionFactor: conversion,
          unitDivision: division,
          minSellableQty: minSellable,
          quantityToAdd: incomingQty,
          categoryId: editCategoryId.trim() ? editCategoryId.trim() : undefined,
          minimumStock: minStock,
          supplierId: editSupplierId.trim() ? editSupplierId.trim() : undefined,
        }, editReason.trim() || `Xaqiijiyey AI pending: ${editProductName}`);
        success('Alaabta waa la xaqiijiyey!', `${editProductName} (${editVariantName}) hadda waa rasmi.`);
      } else {
        await repository.updateVariant(editingVariant.id, {
          productName: editProductName.trim(),
          categoryId: editCategoryId.trim() ? editCategoryId.trim() : null,
          variant_name: editVariantName.trim(),
          sku: editSku.trim() || null,
          barcode: editBarcode.trim() || null,
          buy_price: buyPrice,
          purchase_unit: editPurchaseUnit,
          sell_price: sellPrice,
          selling_unit: editSellingUnit,
          conversion_factor: conversion,
          unit_division: division,
          min_sellable_qty: minSellable,
          minimum_stock: minStock,
          supplier_id: editSupplierId.trim() ? editSupplierId.trim() : null,
        }, editReason.trim() || `Wax ka beddel alaabta: ${editProductName} (${editVariantName})`);
        success('Xogta si guul leh ayaa loo saxay.', `${editProductName} (${editVariantName})`);
      }

      setEditingVariant(null);
      await loadData();
    } catch (err: any) {
      error('Xogta lama sixi karin. Fadlan mar kale isku day.', err.message);
    }
  };

  // Open Stock Adjustment Modal
  const handleOpenAdjustment = (v: ProductVariant) => {
    setAdjustingVariant(v);
    setAdjustMode('physical_count');
    setPhysicalCountInput(String(v.stock_quantity));
    setDeltaInput('0');
    setAdjustReason('Sixidda tirada dhabta ah (Physical count correction)');
    setActiveActionMenuId(null);
  };

  // Save Stock Adjustment
  const handleSaveAdjustment = async () => {
    if (!adjustingVariant) return;

    let delta = 0;
    if (adjustMode === 'physical_count') {
      const physical = parseFloat(physicalCountInput);
      if (isNaN(physical) || physical < 0) {
        error('Geli tirada dhabta ah ee yaalla (0 ama ka weyn)');
        return;
      }
      delta = physical - adjustingVariant.stock_quantity;
    } else {
      delta = parseFloat(deltaInput);
      if (isNaN(delta) || delta === 0) {
        error('Geli tirada isbeddelka (+ ama -)');
        return;
      }
    }

    if (adjustingVariant.stock_quantity + delta < 0) {
      error('Kaydku kama dhici karo 0 ka yar');
      return;
    }

    try {
      await repository.recordStockAdjustment(
        adjustingVariant.id,
        delta,
        adjustReason.trim() || 'Physical inventory count adjustment'
      );

      success('Kaydka si guul leh ayaa loo saxay.', `${adjustingVariant.product?.name} (${adjustingVariant.variant_name}): ${delta >= 0 ? '+' : ''}${delta} ${adjustingVariant.selling_unit}`);
      setAdjustingVariant(null);
      await loadData();
    } catch (err: any) {
      error('Khalad baa dhacay', err.message);
    }
  };

  // Handle Manual Incoming Stock Save (Stock In)
  const handleSaveStockIn = async () => {
    const qty = parseFloat(stockInQty);
    const conv = parseFloat(stockInConv) || 1;
    const division = Math.max(1, parseFloat(stockInDivision) || 1);
    const minSellable = calculateMinSellableQty(division);
    const buy = parseFloat(stockInBuy) || 0;
    const sell = parseFloat(stockInSell);
    const min = parseFloat(stockInMin) || 0;

    if (!stockInProduct.trim() || !stockInVariant.trim()) {
      error('Geli magaca alaabta iyo nooca');
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      error('Geli tirada soo gashay (quantity)');
      return;
    }
    if (isNaN(sell) || sell <= 0) {
      error('Geli qiimaha iibinta');
      return;
    }

    try {
      await repository.recordIncomingStock({
        productName: stockInProduct,
        variantName: stockInVariant,
        quantity: qty,
        purchaseUnit: stockInPUnit,
        sellingUnit: stockInSUnit,
        conversionFactor: conv,
        unitDivision: division,
        minSellableQty: minSellable,
        buyPrice: buy,
        sellPrice: sell,
        supplierId: stockInSupplier || undefined,
        categoryId: stockInCat || undefined,
        minimumStock: min,
      }, `Alaab soo gashay: ${stockInProduct} +${qty} ${stockInPUnit}`);

      success('Alaab cusub ayaa soo gashay!', `${stockInProduct} (${stockInVariant}) +${qty} ${stockInPUnit}`);
      setIsStockInOpen(false);
      setStockInProduct('');
      setStockInVariant('');
      setStockInQty('');
      setStockInConv('');
      setStockInDivision('1');
      setStockInBuy('');
      setStockInSell('');
      setStockInMin('');
      setStockInSupplier('');
      setStockInCat('');
      await loadData();
    } catch (err: any) {
      error('Khalad baa dhacay', err.message);
    }
  };

  // Open Stock History
  const handleOpenHistory = async (v: ProductVariant) => {
    setHistoryVariant(v);
    const movs = await repository.getStockMovementsForVariant(v.id);
    setMovements(movs);
    setActiveActionMenuId(null);
  };

  // Quick Sell: Navigates to POS
  const handleQuickSell = (v: ProductVariant) => {
    router.push(`/sales/new?barcode=${v.barcode || v.sku || ''}`);
  };

  // Delete Variant
  const handleDelete = async (v: ProductVariant) => {
    if (confirm(`Ma hubtaa inaad tirtirto noocan: "${v.product?.name} - ${v.variant_name}"?`)) {
      try {
        await repository.deleteVariant(v.id, `Tirtiray nooca: ${v.product?.name} (${v.variant_name})`);
        success('Nooca waa la tirtiray', `${v.product?.name} (${v.variant_name})`);
        await loadData();
      } catch (err: any) {
        error('Khalad baa dhacay', err.message);
      }
    }
    setActiveActionMenuId(null);
  };

  return (
    <AppShell title="Products">
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Package className="h-6 w-6 text-emerald-600" />
              Liiska Alaabta & Noocyada ({totalCount.toLocaleString()})
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Alaabta, Noocyada (Variants), Kaydka tooska ah, Sixidda (Adjustment) iyo Taariikhda soo galka
            </p>
          </div>

          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2.5">
              <Link href="/ai-camera">
                <Button variant="outline" className="font-bold flex items-center gap-2 border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
                  <Camera className="h-4 w-4 text-emerald-600" />
                  AI Scan Invoice
                </Button>
              </Link>

              <Button 
                onClick={() => {
                  setStockInProduct('');
                  setStockInVariant('');
                  setStockInQty('');
                  setStockInConv('');
                  setStockInBuy('');
                  setStockInSell('');
                  setStockInMin('');
                  setStockInSupplier('');
                  setStockInCat('');
                  setIsStockInOpen(true);
                }}
                className="font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Plus className="h-4 w-4" />
                Soo Xaree Alaab (Stock In)
              </Button>
            </div>
          )}
        </div>

        {/* Search & Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="md:col-span-5 relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Ka baadh magaca, Variant, Barcode, SKU..."
              className="pl-10 h-10"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold"
            >
              <option value="all">Dhammaan Qaybaha (All Categories)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold"
            >
              <option value="all">Dhammaan Xaaladaha</option>
              <option value="in_stock">🟢 In Stock</option>
              <option value="low_stock">🟡 Low Stock</option>
              <option value="out_of_stock">🔴 Out of Stock</option>
              <option value="pending">⏳ Pending (AI Scan)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={pageSize}
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold"
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={25}>25 saf / bog</option>
              <option value={50}>50 saf / bog</option>
              <option value={100}>100 saf / bog</option>
            </select>
          </div>
        </div>

        {/* PRODUCTS & VARIANTS TABLE */}
        <Card className="border border-slate-200/80 dark:border-slate-800 overflow-visible shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 w-12 text-center">#</th>
                  <th className="px-4 py-3.5">Alaabta</th>
                  <th className="px-4 py-3.5">Variant / Nooca</th>
                  <th className="px-4 py-3.5 text-right">Buy (Soo Iib)</th>
                  <th className="px-4 py-3.5 text-right">Sell (Iib)</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5 text-right">Stock (Kayd)</th>
                  <th className="px-4 py-3.5 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {variants.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
                      Alaab laguma helin shuruudahan
                    </td>
                  </tr>
                ) : (
                  variants.map((v, index) => {
                    const rowNumber = (currentPage - 1) * pageSize + index + 1;
                    const status = getStockStatus(v.stock_quantity, v.minimum_stock, v.is_pending);
                    const costPerBase = calculateCostPerBaseUnit(v.buy_price, v.conversion_factor);
                    const unitProfit = calculateUnitProfit(v.sell_price, costPerBase);

                    return (
                      <tr 
                        key={v.id} 
                        className={`transition-colors ${
                          v.is_pending 
                            ? 'bg-amber-50/60 hover:bg-amber-100/60 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 border-l-4 border-l-amber-500' 
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="px-4 py-4 text-center font-mono text-slate-400 font-bold">
                          {rowNumber}
                        </td>

                        <td className="px-4 py-4">
                          <Link href={`/products/${v.product_id}`} className="hover:underline">
                            <p className="font-bold text-slate-900 dark:text-white line-clamp-1">
                              {v.product?.name || 'Alaab'}
                            </p>
                          </Link>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            {v.barcode && (
                              <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                                {v.barcode}
                              </span>
                            )}
                            {v.sku && <span>SKU: {v.sku}</span>}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <span className="font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-900">
                            {v.variant_name}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-right font-mono text-slate-600 dark:text-slate-300">
                          {formatMoney(v.buy_price)}
                          <span className="text-[11px] text-slate-400 ml-1">/{v.purchase_unit}</span>
                          {v.conversion_factor > 1 && (
                            <p className="text-[10px] text-slate-400">
                              (Cost: {formatMoney(costPerBase)}/{v.selling_unit})
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {v.is_pending && v.sell_price === 0 ? (
                            <span className="text-amber-600 font-semibold italic text-xs">— Geli Iibka</span>
                          ) : (
                            <>
                              {formatMoney(v.sell_price)}
                              <span className="text-[11px] text-slate-400 ml-1 font-normal">/{v.selling_unit}</span>
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                                +{formatMoney(unitProfit)} faa'iido
                              </p>
                            </>
                          )}
                        </td>

                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${status.badgeClass}`}>
                            <span>{status.icon}</span>
                            <span>{status.labelSomali}</span>
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-700 dark:text-slate-300">
                            {v.category?.name || v.product?.category?.name || '—'}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-right">
                          <span className="font-black text-slate-900 dark:text-white text-sm">
                            {v.stock_quantity.toLocaleString()}
                          </span>
                          <span className="text-xs text-slate-500 ml-1">{v.selling_unit}</span>
                          {v.conversion_factor > 1 && v.stock_quantity >= v.conversion_factor && (
                            <p className="text-[10px] text-slate-400">
                              ≈ {(v.stock_quantity / v.conversion_factor).toFixed(1)} {v.purchase_unit}
                            </p>
                          )}
                          {v.unit_division && v.unit_division > 1 && (
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                              Min: {v.min_sellable_qty || (1 / v.unit_division)} {v.selling_unit}
                            </p>
                          )}
                        </td>

                        {/* Actions Menu */}
                        <td className="px-4 py-4 text-center relative">
                          {v.is_pending ? (
                            <Button
                              size="sm"
                              onClick={() => handleOpenEdit(v)}
                              className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-7 px-2.5 text-xs shadow-xs"
                            >
                              <Edit className="h-3 w-3 mr-1" /> Sax & Keydi
                            </Button>
                          ) : (
                            <div className="relative inline-block text-left">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                                onClick={() => setActiveActionMenuId(activeActionMenuId === v.id ? null : v.id)}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>

                              {activeActionMenuId === v.id && (
                                <div className="absolute right-0 mt-1 w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 text-left">
                                  <Link
                                    href={`/products/${v.product_id}`}
                                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    onClick={() => setActiveActionMenuId(null)}
                                  >
                                    <Eye className="h-3.5 w-3.5 text-slate-400" />
                                    <span>Faahfaahin (View)</span>
                                  </Link>

                                  {isAdmin && (
                                    <>
                                      <button
                                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                        onClick={() => handleOpenEdit(v)}
                                      >
                                        <Edit className="h-3.5 w-3.5 text-blue-500" />
                                        <span>Wax ka beddel (Edit)</span>
                                      </button>

                                      <button
                                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                        onClick={() => handleOpenAdjustment(v)}
                                      >
                                        <Scale className="h-3.5 w-3.5 text-amber-500" />
                                        <span>Sixid Stock (Adjustment)</span>
                                      </button>

                                      <button
                                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                        onClick={() => {
                                          setStockInProduct(v.product?.name || '');
                                          setStockInVariant(v.variant_name);
                                          setStockInQty('');
                                          setStockInBuy(String(v.buy_price ?? ''));
                                          setStockInSell(String(v.sell_price ?? ''));
                                          setStockInPUnit(v.purchase_unit);
                                          setStockInSUnit(v.selling_unit);
                                          setStockInConv(String(v.conversion_factor ?? ''));
                                          setStockInSupplier(v.supplier_id || '');
                                          setIsStockInOpen(true);
                                          setActiveActionMenuId(null);
                                        }}
                                      >
                                        <Truck className="h-3.5 w-3.5 text-emerald-500" />
                                        <span>Soo Xaree (Stock In)</span>
                                      </button>
                                    </>
                                  )}

                                  <button
                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    onClick={() => handleQuickSell(v)}
                                  >
                                    <ShoppingCart className="h-3.5 w-3.5 text-emerald-600" />
                                    <span>Iibi POS (Sell)</span>
                                  </button>

                                  <button
                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    onClick={() => handleOpenHistory(v)}
                                  >
                                    <History className="h-3.5 w-3.5 text-purple-500" />
                                    <span>Stock History</span>
                                  </button>

                                  {isAdmin && (
                                    <>
                                      <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                                      <button
                                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                        onClick={() => handleDelete(v)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                        <span>Tirtir Noocan</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 gap-4">
            <p className="text-xs text-slate-500 font-medium">
              Waxaa muuqda <span className="font-bold text-slate-900 dark:text-white">{Math.min(totalCount, (currentPage - 1) * pageSize + 1)}</span> - <span className="font-bold text-slate-900 dark:text-white">{Math.min(totalCount, currentPage * pageSize)}</span> ee <span className="font-bold text-slate-900 dark:text-white">{totalCount.toLocaleString()}</span> nooc
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="h-8 px-3 text-xs font-bold gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Hore
              </Button>

              <span className="text-xs font-semibold px-2">
                Bogga {currentPage} / {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="h-8 px-3 text-xs font-bold gap-1"
              >
                Xiga
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* 1. STOCK IN MODAL */}
      <Dialog open={isStockInOpen} onOpenChange={setIsStockInOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-lg">
            <Truck className="h-5 w-5 text-emerald-600" />
            Soo Xaree Alaab (Manual Stock In)
          </DialogTitle>
          <DialogDescription>
            Geli xogta alaabta soo gashay dukaanka si toos ah
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Magaca Alaabta *</label>
              <Input
                placeholder="Tusaale: Bariis Basmati"
                value={stockInProduct}
                onChange={(e) => setStockInProduct(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Nooca / Variant *</label>
              <Input
                placeholder="Tusaale: 50kg, Cas, Cagaar..."
                value={stockInVariant}
                onChange={(e) => setStockInVariant(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Tirada Soo Gashay *</label>
              <Input
                type="number"
                step="0.01"
                placeholder=""
                value={stockInQty}
                onChange={(e) => setStockInQty(e.target.value)}
                className="mt-1 font-mono font-bold"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Halbeegga Soo Galka *</label>
              <select
                value={stockInPUnit}
                onChange={(e) => setStockInPUnit(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs font-bold"
              >
                {ALLOWED_INCOMING_UNITS.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
                {!ALLOWED_INCOMING_UNITS.some(u => u.value === stockInPUnit) && (
                  <option value={stockInPUnit}>{stockInPUnit}</option>
                )}
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Qiimaha Soo Iibka ($)</label>
              <Input
                type="number"
                step="0.01"
                placeholder=""
                value={stockInBuy}
                onChange={(e) => setStockInBuy(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-medium text-slate-600 dark:text-slate-400">1 {stockInPUnit.toUpperCase()} =</label>
                <Input
                  type="number"
                  placeholder="50"
                  value={stockInConv}
                  onChange={(e) => setStockInConv(e.target.value)}
                  className="mt-1 font-mono font-bold"
                />
              </div>
              <div>
                <label className="font-medium text-slate-600 dark:text-slate-400">Halbeegga Iibka *</label>
                <select
                  value={stockInSUnit}
                  onChange={(e) => setStockInSUnit(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs font-bold"
                >
                  {ALLOWED_SELLING_UNITS.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                  {!ALLOWED_SELLING_UNITS.some(u => u.value === stockInSUnit) && (
                    <option value={stockInSUnit}>{stockInSUnit}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="font-medium text-slate-600 dark:text-slate-400">Qiimaha Iibinta ($/{stockInSUnit.toUpperCase()}) *</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder=""
                  value={stockInSell}
                  onChange={(e) => setStockInSell(e.target.value)}
                  className="mt-1 font-mono font-bold text-emerald-700"
                />
              </div>
            </div>

            {/* Fractional division & Minimum sellable quantity */}
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="font-medium text-slate-600 dark:text-slate-400">
                  1 {stockInSUnit.toUpperCase()} waxaa loo qaybin karaa:
                </label>
                <div className="flex items-center gap-1.5 mt-1">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="1, 4, 10..."
                    value={stockInDivision}
                    onChange={(e) => setStockInDivision(e.target.value)}
                    className="font-mono font-bold w-24 h-8 text-xs"
                  />
                  <span className="text-[11px] text-slate-500">qeybood</span>
                </div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                <p className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300">Qiyaasta ugu yar ee la iibin karo (Min Qty):</p>
                <p className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-300 mt-0.5">
                  Minimum: {calculateMinSellableQty(parseFloat(stockInDivision) || 1)} {stockInSUnit.toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Alaab-qeybiyaha (Supplier)</label>
              <select
                value={stockInSupplier}
                onChange={(e) => setStockInSupplier(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
              >
                <option value="">Dooro Qeybiyaha...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Qaybta (Category)</label>
              <select
                value={stockInCat}
                onChange={(e) => setStockInCat(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
              >
                <option value="">Dooro Qaybta...</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setIsStockInOpen(false)}>
            Ka noqo
          </Button>
          <Button onClick={handleSaveStockIn} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            Keydi Soo Galka
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 2. EDIT & FINALIZE MODAL */}
      <Dialog open={!!editingVariant} onOpenChange={(open) => !open && setEditingVariant(null)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-lg">
            <Edit className="h-5 w-5 text-blue-600" />
            {editingVariant?.is_pending ? 'Xaqiiji & Sax Alaabta AI Scan-ka' : 'Wax ka beddel Alaabta (Edit Product)'}
          </DialogTitle>
          <DialogDescription>
            {editingVariant?.is_pending 
              ? 'Sax qiimaha iibinta iyo xogta ka hor inta aysan si rasmi ah ugu biirin kaydka.'
              : 'Wax ka beddel qiimaha, nooca, barcode ama halbeegyada alaabta.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Magaca Alaabta *</label>
              <Input
                value={editProductName}
                onChange={(e) => setEditProductName(e.target.value)}
                className="mt-1 font-bold"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Nooca / Variant *</label>
              <Input
                value={editVariantName}
                onChange={(e) => setEditVariantName(e.target.value)}
                className="mt-1 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Barcode</label>
              <Input
                value={editBarcode}
                onChange={(e) => setEditBarcode(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">SKU</label>
              <Input
                value={editSku}
                onChange={(e) => setEditSku(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Qiimaha Soo Iibka ($)</label>
              <Input
                type="number"
                step="0.01"
                value={editBuyPrice}
                onChange={(e) => setEditBuyPrice(e.target.value)}
                className="mt-1 font-mono font-bold"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Halbeegga Soo Galka *</label>
              <select
                value={editPurchaseUnit}
                onChange={(e) => setEditPurchaseUnit(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs font-bold"
              >
                {ALLOWED_INCOMING_UNITS.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
                {!ALLOWED_INCOMING_UNITS.some(u => u.value === editPurchaseUnit) && (
                  <option value={editPurchaseUnit}>{editPurchaseUnit}</option>
                )}
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Qiimaha Iibinta ($/{editSellingUnit.toUpperCase()}) *</label>
              <Input
                type="number"
                step="0.01"
                value={editSellPrice}
                onChange={(e) => setEditSellPrice(e.target.value)}
                className="mt-1 font-mono font-black text-emerald-700 dark:text-emerald-400"
              />
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-medium text-slate-600 dark:text-slate-400">1 {editPurchaseUnit.toUpperCase()} =</label>
                <Input
                  type="number"
                  value={editConversion}
                  onChange={(e) => setEditConversion(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <label className="font-medium text-slate-600 dark:text-slate-400">Halbeegga Iibka *</label>
                <select
                  value={editSellingUnit}
                  onChange={(e) => setEditSellingUnit(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs font-bold"
                >
                  {ALLOWED_SELLING_UNITS.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                  {!ALLOWED_SELLING_UNITS.some(u => u.value === editSellingUnit) && (
                    <option value={editSellingUnit}>{editSellingUnit}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="font-medium text-slate-600 dark:text-slate-400">Heerka Digniinta (Min Stock)</label>
                <Input
                  type="number"
                  value={editMinStock}
                  onChange={(e) => setEditMinStock(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            {/* Fractional division & Minimum sellable quantity in Edit Modal */}
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="font-medium text-slate-600 dark:text-slate-400">
                  1 {editSellingUnit.toUpperCase()} waxaa loo qaybin karaa:
                </label>
                <div className="flex items-center gap-1.5 mt-1">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="1, 4, 10..."
                    value={editDivision}
                    onChange={(e) => setEditDivision(e.target.value)}
                    className="font-mono font-bold w-24 h-8 text-xs"
                  />
                  <span className="text-[11px] text-slate-500">qeybood</span>
                </div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                <p className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300">Qiyaasta ugu yar ee la iibin karo (Min Qty):</p>
                <p className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-300 mt-0.5">
                  Minimum: {calculateMinSellableQty(parseFloat(editDivision) || 1)} {editSellingUnit.toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Qaybta (Category)</label>
              <select
                value={editCategoryId}
                onChange={(e) => setEditCategoryId(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
              >
                <option value="">Dooro Qaybta...</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Alaab-qeybiyaha (Supplier)</label>
              <select
                value={editSupplierId}
                onChange={(e) => setEditSupplierId(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
              >
                <option value="">Dooro Qeybiyaha...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Sababta Wax Ka Beddelka (Reason for Audit)</label>
            <Input
              placeholder="Tusaale: Qiimaha iibka ayaa la kordhiyey..."
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              className="mt-1 text-slate-600"
            />
          </div>
        </DialogBody>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setEditingVariant(null)}>
            Ka noqo
          </Button>
          <Button onClick={handleSaveEdit} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            Keydi Isbeddelka
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 3. STOCK ADJUSTMENT / SIXIDDA KAYDKA MODAL */}
      <Dialog open={!!adjustingVariant} onOpenChange={(open) => !open && setAdjustingVariant(null)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-lg">
            <Scale className="h-5 w-5 text-amber-600" />
            Sixidda Kaydka (Stock Adjustment / Physical Count)
          </DialogTitle>
          <DialogDescription>
            Sax tirada kaydka si ay ula jaanqaaddo tirada dhabta ah ee bakhaarka yaalla iyadoo la ilaalinayo taariikhda dhaqdhaqaaqa kaydka.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 text-xs">
          {/* Item Summary Card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm text-slate-900 dark:text-white">{adjustingVariant?.product?.name}</p>
              <p className="text-slate-500">{adjustingVariant?.variant_name} ({adjustingVariant?.selling_unit})</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 text-[11px] uppercase font-bold">Kaydka Nidaamka Ku Qoran</p>
              <p className="text-xl font-black font-mono text-slate-900 dark:text-white">
                {adjustingVariant?.stock_quantity} {adjustingVariant?.selling_unit}
              </p>
            </div>
          </div>

          {/* Mode Selection */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAdjustMode('physical_count')}
              className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all ${
                adjustMode === 'physical_count'
                  ? 'border-emerald-600 bg-emerald-50/60 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-xs'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600'
              }`}
            >
              Tirada Dhabta ah (Physical Count)
            </button>

            <button
              type="button"
              onClick={() => setAdjustMode('delta')}
              className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all ${
                adjustMode === 'delta'
                  ? 'border-emerald-600 bg-emerald-50/60 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-xs'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600'
              }`}
            >
              Isbeddel (+ ama - Delta)
            </button>
          </div>

          {/* Value Input */}
          {adjustMode === 'physical_count' ? (
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Tirada Dhabta ah ee Hadda Bakhaarka Yaalla ({adjustingVariant?.selling_unit}) *
              </label>
              <Input
                type="number"
                step="0.01"
                value={physicalCountInput}
                onChange={(e) => setPhysicalCountInput(e.target.value)}
                className="mt-1 font-mono font-black text-lg h-11"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Isbeddelka kaydka lagu samayn doono: <span className="font-mono font-bold text-amber-600">
                  {((parseFloat(physicalCountInput) || 0) - (adjustingVariant?.stock_quantity || 0)) >= 0 ? '+' : ''}
                  {((parseFloat(physicalCountInput) || 0) - (adjustingVariant?.stock_quantity || 0)).toFixed(2)} {adjustingVariant?.selling_unit}
                </span>
              </p>
            </div>
          ) : (
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Tirada Lagu Darayo ama Laga Jarayo (+ / - {adjustingVariant?.selling_unit}) *
              </label>
              <Input
                type="number"
                step="0.01"
                value={deltaInput}
                onChange={(e) => setDeltaInput(e.target.value)}
                placeholder="-5 ama +10"
                className="mt-1 font-mono font-black text-lg h-11"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Kaydka cusub ee noqon doono: <span className="font-mono font-bold text-emerald-600">
                  {Math.max(0, (adjustingVariant?.stock_quantity || 0) + (parseFloat(deltaInput) || 0)).toFixed(2)} {adjustingVariant?.selling_unit}
                </span>
              </p>
            </div>
          )}

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Sababta Sixidda (Reason / Audit Trail) *</label>
            <Input
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="Tusaale: Alaab khasaartay, qalad tirada hore ah..."
              className="mt-1"
            />
          </div>
        </DialogBody>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setAdjustingVariant(null)}>
            Ka noqo
          </Button>
          <Button onClick={handleSaveAdjustment} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
            Keydi Sixidda Kaydka
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 4. STOCK MOVEMENTS HISTORY MODAL */}
      <Dialog open={!!historyVariant} onOpenChange={(open) => !open && setHistoryVariant(null)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-lg">
            <History className="h-5 w-5 text-purple-600" />
            Taariikhda Dhaqdhaqaaqa Kaydka (Stock Movements)
          </DialogTitle>
          <DialogDescription>
            Alaabta: <strong className="text-slate-900 dark:text-white">{historyVariant?.product?.name} ({historyVariant?.variant_name})</strong>
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-2 text-xs">
          {movements.length === 0 ? (
            <p className="text-center text-slate-400 py-8">Dhaqdhaqaaq kayd hore uma dhicin</p>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 font-bold border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="p-2.5">Nooca</th>
                    <th className="p-2.5 text-right">Tirada</th>
                    <th className="p-2.5 text-right">Hore → Cusub</th>
                    <th className="p-2.5">Taariikhda</th>
                    <th className="p-2.5">Qoraal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.type === 'purchase'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : m.type === 'adjustment'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : m.type === 'sale_return'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {m.type === 'purchase' ? 'Soo Gashay' : m.type === 'adjustment' ? 'Sixid / Adjustment' : m.type === 'sale_return' ? 'Celinta Iibka' : 'Iib'}
                        </span>
                      </td>

                      <td className={`p-2.5 text-right font-mono font-bold ${m.quantity > 0 ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-300'}`}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity} {m.unit}
                      </td>

                      <td className="p-2.5 text-right font-mono text-slate-500">
                        {m.previous_quantity} → {m.new_quantity}
                      </td>

                      <td className="p-2.5 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                        {m.created_at.split('T')[0]}
                      </td>

                      <td className="p-2.5 text-slate-500 line-clamp-1">
                        {m.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => setHistoryVariant(null)}>
            Xidh
          </Button>
        </DialogFooter>
      </Dialog>
    </AppShell>
  );
}
