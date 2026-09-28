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
  Scale,
  X,
  Droplets,
  Boxes,
  FileText,
  Calculator,
  AlertCircle
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { repository } from '@/lib/services/repository';
import { formatMoney, formatUnitMoney, cleanPrecision } from '@/lib/calculations/financials';
import { calculateSosDenomination, formatSos } from '@/lib/calculations/denominations';
import { 
  calculateCostPerBaseUnit, 
  calculateUnitProfit, 
  getStockStatus, 
  calculateMinSellableQty,
  calculatePackRatio,
  calculateBatchCostPerUnit,
  calculateBatchVariance,
  calculateProductModel,
  ShopProductType,
  ProductModelCalculation,
  getVariantStep,
  isValidSellableQuantity,
  ALLOWED_INCOMING_UNITS,
  ALLOWED_SELLING_UNITS,
  OilSellingMeasure,
  getDefaultOilSellingMeasures,
  calculateCookingOilRegistration,
  JawanSellingMeasure,
  getDefaultJawanSellingMeasures,
  calculateJawanRegistration
} from '@/lib/calculations/stock';
import { Category, ProductVariant, StockMovement, Supplier, ProductBatch } from '@/types';
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

  // Stock In Modal ("Soo Xaree Alaab") - Redesigned 4-Product-Model
  const [isStockInOpen, setIsStockInOpen] = useState(false);
  const [stockInProductType, setStockInProductType] = useState<ShopProductType>('jawan');
  const [stockInProduct, setStockInProduct] = useState('');
  const [stockInVariant, setStockInVariant] = useState('');
  const [stockInQty, setStockInQty] = useState<string>('');
  const [stockInPUnit, setStockInPUnit] = useState('jawan');
  const [stockInSUnit, setStockInSUnit] = useState('kg');
  const [stockInConv, setStockInConv] = useState<string>('25');
  const [stockInPackWeight, setStockInPackWeight] = useState<string>('0.5');
  const [stockInLooseMode, setStockInLooseMode] = useState<'kg_per_bag' | 'bags_per_kg'>('kg_per_bag');
  const [stockInTotalBuy, setStockInTotalBuy] = useState<string>('');
  const [stockInMinSellableQty, setStockInMinSellableQty] = useState<string>('0.05');
  const [stockInDivision, setStockInDivision] = useState<string>('20');
  const [stockInPricingMode, setStockInPricingMode] = useState<'fixed' | 'denomination'>('fixed');
  const [stockInSosPrice, setStockInSosPrice] = useState<string>('');
  const [stockInBuy, setStockInBuy] = useState<string>('');
  const [stockInSell, setStockInSell] = useState<string>('');
  const [stockInSupplier, setStockInSupplier] = useState('');
  const [stockInCat, setStockInCat] = useState('');
  const [stockInMin, setStockInMin] = useState<string>('');

  // Special Models Configuration for Stock In
  const [stockInManagementMode, setStockInManagementMode] = useState<'standard' | 'pack_based' | 'amount_based'>('standard');
  const [stockInSourceQty, setStockInSourceQty] = useState<string>('500');
  const [stockInSourceUnit, setStockInSourceUnit] = useState<string>('g');
  const [stockInPackCount, setStockInPackCount] = useState<string>('10');
  const [stockInSellingPackUnit, setStockInSellingPackUnit] = useState<string>('bac');
  const [stockInContainerCount, setStockInContainerCount] = useState<string>('4');
  const [stockInContainerUnit, setStockInContainerUnit] = useState<string>('caag');
  const [stockInContainerCapacity, setStockInContainerCapacity] = useState<string>('20');
  const [stockInBatchCost, setStockInBatchCost] = useState<string>('');
  const [stockInBatchRef, setStockInBatchRef] = useState<string>('');

  // Cooking Oil dedicated selling measures state
  const [stockInOilMeasures, setStockInOilMeasures] = useState<OilSellingMeasure[]>(getDefaultOilSellingMeasures(1.85));
  const [showStockInOilMeasureConfig, setShowStockInOilMeasureConfig] = useState(false);
  const [editOilMeasures, setEditOilMeasures] = useState<OilSellingMeasure[]>(getDefaultOilSellingMeasures(1.85));
  const [showEditOilMeasureConfig, setShowEditOilMeasureConfig] = useState(false);

  // Jawan / Sack dedicated selling measures state
  const [stockInJawanMeasures, setStockInJawanMeasures] = useState<JawanSellingMeasure[]>(getDefaultJawanSellingMeasures(0.60));
  const [showStockInJawanMeasureConfig, setShowStockInJawanMeasureConfig] = useState(false);
  const [newCustomMeasureName, setNewCustomMeasureName] = useState('');
  const [newCustomMeasureKg, setNewCustomMeasureKg] = useState('');
  const [newCustomMeasureValue, setNewCustomMeasureValue] = useState('');
  const [newCustomMeasurePaid, setNewCustomMeasurePaid] = useState('');
  const [newCustomMeasureCashChange, setNewCustomMeasureCashChange] = useState(false);

  // Edit / Finalize Modal (Real zero rule: prefilled with actual values)
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [editProductType, setEditProductType] = useState<ShopProductType>('jawan');
  const [editProductName, setEditProductName] = useState('');
  const [editVariantName, setEditVariantName] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editBuyPrice, setEditBuyPrice] = useState<string>('');
  const [editPurchaseUnit, setEditPurchaseUnit] = useState('jawan');
  const [editSellPrice, setEditSellPrice] = useState<string>('');
  const [editSellingUnit, setEditSellingUnit] = useState('kg');
  const [editConversion, setEditConversion] = useState<string>('25');
  const [editPackWeight, setEditPackWeight] = useState<string>('0.5');
  const [editLooseMode, setEditLooseMode] = useState<'kg_per_bag' | 'bags_per_kg'>('kg_per_bag');
  const [editTotalBuy, setEditTotalBuy] = useState<string>('');
  const [editMinSellableQty, setEditMinSellableQty] = useState<string>('0.05');
  const [editDivision, setEditDivision] = useState<string>('1');
  const [editPricingMode, setEditPricingMode] = useState<'fixed' | 'denomination'>('fixed');
  const [editSosPrice, setEditSosPrice] = useState<string>('');
  const [editMinStock, setEditMinStock] = useState<string>('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editSupplierId, setEditSupplierId] = useState('');
  const [editIncomingQty, setEditIncomingQty] = useState<string>('');
  const [editReason, setEditReason] = useState('');

  // Special Models Configuration for Edit Modal
  const [editManagementMode, setEditManagementMode] = useState<'standard' | 'pack_based' | 'amount_based'>('standard');
  const [editSourceQty, setEditSourceQty] = useState<string>('500');
  const [editSourceUnit, setEditSourceUnit] = useState<string>('g');
  const [editPackCount, setEditPackCount] = useState<string>('10');
  const [editSellingPackUnit, setEditSellingPackUnit] = useState<string>('bac');
  const [editContainerCount, setEditContainerCount] = useState<string>('4');
  const [editContainerUnit, setEditContainerUnit] = useState<string>('caag');
  const [editContainerCapacity, setEditContainerCapacity] = useState<string>('20');

  const selectStockInProductType = (type: ShopProductType) => {
    setStockInProductType(type);
    if (type === 'jawan') {
      setStockInProduct('Bariis');
      setStockInVariant('Fufur');
      setStockInPUnit('jawan');
      setStockInSUnit('kg');
      setStockInConv('50');
      setStockInQty('10');
      setStockInBuy('25.80');
      setStockInSell('0.60');
      setStockInMinSellableQty('0.25');
      setStockInDivision('4');
      setStockInManagementMode('standard');
      setStockInJawanMeasures(getDefaultJawanSellingMeasures(0.60));
    } else if (type === 'liquid') {
      setStockInProduct('Saliid');
      setStockInVariant('Caag 20L');
      setStockInPUnit('caag');
      setStockInSUnit('liter');
      setStockInConv('20');
      setStockInQty('3');
      setStockInBuy('29.70');
      setStockInSell('1.85');
      setStockInMinSellableQty('0.0625');
      setStockInDivision('16');
      setStockInManagementMode('amount_based');
      setStockInContainerUnit('caag');
      setStockInContainerCapacity('20');
      setStockInOilMeasures(getDefaultOilSellingMeasures(1.85));
    } else if (type === 'carton') {
      setStockInPUnit('carton');
      setStockInSUnit('bac');
      setStockInConv('20');
      setStockInPackWeight('0.5');
      setStockInMinSellableQty('0.5');
      setStockInDivision('2');
      setStockInManagementMode('pack_based');
      setStockInSellingPackUnit('bac');
    } else if (type === 'loose') {
      setStockInPUnit('kg');
      setStockInSUnit('bac');
      setStockInLooseMode('kg_per_bag');
      setStockInConv('0.05');
      setStockInMinSellableQty('1');
      setStockInDivision('1');
      setStockInManagementMode('pack_based');
      setStockInSellingPackUnit('bac');
    }
  };

  const selectEditProductType = (type: ShopProductType) => {
    setEditProductType(type);
    if (type === 'jawan') {
      setEditPurchaseUnit('jawan');
      setEditSellingUnit('kg');
      if (!editConversion || editConversion === '1') setEditConversion('25');
      if (!editMinSellableQty) setEditMinSellableQty('0.05');
      setEditManagementMode('standard');
    } else if (type === 'liquid') {
      setEditPurchaseUnit('caag');
      setEditSellingUnit('liter');
      if (!editConversion || editConversion === '1') setEditConversion('20');
      if (!editMinSellableQty) setEditMinSellableQty('0.10');
      setEditManagementMode('amount_based');
      setEditContainerUnit('caag');
      setEditContainerCapacity('20');
    } else if (type === 'carton') {
      setEditPurchaseUnit('carton');
      setEditSellingUnit('bac');
      if (!editConversion || editConversion === '1') setEditConversion('20');
      setEditPackWeight('0.5');
      if (!editMinSellableQty) setEditMinSellableQty('0.5');
      setEditManagementMode('pack_based');
      setEditSellingPackUnit('bac');
    } else if (type === 'loose') {
      setEditPurchaseUnit('kg');
      setEditSellingUnit('bac');
      setEditLooseMode('kg_per_bag');
      if (!editConversion || editConversion === '1') setEditConversion('0.05');
      if (!editMinSellableQty) setEditMinSellableQty('1');
      setEditManagementMode('pack_based');
      setEditSellingPackUnit('bac');
    }
  };

  // Oil Batches Management Modal State
  const [batchModalVariant, setBatchModalVariant] = useState<ProductVariant | null>(null);
  const [variantBatches, setVariantBatches] = useState<ProductBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  
  // Batch Reconciliation Dialog State
  const [reconcilingBatch, setReconcilingBatch] = useState<ProductBatch | null>(null);
  const [physicalRemainingInput, setPhysicalRemainingInput] = useState<string>('');
  const [reconcileNotes, setReconcileNotes] = useState<string>('');

  // Batch Transactions Drilldown State
  const [viewingBatchTransactions, setViewingBatchTransactions] = useState<ProductBatch | null>(null);
  const [batchTransactions, setBatchTransactions] = useState<any[]>([]);
  const [loadingBatchTransactions, setLoadingBatchTransactions] = useState(false);

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
    const division = v.unit_division && Number(v.unit_division) > 0 
      ? Number(v.unit_division) 
      : (v.min_sellable_qty && Number(v.min_sellable_qty) > 0 
          ? Math.round(1 / Number(v.min_sellable_qty)) 
          : 1);
    setEditDivision(String(division));
    const minSell = v.min_sellable_qty !== undefined && Number(v.min_sellable_qty) > 0
      ? String(v.min_sellable_qty)
      : (division > 1 ? String(1 / division) : '1');
    setEditMinSellableQty(minSell);
    setEditPricingMode(v.pricing_mode || 'fixed');
    setEditSosPrice(v.sos_price ? String(v.sos_price) : '');
    setEditMinStock(String(v.minimum_stock ?? 0));
    setEditCategoryId(v.product?.category_id || '');
    setEditSupplierId(v.supplier_id || '');
    setEditIncomingQty(String(v.is_pending ? v.stock_quantity : 0));
    setEditReason('');

    // Model configuration
    const mMode = v.management_mode || 'standard';
    setEditManagementMode(mMode);
    let pType: ShopProductType = 'jawan';
    if (mMode === 'amount_based' || v.selling_unit === 'liter' || v.purchase_unit === 'caag') {
      pType = 'liquid';
    } else if (v.purchase_unit === 'carton') {
      pType = 'carton';
    } else if (mMode === 'pack_based') {
      pType = 'loose';
    } else if (v.purchase_unit === 'jawan' || v.selling_unit === 'kg') {
      pType = 'jawan';
    }
    setEditProductType(pType);
    setEditSourceQty(String(v.source_quantity || 500));
    setEditSourceUnit(v.source_unit || 'g');
    setEditPackCount(String(v.pack_count || 10));
    setEditSellingPackUnit(v.selling_pack_unit || 'bac');
    setEditContainerCount(String(v.initial_containers || 4));
    setEditContainerUnit(v.container_unit || 'caag');
    setEditContainerCapacity(String(v.container_capacity_liters || 20));
    setActiveActionMenuId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingVariant) return;

    if (!editProductName.trim() || !editVariantName.trim()) {
      error('Geli magaca alaabta iyo nooca (variant)');
      return;
    }

    const pType = editProductType;
    const mMode = pType === 'liquid' ? 'amount_based' : (pType === 'carton' || pType === 'loose' ? 'pack_based' : 'standard');
    const buyPrice = parseFloat(editBuyPrice) || 0;
    const sellPrice = parseFloat(editSellPrice) || 0;
    const minSellable = parseFloat(editMinSellableQty) || 1;
    const minStock = parseFloat(editMinStock) || 0;
    const incomingQty = parseFloat(editIncomingQty) || 0;
    const sosPriceVal = editPricingMode === 'denomination' ? (parseFloat(editSosPrice) || 0) : undefined;
    const effectiveSellPrice = editPricingMode === 'denomination' && sosPriceVal ? calculateSosDenomination(sosPriceVal).denominationUsd : sellPrice;

    let conv = parseFloat(editConversion) || 1;
    if (pType === 'liquid') {
      conv = parseFloat(editContainerCapacity) || 20;
    } else if (pType === 'carton') {
      conv = parseFloat(editConversion) || 20;
    } else if (pType === 'loose') {
      conv = parseFloat(editConversion) || 0.05;
    }

    // Authoritative calculation
    const calc = calculateProductModel({
      productType: pType,
      purchaseQuantity: incomingQty > 0 ? incomingQty : 1,
      costPerPurchaseUnit: buyPrice,
      totalPurchaseCost: editTotalBuy ? parseFloat(editTotalBuy) : undefined,
      conversionValue: conv,
      loosePackMode: editLooseMode,
      packContentWeight: parseFloat(editPackWeight) || undefined,
      sellingPrice: effectiveSellPrice,
      minSellableQty: minSellable,
    });

    const finalSellingUnit = pType === 'liquid' ? 'liter' : (pType === 'carton' || pType === 'loose' ? (editSellingPackUnit || 'bac') : editSellingUnit);
    const finalPurchaseUnit = pType === 'liquid' ? (editContainerUnit || 'caag') : (pType === 'carton' ? 'carton' : (pType === 'loose' ? 'kg' : editPurchaseUnit));

    try {
      if (editingVariant.is_pending) {
        await repository.finalizePendingVariant(editingVariant.id, {
          productName: editProductName.trim(),
          variantName: editVariantName.trim(),
          buyPrice: calc.costPerSellingUnit,
          purchaseUnit: finalPurchaseUnit,
          sellPrice: effectiveSellPrice,
          sellingUnit: finalSellingUnit,
          conversionFactor: conv,
          unitDivision: Math.max(1, Math.round(1 / minSellable)),
          minSellableQty: minSellable,
          pricingMode: editPricingMode,
          sosPrice: sosPriceVal,
          quantityToAdd: incomingQty,
          categoryId: editCategoryId.trim() ? editCategoryId.trim() : undefined,
          minimumStock: minStock,
          supplierId: editSupplierId.trim() ? editSupplierId.trim() : undefined,
          management_mode: mMode,
          source_quantity: pType === 'loose' ? parseFloat(editSourceQty) : undefined,
          source_unit: pType === 'loose' ? editSourceUnit : undefined,
          pack_count: pType === 'loose' || pType === 'carton' ? calc.totalStockQuantity : undefined,
          selling_pack_unit: pType === 'loose' || pType === 'carton' ? finalSellingUnit : undefined,
          container_unit: pType === 'liquid' ? (editContainerUnit || 'caag') : undefined,
          container_capacity_liters: pType === 'liquid' ? conv : undefined,
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
          purchase_unit: finalPurchaseUnit,
          sell_price: effectiveSellPrice,
          selling_unit: finalSellingUnit,
          conversion_factor: conv,
          unit_division: Math.max(1, Math.round(1 / minSellable)),
          min_sellable_qty: minSellable,
          pricing_mode: editPricingMode,
          sos_price: sosPriceVal,
          minimum_stock: minStock,
          supplier_id: editSupplierId.trim() ? editSupplierId.trim() : null,
          management_mode: mMode,
          cost_per_unit: calc.costPerSellingUnit,
          total_purchase_cost: calc.totalPurchaseCost,
          total_sellable_units: calc.totalStockQuantity,
          source_quantity: pType === 'loose' ? parseFloat(editSourceQty) : undefined,
          source_unit: pType === 'loose' ? editSourceUnit : undefined,
          pack_count: pType === 'loose' || pType === 'carton' ? calc.totalStockQuantity : undefined,
          selling_pack_unit: pType === 'loose' || pType === 'carton' ? finalSellingUnit : undefined,
          container_unit: pType === 'liquid' ? (editContainerUnit || 'caag') : undefined,
          container_capacity_liters: pType === 'liquid' ? conv : undefined,
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
    const pType = stockInProductType;
    let qty = parseFloat(stockInQty);
    let conv = parseFloat(stockInConv) || 1;
    let pUnit = stockInPUnit;
    let sUnit = stockInSUnit;
    let buy = parseFloat(stockInBuy) || 0;
    let sell = parseFloat(stockInSell);
    const minSellable = parseFloat(stockInMinSellableQty) || 1;
    const min = parseFloat(stockInMin) || 0;
    const sosPriceVal = stockInPricingMode === 'denomination' ? (parseFloat(stockInSosPrice) || 0) : undefined;
    const effectiveSellPrice = stockInPricingMode === 'denomination' && sosPriceVal ? calculateSosDenomination(sosPriceVal).denominationUsd : sell;

    if (!stockInProduct.trim() || !stockInVariant.trim()) {
      error('Geli magaca alaabta iyo nooca (Product & Variant name)');
      return;
    }

    if (isNaN(qty) || qty <= 0) {
      error('Geli tirada aad soo iisatay (Quantity purchased)');
      return;
    }

    if (stockInPricingMode === 'denomination') {
      if (!sosPriceVal || sosPriceVal <= 0) {
        error('Geli qiimaha SOS ee saxda ah (tusaale: 5000 SOS)');
        return;
      }
    } else {
      if (isNaN(sell) || sell <= 0) {
        error('Geli qiimaha iibinta ee saxda ah ($)');
        return;
      }
    }

    // Authoritative calculation
    const calc = calculateProductModel({
      productType: pType,
      purchaseQuantity: qty,
      costPerPurchaseUnit: buy,
      totalPurchaseCost: stockInTotalBuy ? parseFloat(stockInTotalBuy) : undefined,
      conversionValue: conv,
      loosePackMode: stockInLooseMode,
      packContentWeight: parseFloat(stockInPackWeight) || undefined,
      sellingPrice: effectiveSellPrice,
      minSellableQty: minSellable,
    });

    const mMode = pType === 'liquid' ? 'amount_based' : (pType === 'carton' || pType === 'loose' ? 'pack_based' : 'standard');

    try {
      await repository.recordIncomingStock({
        productName: stockInProduct.trim(),
        variantName: stockInVariant.trim(),
        quantity: pType === 'carton' || pType === 'loose' ? calc.totalStockQuantity : qty,
        purchaseUnit: pUnit,
        sellingUnit: sUnit,
        conversionFactor: conv,
        unitDivision: Math.max(1, Math.round(1 / minSellable)),
        minSellableQty: minSellable,
        pricing_mode: stockInPricingMode,
        sos_price: sosPriceVal,
        buyPrice: calc.costPerSellingUnit,
        sellPrice: effectiveSellPrice,
        supplierId: stockInSupplier || undefined,
        categoryId: stockInCat || undefined,
        minimumStock: min,
        management_mode: mMode,
        source_quantity: pType === 'loose' ? qty : (pType === 'carton' && stockInPackWeight ? cleanPrecision(calc.totalStockQuantity * parseFloat(stockInPackWeight)) : undefined),
        source_unit: pType === 'loose' ? 'kg' : (pType === 'carton' ? 'carton' : undefined),
        pack_count: pType === 'carton' || pType === 'loose' ? calc.totalStockQuantity : undefined,
        selling_pack_unit: pType === 'carton' || pType === 'loose' ? sUnit : undefined,
        container_unit: pType === 'liquid' ? stockInContainerUnit : undefined,
        container_capacity_liters: pType === 'liquid' ? conv : undefined,
        container_count: pType === 'liquid' ? qty : undefined,
        batch_total_cost: pType === 'liquid' || pType === 'jawan' ? cleanPrecision(qty * buy) : calc.totalPurchaseCost,
        total_purchase_cost: pType === 'liquid' || pType === 'jawan' ? cleanPrecision(qty * buy) : calc.totalPurchaseCost,
        total_sellable_units: pType === 'liquid' || pType === 'jawan' ? cleanPrecision(qty * conv) : calc.totalStockQuantity,
        cost_per_unit: (pType === 'liquid' || pType === 'jawan') && (qty * conv) > 0 ? cleanPrecision((qty * buy) / (qty * conv)) : calc.costPerSellingUnit,
        batch_reference: pType === 'liquid' || pType === 'jawan' ? (stockInBatchRef || `DUF-${Date.now().toString().slice(-4)}`) : undefined,
        selling_options: pType === 'liquid' ? stockInOilMeasures : (pType === 'jawan' ? stockInJawanMeasures : undefined),
      }, `Alaab soo gashay (${pType}): ${stockInProduct} +${pType === 'liquid' || pType === 'jawan' ? (qty * conv) : calc.totalStockQuantity} ${sUnit}`);

      success('Alaab cusub ayaa soo gashay!', `${stockInProduct} (${stockInVariant}): ${calc.totalStockQuantity} ${sUnit}`);
      setIsStockInOpen(false);
      setStockInProduct('');
      setStockInVariant('');
      setStockInQty('');
      setStockInBuy('');
      setStockInSell('');
      setStockInMin('');
      setStockInSupplier('');
      setStockInCat('');
      setStockInTotalBuy('');
      selectStockInProductType('jawan');
      await loadData();
    } catch (err: any) {
      error('Khalad baa dhacay', err.message);
    }
  };

  // Open Oil Batches Modal
  const handleOpenBatchesModal = async (v: ProductVariant) => {
    setBatchModalVariant(v);
    setLoadingBatches(true);
    setActiveActionMenuId(null);
    try {
      const batches = await repository.getProductBatches(v.id);
      setVariantBatches(batches);
    } catch (err) {
      console.error('Error loading batches:', err);
    } finally {
      setLoadingBatches(false);
    }
  };

  // Open Reconcile Dialog
  const handleOpenReconcile = (batch: ProductBatch) => {
    setReconcilingBatch(batch);
    setPhysicalRemainingInput(String(batch.remaining_quantity || 0));
    setReconcileNotes('');
  };

  // Save Reconciliation
  const handleSaveReconciliation = async () => {
    if (!reconcilingBatch) return;
    const physical = parseFloat(physicalRemainingInput);
    if (isNaN(physical) || physical < 0) {
      error('Geli tirada dhabta ah ee kaydka ku haray (0 ama ka weyn)');
      return;
    }

    try {
      await repository.reconcileProductBatch({
        batch_id: reconcilingBatch.id,
        actual_remaining_liters: physical,
        notes: reconcileNotes.trim() || 'Dib-u-heshiisiin tiro dhab ah',
      });
      success('Dufcadda si guul leh ayaa loo heshiisiiyey!', `Dufcad #${reconcilingBatch.batch_number}`);
      setReconcilingBatch(null);
      if (batchModalVariant) {
        const updated = await repository.getProductBatches(batchModalVariant.id);
        setVariantBatches(updated);
      }
      await loadData();
    } catch (err: any) {
      error('Heshiisiinta lama keydin karin', err.message);
    }
  };

  // View Batch Transactions
  const handleOpenBatchTransactions = async (batch: ProductBatch) => {
    setViewingBatchTransactions(batch);
    setLoadingBatchTransactions(true);
    try {
      const txs = await repository.getBatchTransactions(batch.id);
      setBatchTransactions(txs);
    } catch (err) {
      console.error('Error loading batch txs:', err);
    } finally {
      setLoadingBatchTransactions(false);
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

  const stockInCalculation = calculateProductModel({
    productType: stockInProductType,
    purchaseQuantity: parseFloat(stockInQty) || 0,
    costPerPurchaseUnit: parseFloat(stockInBuy) || 0,
    totalPurchaseCost: stockInTotalBuy ? parseFloat(stockInTotalBuy) : undefined,
    conversionValue: parseFloat(stockInConv) || 1,
    loosePackMode: stockInLooseMode,
    packContentWeight: parseFloat(stockInPackWeight) || undefined,
    sellingPrice: stockInPricingMode === 'denomination' && stockInSosPrice ? calculateSosDenomination(parseFloat(stockInSosPrice) || 0).denominationUsd : (parseFloat(stockInSell) || 0),
    minSellableQty: parseFloat(stockInMinSellableQty) || 1,
  });

  const editCalculation = calculateProductModel({
    productType: editProductType,
    purchaseQuantity: parseFloat(editIncomingQty) || 1,
    costPerPurchaseUnit: parseFloat(editBuyPrice) || 0,
    totalPurchaseCost: editTotalBuy ? parseFloat(editTotalBuy) : undefined,
    conversionValue: parseFloat(editConversion) || 1,
    loosePackMode: editLooseMode,
    packContentWeight: parseFloat(editPackWeight) || undefined,
    sellingPrice: editPricingMode === 'denomination' && editSosPrice ? calculateSosDenomination(parseFloat(editSosPrice) || 0).denominationUsd : (parseFloat(editSellPrice) || 0),
    minSellableQty: parseFloat(editMinSellableQty) || 1,
  });

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
              <Button 
                onClick={() => {
                  setStockInProduct('');
                  setStockInVariant('');
                  setStockInQty('');
                  setStockInBuy('');
                  setStockInSell('');
                  setStockInMin('');
                  setStockInSupplier('');
                  setStockInCat('');
                  setStockInTotalBuy('');
                  selectStockInProductType('jawan');
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
                    const costPerBase = v.cost_per_unit || calculateCostPerBaseUnit(v.buy_price, v.conversion_factor, v);
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
                          <div className="flex flex-col gap-1 items-start">
                            <span className="font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-900">
                              {v.variant_name}
                            </span>
                            {v.management_mode === 'pack_based' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-200/60">
                                <Boxes className="h-3 w-3" />
                                {v.source_quantity}{v.source_unit} ÷ {v.pack_count} {v.selling_pack_unit || 'Bac'} ({calculatePackRatio(v.source_quantity || 500, v.pack_count || 10).qtyPerPack}{v.source_unit || 'g'}/Bac)
                              </span>
                            )}
                            {v.min_sellable_qty && Number(v.min_sellable_qty) < 1 && (
                              <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                minimum: {v.min_sellable_qty} {v.selling_unit}
                              </span>
                            )}
                            {(v.purchase_unit === 'jawan' || v.selling_unit === 'kg') && v.selling_options && v.selling_options.length > 0 && (
                              <div className="flex flex-col gap-1 items-start mt-0.5">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200/60">
                                  <Package className="h-3 w-3" />
                                  {v.conversion_factor || 50} KG / {v.purchase_unit || 'Jawan'}
                                </span>
                                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                  <span className="text-[10px] font-bold text-slate-500">Cabbirrada:</span>
                                  {v.selling_options.map((m: any, idx: number) => (
                                    <span key={m.code || idx} className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
                                      {m.name || m.label}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(v.management_mode === 'amount_based' || v.selling_unit === 'liter') && (
                              <div className="flex flex-col gap-1 items-start mt-0.5">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200/60">
                                  <Droplets className="h-3 w-3" />
                                  {v.container_capacity_liters || 20}L / {v.container_unit || 'Caag'}
                                </span>
                                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                  <span className="text-[10px] font-bold text-slate-500">Cabbirrada:</span>
                                  {(v.selling_options && v.selling_options.length > 0 
                                    ? v.selling_options 
                                    : getDefaultOilSellingMeasures(v.sell_price || 1.85)
                                  ).map((m: any, idx: number) => (
                                    <span key={m.code || idx} className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                                      {m.name || m.label}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4 text-right font-mono text-slate-600 dark:text-slate-300">
                          {v.buy_price > 0 && (
                            <div>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMoney(v.buy_price)}</span>
                              <span className="text-[11px] text-slate-400 ml-1">/{v.purchase_unit}</span>
                            </div>
                          )}
                          <p className="text-[10px] text-slate-500 font-medium">
                            Cost: {formatUnitMoney(costPerBase)}/{v.selling_unit}
                          </p>
                        </td>

                        <td className="px-4 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {v.is_pending && v.sell_price === 0 && !v.sos_price ? (
                            <span className="text-amber-600 font-semibold italic text-xs">— Geli Iibka</span>
                          ) : v.pricing_mode === 'denomination' && v.sos_price ? (
                            <div>
                              <span className="text-sm font-black text-purple-600 dark:text-purple-400">
                                {formatSos(v.sos_price)}
                              </span>
                              <span className="text-[10px] block font-normal text-slate-400">
                                Mode A ({formatMoney(v.sell_price)})
                              </span>
                              <p className={`text-[10px] font-bold ${unitProfit < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {unitProfit < 0 ? '-' : '+'}{formatUnitMoney(Math.abs(unitProfit))} {unitProfit < 0 ? 'khasaare' : "faa'iido"}
                              </p>
                            </div>
                          ) : (
                            <>
                              {formatUnitMoney(v.sell_price)}
                              <span className="text-[11px] text-slate-400 ml-1 font-normal">/{v.selling_unit}</span>
                              <p className={`text-[10px] font-bold ${unitProfit < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {unitProfit < 0 ? '-' : '+'}{formatUnitMoney(Math.abs(unitProfit))} {unitProfit < 0 ? 'khasaare' : "faa'iido"}
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
                          {v.management_mode === 'pack_based' && v.source_quantity && v.pack_count && (
                            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                              ≈ {cleanPrecision((v.stock_quantity * (v.source_quantity / v.pack_count)) / (v.source_unit === 'g' ? 1000 : 1))} KG
                            </p>
                          )}
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                            Min: {v.min_sellable_qty || (v.unit_division && v.unit_division > 1 ? (1 / v.unit_division) : 1)} {v.selling_unit}
                          </p>
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
                                <div className="absolute right-0 mt-1 w-52 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 text-left">
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

                                      {(v.management_mode === 'amount_based' || v.selling_unit === 'liter' || v.purchase_unit === 'caag') && (
                                        <button
                                          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                          onClick={() => handleOpenBatchesModal(v)}
                                        >
                                          <Droplets className="h-3.5 w-3.5 text-amber-500" />
                                          <span>Dufcadaha Saliidda (Batches)</span>
                                        </button>
                                      )}

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
                                          setStockInManagementMode(v.management_mode || 'standard');
                                          let pt: ShopProductType = 'jawan';
                                          if (v.management_mode === 'amount_based' || v.selling_unit === 'liter' || v.purchase_unit === 'caag') {
                                            pt = 'liquid';
                                          } else if (v.purchase_unit === 'carton') {
                                            pt = 'carton';
                                          } else if (v.management_mode === 'pack_based') {
                                            pt = 'loose';
                                          } else if (v.purchase_unit === 'jawan' || v.selling_unit === 'kg') {
                                            pt = 'jawan';
                                          }
                                          setStockInProductType(pt);
                                          setStockInMinSellableQty(String(v.min_sellable_qty || (v.unit_division && v.unit_division > 1 ? (1 / v.unit_division) : 1)));
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
          {/* STEP 1: PRODUCT MODEL SELECTOR (4 CARDS) */}
          <div>
            <label className="font-black text-slate-800 dark:text-slate-200 block mb-1.5 text-xs">
              1. Sidee ayay alaabtani ku timaadaa dukaanka? (How does this product arrive?) *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* 1. Jawan / Sack */}
              <button
                type="button"
                onClick={() => selectStockInProductType('jawan')}
                className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                  stockInProductType === 'jawan'
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Package className="h-4 w-4 text-emerald-600" />
                  <span className="font-bold text-xs">Kiish / Jawan</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">Bariis, Bur, Sokor (KG lagu iibiyo)</p>
              </button>

              {/* 2. Liquid / Liter */}
              <button
                type="button"
                onClick={() => selectStockInProductType('liquid')}
                className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                  stockInProductType === 'liquid'
                    ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Droplets className="h-4 w-4 text-amber-600" />
                  <span className="font-bold text-xs">Dareere / Saliid</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">Saliid, Weelal (Litir lagu iibiyo)</p>
              </button>

              {/* 3. Carton / Pack */}
              <button
                type="button"
                onClick={() => selectStockInProductType('carton')}
                className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                  stockInProductType === 'carton'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Boxes className="h-4 w-4 text-blue-600" />
                  <span className="font-bold text-xs">Kartoon / Pack</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">Basto, Buskud (Bac/Pack lagu iibiyo)</p>
              </button>

              {/* 4. Loose / Bulk */}
              <button
                type="button"
                onClick={() => selectStockInProductType('loose')}
                className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                  stockInProductType === 'loose'
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Scale className="h-4 w-4 text-purple-600" />
                  <span className="font-bold text-xs">Shub-shub / Bulk</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">Xawaaji, Budo (KG loo qeybiyo Bac)</p>
              </button>
            </div>
          </div>

          {stockInProductType === 'liquid' ? (
            <div className="space-y-4">
              {/* DEDICATED SIMPLE COOKING OIL REGISTRATION FLOW */}
              <div className="bg-amber-50/70 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/60 space-y-4">
                <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-900/40 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Droplets className="h-5 w-5 text-amber-600" />
                    <div>
                      <h3 className="font-black text-sm text-slate-900 dark:text-white">
                        Diiwaangelinta Saliidda (Cooking Oil Registration)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Geli kaliya xogta dhabta ah ee aad taqaanno: Caag, Litir & Qiimayaasha
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border border-amber-300">
                    Caag → Litir & Cabbirro
                  </span>
                </div>

                {/* 1. Magaca Saliidda & Variant */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                      A. Magaca Saliidda *
                    </label>
                    <Input
                      placeholder="Saliid"
                      value={stockInProduct}
                      onChange={(e) => setStockInProduct(e.target.value)}
                      className="font-bold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                      Nooca / Variant Name
                    </label>
                    <Input
                      placeholder="Caag 20L"
                      value={stockInVariant}
                      onChange={(e) => setStockInVariant(e.target.value)}
                      className="font-bold"
                    />
                  </div>
                </div>

                {/* 2. Real-world Inputs: Caag, Litir/Caag, Qiimaha/Caag, Qiimaha 1 Liter */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* B. Tirada Caagga la keenay */}
                  <div>
                    <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                      B. Tirada Caagga *
                    </label>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      placeholder="3"
                      value={stockInQty}
                      onChange={(e) => setStockInQty(e.target.value)}
                      className="font-mono font-bold text-slate-900 dark:text-white"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Tusaale: 3 Caag</p>
                  </div>

                  {/* C. Liter-ka halkii Caag */}
                  <div>
                    <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                      C. Liter halkii Caag *
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      placeholder="20"
                      value={stockInConv}
                      onChange={(e) => {
                        setStockInConv(e.target.value);
                        setStockInContainerCapacity(e.target.value);
                      }}
                      className="font-mono font-bold text-amber-700 dark:text-amber-400"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Tusaale: 20 Liter</p>
                  </div>

                  {/* D. Qiimaha halkii Caag */}
                  <div>
                    <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                      D. Qiimaha hal Caag ($) *
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="29.70"
                      value={stockInBuy}
                      onChange={(e) => setStockInBuy(e.target.value)}
                      className="font-mono font-bold text-emerald-700 dark:text-emerald-400"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Tusaale: $29.70</p>
                  </div>

                  {/* E. Qiimaha lagu iibiyo 1 Liter */}
                  <div>
                    <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                      E. Qiimaha 1 Liter ($) *
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="1.85"
                      value={stockInSell}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStockInSell(val);
                        const p = parseFloat(val);
                        if (!isNaN(p) && p > 0) {
                          setStockInOilMeasures(prev => prev.map(m => m.code === '1L' ? { ...m, display_price: p, payment_price: p } : m));
                        }
                      }}
                      className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Tusaale: $1.85</p>
                  </div>
                </div>
              </div>

              {/* READ-ONLY CALCULATION SUMMARY */}
              {(() => {
                const cReg = calculateCookingOilRegistration({
                  containers: parseFloat(stockInQty) || 0,
                  litersPerContainer: parseFloat(stockInConv) || 0,
                  purchasePricePerContainer: parseFloat(stockInBuy) || 0,
                  sellingPricePerLiter: parseFloat(stockInSell) || 0,
                  customMeasures: stockInOilMeasures,
                });

                return (
                  <div className="p-3.5 bg-slate-100/90 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span>Xisaabinta Tooska ah (Derived Values - Read-only):</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {cReg.containers} Caag × {cReg.litersPerContainer}L = {cReg.totalStockLiters} L
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                      {/* Stock */}
                      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-sans text-slate-500 font-bold block">Stock</span>
                        <span className="text-base font-black text-slate-900 dark:text-white">
                          {cReg.totalStockLiters} L
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                          {cReg.containers} Caag × {cReg.litersPerContainer}L
                        </span>
                      </div>

                      {/* Total Cost */}
                      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-sans text-slate-500 font-bold block">Total Cost</span>
                        <span className="text-base font-black text-slate-800 dark:text-slate-200">
                          ${cReg.totalPurchaseCost.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                          {cReg.containers} × ${cReg.purchasePricePerContainer.toFixed(2)}
                        </span>
                      </div>

                      {/* Cost / Liter */}
                      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-sans text-slate-500 font-bold block">Cost / Liter</span>
                        <span className="text-base font-black text-amber-700 dark:text-amber-400">
                          ${cReg.costPerLiter.toFixed(3)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                          ${cReg.totalPurchaseCost.toFixed(2)} ÷ {cReg.totalStockLiters}L
                        </span>
                      </div>

                      {/* Profit / Liter */}
                      <div className={`p-2.5 rounded-xl border ${
                        cReg.isLoss 
                          ? 'bg-red-50 dark:bg-red-950/60 border-red-300 text-red-900 dark:text-red-200' 
                          : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                      }`}>
                        <span className={`text-[10px] uppercase font-sans font-bold block ${cReg.isLoss ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                          {cReg.isLoss ? 'Khasaare / Liter' : 'Profit / Liter'}
                        </span>
                        <span className={`text-base font-black ${cReg.isLoss ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {cReg.profitPerLiter >= 0 ? '+' : ''}${cReg.profitPerLiter.toFixed(3)}
                        </span>
                        <span className="text-[10px] font-sans block mt-0.5 opacity-80">
                          ${cReg.sellingPricePerLiter.toFixed(2)} - ${cReg.costPerLiter.toFixed(3)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* SECTION 3: CABBIRRADA SALIIDDA (SELLING MEASURES CARDS) */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-slate-900 dark:text-white text-xs">
                      Cabbirrada Saliidda (Selling Measures)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      7-da cabbir ee xaqiijisan iyo xidhiidhka ka dhexeeya:
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStockInOilMeasureConfig(!showStockInOilMeasureConfig)}
                    className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    {showStockInOilMeasureConfig ? 'Qari Habeynta' : 'Habee Litirrada & Qiimaha'}
                  </button>
                </div>

                {/* 7 CARDS SHOWING CONFIRMED HIERARCHY */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {stockInOilMeasures.map((m, idx) => (
                    <div
                      key={m.code || idx}
                      className="p-2.5 rounded-xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 text-center flex flex-col justify-between"
                    >
                      <div>
                        <span className="font-black text-slate-900 dark:text-white text-xs block">
                          {m.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium block leading-tight mt-0.5">
                          {m.description}
                        </span>
                      </div>
                      <div className="mt-2 pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                        <span className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-400 block">
                          ${m.display_price.toFixed(2)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 block">
                          {m.quantity_liters} L
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* OPTIONAL EXPANDABLE CONFIGURATION TABLE FOR EXACT NUMERIC LITERS */}
                {showStockInOilMeasureConfig && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Wax ka beddel xaddiga saxda ah ee Litirrada ama Qiimaha iibka ee cabbir kasta:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {stockInOilMeasures.map((m, idx) => (
                        <div key={m.code || idx} className="flex items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                          <div className="min-w-24">
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">{m.name}</span>
                            <span className="text-[10px] text-slate-400">{m.description}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-20">
                              <label className="text-[9px] text-slate-400 block">Litir:</label>
                              <Input
                                type="number"
                                step="0.0001"
                                min="0.0001"
                                value={m.quantity_liters}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setStockInOilMeasures(prev => prev.map((item, i) => i === idx ? { ...item, quantity_liters: val } : item));
                                }}
                                className="h-7 text-xs font-mono font-bold"
                              />
                            </div>
                            <div className="w-20">
                              <label className="text-[9px] text-slate-400 block">Qiimo $:</label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={m.display_price}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setStockInOilMeasures(prev => prev.map((item, i) => i === idx ? { ...item, display_price: val, payment_price: val } : item));
                                }}
                                className="h-7 text-xs font-mono font-bold text-emerald-700"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : stockInProductType === 'jawan' ? (
            <div className="space-y-4">
              {/* DEDICATED SIMPLE JAWAN / SACK & POWDER REGISTRATION FLOW */}
              <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-900/40 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-emerald-600" />
                    <div>
                      <h3 className="font-black text-sm text-slate-900 dark:text-white">
                        Diiwaangelinta Jawan / Sack & Fufur (Bariis, Bur, Sokor)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Geli kaliya xogta dhabta ah: Tirada Jawan, KG/Jawan & Qiimayaasha
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border border-emerald-300">
                    Jawan → KG & Cabbirro
                  </span>
                </div>

                {/* 1. Magaca Alaabta & Nooca */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                      Magaca Alaabta *
                    </label>
                    <Input
                      placeholder="Bariis (ama Bur, Sokor...)"
                      value={stockInProduct}
                      onChange={(e) => setStockInProduct(e.target.value)}
                      className="font-bold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                      Nooca (Type / Subtype)
                    </label>
                    <Input
                      placeholder="Fufur (ama Gudud, Caddaan...)"
                      value={stockInVariant}
                      onChange={(e) => setStockInVariant(e.target.value)}
                      className="font-bold"
                    />
                  </div>
                </div>

                {/* 2. Real-world Inputs: Tirada Jawan, KG halkii Jawan, Qiimaha hal Jawan, Qiimaha 1 KG */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Tirada Jawan */}
                  <div>
                    <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                      Tirada Jawan *
                    </label>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      placeholder="10"
                      value={stockInQty}
                      onChange={(e) => setStockInQty(e.target.value)}
                      className="font-mono font-bold text-slate-900 dark:text-white"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Tusaale: 10 Jawan</p>
                  </div>

                  {/* KG halkii Jawan */}
                  <div>
                    <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                      KG halkii Jawan *
                    </label>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      placeholder="50"
                      value={stockInConv}
                      onChange={(e) => setStockInConv(e.target.value)}
                      className="font-mono font-bold text-emerald-700 dark:text-emerald-400"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Tusaale: 50 KG</p>
                  </div>

                  {/* Qiimaha hal Jawan ($) */}
                  <div>
                    <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                      Qiimaha hal Jawan ($) *
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="25.80"
                      value={stockInBuy}
                      onChange={(e) => setStockInBuy(e.target.value)}
                      className="font-mono font-bold text-slate-900 dark:text-white"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Tusaale: $25.80</p>
                  </div>

                  {/* Qiimaha 1 KG ($) */}
                  <div>
                    <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                      Qiimaha 1 KG ($) *
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.60"
                      value={stockInSell}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStockInSell(val);
                        const p = parseFloat(val);
                        if (!isNaN(p) && p > 0) {
                          setStockInJawanMeasures(getDefaultJawanSellingMeasures(p));
                        }
                      }}
                      className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Tusaale: $0.60</p>
                  </div>
                </div>
              </div>

              {/* READ-ONLY DERIVED VALUES SUMMARY */}
              {(() => {
                const jReg = calculateJawanRegistration({
                  jawanCount: parseFloat(stockInQty) || 0,
                  kgPerJawan: parseFloat(stockInConv) || 0,
                  purchasePricePerJawan: parseFloat(stockInBuy) || 0,
                  sellingPricePerKg: parseFloat(stockInSell) || 0,
                  customMeasures: stockInJawanMeasures,
                });

                return (
                  <div className="p-3.5 bg-slate-100/90 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span>Xisaabinta Tooska ah (Derived Values - Read-only):</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {jReg.jawanCount} Jawan × {jReg.kgPerJawan} KG = {jReg.totalStockKg} KG
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                      {/* Stock */}
                      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-sans text-slate-500 font-bold block">Stock</span>
                        <span className="text-base font-black text-slate-900 dark:text-white">
                          {jReg.totalStockKg} KG
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                          {jReg.jawanCount} Jawan × {jReg.kgPerJawan} KG
                        </span>
                      </div>

                      {/* Total Cost */}
                      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-sans text-slate-500 font-bold block">Total Cost</span>
                        <span className="text-base font-black text-slate-800 dark:text-slate-200">
                          ${jReg.totalPurchaseCost.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                          {jReg.jawanCount} × ${jReg.purchasePricePerJawan.toFixed(2)}
                        </span>
                      </div>

                      {/* Cost / KG */}
                      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-sans text-slate-500 font-bold block">Cost / KG</span>
                        <span className="text-base font-black text-amber-700 dark:text-amber-400">
                          ${jReg.costPerKg.toFixed(3)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                          ${jReg.totalPurchaseCost.toFixed(2)} ÷ {jReg.totalStockKg} KG
                        </span>
                      </div>

                      {/* Profit / KG */}
                      <div className={`p-2.5 rounded-xl border ${
                        jReg.isLoss 
                          ? 'bg-red-50 dark:bg-red-950/60 border-red-300 text-red-900 dark:text-red-200' 
                          : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                      }`}>
                        <span className={`text-[10px] uppercase font-sans font-bold block ${jReg.isLoss ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                          {jReg.isLoss ? 'Khasaare / KG' : 'Profit / KG'}
                        </span>
                        <span className={`text-base font-black ${jReg.isLoss ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {jReg.profitPerKg >= 0 ? '+' : ''}${jReg.profitPerKg.toFixed(3)}
                        </span>
                        <span className="text-[10px] font-sans block mt-0.5 opacity-80">
                          ${jReg.sellingPricePerKg.toFixed(2)} - ${jReg.costPerKg.toFixed(3)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* SELLING MEASURES CARDS */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-slate-900 dark:text-white text-xs">
                      Cabbirrada lagu iibin karo (Selling Measures)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Cabbirrada caadiga ah iyo cabbirrada gaarka ah:
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStockInJawanMeasureConfig(!showStockInJawanMeasureConfig)}
                    className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    {showStockInJawanMeasureConfig ? 'Qari Habeynta' : 'Ku dar Cabbir Gaar ah (5K, Tuman...)'}
                  </button>
                </div>

                {/* MEASURE CARDS */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {stockInJawanMeasures.map((m, idx) => (
                    <div
                      key={m.code || idx}
                      className="p-2.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 text-center flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-slate-900 dark:text-white">{m.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border font-bold text-emerald-700 dark:text-emerald-300">
                          {m.quantity_kg} KG
                        </span>
                      </div>
                      <div className="my-1.5">
                        <span className="font-mono font-black text-sm text-emerald-800 dark:text-emerald-200 block">
                          ${m.display_price.toFixed(2)}
                        </span>
                        {m.supports_cash_change && (
                          <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold block">
                            Bixi: ${m.payment_price.toFixed(2)} (Celis)
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-slate-400 truncate" title={m.description}>
                        {m.description || `${m.quantity_kg} KG`}
                      </p>
                    </div>
                  ))}
                </div>

                {/* ADD CUSTOM MEASURE (e.g. 5K Sokor with cash change, or Tuman $0.10) */}
                {showStockInJawanMeasureConfig && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      Ku dar Cabbir Gaar ah (Custom Measure e.g. 5K ama Tuman):
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block">Magaca (e.g. 5K, Tuman)</label>
                        <Input
                          placeholder="5K ama Tuman"
                          value={newCustomMeasureName}
                          onChange={(e) => setNewCustomMeasureName(e.target.value)}
                          className="h-8 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block">Qiyaasta KG (e.g. 0.25)</label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.25"
                          value={newCustomMeasureKg}
                          onChange={(e) => setNewCustomMeasureKg(e.target.value)}
                          className="h-8 text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block">Qiimaha Alaabta ($)</label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.15"
                          value={newCustomMeasureValue}
                          onChange={(e) => setNewCustomMeasureValue(e.target.value)}
                          className="h-8 text-xs font-mono font-bold text-emerald-700"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block">Lacagta La Bixinayo ($)</label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.20"
                          value={newCustomMeasurePaid}
                          onChange={(e) => setNewCustomMeasurePaid(e.target.value)}
                          className="h-8 text-xs font-mono font-bold"
                        />
                      </div>
                      <div className="flex flex-col justify-end">
                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 mb-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newCustomMeasureCashChange}
                            onChange={(e) => setNewCustomMeasureCashChange(e.target.checked)}
                            className="rounded"
                          />
                          <span>Celis / Cash Rule</span>
                        </label>
                        <Button
                          type="button"
                          onClick={() => {
                            const kg = parseFloat(newCustomMeasureKg);
                            const val = parseFloat(newCustomMeasureValue);
                            const paid = parseFloat(newCustomMeasurePaid) || val;
                            if (!newCustomMeasureName.trim() || isNaN(kg) || kg <= 0 || isNaN(val) || val <= 0) {
                              error('Geli xogta cabbirka oo sax ah (Magac, KG, Qiimo)');
                              return;
                            }
                            const newM: JawanSellingMeasure = {
                              id: `jawan-custom-${Date.now()}`,
                              name: newCustomMeasureName.trim(),
                              label: newCustomMeasureName.trim(),
                              code: newCustomMeasureName.trim().toUpperCase().replace(/\s+/g, '_'),
                              quantity_kg: kg,
                              display_price: val,
                              amount: val,
                              payment_price: paid,
                              supports_cash_change: newCustomMeasureCashChange,
                              currency: '$',
                              description: `${kg} KG`,
                              sort_order: stockInJawanMeasures.length + 1,
                              is_active: true,
                            };
                            setStockInJawanMeasures(prev => [...prev, newM]);
                            setNewCustomMeasureName('');
                            setNewCustomMeasureKg('');
                            setNewCustomMeasureValue('');
                            setNewCustomMeasurePaid('');
                            setNewCustomMeasureCashChange(false);
                            success(`Cabbirka "${newM.name}" si guul leh ayaa loogu daray!`);
                          }}
                          className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                        >
                          + Ku dar Cabbir
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* STEP 2: PRODUCT IDENTIFICATION */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Magaca Alaabta (Product Name) *</label>
              <Input
                placeholder="Tusaale: Bur Dahab, Basto MK, Saliid Macsar, Xawaaji..."
                value={stockInProduct}
                onChange={(e) => setStockInProduct(e.target.value)}
                className="mt-1 font-bold"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Nooca / Variant *</label>
              <Input
                placeholder="Tusaale: 25KG, MK, 20L Caag, Bac 50g..."
                value={stockInVariant}
                onChange={(e) => setStockInVariant(e.target.value)}
                className="mt-1 font-bold"
              />
            </div>
          </div>

          {/* STEP 3: PURCHASE SECTION (QAYBTA SOO GADASHADA) */}
          <div className="bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-slate-800 dark:text-slate-200 font-bold">
              <span>Qaybta Soo Gadashada (Purchase Details)</span>
              {stockInQty && stockInBuy && (
                <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200/60">
                  Wadarta: {stockInQty} × ${stockInBuy} = ${(Number(stockInQty) * Number(stockInBuy)).toFixed(2)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Tirada Aad Soo Iisatay (Quantity) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Tusaale: 5, 2, 4..."
                  value={stockInQty}
                  onChange={(e) => setStockInQty(e.target.value)}
                  className="mt-1 font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Halbeegga Soo Galka (Purchase Unit) *
                </label>
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
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  {stockInPUnit.toLowerCase() === 'jawan' 
                    ? 'Qiimaha Hal Jawan ($) *' 
                    : (stockInPUnit.toLowerCase() === 'caag' 
                        ? 'Qiimaha Hal Caag ($) *' 
                        : (stockInPUnit.toLowerCase() === 'carton' 
                            ? 'Qiimaha Hal Carton ($) *' 
                            : (stockInPUnit.toLowerCase() === 'kg' 
                                ? 'Qiimaha Hal KG ($) *' 
                                : `Qiimaha Hal ${stockInPUnit} ($) *`)))}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={stockInBuy}
                  onChange={(e) => setStockInBuy(e.target.value)}
                  className="mt-1 font-mono font-bold text-emerald-700 dark:text-emerald-300"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Qiimaha hal {stockInPUnit} kugu kacay (alaab-qeybiyaha)
                </p>
              </div>
            </div>

            {/* If Loose: support entering total cost directly if known */}
            {stockInProductType === 'loose' && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-600 dark:text-slate-400">
                  Miyaad haysataa qiimaha guud ee dhammaan KG-yada? (Optional Total Cost):
                </span>
                <div className="flex items-center gap-1.5 w-36">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Wadarta $"
                    value={stockInTotalBuy}
                    onChange={(e) => setStockInTotalBuy(e.target.value)}
                    className="h-7 text-xs font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* STEP 4: CONVERSION SECTION (QAYBTA ISKU BEDDELKA) */}
          <div className="bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <span className="font-bold text-slate-800 dark:text-slate-200 block">
              Qaybta Isku Beddelka (Conversion Setup)
            </span>

            {(stockInProductType as string) === 'jawan' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="font-medium text-slate-700 dark:text-slate-300">
                    1 Jawan intee KG ayuu ka kooban yahay? *
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono font-bold text-xs text-slate-500">1 Jawan =</span>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="25"
                      value={stockInConv}
                      onChange={(e) => setStockInConv(e.target.value)}
                      className="font-mono font-bold w-28 text-emerald-700"
                    />
                    <span className="font-bold text-xs text-slate-700 dark:text-slate-300">KG</span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <p>Kaydka Guud ee Dukaanka: <strong className="text-slate-900 dark:text-white font-mono">{stockInCalculation.totalStockQuantity} KG</strong></p>
                  <p>Cost/KG Toos ah: <strong className="text-emerald-700 dark:text-emerald-400 font-mono">${stockInCalculation.costPerSellingUnit.toFixed(3)}/KG</strong></p>
                </div>
              </div>
            )}

            {stockInProductType === 'carton' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="font-medium text-slate-700 dark:text-slate-300">
                      1 Carton intee Bac/Baakad ayuu ka kooban yahay? *
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono font-bold text-xs text-slate-500">1 Carton =</span>
                      <Input
                        type="number"
                        step="1"
                        placeholder="20"
                        value={stockInConv}
                        onChange={(e) => setStockInConv(e.target.value)}
                        className="font-mono font-bold w-28 text-blue-700"
                      />
                      <span className="font-bold text-xs text-slate-700 dark:text-slate-300">{stockInSUnit.toUpperCase()}</span>
                    </div>
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 dark:text-slate-300">
                      Culeyska 1 Bac (Optional KG)
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono font-bold text-xs text-slate-500">1 Bac =</span>
                      <Input
                        type="number"
                        step="0.05"
                        placeholder="0.5"
                        value={stockInPackWeight}
                        onChange={(e) => setStockInPackWeight(e.target.value)}
                        className="font-mono font-bold w-28"
                      />
                      <span className="font-bold text-xs text-slate-700 dark:text-slate-300">KG (500g)</span>
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between">
                  <span>Kaydka Guud: <strong className="text-slate-900 dark:text-white font-mono">{stockInCalculation.totalStockQuantity} {stockInSUnit.toUpperCase()}</strong></span>
                  <span>Cost/Bac Toos ah: <strong className="text-blue-700 dark:text-blue-400 font-mono">${stockInCalculation.costPerSellingUnit.toFixed(4)}/{stockInSUnit.toUpperCase()}</strong></span>
                </div>
              </div>
            )}

            {stockInProductType === 'loose' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Dooro Habka Xisaabinta:</span>
                  <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setStockInLooseMode('kg_per_bag');
                        setStockInConv('0.05');
                      }}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all ${
                        stockInLooseMode === 'kg_per_bag' 
                          ? 'bg-white dark:bg-slate-900 text-purple-700 shadow-xs' 
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      1 Bac = [KG] (Tusaale 0.05 KG)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStockInLooseMode('bags_per_kg');
                        setStockInConv('20');
                      }}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all ${
                        stockInLooseMode === 'bags_per_kg' 
                          ? 'bg-white dark:bg-slate-900 text-purple-700 shadow-xs' 
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      1 KG = [Bacaha] (Tusaale 20 Bac)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="font-medium text-slate-700 dark:text-slate-300">
                      {stockInLooseMode === 'kg_per_bag' ? '1 Bac culeyskeeda (KG):' : '1 KG intee Bacood ayuu ka kooban yahay:'} *
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        step={stockInLooseMode === 'kg_per_bag' ? '0.01' : '1'}
                        placeholder={stockInLooseMode === 'kg_per_bag' ? '0.05' : '20'}
                        value={stockInConv}
                        onChange={(e) => setStockInConv(e.target.value)}
                        className="font-mono font-bold w-32 text-purple-700"
                      />
                      <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                        {stockInLooseMode === 'kg_per_bag' ? 'KG (50g)' : 'Bac'}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <p>Wadarta Bacaha Ka Soo Baxaya: <strong className="text-purple-700 dark:text-purple-300 font-mono">{stockInCalculation.totalStockQuantity} Bac</strong></p>
                    <p>Cost/Bac Toos ah: <strong className="text-purple-700 dark:text-purple-400 font-mono">${stockInCalculation.costPerSellingUnit.toFixed(4)}/Bac</strong></p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* STEP 5: SELLING SECTION & MINIMUM SELLABLE QUANTITY */}
          <div className="bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <span className="font-bold text-slate-800 dark:text-slate-200 block">
              Qaybta Iibinta & Qiyaasta Ugu Yar (Selling & Minimum Step)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Sidee ayaad u iibinaysaa? (Selling Unit) *</label>
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
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Qiimaha Iibka (${stockInSUnit ? `/${stockInSUnit.toUpperCase()}` : ''}) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.60"
                  value={stockInSell}
                  onChange={(e) => setStockInSell(e.target.value)}
                  className="mt-1 font-mono font-black text-emerald-700 dark:text-emerald-300 text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Qaybta Ugu Yar ee La Iibin Karo (Min Qty) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.05, 0.5, 1..."
                  value={stockInMinSellableQty}
                  onChange={(e) => setStockInMinSellableQty(e.target.value)}
                  className="mt-1 font-mono font-bold text-indigo-700 dark:text-indigo-300"
                />
              </div>
            </div>

            {/* Quick-select chips for minimum sellable quantity */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-500 font-semibold mr-1">Qiyaasaha caanka ah:</span>
              {stockInSUnit.toLowerCase() === 'kg' && (
                <>
                  {['0.05', '0.10', '0.25', '0.50', '1.00'].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setStockInMinSellableQty(val)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                        stockInMinSellableQty === val 
                          ? 'bg-emerald-600 text-white shadow-xs' 
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {val} KG
                    </button>
                  ))}
                </>
              )}
              {stockInSUnit.toLowerCase() === 'liter' && (
                <>
                  {['0.10', '0.25', '0.50', '1.00'].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setStockInMinSellableQty(val)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                        stockInMinSellableQty === val 
                          ? 'bg-amber-600 text-white shadow-xs' 
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {val} L
                    </button>
                  ))}
                </>
              )}
              {(stockInSUnit.toLowerCase() === 'bac' || stockInSUnit.toLowerCase() === 'pcs') && (
                <>
                  {['0.5', '1.0'].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setStockInMinSellableQty(val)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                        stockInMinSellableQty === val 
                          ? 'bg-blue-600 text-white shadow-xs' 
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {val} {stockInSUnit.toUpperCase()}
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Pricing Mode Toggle */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-slate-700 dark:text-slate-300">Habka Qiimeynta (Pricing Mode):</span>
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setStockInPricingMode('fixed')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                    stockInPricingMode === 'fixed'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Mode B: Qiimo Go'an ($ USD)
                </button>
                <button
                  type="button"
                  onClick={() => setStockInPricingMode('denomination')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                    stockInPricingMode === 'denomination'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Mode A: Denomination (SOS)
                </button>
              </div>
            </div>

            {stockInPricingMode === 'denomination' && (
              <div className="grid grid-cols-2 gap-3 p-2.5 bg-purple-50/70 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800/60">
                <div>
                  <label className="font-bold text-purple-950 dark:text-purple-200 text-[11px]">
                    Qiimaha SOS (Tusaale: 5000 SOS) *
                  </label>
                  <Input
                    type="number"
                    step="500"
                    placeholder="5000"
                    value={stockInSosPrice}
                    onChange={(e) => {
                      setStockInSosPrice(e.target.value);
                      const sVal = parseFloat(e.target.value) || 0;
                      if (sVal > 0) {
                        setStockInSell(String(calculateSosDenomination(sVal).denominationUsd));
                      }
                    }}
                    className="mt-1 font-mono font-bold text-purple-700 dark:text-purple-300 bg-white dark:bg-slate-900"
                  />
                </div>
                <div className="text-[11px] text-purple-900 dark:text-purple-300 flex flex-col justify-center">
                  {stockInSosPrice && parseFloat(stockInSosPrice) > 0 ? (
                    <div>
                      <p className="font-bold">Next Denom: ${calculateSosDenomination(parseFloat(stockInSosPrice)).denominationUsd.toFixed(2)} ({calculateSosDenomination(parseFloat(stockInSosPrice)).denominationSos.toLocaleString()} SOS)</p>
                      {calculateSosDenomination(parseFloat(stockInSosPrice)).differenceSos > 0 && (
                        <p className="text-amber-700 dark:text-amber-400 font-semibold">
                          Farqi: +{calculateSosDenomination(parseFloat(stockInSosPrice)).differenceSos.toLocaleString()} SOS
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-500">1k=$0.05, 3k=$0.10, 4k=$0.15, 6k=$0.20, 7k=$0.25</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* STEP 6: LIVE CALCULATION PREVIEW CARD */}
          <div className={`p-4 rounded-xl border transition-all ${
            stockInCalculation.isLoss 
              ? 'bg-red-50/90 dark:bg-red-950/40 border-red-300 dark:border-red-800' 
              : 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
          }`}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5 font-black text-xs">
                <Calculator className={`h-4 w-4 ${stockInCalculation.isLoss ? 'text-red-600' : 'text-emerald-600'}`} />
                <span className={stockInCalculation.isLoss ? 'text-red-900 dark:text-red-200' : 'text-emerald-900 dark:text-emerald-200'}>
                  Xisaabinta Tooska ah ee Nidaamka (Live Authoritative Summary)
                </span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                stockInCalculation.isLoss 
                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-300' 
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border border-emerald-300'
              }`}>
                {stockInCalculation.conversionSummary}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              {/* STOCK */}
              <div className="bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] uppercase font-sans text-slate-500 font-bold block">Kaydka (Stock)</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  {stockInCalculation.totalStockQuantity.toLocaleString()} {stockInSUnit.toUpperCase()}
                </span>
                {stockInProductType === 'carton' && stockInPackWeight && (
                  <span className="text-[10px] block text-slate-400 font-normal">
                    ≈ {cleanPrecision(stockInCalculation.totalStockQuantity * Number(stockInPackWeight))} KG
                  </span>
                )}
                {(stockInProductType as string) === 'jawan' && (
                  <span className="text-[10px] block text-slate-400 font-normal">
                    = {stockInQty || 0} Jawan
                  </span>
                )}
              </div>

              {/* EXACT COST PER SELLING UNIT */}
              <div className="bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] uppercase font-sans text-slate-500 font-bold block">Qiimaha Kugu Kacay (Cost)</span>
                <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                  ${stockInCalculation.costPerSellingUnit.toFixed(stockInCalculation.costPerSellingUnit % 1 === 0 ? 2 : (stockInCalculation.costPerSellingUnit * 100 % 1 === 0 ? 2 : (stockInCalculation.costPerSellingUnit * 1000 % 1 === 0 ? 3 : 4)))} / {stockInSUnit.toUpperCase()}
                </span>
                <span className="text-[10px] block text-slate-400 font-normal">
                  Wadarta: ${stockInCalculation.totalPurchaseCost.toFixed(2)}
                </span>
              </div>

              {/* SELLING PRICE */}
              <div className="bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] uppercase font-sans text-slate-500 font-bold block">Qiimaha Iibka (Sell)</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  ${stockInCalculation.sellPricePerUnit.toFixed(2)} / {stockInSUnit.toUpperCase()}
                </span>
                <span className="text-[10px] block text-slate-400 font-normal">
                  Min: {stockInCalculation.minSellableQty} {stockInSUnit.toUpperCase()}
                </span>
              </div>

              {/* EXACT PROFIT OR LOSS */}
              <div className={`p-2.5 rounded-lg border ${
                stockInCalculation.isLoss 
                  ? 'bg-red-100 dark:bg-red-950/60 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200' 
                  : 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              }`}>
                <span className={`text-[10px] uppercase font-sans font-bold block ${stockInCalculation.isLoss ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                  {stockInCalculation.isLoss ? 'KHASAARE (LOSS)' : 'FAA\'IIDO (PROFIT)'}
                </span>
                <span className={`text-sm font-black ${stockInCalculation.isLoss ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {stockInCalculation.profitPerUnit >= 0 ? '+' : ''}${stockInCalculation.profitPerUnit.toFixed(stockInCalculation.profitPerUnit % 1 === 0 ? 2 : (stockInCalculation.profitPerUnit * 100 % 1 === 0 ? 2 : (stockInCalculation.profitPerUnit * 1000 % 1 === 0 ? 3 : 4)))} / {stockInSUnit.toUpperCase()}
                </span>
                <span className={`text-[10px] block font-semibold ${stockInCalculation.isLoss ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {stockInCalculation.isLoss ? 'Digniin: Qiimo hooseeya' : `${stockInCalculation.costPerSellingUnit > 0 ? ((stockInCalculation.profitPerUnit / stockInCalculation.costPerSellingUnit) * 100).toFixed(0) : 0}% margin`}
                </span>
              </div>
            </div>

            {/* FRACTIONAL SALE EXAMPLE IF MIN < 1 */}
            {stockInCalculation.fractionalExample && (
              <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700/60 text-[11px] text-slate-700 dark:text-slate-300 flex flex-wrap items-center justify-between gap-1">
                <span className="font-semibold">
                  Tusaale: Haddii macaamiilku gato {stockInCalculation.fractionalExample.qty} {stockInSUnit.toUpperCase()}:
                </span>
                <div className="flex items-center gap-3 font-mono">
                  <span>Iib: <strong>${stockInCalculation.fractionalExample.revenue.toFixed(2)}</strong></span>
                  <span>Cost: <strong>${stockInCalculation.fractionalExample.cost.toFixed(3)}</strong></span>
                  <span>Faa'iido: <strong className={stockInCalculation.fractionalExample.exactProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    ${stockInCalculation.fractionalExample.exactProfit.toFixed(3)} (Display: ${stockInCalculation.fractionalExample.displayProfit.toFixed(2)})
                  </strong></span>
                </div>
              </div>
            )}
          </div>
            </>
          )}

          {/* STEP 7: SUPPLIER & CATEGORY */}
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
            {editingVariant?.is_pending ? 'Xaqiiji & Sax Alaabta Sugaysa' : 'Wax ka beddel Alaabta (Edit Product)'}
          </DialogTitle>
          <DialogDescription>
            {editingVariant?.is_pending 
              ? 'Sax qiimaha iibinta iyo xogta ka hor inta aysan si rasmi ah ugu biirin kaydka.'
              : 'Wax ka beddel qiimaha, nooca, barcode, habka maareynta ama halbeegyada alaabta.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 text-xs">
          {/* STEP 1: PRODUCT MODEL SELECTOR (4 CARDS) */}
          <div>
            <label className="font-black text-slate-800 dark:text-slate-200 block mb-1.5 text-xs">
              1. Nooca Habka Alaabta (Product Category / Arrival Model) *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* 1. Jawan / Sack */}
              <button
                type="button"
                onClick={() => selectEditProductType('jawan')}
                className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                  editProductType === 'jawan'
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Package className="h-4 w-4 text-emerald-600" />
                  <span className="font-bold text-xs">Kiish / Jawan</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">Bariis, Bur, Sokor (KG lagu iibiyo)</p>
              </button>

              {/* 2. Liquid / Liter */}
              <button
                type="button"
                onClick={() => selectEditProductType('liquid')}
                className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                  editProductType === 'liquid'
                    ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Droplets className="h-4 w-4 text-amber-600" />
                  <span className="font-bold text-xs">Dareere / Saliid</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">Caag Saliid ah (Litir lagu iibiyo)</p>
              </button>

              {/* 3. Carton / Pack */}
              <button
                type="button"
                onClick={() => selectEditProductType('carton')}
                className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                  editProductType === 'carton'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Boxes className="h-4 w-4 text-blue-600" />
                  <span className="font-bold text-xs">Kartoon / Pack</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">Basto, Baakado (Bac/Pcs lagu iibiyo)</p>
              </button>

              {/* 4. Loose / Bulk */}
              <button
                type="button"
                onClick={() => selectEditProductType('loose')}
                className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                  editProductType === 'loose'
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Scale className="h-4 w-4 text-purple-600" />
                  <span className="font-bold text-xs">Shub-shub / Bulk</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">Xawaaji, Budo (KG loo qeybiyo Bac)</p>
              </button>
            </div>
          </div>

          {/* STEP 2: PRODUCT IDENTIFICATION */}
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

          {/* STEP 3: PURCHASE SECTION */}
          <div className="bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-slate-800 dark:text-slate-200 font-bold">
              <span>Qaybta Qiimaha Soo Iibka (Purchase Details)</span>
              {editBuyPrice && (
                <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200/60">
                  {editingVariant?.is_pending && editIncomingQty ? `${editIncomingQty} × $${editBuyPrice} = $${(Number(editIncomingQty) * Number(editBuyPrice)).toFixed(2)}` : `1 ${editPurchaseUnit.toUpperCase()} = $${editBuyPrice}`}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {editingVariant?.is_pending && (
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Tirada Soo Gashay ({editPurchaseUnit.toUpperCase()}) *
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editIncomingQty}
                    onChange={(e) => setEditIncomingQty(e.target.value)}
                    className="mt-1 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  {editProductType === 'jawan' 
                    ? 'Qiimaha Hal Jawan / Kiish ($) *'
                    : editProductType === 'liquid'
                    ? 'Qiimaha Hal Caag ($) *'
                    : editProductType === 'carton'
                    ? 'Qiimaha Hal Carton ($) *'
                    : (editLooseMode === 'bags_per_kg' ? 'Qiimaha Guud ee KG-ga ($) *' : 'Qiimaha Hal KG ($) *')
                  }
                </label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="Tusaale: 12.40, 32.00, 8.60..."
                  value={editBuyPrice}
                  onChange={(e) => setEditBuyPrice(e.target.value)}
                  className="mt-1 font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Halbeegga Soo Galka (Purchase Unit)
                </label>
                <Input
                  value={editPurchaseUnit}
                  onChange={(e) => setEditPurchaseUnit(e.target.value)}
                  className="mt-1 font-bold uppercase text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          {/* STEP 4: CONVERSION SECTION */}
          <div className="bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <span className="font-bold text-slate-800 dark:text-slate-200 block">
              Xaddiga Halbeegga Soo Galka (What does ONE purchase unit contain?)
            </span>

            {editProductType === 'jawan' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-xs text-slate-600 dark:text-slate-400">1 Jawan / Kiish =</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="25"
                      value={editConversion}
                      onChange={(e) => setEditConversion(e.target.value)}
                      className="font-mono font-bold w-28 text-emerald-700"
                    />
                    <span className="font-bold text-xs text-slate-700 dark:text-slate-300">KG</span>
                  </div>
                </div>
              </div>
            )}

            {editProductType === 'liquid' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-xs text-slate-600 dark:text-slate-400">1 Caag =</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="20"
                      value={editConversion}
                      onChange={(e) => setEditConversion(e.target.value)}
                      className="font-mono font-bold w-28 text-amber-700"
                    />
                    <span className="font-bold text-xs text-slate-700 dark:text-slate-300">Liter</span>
                  </div>
                </div>
              </div>
            )}

            {editProductType === 'carton' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="font-medium text-slate-700 dark:text-slate-300">
                      1 Carton intee Bac/Baakad ayuu ka kooban yahay? *
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono font-bold text-xs text-slate-500">1 Carton =</span>
                      <Input
                        type="number"
                        step="1"
                        placeholder="20"
                        value={editConversion}
                        onChange={(e) => setEditConversion(e.target.value)}
                        className="font-mono font-bold w-28 text-blue-700"
                      />
                      <span className="font-bold text-xs text-slate-700 dark:text-slate-300">{editSellingUnit.toUpperCase()}</span>
                    </div>
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 dark:text-slate-300">
                      Culeyska 1 Bac (Optional KG)
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono font-bold text-xs text-slate-500">1 Bac =</span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.5"
                        value={editPackWeight}
                        onChange={(e) => setEditPackWeight(e.target.value)}
                        className="font-mono font-bold w-24 text-slate-700"
                      />
                      <span className="font-bold text-xs text-slate-700 dark:text-slate-300">KG (500g)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {editProductType === 'loose' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Qaabka Qaybinta:</span>
                  <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setEditLooseMode('kg_per_bag')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                        editLooseMode === 'kg_per_bag' 
                          ? 'bg-purple-600 text-white shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      1 Bac = [X] KG
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditLooseMode('bags_per_kg')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                        editLooseMode === 'bags_per_kg' 
                          ? 'bg-purple-600 text-white shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      1 KG = [X] Bac
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {editLooseMode === 'kg_per_bag' ? (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-purple-900 dark:text-purple-300">1 Bac =</span>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="0.05"
                        value={editConversion}
                        onChange={(e) => setEditConversion(e.target.value)}
                        className="font-mono font-bold w-28 text-purple-700"
                      />
                      <span className="font-bold text-xs text-slate-700 dark:text-slate-300">KG (Tusaale: 0.05 KG = 50g)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-purple-900 dark:text-purple-300">1 KG =</span>
                      <Input
                        type="number"
                        step="1"
                        placeholder="20"
                        value={editConversion}
                        onChange={(e) => setEditConversion(e.target.value)}
                        className="font-mono font-bold w-28 text-purple-700"
                      />
                      <span className="font-bold text-xs text-slate-700 dark:text-slate-300">Bacood</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* STEP 5: SELLING & MINIMUM SELLABLE QUANTITY */}
          <div className="bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <span className="font-bold text-slate-800 dark:text-slate-200 block">
              Qaybta Iibinta & Qadarka Ugu Yar (Selling Configuration)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Halbeegga Iibka (Selling Unit) *
                </label>
                <Input
                  value={editSellingUnit}
                  onChange={(e) => setEditSellingUnit(e.target.value)}
                  className="mt-1 font-bold uppercase text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Qiimaha Iibka ($/{editSellingUnit.toUpperCase()}) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.60, 2.00, 0.50..."
                  value={editSellPrice}
                  onChange={(e) => setEditSellPrice(e.target.value)}
                  className="mt-1 font-mono font-black text-emerald-600 dark:text-emerald-400"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Qadarka Ugu Yar ee La Iibin Karo (Min Qty) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.05, 0.1, 0.5, 1..."
                  value={editMinSellableQty}
                  onChange={(e) => setEditMinSellableQty(e.target.value)}
                  className="mt-1 font-mono font-bold text-blue-600 dark:text-blue-400"
                />
              </div>
            </div>

            {/* Quick Chips for Minimum Sellable Quantity */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-500 font-semibold">Talooyin Degdeg ah (Quick presets):</span>
              {editSellingUnit.toLowerCase() === 'kg' && (
                <>
                  {['0.05', '0.10', '0.25', '0.50', '1.0'].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setEditMinSellableQty(val)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                        editMinSellableQty === val 
                          ? 'bg-emerald-600 text-white shadow-xs' 
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {val} KG
                    </button>
                  ))}
                </>
              )}
              {editSellingUnit.toLowerCase() === 'liter' && (
                <>
                  {['0.10', '0.25', '0.50', '1.0'].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setEditMinSellableQty(val)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                        editMinSellableQty === val 
                          ? 'bg-amber-600 text-white shadow-xs' 
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {val} L
                    </button>
                  ))}
                </>
              )}
              {(editSellingUnit.toLowerCase() === 'bac' || editSellingUnit.toLowerCase() === 'pcs') && (
                <>
                  {['0.5', '1.0'].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setEditMinSellableQty(val)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                        editMinSellableQty === val 
                          ? 'bg-blue-600 text-white shadow-xs' 
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {val} {editSellingUnit.toUpperCase()}
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Pricing Mode Toggle */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-slate-700 dark:text-slate-300">Habka Qiimeynta (Pricing Mode):</span>
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setEditPricingMode('fixed')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                    editPricingMode === 'fixed'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Mode B: Qiimo Go'an ($ USD)
                </button>
                <button
                  type="button"
                  onClick={() => setEditPricingMode('denomination')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                    editPricingMode === 'denomination'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Mode A: Denomination (SOS)
                </button>
              </div>
            </div>

            {editPricingMode === 'denomination' && (
              <div className="grid grid-cols-2 gap-3 p-2.5 bg-purple-50/70 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800/60">
                <div>
                  <label className="font-bold text-purple-950 dark:text-purple-200 text-[11px]">
                    Qiimaha SOS (Tusaale: 5000 SOS) *
                  </label>
                  <Input
                    type="number"
                    step="500"
                    placeholder="5000"
                    value={editSosPrice}
                    onChange={(e) => {
                      setEditSosPrice(e.target.value);
                      const sVal = parseFloat(e.target.value) || 0;
                      if (sVal > 0) {
                        setEditSellPrice(String(calculateSosDenomination(sVal).denominationUsd));
                      }
                    }}
                    className="mt-1 font-mono font-bold text-purple-700 dark:text-purple-300 bg-white dark:bg-slate-900"
                  />
                </div>
                <div className="text-[11px] text-purple-900 dark:text-purple-300 flex flex-col justify-center">
                  {editSosPrice && parseFloat(editSosPrice) > 0 ? (
                    <div>
                      <p className="font-bold">Next Denom: ${calculateSosDenomination(parseFloat(editSosPrice)).denominationUsd.toFixed(2)} ({calculateSosDenomination(parseFloat(editSosPrice)).denominationSos.toLocaleString()} SOS)</p>
                      {calculateSosDenomination(parseFloat(editSosPrice)).differenceSos > 0 && (
                        <p className="text-amber-700 dark:text-amber-400 font-semibold">
                          Farqi: +{calculateSosDenomination(parseFloat(editSosPrice)).differenceSos.toLocaleString()} SOS
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-500">1k=$0.05, 3k=$0.10, 4k=$0.15, 6k=$0.20, 7k=$0.25</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* STEP 6: LIVE CALCULATION PREVIEW CARD */}
          <div className={`p-4 rounded-xl border transition-all ${
            editCalculation.isLoss 
              ? 'bg-red-50/90 dark:bg-red-950/40 border-red-300 dark:border-red-800' 
              : 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
          }`}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5 font-black text-xs">
                <Calculator className={`h-4 w-4 ${editCalculation.isLoss ? 'text-red-600' : 'text-emerald-600'}`} />
                <span className={editCalculation.isLoss ? 'text-red-900 dark:text-red-200' : 'text-emerald-900 dark:text-emerald-200'}>
                  Xisaabinta Tooska ah ee Nidaamka (Live Authoritative Summary)
                </span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                editCalculation.isLoss 
                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-300' 
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border border-emerald-300'
              }`}>
                {editCalculation.conversionSummary}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              {/* STOCK */}
              <div className="bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] uppercase font-sans text-slate-500 font-bold block">Kaydka (Stock)</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  {editingVariant?.stock_quantity ?? 0} {editSellingUnit.toUpperCase()}
                </span>
                {editProductType === 'carton' && editPackWeight && (
                  <span className="text-[10px] block text-slate-400 font-normal">
                    ≈ {cleanPrecision((editingVariant?.stock_quantity ?? 0) * Number(editPackWeight))} KG
                  </span>
                )}
              </div>

              {/* EXACT COST PER SELLING UNIT */}
              <div className="bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] uppercase font-sans text-slate-500 font-bold block">Qiimaha Kugu Kacay (Cost)</span>
                <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                  ${editCalculation.costPerSellingUnit.toFixed(editCalculation.costPerSellingUnit % 1 === 0 ? 2 : (editCalculation.costPerSellingUnit * 100 % 1 === 0 ? 2 : (editCalculation.costPerSellingUnit * 1000 % 1 === 0 ? 3 : 4)))} / {editSellingUnit.toUpperCase()}
                </span>
                <span className="text-[10px] block text-slate-400 font-normal">
                  Soo Galka: 1 {editPurchaseUnit.toUpperCase()} = ${editBuyPrice || 0}
                </span>
              </div>

              {/* SELLING PRICE */}
              <div className="bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] uppercase font-sans text-slate-500 font-bold block">Qiimaha Iibka (Sell)</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  ${editCalculation.sellPricePerUnit.toFixed(2)} / {editSellingUnit.toUpperCase()}
                </span>
                <span className="text-[10px] block text-slate-400 font-normal">
                  Min: {editCalculation.minSellableQty} {editSellingUnit.toUpperCase()}
                </span>
              </div>

              {/* EXACT PROFIT OR LOSS */}
              <div className={`p-2.5 rounded-lg border ${
                editCalculation.isLoss 
                  ? 'bg-red-100 dark:bg-red-950/60 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200' 
                  : 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              }`}>
                <span className={`text-[10px] uppercase font-sans font-bold block ${editCalculation.isLoss ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                  {editCalculation.isLoss ? 'KHASAARE (LOSS)' : 'FAA\'IIDO (PROFIT)'}
                </span>
                <span className={`text-sm font-black ${editCalculation.isLoss ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {editCalculation.profitPerUnit >= 0 ? '+' : ''}${editCalculation.profitPerUnit.toFixed(editCalculation.profitPerUnit % 1 === 0 ? 2 : (editCalculation.profitPerUnit * 100 % 1 === 0 ? 2 : (editCalculation.profitPerUnit * 1000 % 1 === 0 ? 3 : 4)))} / {editSellingUnit.toUpperCase()}
                </span>
                <span className={`text-[10px] block font-semibold ${editCalculation.isLoss ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {editCalculation.isLoss ? 'Digniin: Qiimo hooseeya' : `${editCalculation.costPerSellingUnit > 0 ? ((editCalculation.profitPerUnit / editCalculation.costPerSellingUnit) * 100).toFixed(0) : 0}% margin`}
                </span>
              </div>
            </div>

            {/* FRACTIONAL SALE EXAMPLE IF MIN < 1 */}
            {editCalculation.fractionalExample && (
              <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700/60 text-[11px] text-slate-700 dark:text-slate-300 flex flex-wrap items-center justify-between gap-1">
                <span className="font-semibold">
                  Tusaale: Haddii macaamiilku gato {editCalculation.fractionalExample.qty} {editSellingUnit.toUpperCase()}:
                </span>
                <div className="flex items-center gap-3 font-mono">
                  <span>Iib: <strong>${editCalculation.fractionalExample.revenue.toFixed(2)}</strong></span>
                  <span>Cost: <strong>${editCalculation.fractionalExample.cost.toFixed(3)}</strong></span>
                  <span>Faa'iido: <strong className={editCalculation.fractionalExample.exactProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    ${editCalculation.fractionalExample.exactProfit.toFixed(3)} (Display: ${editCalculation.fractionalExample.displayProfit.toFixed(2)})
                  </strong></span>
                </div>
              </div>
            )}
          </div>

          {/* MINIMUM STOCK THRESHOLD */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="font-medium text-slate-600 dark:text-slate-400">Heerka Digniinta Kaydka (Min Stock Alert)</label>
              <Input
                type="number"
                value={editMinStock}
                onChange={(e) => setEditMinStock(e.target.value)}
                className="mt-1 font-mono"
              />
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

      {/* 4. OIL BATCHES MANAGEMENT MODAL */}
      <Dialog open={!!batchModalVariant} onOpenChange={(open) => !open && setBatchModalVariant(null)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-lg">
            <Droplets className="h-5 w-5 text-amber-600" />
            Dufcadaha Saliidda & Heshiisiinta (Oil Batches & Reconciliation)
          </DialogTitle>
          <DialogDescription>
            Alaabta: <strong className="text-slate-900 dark:text-white">{batchModalVariant?.product?.name} ({batchModalVariant?.variant_name})</strong>
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 text-xs">
          {loadingBatches ? (
            <div className="py-12 text-center text-slate-400">Soo rarayaa dufcadaha...</div>
          ) : variantBatches.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              Dufcado saliid ah lama helin. Soo gali dufcad cusub adigoo isticmaalaya "Soo Xaree Alaab".
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 font-bold border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="p-2.5">Dufcadda</th>
                    <th className="p-2.5">Taariikhda</th>
                    <th className="p-2.5 text-right">Weelasha</th>
                    <th className="p-2.5 text-right">Litir Guud</th>
                    <th className="p-2.5 text-right">Qiimaha Iibka</th>
                    <th className="p-2.5 text-right">Cost/L</th>
                    <th className="p-2.5 text-right">Kaydka Haray</th>
                    <th className="p-2.5 text-center">Status</th>
                    <th className="p-2.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {variantBatches.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                        #{b.batch_number}
                      </td>
                      <td className="p-2.5 text-slate-500 text-[11px]">
                        {b.created_at ? b.created_at.split('T')[0] : '—'}
                      </td>
                      <td className="p-2.5 text-right">
                        {b.container_count} Caag ({b.liters_per_container}L)
                      </td>
                      <td className="p-2.5 text-right font-bold text-emerald-600">
                        {b.total_liters}L
                      </td>
                      <td className="p-2.5 text-right">
                        ${Number(b.total_purchase_cost).toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right font-bold text-amber-700 dark:text-amber-300">
                        ${Number(b.cost_per_liter).toFixed(4)}/L
                      </td>
                      <td className="p-2.5 text-right font-black text-slate-900 dark:text-white">
                        {Number(b.remaining_quantity || 0).toFixed(2)}L
                      </td>
                      <td className="p-2.5 text-center">
                        <Badge variant="outline" className={`text-[10px] uppercase font-bold ${
                          b.status === 'active' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                            : b.status === 'reconciled'
                            ? 'bg-blue-50 text-blue-700 border-blue-300'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {b.status === 'active' ? '🟢 Active' : b.status === 'reconciled' ? '🔵 Reconciled' : 'Finished'}
                        </Badge>
                      </td>
                      <td className="p-2.5 text-center flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenBatchTransactions(b)}
                          className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                          title="Arag Iibka Dufcaddan"
                        >
                          Transactions
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleOpenReconcile(b)}
                            className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-950/60 text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-200 border border-amber-300"
                          >
                            Heshiisii (Reconcile)
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => setBatchModalVariant(null)}>
            Xidh
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 5. BATCH RECONCILIATION DIALOG */}
      <Dialog open={!!reconcilingBatch} onOpenChange={(open) => !open && setReconcilingBatch(null)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-lg">
            <Scale className="h-5 w-5 text-amber-600" />
            Dib-u-heshiisiinta Dufcadda (Batch Physical Count Reconciliation)
          </DialogTitle>
          <DialogDescription>
            Geli tirada dhabta ah ee litirrada ah ee weelka ku haray si loo ogaado faa'iidada ama khasaaraha daatay (shrinkage).
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 text-xs">
          <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-amber-900 dark:text-amber-200">Dufcadda:</span>
              <strong className="font-mono text-sm">#{reconcilingBatch?.batch_number}</strong>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span>Litirrada Hore u Soo Galay:</span>
              <strong className="font-mono">{reconcilingBatch?.total_liters} Liters</strong>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span>Kaydka la filayo (Expected Remaining):</span>
              <strong className="font-mono text-blue-700 dark:text-blue-300">{Number(reconcilingBatch?.remaining_quantity || 0).toFixed(2)} Liters</strong>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span>Cost per Liter:</span>
              <strong className="font-mono">${Number(reconcilingBatch?.cost_per_liter || 0).toFixed(4)}/L</strong>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">
              Tirada Dhabta ah ee Litirrada ee Hadda Yaalla (Actual Physical Count) *
            </label>
            <Input
              type="number"
              step="0.01"
              value={physicalRemainingInput}
              onChange={(e) => setPhysicalRemainingInput(e.target.value)}
              className="mt-1 font-mono font-black text-lg h-11"
            />
            {reconcilingBatch && (
              <div className="mt-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Farqiga (Variance):</span>
                  <span className={`font-mono font-bold ${
                    calculateBatchVariance(Number(reconcilingBatch.remaining_quantity || 0), parseFloat(physicalRemainingInput) || 0).variance < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {calculateBatchVariance(Number(reconcilingBatch.remaining_quantity || 0), parseFloat(physicalRemainingInput) || 0).variance > 0 ? '+' : ''}
                    {calculateBatchVariance(Number(reconcilingBatch.remaining_quantity || 0), parseFloat(physicalRemainingInput) || 0).variance} Liters
                  </span>
                </div>
                {calculateBatchVariance(Number(reconcilingBatch.remaining_quantity || 0), parseFloat(physicalRemainingInput) || 0).isShrinkage && (
                  <div className="flex justify-between items-center text-red-600 dark:text-red-400 font-bold">
                    <span>Khasaaraha Daadashada (Shrinkage Loss):</span>
                    <span className="font-mono">
                      -${(Math.abs(calculateBatchVariance(Number(reconcilingBatch.remaining_quantity || 0), parseFloat(physicalRemainingInput) || 0).variance) * Number(reconcilingBatch.cost_per_liter || 0)).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Qoraal / Notes</label>
            <Input
              value={reconcileNotes}
              onChange={(e) => setReconcileNotes(e.target.value)}
              placeholder="Tusaale: Heshiisiinta dhamaadka caagga..."
              className="mt-1"
            />
          </div>
        </DialogBody>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setReconcilingBatch(null)}>
            Ka noqo
          </Button>
          <Button onClick={handleSaveReconciliation} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
            Keydi Heshiisiinta
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 6. BATCH TRANSACTIONS MODAL */}
      <Dialog open={!!viewingBatchTransactions} onOpenChange={(open) => !open && setViewingBatchTransactions(null)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-lg">
            <FileText className="h-5 w-5 text-blue-600" />
            Iibka Ku Xidhan Dufcadda #{viewingBatchTransactions?.batch_number}
          </DialogTitle>
          <DialogDescription>
            Liiska dhammaan iibyada saliidda ee laga jaray dufcaddan
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3 text-xs">
          {loadingBatchTransactions ? (
            <div className="py-8 text-center text-slate-400">Soo rarayaa iibka...</div>
          ) : batchTransactions.length === 0 ? (
            <div className="py-8 text-center text-slate-400">Weli iib lagama samayn dufcaddan.</div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-[360px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 font-bold border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="p-2.5">Taariikh</th>
                    <th className="p-2.5">Iibka (Option)</th>
                    <th className="p-2.5 text-right">Litirrada</th>
                    <th className="p-2.5 text-right">Qiimaha</th>
                    <th className="p-2.5 text-right">Faa'iido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {batchTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 text-[11px] text-slate-500">
                        {tx.created_at ? tx.created_at.split('T')[0] : '—'}
                      </td>
                      <td className="p-2.5 font-sans font-bold text-slate-900 dark:text-white">
                        {tx.selling_option_label || 'Saliid'}
                      </td>
                      <td className="p-2.5 text-right font-bold text-emerald-600">
                        {tx.actual_quantity_used || tx.quantity}L
                      </td>
                      <td className="p-2.5 text-right">
                        ${Number(tx.total_price || 0).toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right font-bold text-emerald-600">
                        +${Number(tx.gross_profit || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => setViewingBatchTransactions(null)}>
            Xidh
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 7. STOCK MOVEMENTS HISTORY MODAL */}
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
