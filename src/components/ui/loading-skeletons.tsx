import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-md border">
      <div className={cn('p-4 border-b bg-muted/50 grid gap-4', `grid-cols-${columns}`)}>
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 bg-muted-foreground/20 rounded" />
        ))}
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className={cn('p-4 grid gap-4 animate-pulse', `grid-cols-${columns}`)}>
            {Array.from({ length: columns }).map((_, col) => (
              <div key={col} className="h-4 bg-muted rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="h-6 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="h-32 bg-muted rounded" />
      </CardContent>
    </Card>
  );
}

export function EmptyState({ 
  title, 
  description, 
  action 
}: { 
  title: string; 
  description?: string; 
  action?: React.ReactNode; 
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <svg className="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7m16 0h-2.586a1 1 0 00-.707-.293l-2.122-.536a1 1 0 01-.707-.293h-3.464a1 1 0 01-.707.293l-2.122.536a1 1 0 00-.707.293H4v-6" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-4 max-w-md">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}