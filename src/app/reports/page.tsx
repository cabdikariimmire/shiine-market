'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileBarChart, 
  Calendar, 
  Download, 
  Printer, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  CreditCard, 
  Building2, 
  Receipt,
  FileSpreadsheet,
  ShoppingBag,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Scale,
  Calendar as CalendarIcon
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ReportPrintView } from '@/components/reports/report-print-view';
import { repository } from '@/lib/services/repository';
import { formatMoney } from '@/lib/calculations/financials';
import { calculateStockValuation, calculateBatchVariance } from '@/lib/calculations/stock';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/components/ui/toast';
import { 
  DashboardMetrics, 
  ProfitReportRow, 
  SalesReportRow, 
  ProductSalesReportRow, 
  ProductSalesReportSummary, 
  ProductSaleTransactionDetail, 
  OilBatchReportRow,
  ProductBatch,
  ReportDateFilterType,
  ShopSettings
} from '@/types';

export default function ReportsPage() {
  const { user: currentUser } = useAuth();
  const { success, error } = useToast();
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [dateFilter, setDateFilter] = useState<ReportDateFilterType>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [activeReportTab, setActiveReportTab] = useState<'product_sales' | 'financial' | 'sales' | 'stock' | 'debts' | 'oil_batches'>('product_sales');

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [salesRows, setSalesRows] = useState<SalesReportRow[]>([]);
  const [profitRows, setProfitRows] = useState<ProfitReportRow[]>([]);
  const [stockValuation, setStockValuation] = useState<{
    totalCostValue: number;
    totalRetailValue: number;
    totalPotentialProfit: number;
    totalQuantity: number;
  }>({ totalCostValue: 0, totalRetailValue: 0, totalPotentialProfit: 0, totalQuantity: 0 });

  // Product Sales Report State
  const [productSalesRows, setProductSalesRows] = useState<ProductSalesReportRow[]>([]);
  const [productSalesSummary, setProductSalesSummary] = useState<ProductSalesReportSummary | null>(null);
  const [productSearch, setProductSearch] = useState<string>('');
  const [loadingProductSales, setLoadingProductSales] = useState<boolean>(false);

  // Oil Batches Report State
  const [oilBatchRows, setOilBatchRows] = useState<OilBatchReportRow[]>([]);
  const [loadingOilBatches, setLoadingOilBatches] = useState<boolean>(false);

  // Product Drill-down Modal State
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<ProductSalesReportRow | null>(null);
  const [detailTransactions, setDetailTransactions] = useState<ProductSaleTransactionDetail[]>([]);
  const [detailPage, setDetailPage] = useState<number>(1);
  const [detailTotalPages, setDetailTotalPages] = useState<number>(1);
  const [detailTotalCount, setDetailTotalCount] = useState<number>(0);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  // Oil Batch Drill-down & Reconciliation Modal States
  const [selectedBatchForDetail, setSelectedBatchForDetail] = useState<OilBatchReportRow | null>(null);
  const [batchTransactions, setBatchTransactions] = useState<any[]>([]);
  const [loadingBatchTxs, setLoadingBatchTxs] = useState<boolean>(false);

  const [reconcilingBatch, setReconcilingBatch] = useState<OilBatchReportRow | null>(null);
  const [reconcilePhysicalLiters, setReconcilePhysicalLiters] = useState<string>('');
  const [reconcileNotes, setReconcileNotes] = useState<string>('');
  const [isSubmittingReconcile, setIsSubmittingReconcile] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const metricFilter = dateFilter === 'all' ? 'all' : (dateFilter === 'today' ? 'today' : (dateFilter === 'yesterday' ? 'yesterday' : 'month'));
      const [m, sRows, pRows, varData, shopSettings] = await Promise.all([
        repository.getDashboardMetrics(metricFilter),
        repository.getSalesReport(),
        repository.getProfitReport(),
        repository.getVariantsPaginated('', 'all', 'all', 1, 1000),
        repository.getSettings(),
      ]);
      setMetrics(m);
      setSalesRows(sRows);
      setProfitRows(pRows);
      setStockValuation(calculateStockValuation(varData.data));
      setSettings(shopSettings);
    } catch (err) {
      console.error('Error loading report data:', err);
    }
  }, [dateFilter]);

  const loadProductSales = useCallback(async () => {
    setLoadingProductSales(true);
    try {
      const { rows, summary } = await repository.getProductSalesReport(
        dateFilter,
        dateFilter === 'custom' ? customStartDate : undefined,
        dateFilter === 'custom' ? customEndDate : undefined,
        productSearch
      );
      setProductSalesRows(rows);
      setProductSalesSummary(summary);
    } catch (err) {
      console.error('Error loading product sales report:', err);
    } finally {
      setLoadingProductSales(false);
    }
  }, [dateFilter, customStartDate, customEndDate, productSearch]);

  const loadOilBatches = useCallback(async () => {
    setLoadingOilBatches(true);
    try {
      const rows = await repository.getOilBatchReports();
      setOilBatchRows(rows);
    } catch (err) {
      console.error('Error loading oil batches report:', err);
    } finally {
      setLoadingOilBatches(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadProductSales();
    loadOilBatches();
  }, [loadData, loadProductSales, loadOilBatches]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProductSales();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadProductSales]);

  const handleApplyCustomFilter = () => {
    loadProductSales();
    loadData();
    loadOilBatches();
  };

  // Transaction drilldown loader for normal products
  const openProductDetail = async (row: ProductSalesReportRow) => {
    setSelectedProductForDetail(row);
    setDetailPage(1);
    setLoadingDetails(true);
    try {
      const result = await repository.getProductSaleTransactions(
        row.variantId,
        dateFilter,
        dateFilter === 'custom' ? customStartDate : undefined,
        dateFilter === 'custom' ? customEndDate : undefined,
        1,
        15
      );
      setDetailTransactions(result.data);
      setDetailTotalPages(result.totalPages);
      setDetailTotalCount(result.totalCount);
    } catch (err) {
      console.error('Error loading product transaction details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const changeDetailPage = async (newPage: number) => {
    if (!selectedProductForDetail || newPage < 1 || newPage > detailTotalPages) return;
    setDetailPage(newPage);
    setLoadingDetails(true);
    try {
      const result = await repository.getProductSaleTransactions(
        selectedProductForDetail.variantId,
        dateFilter,
        dateFilter === 'custom' ? customStartDate : undefined,
        dateFilter === 'custom' ? customEndDate : undefined,
        newPage,
        15
      );
      setDetailTransactions(result.data);
      setDetailTotalPages(result.totalPages);
      setDetailTotalCount(result.totalCount);
    } catch (err) {
      console.error('Error loading product transaction details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Transaction drilldown loader for Oil Batches
  const openBatchTransactions = async (batch: OilBatchReportRow) => {
    setSelectedBatchForDetail(batch);
    setLoadingBatchTxs(true);
    try {
      const txs = await repository.getBatchTransactions(batch.batchId);
      setBatchTransactions(txs);
    } catch (err) {
      console.error('Error loading batch transactions:', err);
    } finally {
      setLoadingBatchTxs(false);
    }
  };

  // Open Reconcile Modal for Oil Batch
  const openReconcileModal = (batch: OilBatchReportRow) => {
    setReconcilingBatch(batch);
    setReconcilePhysicalLiters(String(batch.expectedRemainingLiters));
    setReconcileNotes('');
  };

  // Submit Batch Reconciliation
  const handleSaveReconcile = async () => {
    if (!reconcilingBatch) return;
    const physical = parseFloat(reconcilePhysicalLiters);
    if (isNaN(physical) || physical < 0) {
      error('Fadlan geli tirada saxda ah ee litirrada dhabta ah ee taalla.');
      return;
    }

    setIsSubmittingReconcile(true);
    try {
      await repository.reconcileProductBatch({
        batch_id: reconcilingBatch.batchId,
        actual_remaining_liters: physical,
        notes: reconcileNotes.trim() || undefined,
        status: physical <= 0.001 ? 'finished' : 'reconciled',
      }, `Dib-u-heshiisiin dufcadda #${reconcilingBatch.batchNumber}: Taalla ${physical}L (Filasho: ${reconcilingBatch.expectedRemainingLiters}L)`);

      success('Dufcadda dib-u-heshiisiinteeda waa la keydiyey!');
      setReconcilingBatch(null);
      await loadOilBatches();
      await loadData();
    } catch (err: any) {
      error('Khalad baa dhacay', err.message);
    } finally {
      setIsSubmittingReconcile(false);
    }
  };

  // Export to CSV Function
  const exportToCSV = (filename: string, rows: any[]) => {
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]).join(',');
    const values = rows.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${values}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = () => {
    if (activeReportTab === 'product_sales') {
      const exportRows = productSalesRows.map(r => ({
        'Alaabta (Product)': r.productName,
        'Variant': r.variantName || '-',
        'Halbeeg (Unit)': r.sellingUnit,
        'Tirada La Iibiyey (Qty Sold)': r.quantitySold,
        'Iibka Guud (Total Sales $)': r.totalSales,
        'Caddaan La Bixiyey (Paid $)': r.totalPaid,
        'Dayn Ka Dhalatay (Debt $)': r.totalDebt,
        'Faa\'iido (Profit $)': r.totalProfit,
        'Tirada Rasiidhada (Transactions)': r.transactionCount,
      }));
      exportToCSV(`warbixinta_iibka_alaabooyinka_${dateFilter}`, exportRows);
    } else if (activeReportTab === 'oil_batches') {
      const exportRows = oilBatchRows.map(r => ({
        'Batch #': r.batchNumber,
        'Alaabta': `${r.productName} (${r.variantName})`,
        'Caag': r.containersCount,
        'Litir': r.totalLiters,
        'Soo Iibka ($)': r.totalPurchaseCost,
        'Cost/L ($)': r.costPerLiter,
        'La Iibiyey (L)': r.litersSold,
        'Dakhli ($)': r.totalRevenue,
        'Cost of Sold Oil ($)': r.costOfSoldOil,
        'Faa\'iido/Khasaare ($)': r.grossProfitLoss,
        'Expected Remaining (L)': r.expectedRemainingLiters,
        'Actual Remaining (L)': r.actualRemainingLiters ?? '-',
        'Variance (L)': r.varianceLiters ?? '-',
        'Xaaladda': r.status,
      }));
      exportToCSV(`warbixinta_dufcadaha_saliidda`, exportRows);
    } else if (activeReportTab === 'sales') {
      exportToCSV(`warbixinta_iibka_${dateFilter}`, salesRows);
    } else {
      exportToCSV(`warbixinta_maaliyadda_${dateFilter}`, profitRows);
    }
  };

  // Safe Print Trigger
  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 50);
  };

  // Oil Batches Summary Totals
  const oilBatchesSummary = React.useMemo(() => {
    return oilBatchRows.reduce(
      (acc, r) => ({
        totalLitersReceived: acc.totalLitersReceived + (r.totalLiters || 0),
        totalPurchaseCost: acc.totalPurchaseCost + (r.totalPurchaseCost || 0),
        totalLitersSold: acc.totalLitersSold + (r.litersSold || 0),
        totalRevenue: acc.totalRevenue + (r.totalRevenue || 0),
        totalCostOfSoldOil: acc.totalCostOfSoldOil + (r.costOfSoldOil || 0),
        totalProfitLoss: acc.totalProfitLoss + (r.grossProfitLoss || 0),
        totalVarianceLiters: acc.totalVarianceLiters + (r.varianceLiters || 0),
      }),
      {
        totalLitersReceived: 0,
        totalPurchaseCost: 0,
        totalLitersSold: 0,
        totalRevenue: 0,
        totalCostOfSoldOil: 0,
        totalProfitLoss: 0,
        totalVarianceLiters: 0,
      }
    );
  }, [oilBatchRows]);

  return (
    <AppShell title="Reports">
      {/* ======================================================== */}
      {/* 1. SCREEN VERSION (Interactive UI)                       */}
      {/* ======================================================== */}
      <div className="space-y-6 screen-only print:hidden">
        {/* Header & Export Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileBarChart className="h-6 w-6 text-emerald-600" />
              Warbixinnada Dukaanka (Reports & Analytics)
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Iibka alaabooyinka, xogta dufcadaha saliidda, maaliyadda, faa'iidada nadiifka ah iyo xisaabaadka
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              className="font-bold gap-2 text-xs"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Dhoofi CSV / Excel
            </Button>

            <Button
              onClick={handlePrint}
              className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold gap-2 text-xs shadow-sm hover:bg-slate-800"
            >
              <Printer className="h-4 w-4" />
              Daabac (Print / PDF)
            </Button>
          </div>
        </div>

        {/* Date Filter Selector */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Calendar className="h-4 w-4 text-emerald-600" />
              Muddada Xogta (Date Filter):
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'today', label: 'Maanta (Today)' },
                { id: 'yesterday', label: 'Shalay (Yesterday)' },
                { id: 'week', label: 'Toddobaadkan (This Week)' },
                { id: 'month', label: 'Bishan (This Month)' },
                { id: 'custom', label: 'Mudo Gaar ah (Custom)' },
                { id: 'all', label: 'Dhammaan (All Time)' },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDateFilter(d.id as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    dateFilter === d.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range Inputs */}
          {dateFilter === 'custom' && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Laga bilaabo:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Ilaa:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <Button
                size="sm"
                onClick={handleApplyCustomFilter}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-1.5 rounded-xl h-auto"
              >
                Codso (Filter)
              </Button>
            </div>
          )}
        </div>

        {/* Report Sub-Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 dark:border-slate-800 pb-2 scrollbar-none">
          {[
            { id: 'product_sales', label: 'Iibka Alaabooyinka (Product Sales)', icon: ShoppingBag },
            { id: 'oil_batches', label: 'Dufcadaha Saliidda & Reconciliation', icon: Droplet },
            { id: 'financial', label: "Faa'iidada & Maaliyadda (Financial)", icon: DollarSign },
            { id: 'sales', label: 'Iibka & Rasiidhada (Sales)', icon: Receipt },
            { id: 'stock', label: 'Qiimaha Kaydka (Stock Valuation)', icon: Package },
            { id: 'debts', label: 'Xisaabta Daymaha (Debts)', icon: CreditCard },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeReportTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveReportTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ======================================================== */}
        {/* REPORT TAB 0: PRODUCT SALES REPORT                       */}
        {/* ======================================================== */}
        {activeReportTab === 'product_sales' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className="p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <p className="text-xs font-bold text-slate-400 uppercase">Tirada Guud ee La Iibiyey</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                  {productSalesSummary?.totalQuantity || 0}
                </p>
                <p className="text-[11px] text-slate-500">{productSalesSummary?.uniqueProductsCount || 0} nooc oo alaab ah</p>
              </Card>

              <Card className="p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <p className="text-xs font-bold text-slate-400 uppercase">Wadarta Iibka (Total Sales)</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                  {formatMoney(productSalesSummary?.totalSales)}
                </p>
                <p className="text-[11px] text-slate-500">Gross Sales Value</p>
              </Card>

              <Card className="p-4 border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">Caddaan La Bixiyey (Paid)</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  {formatMoney(productSalesSummary?.totalPaid)}
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Lacagta tooska loo helay</p>
              </Card>

              <Card className="p-4 border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20 shadow-xs">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase">Dayn Ka Dhalatay (Debt)</p>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
                  {formatMoney(productSalesSummary?.totalDebt)}
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300">Dayn dukaanka ku maqan</p>
              </Card>

              <Card className="p-4 border border-purple-200 dark:border-purple-900 bg-purple-50/40 dark:bg-purple-950/20 shadow-xs">
                <p className="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase">Faa'iidada Koowaad (Profit)</p>
                <p className="text-2xl font-black text-purple-700 dark:text-purple-300 mt-1 font-mono">
                  +{formatMoney(productSalesSummary?.totalProfit)}
                </p>
                <p className="text-[11px] text-purple-700 dark:text-purple-300">Revenue - Cost</p>
              </Card>
            </div>

            {/* Product Sales Data Table Card */}
            <Card className="border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Iibka Alaab Kasta (Individual Product Sales Breakdown)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Guji saf kasta ama batoonka "Faahfaahin" si aad u aragto rasiidhada & macaamiisha iibsatay
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Raadi magac, variant, halbeeg..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Alaabta (Product)</th>
                      <th className="px-4 py-3">Variant</th>
                      <th className="px-4 py-3 text-center">Halbeegga</th>
                      <th className="px-4 py-3 text-right">Tirada La Iibiyey</th>
                      <th className="px-4 py-3 text-right">Iibka Guud</th>
                      <th className="px-4 py-3 text-right">La Bixiyey (Paid)</th>
                      <th className="px-4 py-3 text-right">Dayn (Debt)</th>
                      <th className="px-4 py-3 text-right">Faa'iidada (Profit)</th>
                      <th className="px-4 py-3 text-center">Faahfaahin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {loadingProductSales ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-slate-400">
                          <div className="flex items-center justify-center gap-2">
                            <div className="h-5 w-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                            <span>Xogta iibka waa la soo rarayaa...</span>
                          </div>
                        </td>
                      </tr>
                    ) : productSalesRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-slate-400">
                          Ma jiraan wax iib ah oo la helay muddadan
                        </td>
                      </tr>
                    ) : (
                      productSalesRows.map((row, idx) => (
                        <tr 
                          key={idx} 
                          onClick={() => openProductDetail(row)}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                            {row.productName}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                              {row.variantName || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="outline" className="font-mono uppercase text-[10px]">
                              {row.sellingUnit}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {row.quantitySold} {row.sellingUnit}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {formatMoney(row.totalSales)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatMoney(row.totalPaid)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {row.totalDebt > 0 ? (
                              <span className="font-bold text-amber-600 dark:text-amber-400">
                                {formatMoney(row.totalDebt)}
                              </span>
                            ) : (
                              <span className="text-slate-400">$0.00</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-black text-purple-600 dark:text-purple-400">
                            +{formatMoney(row.totalProfit)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                openProductDetail(row);
                              }}
                              className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              <span className="text-[11px] font-bold">Faahfaahin</span>
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
        )}

        {/* ======================================================== */}
        {/* REPORT TAB 1: OIL BATCHES & RECONCILIATION REPORT         */}
        {/* ======================================================== */}
        {activeReportTab === 'oil_batches' && (
          <div className="space-y-6">
            {/* Oil KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <Card className="p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Wadarta Litir ee Soo Galay</p>
                <p className="text-xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                  {oilBatchesSummary.totalLitersReceived} L
                </p>
                <p className="text-[10px] text-slate-500">{oilBatchRows.length} dufcadood</p>
              </Card>

              <Card className="p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Wadarta Qiimaha Soo Iibka</p>
                <p className="text-xl font-black text-slate-700 dark:text-slate-300 mt-1 font-mono">
                  ${formatMoney(oilBatchesSummary.totalPurchaseCost)}
                </p>
                <p className="text-[10px] text-slate-500">Total Purchase Cost</p>
              </Card>

              <Card className="p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Litirrada La Iibiyey</p>
                <p className="text-xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                  {oilBatchesSummary.totalLitersSold} L
                </p>
                <p className="text-[10px] text-slate-500">Total Liters Sold/Used</p>
              </Card>

              <Card className="p-3.5 border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs">
                <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">Dakhliga Saliidda (Revenue)</p>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  ${formatMoney(oilBatchesSummary.totalRevenue)}
                </p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-300">Sales Value</p>
              </Card>

              <Card className="p-3.5 border border-purple-200 dark:border-purple-900 bg-purple-50/40 dark:bg-purple-950/20 shadow-xs">
                <p className="text-[10px] font-bold text-purple-800 dark:text-purple-300 uppercase">Faa'iido / Khasaare</p>
                <p className="text-xl font-black text-purple-700 dark:text-purple-300 mt-1 font-mono">
                  +${formatMoney(oilBatchesSummary.totalProfitLoss)}
                </p>
                <p className="text-[10px] text-purple-700 dark:text-purple-300">Revenue - Cost of Sold</p>
              </Card>

              <Card className="p-3.5 border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20 shadow-xs">
                <p className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase">Farqiga / Lumiska (Variance)</p>
                <p className="text-xl font-black font-mono mt-1 text-amber-600 dark:text-amber-400">
                  {oilBatchesSummary.totalVarianceLiters > 0 ? '+' : ''}{oilBatchesSummary.totalVarianceLiters} L
                </p>
                <p className="text-[10px] text-amber-700 dark:text-amber-300">Physical vs Expected</p>
              </Card>
            </div>

            {/* Oil Batches Table */}
            <Card className="border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Droplet className="h-4 w-4 text-amber-600" />
                    Dufcadaha Saliidda, Kharashka, Faa'iidada & Dib-u-heshiisiinta
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Dufcad kasta waxay leedahay qiimo soo iibsi oo gaar ah ($25, $28, $32, $35) iyo xisaab faa'iido/khasaare gaar ah
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-3.5 py-3">Dufcadda (Batch #)</th>
                      <th className="px-3.5 py-3">Alaabta</th>
                      <th className="px-3 py-3 text-right">Caag</th>
                      <th className="px-3 py-3 text-right">Litir</th>
                      <th className="px-3 py-3 text-right">Qiimaha ($)</th>
                      <th className="px-3 py-3 text-right">Cost/L</th>
                      <th className="px-3 py-3 text-right">La Iibiyey</th>
                      <th className="px-3 py-3 text-right">Dakhli ($)</th>
                      <th className="px-3 py-3 text-right">Faa'iido ($)</th>
                      <th className="px-3 py-3 text-right">Filasho (Exp)</th>
                      <th className="px-3 py-3 text-right">Taalla (Phys)</th>
                      <th className="px-3 py-3 text-center">Farqi</th>
                      <th className="px-3 py-3 text-center">Xaaladda</th>
                      <th className="px-3 py-3 text-center">Tallaabo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {loadingOilBatches ? (
                      <tr>
                        <td colSpan={14} className="text-center py-12 text-slate-400">
                          <div className="flex items-center justify-center gap-2">
                            <div className="h-5 w-5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                            <span>Xogta dufcadaha saliidda waa la soo rarayaa...</span>
                          </div>
                        </td>
                      </tr>
                    ) : oilBatchRows.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="text-center py-12 text-slate-400">
                          Wali ma jiraan dufcado saliid ah oo la diiwaangeliyey
                        </td>
                      </tr>
                    ) : (
                      oilBatchRows.map((batch, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-3.5 py-3 font-mono font-bold text-slate-900 dark:text-white">
                            {batch.batchNumber}
                          </td>
                          <td className="px-3.5 py-3 font-bold text-slate-800 dark:text-slate-200">
                            {batch.productName} <span className="text-slate-400 font-normal">({batch.variantName})</span>
                          </td>
                          <td className="px-3 py-3 text-right font-mono">
                            {batch.containersCount}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold">
                            {batch.totalLiters} L
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            ${formatMoney(batch.totalPurchaseCost)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-slate-500 text-[11px]">
                            ${batch.costPerLiter.toFixed(4)}/L
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {batch.litersSold} L
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ${formatMoney(batch.totalRevenue)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-black text-purple-600 dark:text-purple-400">
                            +${formatMoney(batch.grossProfitLoss)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-slate-500">
                            {batch.expectedRemainingLiters} L
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                            {batch.actualRemainingLiters !== undefined ? `${batch.actualRemainingLiters} L` : '-'}
                          </td>
                          <td className="px-3 py-3 text-center font-mono font-bold">
                            {batch.varianceLiters !== undefined ? (
                              <span className={batch.varianceLiters < 0 ? 'text-red-600' : 'text-emerald-600'}>
                                {batch.varianceLiters > 0 ? '+' : ''}{batch.varianceLiters} L
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <Badge 
                              variant={batch.status === 'active' ? 'success' : batch.status === 'reconciled' ? 'outline' : 'secondary'}
                              className="text-[9px] uppercase font-bold"
                            >
                              {batch.status === 'active' ? 'Socota' : batch.status === 'reconciled' ? 'Heshiisiisay' : 'Dhammaatay'}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-center space-x-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openBatchTransactions(batch)}
                              className="h-7 px-2 text-[10px] font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-50"
                              title="Eeg iibka dufcaddan"
                            >
                              <Eye className="h-3 w-3 mr-0.5" />
                              Iibka
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openReconcileModal(batch)}
                              className="h-7 px-2 text-[10px] font-bold text-blue-700 dark:text-blue-400 hover:bg-blue-50"
                              title="Dib-u-heshiisiin qiyaasta taalla"
                            >
                              <Scale className="h-3 w-3 mr-0.5" />
                              Heshiisii
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
        )}

        {/* ======================================================== */}
        {/* REPORT TAB 2: FINANCIAL PROFIT REPORT                    */}
        {/* ======================================================== */}
        {activeReportTab === 'financial' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <p className="text-xs font-bold text-slate-400 uppercase">Dakhliga Guud (Revenue)</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                  {formatMoney(metrics?.todaySales)}
                </p>
                <p className="text-[11px] text-slate-500">Iibka dhammaan alaabooyinka</p>
              </Card>

              <Card className="p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <p className="text-xs font-bold text-slate-400 uppercase">COGS (Qiimaha Soo Iibka)</p>
                <p className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1 font-mono">
                  {formatMoney(metrics?.todayCostOfGoods)}
                </p>
                <p className="text-[11px] text-slate-500">Qiimaha soo iibinta alaabta la iibiyey</p>
              </Card>

              <Card className="p-4 border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">Faa'iidada Koowaad (Gross)</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  {formatMoney(metrics?.todayGrossProfit)}
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Revenue - COGS</p>
              </Card>

              <Card className="p-4 border border-purple-200 dark:border-purple-900 bg-purple-50/40 dark:bg-purple-950/20 shadow-xs">
                <p className="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase">Faa'iidada Nadiifka ah (Net)</p>
                <p className="text-2xl font-black text-purple-700 dark:text-purple-300 mt-1 font-mono">
                  {formatMoney(metrics?.todayNetProfit)}
                </p>
                <p className="text-[11px] text-purple-700 dark:text-purple-300">Gross Profit - Kharashaadka</p>
              </Card>
            </div>

            <Card className="border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Xisaabinta Maalinlaha ah ee Faa'iidada (Daily Profit Ledger)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Taariikhda</th>
                      <th className="px-4 py-3 text-right">Revenue (Iibka)</th>
                      <th className="px-4 py-3 text-right">COGS (Soo Iibka)</th>
                      <th className="px-4 py-3 text-right">Gross Profit</th>
                      <th className="px-4 py-3 text-right">Kharashka</th>
                      <th className="px-4 py-3 text-right">Net Profit</th>
                      <th className="px-4 py-3 text-right">Cash Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {profitRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400">
                          Xog laguma helin muddadan
                        </td>
                      </tr>
                    ) : (
                      profitRows.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{r.date}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">{formatMoney(r.salesRevenue)}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500">{formatMoney(r.cogs)}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">+{formatMoney(r.grossProfit)}</td>
                          <td className="px-4 py-3 text-right font-mono text-red-600">-{formatMoney(r.expenses)}</td>
                          <td className="px-4 py-3 text-right font-mono font-black text-purple-600 dark:text-purple-400">{formatMoney(r.netProfit)}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">{formatMoney(r.cashReceived)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ======================================================== */}
        {/* REPORT TAB 3: SALES BREAKDOWN REPORT                     */}
        {/* ======================================================== */}
        {activeReportTab === 'sales' && (
          <Card className="border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Warbixinta Iibka Maalinlaha ah (Daily Sales Breakdown)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Taariikhda</th>
                    <th className="px-4 py-3 text-center">Tirada Iibka</th>
                    <th className="px-4 py-3 text-right">Iibka Guud</th>
                    <th className="px-4 py-3 text-right">Caddaan (Cash In)</th>
                    <th className="px-4 py-3 text-right">Dayn Cusub</th>
                    <th className="px-4 py-3 text-right">Dayn La Soo Celiyey</th>
                    <th className="px-4 py-3 text-right">Qiimo Dhimis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {salesRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        Xog laguma helin muddadan
                      </td>
                    </tr>
                  ) : (
                    salesRows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{r.date}</td>
                        <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-300">{r.transactionCount}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">{formatMoney(r.totalSales)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(r.cashSales)}</td>
                        <td className="px-4 py-3 text-right font-mono text-amber-600 font-bold">{formatMoney(r.newDebt)}</td>
                        <td className="px-4 py-3 text-right font-mono text-blue-600 font-bold">{formatMoney(r.debtPayments)}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500">-{formatMoney(r.totalDiscounts)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ======================================================== */}
        {/* REPORT TAB 4: STOCK VALUATION                            */}
        {/* ======================================================== */}
        {activeReportTab === 'stock' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <p className="text-xs font-bold text-slate-400 uppercase">Qiimaha Soo Iibka (Cost Value)</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                  {formatMoney(stockValuation.totalCostValue)}
                </p>
                <p className="text-[11px] text-slate-500">Wadarta qiimaha lagu soo iibiyey alaabta taalla</p>
              </Card>

              <Card className="p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <p className="text-xs font-bold text-slate-400 uppercase">Qiimaha Iibinta (Retail Value)</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  {formatMoney(stockValuation.totalRetailValue)}
                </p>
                <p className="text-[11px] text-slate-500">Wadarta lacagta ka soo bixi karta haddii la wada iibiyo</p>
              </Card>

              <Card className="p-4 border border-purple-200 dark:border-purple-900 bg-purple-50/40 dark:bg-purple-950/20 shadow-xs">
                <p className="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase">Faa'iidada Ku Jirta Kaydka</p>
                <p className="text-2xl font-black text-purple-700 dark:text-purple-300 mt-1 font-mono">
                  {formatMoney(stockValuation.totalPotentialProfit)}
                </p>
                <p className="text-[11px] text-purple-700 dark:text-purple-300">Retail Value - Cost Value</p>
              </Card>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* REPORT TAB 5: DEBTS REPORT                               */}
        {/* ======================================================== */}
        {activeReportTab === 'debts' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4 border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20 shadow-xs">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase">Wadarta Daymaha Maqan</p>
                <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1 font-mono">
                  {formatMoney(metrics?.totalOutstandingDebt)}
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300">Lacagta dukaanka kaga maqan macaamiisha</p>
              </Card>

              <Card className="p-4 border border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20 shadow-xs">
                <p className="text-xs font-bold text-red-800 dark:text-red-300 uppercase">Daymaha Dhacay (Overdue)</p>
                <p className="text-2xl font-black text-red-700 dark:text-red-300 mt-1 font-mono">
                  {metrics?.overdueDebtCount || 0} Daymood
                </p>
                <p className="text-[11px] text-red-700 dark:text-red-300">Daymaha xilligii ballanta laga soo gudbay</p>
              </Card>

              <Card className="p-4 border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">Dayn La Soo Celiyey</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  {formatMoney(metrics?.todayDebtPayments)}
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Lacagaha daymaha ee la soo xereeyey</p>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 2. PRINT / PDF VERSION                                    */}
      {/* ======================================================== */}
      <div className="hidden print:block w-full">
        <ReportPrintView
          dateFilter={dateFilter}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          activeReportTab={activeReportTab}
          metrics={metrics}
          profitRows={profitRows}
          salesRows={salesRows}
          productSalesRows={productSalesRows}
          productSalesSummary={productSalesSummary}
          oilBatchRows={oilBatchRows}
          stockValuation={stockValuation}
          shopName={settings?.shopName || 'TUKAAN SHIINE SUPERMARKET'}
          shopPhone={settings?.shopPhone || '+252 61 5500112'}
          shopAddress={settings?.shopAddress || 'Suuqa Bakaaraha, Mogadishu'}
          signatureUrl={settings?.signatureUrl}
          preparedByName={currentUser?.name}
        />
      </div>

      {/* ======================================================== */}
      {/* PRODUCT TRANSACTION DETAIL DRILL-DOWN MODAL              */}
      {/* ======================================================== */}
      <Dialog open={!!selectedProductForDetail} onOpenChange={(open) => !open && setSelectedProductForDetail(null)}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-emerald-600" />
            <DialogTitle>
              {selectedProductForDetail?.productName} {selectedProductForDetail?.variantName ? `(${selectedProductForDetail.variantName})` : ''}
            </DialogTitle>
          </div>
          <DialogDescription>
            Faahfaahinta rasiidhada iyo iibka alaabtan muddada: <span className="font-bold text-slate-700 dark:text-slate-300">{dateFilter.toUpperCase()}</span>
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {selectedProductForDetail && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Tirada La Iibiyey:</span>
                <span className="font-mono font-black text-slate-900 dark:text-white">
                  {selectedProductForDetail.quantitySold} {selectedProductForDetail.sellingUnit}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Wadarta Iibka:</span>
                <span className="font-mono font-black text-slate-900 dark:text-white">
                  {formatMoney(selectedProductForDetail.totalSales)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Caddaan:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatMoney(selectedProductForDetail.totalPaid)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Dayn:</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  {formatMoney(selectedProductForDetail.totalDebt)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Faa'iido:</span>
                <span className="font-mono font-black text-purple-600 dark:text-purple-400">
                  +{formatMoney(selectedProductForDetail.totalProfit)}
                </span>
              </div>
            </div>
          )}

          <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2.5">Rasiid #ID</th>
                    <th className="px-3 py-2.5">Taariikhda</th>
                    <th className="px-3 py-2.5">Macmiilka</th>
                    <th className="px-3 py-2.5 text-center">Bixinta</th>
                    <th className="px-3 py-2.5 text-center">Habka Iibka</th>
                    <th className="px-3 py-2.5 text-right">Tirada/Litirrada</th>
                    <th className="px-3 py-2.5 text-right">Qiimaha</th>
                    <th className="px-3 py-2.5 text-right">Wadarta</th>
                    <th className="px-3 py-2.5 text-right">Paid</th>
                    <th className="px-3 py-2.5 text-right">Debt</th>
                    <th className="px-3 py-2.5 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {loadingDetails ? (
                    <tr>
                      <td colSpan={11} className="text-center py-8 text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                          <span>Rasiidhada waa la soo rarayaa...</span>
                        </div>
                      </td>
                    </tr>
                  ) : detailTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-8 text-slate-400">
                        Wax rasiidho ah lagama helin muddadan
                      </td>
                    </tr>
                  ) : (
                    detailTransactions.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2.5 font-mono font-bold text-slate-900 dark:text-white">
                          #{tx.saleId.slice(0, 8)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 font-mono whitespace-nowrap">
                          {tx.saleCreatedAt ? new Date(tx.saleCreatedAt).toLocaleString('so-SO', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                          {tx.customerName || 'Caddaan (Walk-in)'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Badge 
                            variant={tx.paymentMethod === 'credit' ? 'warning' : 'outline'}
                            className="text-[9px] uppercase font-bold"
                          >
                            {tx.paymentMethod}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {tx.selling_method === 'money' || tx.selling_option_label ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              💵 Lacag: {tx.selling_option_label || 'Money'}
                            </span>
                          ) : tx.selling_method === 'liter' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                              💧 Litir ({tx.quantity} L)
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-bold">Standard</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {tx.actual_quantity_used ? (
                            <span title="Litirrada dhabta ah ee stock-ga laga jaray">
                              {tx.actual_quantity_used} L
                            </span>
                          ) : (
                            <span>{tx.quantity} {tx.unit}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-500">
                          {formatMoney(tx.unitPrice)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatMoney(tx.totalPrice)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatMoney(tx.paidAmount)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {tx.debtAmount > 0 ? (
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              {formatMoney(tx.debtAmount)}
                            </span>
                          ) : (
                            <span className="text-slate-400">$0.00</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-black text-purple-600 dark:text-purple-400">
                          +{formatMoney(tx.profit)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {detailTotalPages > 1 && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Wadarta: <strong className="text-slate-700 dark:text-slate-300">{detailTotalCount}</strong> iib (Bogga {detailPage} ee {detailTotalPages})
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={detailPage <= 1}
                    onClick={() => changeDetailPage(detailPage - 1)}
                    className="h-7 px-2 text-xs"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <span className="text-xs font-mono font-bold px-2">
                    {detailPage} / {detailTotalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={detailPage >= detailTotalPages}
                    onClick={() => changeDetailPage(detailPage + 1)}
                    className="h-7 px-2 text-xs"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setSelectedProductForDetail(null)}
            className="text-xs font-bold"
          >
            Xidh (Close)
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ======================================================== */}
      {/* OIL BATCH TRANSACTIONS DRILLDOWN MODAL                   */}
      {/* ======================================================== */}
      <Dialog open={!!selectedBatchForDetail} onOpenChange={(open) => !open && setSelectedBatchForDetail(null)}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Droplet className="h-5 w-5 text-amber-600" />
            <DialogTitle>
              Iibka Dufcadda Saliidda: #{selectedBatchForDetail?.batchNumber}
            </DialogTitle>
          </div>
          <DialogDescription>
            Alaabta: <span className="font-bold text-slate-800 dark:text-slate-200">{selectedBatchForDetail?.productName}</span> | Qiimaha Soo Iibka: <span className="font-mono font-bold">${formatMoney(selectedBatchForDetail?.totalPurchaseCost)} (${selectedBatchForDetail?.costPerLiter.toFixed(4)}/L)</span>
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {selectedBatchForDetail && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Litirrada Soo Galay:</span>
                <span className="font-mono font-black text-slate-900 dark:text-white">
                  {selectedBatchForDetail.totalLiters} L ({selectedBatchForDetail.containersCount} Caag)
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Litirrada La Iibiyey:</span>
                <span className="font-mono font-black text-slate-900 dark:text-white">
                  {selectedBatchForDetail.litersSold} L
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Dakhliga Guud:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  ${formatMoney(selectedBatchForDetail.totalRevenue)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Faa'iido / Khasaare:</span>
                <span className="font-mono font-black text-purple-600 dark:text-purple-400">
                  +${formatMoney(selectedBatchForDetail.grossProfitLoss)}
                </span>
              </div>
            </div>
          )}

          <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2.5">Taariikhda</th>
                    <th className="px-3 py-2.5">Macmiilka</th>
                    <th className="px-3 py-2.5 text-center">Ikhtiyaarka (Option)</th>
                    <th className="px-3 py-2.5 text-right">Litirrada La Shubay</th>
                    <th className="px-3 py-2.5 text-right">Wadarta Iibka</th>
                    <th className="px-3 py-2.5 text-right">Faa'iido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {loadingBatchTxs ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-4 w-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                          <span>Iibka dufcadda waa la soo rarayaa...</span>
                        </div>
                      </td>
                    </tr>
                  ) : batchTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        Wali wax iib ah lagama diiwaangelin dufcaddan
                      </td>
                    </tr>
                  ) : (
                    batchTransactions.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2.5 text-slate-500 font-mono whitespace-nowrap">
                          {tx.created_at ? new Date(tx.created_at).toLocaleString('so-SO', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                          {tx.sale?.customer?.name || 'Caddaan (Walk-in)'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold text-[10px]">
                            {tx.selling_option_label || 'Saliid'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {tx.actual_quantity_used || tx.quantity} L
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ${formatMoney(tx.total_price)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-black text-purple-600 dark:text-purple-400">
                          +${formatMoney(tx.gross_profit)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setSelectedBatchForDetail(null)}
            className="text-xs font-bold"
          >
            Xidh (Close)
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ======================================================== */}
      {/* OIL BATCH RECONCILIATION MODAL                           */}
      {/* ======================================================== */}
      <Dialog open={!!reconcilingBatch} onOpenChange={(open) => !open && setReconcilingBatch(null)}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-blue-600" />
            <DialogTitle>
              Dib-u-heshiisiinta Dufcadda: #{reconcilingBatch?.batchNumber}
            </DialogTitle>
          </div>
          <DialogDescription>
            Geli xaddiga litirrada dhabta ah ee weelka ku haray si loo ogaado farqiga (Variance) ama lumiska dhacay.
          </DialogDescription>
        </DialogHeader>

        {reconcilingBatch && (
          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-3 gap-2">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Wadarta Bilowga:</span>
                <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                  {reconcilingBatch.totalLiters} L
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">La Iibiyey / Isticmaalay:</span>
                <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                  {reconcilingBatch.litersSold} L
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Filashada Haray (Expected):</span>
                <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                  {reconcilingBatch.expectedRemainingLiters} L
                </span>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                Litirrada Dhabta ah ee Hadda Taalla (Physical Remaining Liters) *
              </label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={reconcilePhysicalLiters}
                  onChange={(e) => setReconcilePhysicalLiters(e.target.value)}
                  placeholder="Tusaale: 4.5"
                  className="font-mono font-black text-base h-11 text-center pr-12"
                />
                <span className="absolute right-3.5 top-3 text-xs font-black text-slate-500">LITERS</span>
              </div>
            </div>

            {/* Live Variance Calculation */}
            {(() => {
              const physical = parseFloat(reconcilePhysicalLiters);
              if (!isNaN(physical)) {
                const variance = Number((physical - reconcilingBatch.expectedRemainingLiters).toFixed(4));
                const varianceCost = Number((variance * reconcilingBatch.costPerLiter).toFixed(2));
                return (
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${
                    variance < 0 
                      ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-800 dark:text-red-300' 
                      : variance > 0
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                  }`}>
                    <div>
                      <span className="font-bold block text-xs">
                        {variance < 0 ? '⚠️ Lumis / Khasaare (Shrinkage / Variance):' : variance > 0 ? 'Farqi Dheeraad ah (Positive Variance):' : 'Farqi Ma Jiro (Exact Match):'}
                      </span>
                      <span className="text-[11px] font-mono mt-0.5 block">
                        Qiimaha Farqiga: ${Math.abs(varianceCost)} ({variance < 0 ? 'Khasaare' : 'Dheeraad'})
                      </span>
                    </div>
                    <span className="font-mono font-black text-lg">
                      {variance > 0 ? '+' : ''}{variance} L
                    </span>
                  </div>
                );
              }
              return null;
            })()}

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block">
                Sababta / Faallo (Notes / Reason)
              </label>
              <Input
                value={reconcileNotes}
                onChange={(e) => setReconcileNotes(e.target.value)}
                placeholder="Tusaale: Daadasho yar ama cabbirka dhabta ah"
                className="mt-1 text-xs"
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setReconcilingBatch(null)}
            disabled={isSubmittingReconcile}
          >
            Ka noqo
          </Button>
          <Button
            onClick={handleSaveReconcile}
            disabled={isSubmittingReconcile}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
          >
            {isSubmittingReconcile ? 'Waa la keydinayaa...' : 'Keydi Dib-u-heshiisiinta'}
          </Button>
        </DialogFooter>
      </Dialog>
    </AppShell>
  );
}
