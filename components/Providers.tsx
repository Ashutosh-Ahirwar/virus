'use client';

import { ReactNode } from 'react';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base } from 'viem/chains';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <OnchainKitProvider 
      chain={base} 
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
      config={{
        appearance: {
            mode: 'dark', 
            theme: 'cyberpunk' 
        }
      }}
      // ENABLE MINIKIT HERE:
      miniKit={{ 
        enabled: true,
        autoConnect: true,
      }}
    >
      {children}
    </OnchainKitProvider>
  );
}