'use client';

import React from 'react';
import { DashboardMetrics, ProfitReportRow, SalesReportRow, ProductSalesReportRow, ProductSalesReportSummary, ReportDateFilterType } from '@/types';
import { formatMoney } from '@/lib/calculations/financials';

interface ReportPrintViewProps {
  dateFilter: ReportDateFilterType;
  customStartDate?: string;
  customEndDate?: string;
  activeReportTab: 'product_sales' | 'financial' | 'sales' | 'stock' | 'suppliers' | 'debts' | 'expenses';
  metrics: DashboardMetrics | null;
  profitRows: ProfitReportRow[];
  salesRows: SalesReportRow[];
  productSalesRows?: ProductSalesReportRow[];
  productSalesSummary?: ProductSalesReportSummary | null;
  stockValuation: {
    totalCostValue: number;
    totalRetailValue: number;
    totalPotentialProfit: number;
    totalQuantity: number;
  };
  shopName?: string;
  shopPhone?: string;
  shopAddress?: string;
}

export function ReportPrintView({
  dateFilter,
  customStartDate,
  customEndDate,
  activeReportTab,
  metrics,
  profitRows,
  salesRows,
  productSalesRows,
  productSalesSummary,
  stockValuation,
  shopName = 'TUKAAN SHIINE SUPERMARKET',
  shopPhone = '+252 61 5500112',
  shopAddress = 'Suuqa Bakaaraha, Mogadishu',
}: ReportPrintViewProps) {
  const getDateFilterLabel = (df: string) => {
    switch (df) {
      case 'today':
        return 'Maanta (Today)';
      case 'yesterday':
        return 'Shalay (Yesterday)';
      case 'week':
      case 'last7':
        return 'Toddobaadkan (This Week / Last 7 Days)';
      case 'month':
        return 'Bishan (Current Month)';
      case 'custom':
        return `Muddada: ${customStartDate || ''} - ${customEndDate || ''}`;
      case 'all':
        return 'Dhammaan Xogta (All Time)';
      default:
        return df;
    }
  };

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'product_sales':
        return 'Warbixinta Iibka Alaabooyinka (Product Sales Report)';
      case 'financial':
        return "Warbixinta Faa'iidada & Xisaabaadka (Financial Profit & Loss)";
      case 'sales':
        return 'Warbixinta Iibka & Dakhliga (Sales & Revenue Breakdown)';
      case 'stock':
        return 'Warbixinta Qiimaha Kaydka (Stock Valuation Report)';
      case 'debts':
        return 'Warbixinta Xisaabta Daymaha (Debts & Aging Report)';
      case 'expenses':
        return 'Warbixinta Kharashaadka Howlgalka (Expenses Report)';
      default:
        return 'Warbixinta Dukaanka (General Shop Report)';
    }
  };

  // Totals calculations for Financial Ledger
  const profitTotals = React.useMemo(() => {
    return profitRows.reduce(
      (acc, r) => ({
        salesRevenue: acc.salesRevenue + (r.salesRevenue || 0),
        cogs: acc.cogs + (r.cogs || 0),
        grossProfit: acc.grossProfit + (r.grossProfit || 0),
        expenses: acc.expenses + (r.expenses || 0),
        netProfit: acc.netProfit + (r.netProfit || 0),
        cashReceived: acc.cashReceived + (r.cashReceived || 0),
      }),
      { salesRevenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0, cashReceived: 0 }
    );
  }, [profitRows]);

  // Totals calculations for Sales Table
  const salesTotals = React.useMemo(() => {
    return salesRows.reduce(
      (acc, r) => ({
        transactionCount: acc.transactionCount + (r.transactionCount || 0),
        totalSales: acc.totalSales + (r.totalSales || 0),
        cashSales: acc.cashSales + (r.cashSales || 0),
        newDebt: acc.newDebt + (r.newDebt || 0),
        debtPayments: acc.debtPayments + (r.debtPayments || 0),
        totalDiscounts: acc.totalDiscounts + (r.totalDiscounts || 0),
      }),
      { transactionCount: 0, totalSales: 0, cashSales: 0, newDebt: 0, debtPayments: 0, totalDiscounts: 0 }
    );
  }, [salesRows]);

  const printedAt = new Date().toLocaleDateString('so-SO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="w-full bg-white text-slate-900 font-sans p-6 text-xs space-y-6">
      {/* 1. DOCUMENT HEADER */}
      <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
            {shopName}
          </h1>
          <p className="text-xs text-slate-600 font-medium">{shopAddress}</p>
          <p className="text-xs text-slate-600 font-medium">Taleefanka: {shopPhone}</p>
        </div>

        <div className="text-right space-y-1">
          <div className="inline-block bg-slate-900 text-white font-black text-xs px-3 py-1 rounded">
            WARBIXIN RASMI AH
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            La daabacay: <span className="font-bold text-slate-900">{printedAt}</span>
          </p>
          <p className="text-[11px] text-slate-500">
            Muddada: <span className="font-bold text-slate-900">{getDateFilterLabel(dateFilter)}</span>
          </p>
        </div>
      </div>

      {/* 2. REPORT TITLE BANNER */}
      <div className="bg-slate-100 p-3 rounded-md border border-slate-300 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-slate-900 uppercase">
            {getTabTitle(activeReportTab)}
          </h2>
          <p className="text-[11px] text-slate-600">
            Nidaamka Xisaabaadka & Maamulka ee Tukaan Management System
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-slate-700">
          Qeybta: {activeReportTab.toUpperCase()}
        </span>
      </div>

      {/* 3. FINANCIAL KPI SUMMARY BOXES */}
      <div className="grid grid-cols-4 gap-3">
        <div className="border border-slate-300 rounded p-2.5 bg-slate-50">
          <p className="text-[10px] font-bold uppercase text-slate-500">Iibka Guud (Revenue)</p>
          <p className="text-base font-black text-slate-900 font-mono mt-0.5">
            {formatMoney(metrics?.todaySales)}
          </p>
          <p className="text-[9px] text-slate-500">{metrics?.todaySalesCount || 0} iib la sameeyey</p>
        </div>

        <div className="border border-slate-300 rounded p-2.5 bg-slate-50">
          <p className="text-[10px] font-bold uppercase text-slate-500">COGS (Soo Iibka)</p>
          <p className="text-base font-black text-slate-700 font-mono mt-0.5">
            {formatMoney(metrics?.todayCostOfGoods)}
          </p>
          <p className="text-[9px] text-slate-500">Cost of Goods Sold</p>
        </div>

        <div className="border border-slate-300 rounded p-2.5 bg-slate-50">
          <p className="text-[10px] font-bold uppercase text-emerald-800">Gross Profit (1aad)</p>
          <p className="text-base font-black text-emerald-700 font-mono mt-0.5">
            {formatMoney(metrics?.todayGrossProfit)}
          </p>
          <p className="text-[9px] text-slate-500">Revenue - COGS</p>
        </div>

        <div className="border border-slate-300 rounded p-2.5 bg-slate-50">
          <p className="text-[10px] font-bold uppercase text-purple-800">Net Profit (Nadiif)</p>
          <p className="text-base font-black text-purple-700 font-mono mt-0.5">
            {formatMoney(metrics?.todayNetProfit)}
          </p>
          <p className="text-[9px] text-slate-500">Gross Profit - Kharash</p>
        </div>
      </div>

      {/* 4. SECONDARY METRICS (CASH VS DEBT) */}
      <div className="grid grid-cols-4 gap-3">
        <div className="border border-slate-300 rounded p-2 bg-white">
          <p className="text-[10px] font-bold text-slate-500">Caddaan La Helay (Cash)</p>
          <p className="text-sm font-black text-emerald-800 font-mono">
            {formatMoney(metrics?.todayCashReceived)}
          </p>
        </div>

        <div className="border border-slate-300 rounded p-2 bg-white">
          <p className="text-[10px] font-bold text-slate-500">Kharashaadka (Expenses)</p>
          <p className="text-sm font-black text-red-700 font-mono">
            {formatMoney(metrics?.todayExpenses)}
          </p>
        </div>

        <div className="border border-slate-300 rounded p-2 bg-white">
          <p className="text-[10px] font-bold text-slate-500">Dayn Cusub (New Debt)</p>
          <p className="text-sm font-black text-amber-700 font-mono">
            {formatMoney(metrics?.todayNewDebt)}
          </p>
        </div>

        <div className="border border-slate-300 rounded p-2 bg-white">
          <p className="text-[10px] font-bold text-slate-500">Dayn La Soo Celiyey</p>
          <p className="text-sm font-black text-blue-700 font-mono">
            {formatMoney(metrics?.todayDebtPayments)}
          </p>
        </div>
      </div>

      {/* 5. ACTIVE DETAIL TABLE */}

      {/* TAB 0: PRODUCT SALES REPORT TABLE */}
      {activeReportTab === 'product_sales' && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
            Iibka Alaab Kasta, Tirada, Dakhliga, Caddaan & Dayn (Product Sales Breakdown)
          </h3>

          {/* Product Sales KPI Summary */}
          {productSalesSummary && (
            <div className="grid grid-cols-5 gap-2">
              <div className="border border-slate-300 rounded p-2 bg-slate-50">
                <p className="text-[9px] font-bold text-slate-500 uppercase">Tirada Guud (Qty)</p>
                <p className="text-sm font-black text-slate-900 font-mono">
                  {productSalesSummary.totalQuantity}
                </p>
                <p className="text-[8px] text-slate-500">{productSalesSummary.uniqueProductsCount} nooc oo alaab ah</p>
              </div>
              <div className="border border-slate-300 rounded p-2 bg-slate-50">
                <p className="text-[9px] font-bold text-slate-500 uppercase">Wadarta Iibka</p>
                <p className="text-sm font-black text-slate-900 font-mono">
                  {formatMoney(productSalesSummary.totalSales)}
                </p>
              </div>
              <div className="border border-slate-300 rounded p-2 bg-slate-50">
                <p className="text-[9px] font-bold text-emerald-800 uppercase">Caddaan La Helay</p>
                <p className="text-sm font-black text-emerald-700 font-mono">
                  {formatMoney(productSalesSummary.totalPaid)}
                </p>
              </div>
              <div className="border border-slate-300 rounded p-2 bg-slate-50">
                <p className="text-[9px] font-bold text-amber-800 uppercase">Dayn Ka Dhalatay</p>
                <p className="text-sm font-black text-amber-700 font-mono">
                  {formatMoney(productSalesSummary.totalDebt)}
                </p>
              </div>
              <div className="border border-slate-300 rounded p-2 bg-slate-50">
                <p className="text-[9px] font-bold text-purple-800 uppercase">Faa'iidada (Profit)</p>
                <p className="text-sm font-black text-purple-700 font-mono">
                  +{formatMoney(productSalesSummary.totalProfit)}
                </p>
              </div>
            </div>
          )}

          <table className="w-full text-left text-xs border border-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <th className="p-2 border-r border-slate-300">Alaabta (Product)</th>
                <th className="p-2 border-r border-slate-300">Variant</th>
                <th className="p-2 text-center border-r border-slate-300">Halbeeg (Unit)</th>
                <th className="p-2 text-right border-r border-slate-300">Tirada (Qty)</th>
                <th className="p-2 text-right border-r border-slate-300">Iibka Guud</th>
                <th className="p-2 text-right border-r border-slate-300">La Bixiyey (Paid)</th>
                <th className="p-2 text-right border-r border-slate-300">Dayn (Debt)</th>
                <th className="p-2 text-right">Faa'iido (Profit)</th>
              </tr>
            </thead>
            <tbody>
              {(!productSalesRows || productSalesRows.length === 0) ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-slate-400">
                    Xog laguma helin muddadan
                  </td>
                </tr>
              ) : (
                productSalesRows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-200">
                    <td className="p-2 font-bold border-r border-slate-200">{r.productName}</td>
                    <td className="p-2 text-slate-600 border-r border-slate-200">{r.variantName || '-'}</td>
                    <td className="p-2 text-center font-mono border-r border-slate-200">{r.sellingUnit}</td>
                    <td className="p-2 text-right font-mono font-bold border-r border-slate-200">{r.quantitySold} {r.sellingUnit}</td>
                    <td className="p-2 text-right font-mono font-bold border-r border-slate-200">{formatMoney(r.totalSales)}</td>
                    <td className="p-2 text-right font-mono font-bold text-emerald-800 border-r border-slate-200">{formatMoney(r.totalPaid)}</td>
                    <td className="p-2 text-right font-mono text-amber-700 border-r border-slate-200">{formatMoney(r.totalDebt)}</td>
                    <td className="p-2 text-right font-mono font-black text-purple-800">+{formatMoney(r.totalProfit)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-200 font-bold border-t-2 border-slate-400">
                <td colSpan={3} className="p-2 font-black border-r border-slate-300">WADARTA GUUD (TOTALS):</td>
                <td className="p-2 text-right font-mono font-black border-r border-slate-300">{productSalesSummary?.totalQuantity || 0}</td>
                <td className="p-2 text-right font-mono font-black border-r border-slate-300">{formatMoney(productSalesSummary?.totalSales || 0)}</td>
                <td className="p-2 text-right font-mono font-black text-emerald-800 border-r border-slate-300">{formatMoney(productSalesSummary?.totalPaid || 0)}</td>
                <td className="p-2 text-right font-mono font-bold text-amber-700 border-r border-slate-300">{formatMoney(productSalesSummary?.totalDebt || 0)}</td>
                <td className="p-2 text-right font-mono font-black text-purple-800">+{formatMoney(productSalesSummary?.totalProfit || 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* TAB 1: FINANCIAL PROFIT BREAKDOWN TABLE */}
      {activeReportTab === 'financial' && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
            Xisaabinta Maalinlaha ah ee Faa'iidada (Daily Profit Ledger)
          </h3>

          <table className="w-full text-left text-xs border border-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <th className="p-2 border-r border-slate-300">Taariikhda</th>
                <th className="p-2 text-right border-r border-slate-300">Revenue (Iibka)</th>
                <th className="p-2 text-right border-r border-slate-300">COGS (Soo Iibka)</th>
                <th className="p-2 text-right border-r border-slate-300">Gross Profit</th>
                <th className="p-2 text-right border-r border-slate-300">Kharashka</th>
                <th className="p-2 text-right border-r border-slate-300">Net Profit</th>
                <th className="p-2 text-right">Cash Received</th>
              </tr>
            </thead>
            <tbody>
              {profitRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-400">
                    Xog laguma helin muddadan
                  </td>
                </tr>
              ) : (
                profitRows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-200">
                    <td className="p-2 font-mono font-bold border-r border-slate-200">{r.date}</td>
                    <td className="p-2 text-right font-mono font-bold border-r border-slate-200">{formatMoney(r.salesRevenue)}</td>
                    <td className="p-2 text-right font-mono text-slate-600 border-r border-slate-200">{formatMoney(r.cogs)}</td>
                    <td className="p-2 text-right font-mono font-bold text-emerald-800 border-r border-slate-200">+{formatMoney(r.grossProfit)}</td>
                    <td className="p-2 text-right font-mono text-red-700 border-r border-slate-200">-{formatMoney(r.expenses)}</td>
                    <td className="p-2 text-right font-mono font-black text-purple-800 border-r border-slate-200">{formatMoney(r.netProfit)}</td>
                    <td className="p-2 text-right font-mono font-bold text-slate-900">{formatMoney(r.cashReceived)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-200 font-bold border-t-2 border-slate-400">
                <td className="p-2 font-black border-r border-slate-300">WADARTA (TOTALS):</td>
                <td className="p-2 text-right font-mono font-black border-r border-slate-300">{formatMoney(profitTotals.salesRevenue)}</td>
                <td className="p-2 text-right font-mono font-bold border-r border-slate-300">{formatMoney(profitTotals.cogs)}</td>
                <td className="p-2 text-right font-mono font-black text-emerald-800 border-r border-slate-300">+{formatMoney(profitTotals.grossProfit)}</td>
                <td className="p-2 text-right font-mono font-bold text-red-700 border-r border-slate-300">-{formatMoney(profitTotals.expenses)}</td>
                <td className="p-2 text-right font-mono font-black text-purple-800 border-r border-slate-300">{formatMoney(profitTotals.netProfit)}</td>
                <td className="p-2 text-right font-mono font-black">{formatMoney(profitTotals.cashReceived)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* TAB 2: SALES BREAKDOWN TABLE */}
      {activeReportTab === 'sales' && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
            Warbixinta Iibka Maalinlaha ah (Daily Sales Breakdown)
          </h3>

          <table className="w-full text-left text-xs border border-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <th className="p-2 border-r border-slate-300">Taariikhda</th>
                <th className="p-2 text-center border-r border-slate-300">Tirada Iibka</th>
                <th className="p-2 text-right border-r border-slate-300">Iibka Guud</th>
                <th className="p-2 text-right border-r border-slate-300">Caddaan (Cash In)</th>
                <th className="p-2 text-right border-r border-slate-300">Dayn Cusub</th>
                <th className="p-2 text-right border-r border-slate-300">Dayn La Soo Celiyey</th>
                <th className="p-2 text-right">Qiimo Dhimis</th>
              </tr>
            </thead>
            <tbody>
              {salesRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-400">
                    Xog laguma helin muddadan
                  </td>
                </tr>
              ) : (
                salesRows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-200">
                    <td className="p-2 font-mono font-bold border-r border-slate-200">{r.date}</td>
                    <td className="p-2 text-center font-bold border-r border-slate-200">{r.transactionCount}</td>
                    <td className="p-2 text-right font-mono font-black border-r border-slate-200">{formatMoney(r.totalSales)}</td>
                    <td className="p-2 text-right font-mono font-bold text-emerald-800 border-r border-slate-200">{formatMoney(r.cashSales)}</td>
                    <td className="p-2 text-right font-mono text-amber-700 border-r border-slate-200">{formatMoney(r.newDebt)}</td>
                    <td className="p-2 text-right font-mono font-bold text-blue-800 border-r border-slate-200">{formatMoney(r.debtPayments)}</td>
                    <td className="p-2 text-right font-mono text-slate-600">-{formatMoney(r.totalDiscounts)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-200 font-bold border-t-2 border-slate-400">
                <td className="p-2 font-black border-r border-slate-300">WADARTA (TOTALS):</td>
                <td className="p-2 text-center font-black border-r border-slate-300">{salesTotals.transactionCount}</td>
                <td className="p-2 text-right font-mono font-black border-r border-slate-300">{formatMoney(salesTotals.totalSales)}</td>
                <td className="p-2 text-right font-mono font-black text-emerald-800 border-r border-slate-300">{formatMoney(salesTotals.cashSales)}</td>
                <td className="p-2 text-right font-mono font-bold text-amber-700 border-r border-slate-300">{formatMoney(salesTotals.newDebt)}</td>
                <td className="p-2 text-right font-mono font-black text-blue-800 border-r border-slate-300">{formatMoney(salesTotals.debtPayments)}</td>
                <td className="p-2 text-right font-mono font-bold">-{formatMoney(salesTotals.totalDiscounts)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* TAB 3: STOCK VALUATION SUMMARY */}
      {activeReportTab === 'stock' && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
            Xisaabinta Qiimaha Guud ee Kaydka (Stock Valuation Breakdown)
          </h3>

          <div className="grid grid-cols-3 gap-3">
            <div className="border border-slate-300 rounded p-3 bg-slate-50">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Qiimaha Soo Iibka (Cost Value)</p>
              <p className="text-lg font-black text-slate-900 font-mono mt-1">
                {formatMoney(stockValuation.totalCostValue)}
              </p>
              <p className="text-[9px] text-slate-500">Wadarta qiimaha lagu soo iibiyey alaabta taalla</p>
            </div>

            <div className="border border-slate-300 rounded p-3 bg-slate-50">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Qiimaha Iibinta (Retail Value)</p>
              <p className="text-lg font-black text-emerald-700 font-mono mt-1">
                {formatMoney(stockValuation.totalRetailValue)}
              </p>
              <p className="text-[9px] text-slate-500">Wadarta lacagta ka soo bixi karta haddii la wada iibiyo</p>
            </div>

            <div className="border border-slate-300 rounded p-3 bg-slate-50">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Faa'iidada Ku Jirta Kaydka</p>
              <p className="text-lg font-black text-purple-700 font-mono mt-1">
                {formatMoney(stockValuation.totalPotentialProfit)}
              </p>
              <p className="text-[9px] text-slate-500">Retail Value - Cost Value</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DEBTS AGING SUMMARY */}
      {activeReportTab === 'debts' && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
            Xaaladda Guud ee Daymaha (Debts Summary)
          </h3>

          <div className="grid grid-cols-3 gap-3">
            <div className="border border-slate-300 rounded p-3 bg-slate-50">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Wadarta Daymaha Maqan</p>
              <p className="text-lg font-black text-amber-700 font-mono mt-1">
                {formatMoney(metrics?.totalOutstandingDebt)}
              </p>
              <p className="text-[9px] text-slate-500">Lacagta dukaanka kaga maqan macaamiisha</p>
            </div>

            <div className="border border-slate-300 rounded p-3 bg-slate-50">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Daymaha Dhacay (Overdue)</p>
              <p className="text-lg font-black text-red-700 font-mono mt-1">
                {metrics?.overdueDebtCount || 0} Daymood
              </p>
              <p className="text-[9px] text-slate-500">Daymaha xilligii ballanta laga soo gudbay</p>
            </div>

            <div className="border border-slate-300 rounded p-3 bg-slate-50">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Dayn La Soo Celiyey</p>
              <p className="text-lg font-black text-emerald-700 font-mono mt-1">
                {formatMoney(metrics?.todayDebtPayments)}
              </p>
              <p className="text-[9px] text-slate-500">Lacagaha daymaha ee la soo xereeyey</p>
            </div>
          </div>
        </div>
      )}

      {/* 6. SIGNATURE & VERIFICATION FOOTER */}
      <div className="pt-8 border-t border-slate-300 mt-8 grid grid-cols-2 gap-8 text-[11px]">
        <div>
          <p className="font-bold text-slate-700">Diyaariyey (Prepared by):</p>
          <div className="mt-8 border-b border-slate-400 w-48"></div>
          <p className="text-[10px] text-slate-500 mt-1">Maamulaha / Cashier</p>
        </div>

        <div className="text-right flex flex-col items-end">
          <p className="font-bold text-slate-700">Oggolaaday (Approved by):</p>
          <div className="mt-8 border-b border-slate-400 w-48"></div>
          <p className="text-[10px] text-slate-500 mt-1">Mulkiilaha Dukaanka (Owner)</p>
        </div>
      </div>
    </div>
  );
}
