// app/page.tsx
'use client';

import dynamic from 'next/dynamic';

// Dynamically import the app with SSR disabled
const ViralStrainApp = dynamic(() => import('@/components/ViralStrainApp'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center font-mono p-4">
        <div className="w-16 h-16 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mb-4"></div>
        <div className="text-green-500 animate-pulse tracking-widest text-sm">LOADING SYSTEM...</div>
    </div>
  ),
});

export default function Home() {
  return <ViralStrainApp />;
}