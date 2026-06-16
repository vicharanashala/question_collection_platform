import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ChartCardProps {
  title: string
  subtitle?: string
  className?: string
  children: React.ReactNode
  action?: React.ReactNode
  noPadding?: boolean
}

export function ChartCard({ title, subtitle, className, children, action, noPadding }: ChartCardProps) {
  return (
    <Card className={cn('shadow-sm', className)}>
      <CardHeader className={cn('pb-2', noPadding ? 'px-5 pt-5 pb-0' : '')}>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className={cn(noPadding ? 'px-0 pb-0' : '')}>
        {children}
      </CardContent>
    </Card>
  )
}