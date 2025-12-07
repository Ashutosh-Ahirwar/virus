'use client';

import { ReactNode } from 'react';
// CORRECT IMPORT PATH:
import { MiniKitProvider } from '@coinbase/onchainkit/minikit';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base } from 'viem/chains';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <OnchainKitProvider 
      chain={base} 
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY} 
    >
      <MiniKitProvider>
        {children}
      </MiniKitProvider>
    </OnchainKitProvider>
  );
}