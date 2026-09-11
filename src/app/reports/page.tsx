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
  Calendar as CalendarIcon
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ReportPrintView } from '@/components/reports/report-print-view';
import { repository } from '@/lib/services/repository';
import { formatMoney } from '@/lib/calculations/financials';
import { calculateStockValuation } from '@/lib/calculations/stock';
import { 
  DashboardMetrics, 
  ProfitReportRow, 
  SalesReportRow, 
  ProductSalesReportRow, 
  ProductSalesReportSummary, 
  ProductSaleTransactionDetail, 
  ReportDateFilterType 
} from '@/types';

export default function ReportsPage() {
  const [dateFilter, setDateFilter] = useState<ReportDateFilterType>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [activeReportTab, setActiveReportTab] = useState<'product_sales' | 'financial' | 'sales' | 'stock' | 'debts'>('product_sales');

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

  // Drill-down Modal State
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<ProductSalesReportRow | null>(null);
  const [detailTransactions, setDetailTransactions] = useState<ProductSaleTransactionDetail[]>([]);
  const [detailPage, setDetailPage] = useState<number>(1);
  const [detailTotalPages, setDetailTotalPages] = useState<number>(1);
  const [detailTotalCount, setDetailTotalCount] = useState<number>(0);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const metricFilter = dateFilter === 'all' ? 'all' : (dateFilter === 'today' ? 'today' : (dateFilter === 'yesterday' ? 'yesterday' : 'month'));
      const [m, sRows, pRows, varData] = await Promise.all([
        repository.getDashboardMetrics(metricFilter),
        repository.getSalesReport(),
        repository.getProfitReport(),
        repository.getVariantsPaginated('', 'all', 'all', 1, 1000),
      ]);
      setMetrics(m);
      setSalesRows(sRows);
      setProfitRows(pRows);
      setStockValuation(calculateStockValuation(varData.data));
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

  useEffect(() => {
    loadData();
    loadProductSales();
  }, [loadData, loadProductSales]);

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
  };

  // Transaction drilldown loader
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
              Iibka alaabooyinka, xogta maaliyadeed, faa'iidada nadiifka ah iyo xisaabaadka daymaha
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

                {/* Search input */}
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
                            <div className="h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                            <span>Xogta waa la soo rarayaa...</span>
                          </div>
                        </td>
                      </tr>
                    ) : productSalesRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-slate-400">
                          Wax alaab ah lama iibin muddadan la doortay
                        </td>
                      </tr>
                    ) : (
                      productSalesRows.map((r, i) => (
                        <tr 
                          key={i} 
                          onClick={() => openProductDetail(r)}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <ShoppingBag className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>{r.productName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 font-medium">
                            {r.variantName || '-'}
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono text-slate-600 dark:text-slate-400">
                            <Badge variant="outline" className="text-[10px] font-bold">
                              {r.sellingUnit}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {r.quantitySold} <span className="text-[11px] text-slate-500 font-normal">{r.sellingUnit}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-black text-slate-900 dark:text-white">
                            {formatMoney(r.totalSales)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatMoney(r.totalPaid)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono">
                            {r.totalDebt > 0 ? (
                              <span className="font-bold text-amber-600 dark:text-amber-400">
                                {formatMoney(r.totalDebt)}
                              </span>
                            ) : (
                              <span className="text-slate-400">$0.00</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-black text-purple-600 dark:text-purple-400">
                            +{formatMoney(r.totalProfit)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                openProductDetail(r);
                              }}
                              className="text-[11px] font-bold gap-1 px-2.5 py-1 h-auto rounded-lg hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:hover:bg-emerald-950/50"
                            >
                              <Eye className="h-3 w-3" />
                              Fiiri ({r.transactionCount})
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {productSalesRows.length > 0 && productSalesSummary && (
                    <tfoot className="bg-slate-50/80 dark:bg-slate-800/80 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                      <tr>
                        <td colSpan={3} className="px-4 py-3 font-black text-slate-900 dark:text-white uppercase text-xs">
                          Wadarta Guud (Totals):
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-slate-900 dark:text-white">
                          {productSalesSummary.totalQuantity}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-slate-900 dark:text-white">
                          {formatMoney(productSalesSummary.totalSales)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {formatMoney(productSalesSummary.totalPaid)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                          {formatMoney(productSalesSummary.totalDebt)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-purple-600 dark:text-purple-400">
                          +{formatMoney(productSalesSummary.totalProfit)}
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-medium text-slate-500">
                          {productSalesSummary.uniqueProductsCount} Alaab
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ======================================================== */}
        {/* REPORT TAB 1: FINANCIAL & NET PROFIT                    */}
        {/* ======================================================== */}
        {activeReportTab === 'financial' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <p className="text-xs font-bold text-slate-400 uppercase">Iibka Guud (Revenue)</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                  {formatMoney(metrics?.todaySales)}
                </p>
                <p className="text-[11px] text-slate-500">Sales Revenue</p>
              </Card>

              <Card className="p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <p className="text-xs font-bold text-slate-400 uppercase">Qiimaha Soo Iibka (COGS)</p>
                <p className="text-2xl font-black text-slate-600 dark:text-slate-400 mt-1 font-mono">
                  {formatMoney(metrics?.todayCostOfGoods)}
                </p>
                <p className="text-[11px] text-slate-500">Cost of Goods Sold</p>
              </Card>

              <Card className="p-4 border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">Faa'iidada Koowaad (Gross Profit)</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  {formatMoney(metrics?.todayGrossProfit)}
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Revenue - COGS</p>
              </Card>

              <Card className="p-4 border border-purple-200 dark:border-purple-900 bg-purple-50/40 dark:bg-purple-950/20 shadow-xs">
                <p className="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase">Faa'iidada Nadiifka ah (Net Profit)</p>
                <p className="text-2xl font-black text-purple-700 dark:text-purple-300 mt-1 font-mono">
                  {formatMoney(metrics?.todayNetProfit)}
                </p>
                <p className="text-[11px] text-purple-700 dark:text-purple-300">Gross Profit - Expenses</p>
              </Card>
            </div>

            {/* Financial Ledger Table */}
            <Card className="border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Xisaabinta Maalinlaha ah ee Faa'iidada (Daily Profit Breakdown)
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Taariikhda</th>
                      <th className="px-4 py-3 text-right">Iibka Guud (Revenue)</th>
                      <th className="px-4 py-3 text-right">COGS (Soo Iibka)</th>
                      <th className="px-4 py-3 text-right">Gross Profit</th>
                      <th className="px-4 py-3 text-right">Kharashka (Expenses)</th>
                      <th className="px-4 py-3 text-right">Net Profit</th>
                      <th className="px-4 py-3 text-right">Cash Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {profitRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-400">
                          Xog ma jirto
                        </td>
                      </tr>
                    ) : (
                      profitRows.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3.5 font-mono text-slate-600 dark:text-slate-300 font-bold">
                            {r.date}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-slate-900 dark:text-white font-bold">
                            {formatMoney(r.salesRevenue)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-slate-500">
                            {formatMoney(r.cogs)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-emerald-600 font-bold">
                            +{formatMoney(r.grossProfit)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-red-600">
                            -{formatMoney(r.expenses)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-black text-purple-600 dark:text-purple-400 text-sm">
                            {formatMoney(r.netProfit)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-emerald-700 font-black">
                            {formatMoney(r.cashReceived)}
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
        {/* REPORT TAB 2: SALES                                     */}
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
                  {salesRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3.5 font-mono text-slate-900 dark:text-white font-bold">{r.date}</td>
                      <td className="px-4 py-3.5 text-center font-bold text-slate-700">{r.transactionCount}</td>
                      <td className="px-4 py-3.5 text-right font-mono font-black text-slate-900 dark:text-white">{formatMoney(r.totalSales)}</td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-600">{formatMoney(r.cashSales)}</td>
                      <td className="px-4 py-3.5 text-right font-mono text-amber-600">{formatMoney(r.newDebt)}</td>
                      <td className="px-4 py-3.5 text-right font-mono text-blue-600 font-bold">{formatMoney(r.debtPayments)}</td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-500">-{formatMoney(r.totalDiscounts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ======================================================== */}
        {/* REPORT TAB 3: STOCK VALUATION                            */}
        {/* ======================================================== */}
        {activeReportTab === 'stock' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <p className="text-xs font-bold text-slate-400 uppercase">Qiimaha Soo Iibka ee Kaydka (Cost Value)</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                  {formatMoney(stockValuation.totalCostValue)}
                </p>
                <p className="text-[11px] text-slate-500">Total cost value of active stock</p>
              </Card>

              <Card className="p-4 border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">Qiimaha Iibinta ee Kaydka (Retail Value)</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  {formatMoney(stockValuation.totalRetailValue)}
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Total retail sale potential</p>
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
        {/* REPORT TAB 4: DEBTS AGING                                */}
        {/* ======================================================== */}
        {activeReportTab === 'debts' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <p className="text-xs font-bold text-slate-400 uppercase">Wadarta Daymaha Dukaanka Ka Maqan</p>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
                {formatMoney(metrics?.totalOutstandingDebt)}
              </p>
            </Card>

            <Card className="p-4 border border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20 shadow-xs">
              <p className="text-xs font-bold text-red-800 dark:text-red-300 uppercase">Daymaha Dhacay (Overdue)</p>
              <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1 font-mono">
                {metrics?.overdueDebtCount || 0}
              </p>
              <p className="text-[11px] text-red-700 dark:text-red-300">Ballantoodii dhaaftay</p>
            </Card>

            <Card className="p-4 border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs">
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">Lacagta Daymaha Laga Helay</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                {formatMoney(metrics?.todayDebtPayments)}
              </p>
            </Card>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 2. PRINT VERSION (Dedicated A4 Print Layout)             */}
      {/* ======================================================== */}
      <div id="printable-report" className="print-only hidden print:block">
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
          stockValuation={stockValuation}
          shopName="TUKAAN SHIINE SUPERMARKET"
          shopPhone="+252 61 5500112"
          shopAddress="Suuqa Bakaaraha, Mogadishu"
        />
      </div>

      {/* ======================================================== */}
      {/* 3. PRODUCT SALES TRANSACTIONS DRILL-DOWN MODAL           */}
      {/* ======================================================== */}
      <Dialog
        open={Boolean(selectedProductForDetail)}
        onOpenChange={(open) => {
          if (!open) setSelectedProductForDetail(null);
        }}
        maxWidth="max-w-4xl"
      >
        <DialogClose onClick={() => setSelectedProductForDetail(null)} />
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
          {/* Summary highlight pills inside modal */}
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

          {/* Table of Individual Transactions */}
          <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2.5">Rasiid #ID</th>
                    <th className="px-3 py-2.5">Taariikhda</th>
                    <th className="px-3 py-2.5">Macmiilka</th>
                    <th className="px-3 py-2.5 text-center">Habka</th>
                    <th className="px-3 py-2.5 text-right">Tirada</th>
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
                      <td colSpan={10} className="text-center py-8 text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                          <span>Rasiidhada waa la soo rarayaa...</span>
                        </div>
                      </td>
                    </tr>
                  ) : detailTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-8 text-slate-400">
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
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {tx.quantity} {tx.unit}
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

            {/* Pagination footer inside dialog */}
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
    </AppShell>
  );
}
