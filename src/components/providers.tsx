'use client';

import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { trpc, trpcClient } from '@/lib/trpc';
import { ToastProviderWrapper } from '@/components/ui/use-toast';
import { ConfirmProvider } from '@/components/ui/confirm-dialog';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        onError: (error) => {
          console.error('Mutation error:', error);
        },
      },
    },
  }));

  const [trpcClientState] = useState(() => trpcClient);

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <trpc.Provider client={trpcClientState} queryClient={queryClient}>
          <ToastProviderWrapper>
            <ConfirmProvider>
              {children}
            </ConfirmProvider>
          </ToastProviderWrapper>
        </trpc.Provider>
      </QueryClientProvider>
    </SessionProvider>
  );
}