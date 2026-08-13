import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card } from './card'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  trend?: { value: number; label: string }
  className?: string
  accentColor?: string
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
  accentColor = 'bg-indigo-500',
}: StatCardProps) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
            {trend && (
              <div className={cn('flex items-center gap-1 text-xs font-medium',
                trend.value >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                <span>{trend.value >= 0 ? '↑' : '↓'}</span>
                <span>{Math.abs(trend.value)}% {trend.label}</span>
              </div>
            )}
          </div>
          {icon && (
            <div className={cn('rounded-xl p-2.5 text-white', accentColor)}>
              {icon}
            </div>
          )}
        </div>
      </div>
      <div className={cn('absolute bottom-0 left-0 right-0 h-1', accentColor, 'opacity-20')} />
    </Card>
  )
}
