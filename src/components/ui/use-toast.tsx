import { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastData = {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
};

type ToastContextType = {
  toast: (data: Omit<ToastData, 'id'>) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProviderWrapper({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const toast = useCallback(({ title, description, variant = 'default' }: Omit<ToastData, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, title, description, variant }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider>
        {children}
        {toasts.map(({ id, title, description, variant }) => (
          <ToastPrimitive.Root key={id} className={cn(
            'rounded-md p-4 shadow-lg border',
            variant === 'destructive' && 'bg-destructive text-destructive-foreground',
            variant === 'success' && 'bg-green-600 text-white',
            variant === 'default' && 'bg-background'
          )}>
            <div className="flex gap-3">
              <div className="flex-1">
                {title && <ToastPrimitive.Title className="font-semibold">{title}</ToastPrimitive.Title>}
                {description && <ToastPrimitive.Description className="text-sm opacity-90">{description}</ToastPrimitive.Description>}
              </div>
              <ToastPrimitive.Close asChild>
                <button className="opacity-70 hover:opacity-100">
                  <X className="h-4 w-4" />
                </button>
              </ToastPrimitive.Close>
            </div>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-100 w-80" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}