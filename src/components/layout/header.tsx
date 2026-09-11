'use client';

import React from 'react';
import Link from 'next/link';
import { Menu, Plus, ShoppingCart, Camera, LogOut, ShieldCheck, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-context';

interface HeaderProps {
  onMenuToggle: () => void;
  title?: string;
  lowStockCount?: number;
}

export function Header({ onMenuToggle, title = "Tukaan Dashboard", lowStockCount = 0 }: HeaderProps) {
  const { user, role, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-20 w-full items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 sm:px-8 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80 print:hidden">
      {/* Left items: Menu button & Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {title}
          </h1>
          <p className="text-xs text-slate-500 font-medium hidden sm:block">
            Nidaamka Maamulka Dukaanka & Iibinta (Somali POS)
          </p>
        </div>
      </div>

      {/* Right Quick Action Buttons */}
      <div className="flex items-center gap-2 sm:gap-3">
        {role === 'admin' ? (
          <>
            {/* Quick AI Camera Button */}
            <Link href="/ai-camera">
              <Button 
                variant="outline" 
                size="sm" 
                className="hidden sm:flex items-center gap-1.5 border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300 font-semibold"
              >
                <Camera className="h-4 w-4" />
                <span>AI Camera</span>
              </Button>
            </Link>

            {/* Quick Product Add */}
            <Link href="/products">
              <Button variant="outline" size="sm" className="hidden md:flex items-center gap-1.5 font-medium">
                <Plus className="h-4 w-4" />
                <span>Alaabta</span>
              </Button>
            </Link>

            {/* Big POS Action Button */}
            <Link href="/sales/new">
              <Button size="sm" className="flex items-center gap-2 font-bold px-4 shadow-md shadow-emerald-600/25">
                <ShoppingCart className="h-4 w-4" />
                <span>Iibka POS</span>
              </Button>
            </Link>
          </>
        ) : role === 'seller' ? (
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-full text-xs font-bold">
              <ShoppingCart className="h-3.5 w-3.5" /> Seller / Iibiye (POS)
            </span>
            <Link href="/sales/new">
              <Button size="sm" className="flex items-center gap-2 font-bold px-4 shadow-md shadow-emerald-600/25">
                <ShoppingCart className="h-4 w-4" />
                <span>Iibka POS</span>
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-bold">
              <UserCheck className="h-3.5 w-3.5" /> Read-Only Reporter
            </span>
          </div>
        )}

        {/* User Avatar & Logout */}
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{user.name}</p>
              <span className="text-[10px] text-slate-400 capitalize">{user.role}</span>
            </div>
            <button
              onClick={logout}
              title="Ka bax (Logout)"
              className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
