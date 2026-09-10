'use client';

import React, { useState, useEffect } from 'react';
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
  FileSpreadsheet
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ReportPrintView } from '@/components/reports/report-print-view';
import { repository } from '@/lib/services/repository';
import { formatMoney } from '@/lib/calculations/financials';
import { calculateStockValuation } from '@/lib/calculations/stock';
import { DashboardMetrics, ProfitReportRow, SalesReportRow } from '@/types';

export default function ReportsPage() {
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'month' | 'all'>('month');
  const [activeReportTab, setActiveReportTab] = useState<'financial' | 'sales' | 'stock' | 'suppliers' | 'debts' | 'expenses'>('financial');

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [salesRows, setSalesRows] = useState<SalesReportRow[]>([]);
  const [profitRows, setProfitRows] = useState<ProfitReportRow[]>([]);
  const [stockValuation, setStockValuation] = useState<{
    totalCostValue: number;
    totalRetailValue: number;
    totalPotentialProfit: number;
    totalQuantity: number;
  }>({ totalCostValue: 0, totalRetailValue: 0, totalPotentialProfit: 0, totalQuantity: 0 });

  const loadData = async () => {
    try {
      const [m, sRows, pRows, varData] = await Promise.all([
        repository.getDashboardMetrics(dateFilter),
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
  };

  useEffect(() => {
    loadData();
  }, [dateFilter]);

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

  // Safe Print Trigger
  const handlePrint = () => {
    // Small timeout allows browser and React state to ensure the print DOM is ready
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
              Xogta maaliyadeed, faa'iidada nadiifka ah, xaaladda kaydka iyo xisaabaadka
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => exportToCSV(`tukaan_report_${activeReportTab}`, activeReportTab === 'sales' ? salesRows : profitRows)}
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
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Calendar className="h-4 w-4 text-emerald-600" />
            Muddada Xogta (Date Filter):
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'today', label: 'Maanta' },
              { id: 'yesterday', label: 'Shalay' },
              { id: 'month', label: 'Bishan' },
              { id: 'all', label: 'Dhammaan' },
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

        {/* Report Sub-Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 dark:border-slate-800 pb-2 scrollbar-none">
          {[
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
          activeReportTab={activeReportTab}
          metrics={metrics}
          profitRows={profitRows}
          salesRows={salesRows}
          stockValuation={stockValuation}
          shopName="TUKAAN SHIINE SUPERMARKET"
          shopPhone="+252 61 5500112"
          shopAddress="Suuqa Bakaaraha, Mogadishu"
        />
      </div>
    </AppShell>
  );
}
