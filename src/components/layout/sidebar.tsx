'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  CreditCard,
  Users,
  Building2,
  Receipt,
  FileBarChart,
  Camera,
  Settings,
  Store,
  ChevronRight,
  Sparkles,
  LogOut,
  Shield,
  UserCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/auth-context';

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

interface NavMenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
  badge?: string;
  adminOnly?: boolean;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, role, logout } = useAuth();

  // Exactly the 10 menus mandated by the Master Prompt
  const allMenuItems: NavMenuItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Iibka / POS', href: '/sales/new', icon: ShoppingCart, highlight: true, adminOnly: true },
    { name: 'Products', href: '/products', icon: Package, adminOnly: true },
    { name: 'Debts', href: '/debts', icon: CreditCard, adminOnly: true },
    { name: 'Customers', href: '/customers', icon: Users, adminOnly: true },
    { name: 'Suppliers', href: '/suppliers', icon: Building2, adminOnly: true },
    { name: 'Expenses', href: '/expenses', icon: Receipt, adminOnly: true },
    { name: 'Reports', href: '/reports', icon: FileBarChart },
    { name: 'AI Camera', href: '/ai-camera', icon: Camera, badge: 'Live AI', adminOnly: true },
    { name: 'Settings', href: '/settings', icon: Settings, adminOnly: true },
  ];

  // Filter based on user role
  const menuItems = allMenuItems.filter(item => {
    if (role === 'reporter') {
      return !item.adminOnly;
    }
    return true;
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white shadow-xl lg:shadow-none transition-transform duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-950 print:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-20 items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800 bg-linear-to-r from-emerald-600/5 to-transparent">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-emerald-700 text-white shadow-md shadow-emerald-500/25">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                TUKAAN <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/70 rounded-md">POS</span>
              </span>
              <p className="text-xs text-slate-500 font-medium">Shiine Supermarket</p>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5">
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {role === 'reporter' ? 'WARBIXINNADA (READ-ONLY)' : 'MAAMULKA GUUD'}
            </p>
            {role && (
              <span className={cn(
                "text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                role === 'admin' 
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
              )}>
                {role === 'admin' ? 'Admin' : 'Reporter'}
              </span>
            )}
          </div>

          {menuItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href) && item.href !== '/reports');
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (onClose && window.innerWidth < 1024) onClose();
                }}
                className={cn(
                  "group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-emerald-600 text-white font-semibold shadow-sm shadow-emerald-600/20"
                    : item.highlight
                    ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn(
                    "h-5 w-5 transition-transform group-hover:scale-110",
                    isActive ? "text-white" : item.highlight ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
                  )} />
                  <span>{item.name}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.badge && (
                    <span className="flex items-center gap-1 rounded-full bg-linear-to-r from-purple-500 to-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs animate-pulse">
                      <Sparkles className="h-3 w-3" />
                      {item.badge}
                    </span>
                  )}
                  {!isActive && (
                    <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Sidebar Footer User Info & Logout */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
          {user && (
            <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-slate-200/80 shadow-xs dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-black text-xs shrink-0">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                </div>
              </div>

              <button
                onClick={logout}
                title="Ka bax (Logout)"
                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
