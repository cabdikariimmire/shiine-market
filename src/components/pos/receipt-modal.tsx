'use client';

import React from 'react';
import { Printer, CheckCircle2, Store, Phone, Calendar, User, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Sale } from '@/types';
import { formatMoney } from '@/lib/calculations/financials';
import { formatDate } from '@/lib/utils';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
}

export function ReceiptModal({ isOpen, onClose, sale }: ReceiptModalProps) {
  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-emerald-600 font-black">
          <CheckCircle2 className="h-6 w-6" />
          Iibka Waa La Dhameystiray!
        </DialogTitle>
      </DialogHeader>

      <div className="py-2 overflow-y-auto max-h-[60vh]">
        {/* Printable Thermal Receipt Card */}
        <div id="printable-receipt" className="bg-white text-slate-900 p-6 rounded-xl border border-slate-200 shadow-inner font-mono text-xs space-y-4 max-w-sm mx-auto">
          {/* Shop Header */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
            <h3 className="text-base font-black tracking-wider uppercase font-sans">TUKAAN SHIINE POS</h3>
            <p className="text-[11px] text-slate-600 font-sans">Suuqa Bakaaraha, Mogadishu</p>
            <p className="text-[11px] text-slate-600 font-sans">Tel: +252 61 5500112</p>
          </div>

          {/* Receipt Info */}
          <div className="text-[11px] space-y-1 text-slate-600 border-b border-dashed border-slate-300 pb-3">
            <div className="flex justify-between">
              <span>Rasiidh #:</span>
              <span className="font-bold text-slate-900 font-mono">#{sale.id.slice(-6).toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span>Taariikhda:</span>
              <span>{formatDate(sale.created_at)}</span>
            </div>
            {sale.customer && (
              <div className="flex justify-between">
                <span>Macmiilka:</span>
                <span className="font-bold text-slate-900">{sale.customer.name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Habka Bixinta:</span>
              <span className="font-bold uppercase text-slate-900">
                {sale.payment_method === 'cash' ? 'Caddaan (Cash)' : sale.payment_method === 'credit' ? 'Dayn Buuxda (Credit)' : 'Qeyb Caddaan / Dayn'}
              </span>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2 border-b border-dashed border-slate-300 pb-3">
            <div className="flex justify-between font-bold text-slate-900 text-[11px]">
              <span>Alaabta (Qty x Price)</span>
              <span>Wadarta</span>
            </div>
            {sale.items?.map((item, idx) => (
              <div key={idx} className="flex justify-between text-[11px] text-slate-700">
                <div>
                  <p className="font-semibold text-slate-900">
                    {item.product_variant?.product?.name || 'Alaab'} 
                    <span className="text-emerald-700 ml-1">({item.product_variant?.variant_name || item.unit})</span>
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {item.quantity} {item.unit} x {formatMoney(item.unit_price)}
                    {item.discount > 0 && ` (-${formatMoney(item.discount)})`}
                  </p>
                </div>
                <span className="font-bold font-mono">{formatMoney(item.total_price)}</span>
              </div>
            ))}
          </div>

          {/* Totals & Payments */}
          <div className="space-y-1.5 text-xs text-slate-700">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-mono">{formatMoney(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Qiimo Dhimis:</span>
                <span className="font-mono">-{formatMoney(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
              <span>WADARTA GUUD:</span>
              <span className="font-mono">{formatMoney(sale.total_amount)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-600">
              <span>Lacagta La Bixiyey:</span>
              <span className="font-mono font-bold text-slate-900">{formatMoney(sale.amount_paid)}</span>
            </div>
            {sale.debt_amount > 0 && (
              <div className="flex justify-between text-[11px] font-bold text-red-600 bg-red-50 p-1 rounded">
                <span>Haraaga Daynta:</span>
                <span className="font-mono">{formatMoney(sale.debt_amount)}</span>
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="text-center text-[10px] text-slate-500 pt-3 border-t border-dashed border-slate-300 space-y-0.5">
            <p className="font-bold text-slate-700 font-sans">Mahadsanid! Soo Dhawoow Mar Kale.</p>
            <p className="font-sans">Alaabta la iibiyey dib looma celin karo 48 saac kadib.</p>
          </div>
        </div>
      </div>

      <DialogFooter className="flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1 font-bold">
          Iib Cusub Samee
        </Button>
        <Button onClick={handlePrint} className="flex-1 font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Printer className="h-4 w-4" /> Daabac Rasiidhka
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
