'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Package, 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Barcode, 
  History, 
  Truck, 
  ShoppingCart, 
  Plus, 
  CheckCircle2, 
  AlertTriangle,
  Layers
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { repository } from '@/lib/services/repository';
import { formatMoney } from '@/lib/calculations/financials';
import { calculateCostPerBaseUnit, calculateUnitProfit, getStockStatus } from '@/lib/calculations/stock';
import { Product, ProductVariant, StockMovement } from '@/types';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { success, error } = useToast();
  const productId = params?.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const loadProduct = useCallback(async () => {
    try {
      const p = await repository.getProductById(productId);
      if (p) {
        setProduct(p);
        if (p.variants && p.variants.length > 0) {
          setSelectedVariant(p.variants[0]);
          const movs = await repository.getStockMovementsForVariant(p.variants[0].id);
          setMovements(movs);
        }
      }
    } catch (err) {
      console.error('Error loading product detail:', err);
    }
  }, [productId]);

  useEffect(() => {
    if (productId) {
      loadProduct();
    }
  }, [productId, loadProduct]);

  const handleSelectVariant = async (v: ProductVariant) => {
    setSelectedVariant(v);
    const movs = await repository.getStockMovementsForVariant(v.id);
    setMovements(movs);
  };

  if (!product) {
    return (
      <AppShell title="Alaabta">
        <div className="text-center py-20">
          <p className="text-slate-500">Alaabta lama helin...</p>
          <Link href="/products">
            <Button className="mt-4">Ku laabo Liiska Alaabta</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={product.name}>
      <div className="space-y-6">
        {/* Top Navigation */}
        <div className="flex items-center justify-between">
          <Link href="/products">
            <Button variant="ghost" size="sm" className="gap-2 text-slate-600 hover:text-slate-900 font-bold">
              <ArrowLeft className="h-4 w-4" />
              Ku laabo Alaabta (Products)
            </Button>
          </Link>

          <div className="flex items-center gap-2">
            <Button 
              onClick={() => router.push(`/sales/new?search=${product.name}`)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
            >
              <ShoppingCart className="h-4 w-4" />
              Iibi Alaabtan (POS)
            </Button>
          </div>
        </div>

        {/* Product Master Header Card */}
        <Card className="p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                <Package className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                  {product.name}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-semibold px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-700 dark:text-slate-300">
                    {product.category?.name || 'Qayb la’aan'}
                  </span>
                  <span className="text-xs text-slate-500">
                    {product.variants?.length || 0} Nooc (Variants)
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-400">Diiwaangelin</p>
              <p className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300">
                {product.created_at.split('T')[0]}
              </p>
            </div>
          </div>

          {product.description && (
            <p className="mt-4 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
              {product.description}
            </p>
          )}
        </Card>

        {/* Product Variants List & Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Variants Selector */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Noocyada Alaabtan ({product.variants?.length || 0})
            </h3>

            <div className="space-y-2">
              {product.variants?.map((v) => {
                const isSelected = selectedVariant?.id === v.id;
                const status = getStockStatus(v.stock_quantity, v.minimum_stock, v.is_pending);

                return (
                  <button
                    key={v.id}
                    onClick={() => handleSelectVariant(v)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs'
                        : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-900 dark:text-white text-sm">
                        {v.variant_name}
                      </p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.badgeClass}`}>
                        {status.icon} {status.labelSomali}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-slate-400">Buy: </span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{formatMoney(v.buy_price)}/{v.purchase_unit}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Sell: </span>
                        <span className="font-bold text-emerald-600">{formatMoney(v.sell_price)}/{v.selling_unit}</span>
                      </div>
                    </div>

                    <div className="mt-2 text-xs flex justify-between items-center text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>Kaydka: <strong className="text-slate-900 dark:text-white font-mono">{v.stock_quantity} {v.selling_unit}</strong></span>
                      {v.conversion_factor > 1 && (
                        <span className="text-[10px]">1 {v.purchase_unit} = {v.conversion_factor} {v.selling_unit}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Selected Variant Details & Stock Movement Audit */}
          <div className="lg:col-span-2 space-y-6">
            {selectedVariant ? (
              <>
                {/* Variant Highlights */}
                <Card className="p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-600" />
                    Faahfaahinta: {selectedVariant.variant_name}
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase font-sans">Soo Iibka</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                        {formatMoney(selectedVariant.buy_price)}
                      </p>
                      <p className="text-[10px] text-slate-500 font-sans">1 {selectedVariant.purchase_unit}</p>
                    </div>

                    <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/40 rounded-xl">
                      <p className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase font-sans">Iibinta</p>
                      <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {formatMoney(selectedVariant.sell_price)}
                      </p>
                      <p className="text-[10px] text-slate-500 font-sans">1 {selectedVariant.selling_unit}</p>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase font-sans">Cost/Base Unit</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                        {formatMoney(calculateCostPerBaseUnit(selectedVariant.buy_price, selectedVariant.conversion_factor))}
                      </p>
                      <p className="text-[10px] text-slate-500 font-sans">1 {selectedVariant.selling_unit}</p>
                    </div>

                    <div className="p-3 bg-purple-50/60 dark:bg-purple-950/40 rounded-xl">
                      <p className="text-[10px] text-purple-800 dark:text-purple-300 uppercase font-sans">Kaydka Hadda</p>
                      <p className="text-base font-black text-purple-700 dark:text-purple-300 mt-0.5">
                        {selectedVariant.stock_quantity.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-500 font-sans">{selectedVariant.selling_unit}</p>
                    </div>
                  </div>
                </Card>

                {/* Stock Movement Audit Log */}
                <Card className="border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <History className="h-4 w-4 text-purple-600" />
                      Dhaqdhaqaaqa Kaydka (Stock Movement Audit Trail)
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Action</th>
                          <th className="px-4 py-3 text-right">Qty</th>
                          <th className="px-4 py-3 text-right">Balance</th>
                          <th className="px-4 py-3">Faahfaahin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {movements.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-slate-400">
                              Weli ma jiro dhaqdhaqaaq kayd ah
                            </td>
                          </tr>
                        ) : (
                          movements.map((m) => {
                            const isPositive = m.quantity > 0;
                            return (
                              <tr key={m.id} className="hover:bg-slate-50/60">
                                <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">
                                  {m.created_at.split('T')[0]}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    m.type === 'purchase'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : m.type === 'sale'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-purple-100 text-purple-800'
                                  }`}>
                                    {m.type === 'purchase' ? 'Supplier / Soo galay' : m.type === 'sale' ? 'Sale (Iib)' : 'Adjustment'}
                                  </span>
                                </td>
                                <td className={`px-4 py-3 text-right font-mono font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {isPositive ? `+${m.quantity}` : m.quantity} {m.unit}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-black text-slate-900 dark:text-white">
                                  {m.new_quantity} {m.unit}
                                </td>
                                <td className="px-4 py-3 text-slate-500 text-[11px]">
                                  {m.notes || '—'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            ) : (
              <Card className="p-12 text-center text-slate-400">
                Dooro nooc (variant) si aad u aragto taariikhda kaydka
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
