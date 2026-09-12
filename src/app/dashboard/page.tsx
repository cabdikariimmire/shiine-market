'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  DollarSign, 
  Wallet, 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  Receipt, 
  AlertTriangle, 
  Package, 
  ShoppingCart, 
  Building2, 
  Plus, 
  ArrowRight,
  Sparkles,
  RefreshCw,
  Clock,
  PhoneCall,
  Truck,
  CheckCircle2
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { StatCard } from '@/components/dashboard/stat-card';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { repository } from '@/lib/services/repository';
import { formatMoney } from '@/lib/calculations/financials';
import { getStockStatus } from '@/lib/calculations/stock';
import { DashboardMetrics, ProductVariant, SalesReportRow } from '@/types';

export default function DashboardPage() {
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'month' | 'all'>('today');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [salesRows, setSalesRows] = useState<SalesReportRow[]>([]);
  const [lowStockVariants, setLowStockVariants] = useState<ProductVariant[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [m, sr, lowRes, outRes] = await Promise.all([
        repository.getDashboardMetrics(dateFilter),
        repository.getSalesReport(),
        repository.getVariantsPaginated('', 'all', 'low_stock', 1, 6),
        repository.getVariantsPaginated('', 'all', 'out_of_stock', 1, 6),
      ]);
      setMetrics(m);
      setSalesRows(sr);
      setLowStockVariants([...outRes.data, ...lowRes.data].slice(0, 6));
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  }, [dateFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <AppShell title="Dashboard">
      <div className="space-y-6">
        {/* Top Header & Period Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              Xaaladda Guud ee Dukaanka (Shop Dashboard)
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Xogta tooska ah ee iibka, lacagaha soo xarooday, daymaha iyo faa'iidada
            </p>
          </div>

          {/* Period Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {[
              { id: 'today', label: 'Maanta' },
              { id: 'yesterday', label: 'Shalay' },
              { id: 'month', label: 'Bishan' },
              { id: 'all', label: 'Dhammaan' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setDateFilter(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  dateFilter === tab.id
                    ? 'bg-white text-emerald-700 shadow-xs dark:bg-slate-900 dark:text-emerald-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 1. KEY METRICS STAT CARDS (Master Prompt Req #24) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Today's Sales Revenue */}
          <StatCard
            title="Iibka Guud (Total Sales)"
            value={formatMoney(metrics?.todaySales)}
            subtitle={`${metrics?.todaySalesCount || 0} iib oo la sameeyey`}
            icon={DollarSign}
            color="emerald"
          />

          {/* Card 2: Cash Received (Separated from sales revenue) */}
          <StatCard
            title="Lacag La Qabtay (Cash In)"
            value={formatMoney(metrics?.todayCashReceived)}
            subtitle={`Caddaan toos ah + Daymo la helay`}
            icon={Wallet}
            color="blue"
          />

          {/* Card 3: Gross Profit */}
          <StatCard
            title="Faa'iidada Koowaad (Gross Profit)"
            value={formatMoney(metrics?.todayGrossProfit)}
            subtitle={`Iibka - Qiimaha soo galka`}
            icon={TrendingUp}
            color="purple"
          />

          {/* Card 4: Net Profit */}
          <StatCard
            title="Faa'iidada Nadiifka ah (Net Profit)"
            value={formatMoney(metrics?.todayNetProfit)}
            subtitle={`Gross Profit - Kharashaadka`}
            icon={TrendingUp}
            color="emerald"
          />
        </div>

        {/* Secondary Metric Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 5: New Debt */}
          <StatCard
            title="Dayn Cusub (New Debt)"
            value={formatMoney(metrics?.todayNewDebt)}
            subtitle="Iibka daynta lagu qaaday"
            icon={CreditCard}
            color="amber"
          />

          {/* Card 6: Debt Payments Collected */}
          <StatCard
            title="Dayn La Soo Celiyey"
            value={formatMoney(metrics?.todayDebtPayments)}
            subtitle="Cash from old debts"
            icon={CheckCircle2}
            color="blue"
          />

          {/* Card 7: Expenses */}
          <StatCard
            title="Kharashka (Expenses)"
            value={formatMoney(metrics?.todayExpenses)}
            subtitle="Koronto, Kiro, Mushahar..."
            icon={Receipt}
            color="red"
          />

          {/* Card 8: Out of Stock & Low Stock Alerts */}
          <StatCard
            title="Digniinta Kaydka (Stock Alerts)"
            value={`${metrics?.outOfStockCount || 0} Dhamaatay`}
            subtitle={`${metrics?.lowStockCount || 0} Yaraysatay | ${metrics?.overdueDebtCount || 0} Dayn dhacday`}
            icon={AlertTriangle}
            color={(metrics?.outOfStockCount || 0) > 0 ? 'red' : 'amber'}
          />
        </div>

        {/* 2. QUICK ACTIONS SHORTCUTS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link href="/sales/new">
            <Button className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 rounded-2xl shadow-sm shadow-emerald-600/20">
              <ShoppingCart className="h-5 w-5" />
              <span>Fur POS (Iib)</span>
            </Button>
          </Link>

          <Link href="/products">
            <Button variant="outline" className="w-full h-14 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-center gap-2 rounded-2xl">
              <Plus className="h-5 w-5 text-emerald-600" />
              <span>Soo Xaree Alaab</span>
            </Button>
          </Link>

          <Link href="/suppliers">
            <Button variant="outline" className="w-full h-14 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-center gap-2 rounded-2xl">
              <Building2 className="h-5 w-5 text-indigo-600" />
              <span>Alaab-qeybiye (Suppliers)</span>
            </Button>
          </Link>

          <Link href="/debts">
            <Button variant="outline" className="w-full h-14 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-center gap-2 rounded-2xl">
              <PhoneCall className="h-5 w-5 text-blue-600" />
              <span>Daymaha & Calendar</span>
            </Button>
          </Link>
        </div>

        {/* 3. CHARTS & LOW STOCK ALERTS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Visual Sales Chart */}
          <div className="lg:col-span-2">
            <DashboardCharts salesRows={salesRows} />
          </div>

          {/* Low Stock Alerts Card */}
          <Card className="p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Digniinta Kaydka (Low Stock)
                </h3>
              </div>
              <Link href="/products?status=low_stock" className="text-xs font-bold text-emerald-600 hover:underline">
                Dhammaan ({metrics?.lowStockCount || 0})
              </Link>
            </div>

            <div className="space-y-3">
              {lowStockVariants.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Dhammaan kaydku waa buuxaa!
                </div>
              ) : (
                lowStockVariants.map((v) => {
                  const status = getStockStatus(v.stock_quantity, v.minimum_stock, v.is_pending);

                  return (
                    <div
                      key={v.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-xs line-clamp-1">
                          {v.product?.name}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          Nooca: <strong className="text-emerald-700">{v.variant_name}</strong> | Min: {v.minimum_stock} {v.selling_unit}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.badgeClass}`}>
                          {v.stock_quantity} {v.selling_unit}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <Link href="/products">
              <Button variant="outline" size="sm" className="w-full text-xs font-bold gap-1 mt-2">
                <Truck className="h-3.5 w-3.5 text-emerald-600" /> Soo Xaree Alaab Cusub
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
