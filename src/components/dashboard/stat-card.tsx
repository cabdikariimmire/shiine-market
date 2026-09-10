import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  color?: 'emerald' | 'blue' | 'amber' | 'purple' | 'red' | 'slate';
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, color = 'emerald' }: StatCardProps) {
  const colorMap = {
    emerald: {
      bg: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
      border: 'border-emerald-200/60 dark:border-emerald-900/50',
      accent: 'text-emerald-600 dark:text-emerald-400',
    },
    blue: {
      bg: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
      border: 'border-blue-200/60 dark:border-blue-900/50',
      accent: 'text-blue-600 dark:text-blue-400',
    },
    amber: {
      bg: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
      border: 'border-amber-200/60 dark:border-amber-900/50',
      accent: 'text-amber-600 dark:text-amber-400',
    },
    purple: {
      bg: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400',
      border: 'border-purple-200/60 dark:border-purple-900/50',
      accent: 'text-purple-600 dark:text-purple-400',
    },
    red: {
      bg: 'bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400',
      border: 'border-red-200/60 dark:border-red-900/50',
      accent: 'text-red-600 dark:text-red-400',
    },
    slate: {
      bg: 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400',
      border: 'border-slate-200/60 dark:border-slate-800',
      accent: 'text-slate-900 dark:text-white',
    },
  };

  const scheme = colorMap[color];

  return (
    <Card className={cn("overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border", scheme.border)}>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                {value}
              </span>
            </div>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {subtitle}
              </p>
            )}
          </div>

          <div className={cn("flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl", scheme.bg)}>
            <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
        </div>

        {trend && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center text-xs font-semibold">
            <span className={scheme.accent}>{trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
