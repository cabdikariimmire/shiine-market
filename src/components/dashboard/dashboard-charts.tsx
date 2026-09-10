'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Product, SalesReportRow } from '@/types';
import { formatMoney } from '@/lib/calculations/financials';
import { TrendingUp, ShoppingBag, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

interface DashboardChartsProps {
  salesRows: SalesReportRow[];
  topProducts?: Array<{ product: { id: string; name: string }; totalQuantitySold: number; totalRevenue: number }>;
}

export function DashboardCharts({ salesRows, topProducts = [] }: DashboardChartsProps) {
  const maxSales = Math.max(...salesRows.map(r => r.totalSales || 0), 100);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 1. Sales & Cash Received Trend Bar Chart */}
      <Card className="lg:col-span-2 shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              Iibka & Lacagta Soo Xarootay (Sales & Cash Overview)
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Xisaabta dakhliga guud iyo caddaanka la qabtay</p>
          </div>
          <Link href="/reports" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
            Warbixin Buuxda <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>

        <CardContent>
          {salesRows.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-slate-400 text-sm">
              Iib lama helin muddadan
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {salesRows.slice(0, 6).map((row) => {
                const salesPct = Math.min(100, Math.round(((row.totalSales || 0) / maxSales) * 100));
                const cashPct = Math.min(100, Math.round(((row.cashSales || 0) / maxSales) * 100));

                return (
                  <div key={row.date} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-700 dark:text-slate-300">{row.date} ({row.transactionCount || 0} Iib)</span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-900 dark:text-white font-bold">{formatMoney(row.totalSales)}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 text-[11px]">({formatMoney(row.cashSales)} Caddaan)</span>
                      </div>
                    </div>

                    <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      {/* Total Sales Bar */}
                      <div
                        className="h-full rounded-full bg-slate-400 dark:bg-slate-600 transition-all duration-500"
                        style={{ width: `${salesPct}%` }}
                      />
                      {/* Cash Received Fill */}
                      <div
                        className="absolute top-0 left-0 h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${cashPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-end gap-5 pt-3 text-xs text-slate-500 font-medium border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-400 dark:bg-slate-600" />
                  <span>Iibka Guud (Total Sales)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span>Caddaanka (Cash Received)</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Top-Selling Summary */}
      <Card className="shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-indigo-600" />
              Alaabta Ugu Iibka Badan
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Alaabooyinka ugu dhaqdhaqaaqa badan</p>
          </div>
        </CardHeader>

        <CardContent>
          {topProducts.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-slate-400 text-sm">
              Iib lama helin weli
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {topProducts.map((item, index) => (
                <div key={item.product.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 font-black text-xs dark:bg-indigo-950/60 dark:text-indigo-400">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                        {item.product.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {item.totalQuantitySold} la iibiyey
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {formatMoney(item.totalRevenue)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
