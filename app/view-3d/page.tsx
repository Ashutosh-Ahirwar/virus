'use client';

import { useEffect, useState, Suspense } from 'react';
import sdk from '@farcaster/miniapp-sdk';
import { createPublicClient, createWalletClient, custom, http, fallback, getAddress } from 'viem';
import { base } from 'viem/chains';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Virus3D } from '@/components/Virus3D';
import { DnaBackground } from '@/components/DnaBackground'; // Import new background

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x60fcA7d0b0585937C451bd043f5259Bf72F08358") as `0x${string}`;

const ABI = [
  { name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] },
  { name: 'tokenURI', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'string' }] }
] as const;

const decodeTokenImage = (uri: string) => {
    try {
        const base64Json = uri.split(',')[1];
        const decodedJson = JSON.parse(atob(base64Json));
        return decodedJson.image;
    } catch (e) { return null; }
};

export default function View3DPage() {
  const [loadingState, setLoadingState] = useState<'connecting' | 'verifying' | 'ready' | 'error' | 'no-assets'>('connecting');
  const [ownedTokens, setOwnedTokens] = useState<{id: number, image: string}[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [userAddress, setUserAddress] = useState<string>("");
  const [scanStatus, setScanStatus] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [targetFid, setTargetFid] = useState<number>(0);

  const connectAndFetch = async () => {
    try {
      setLoadingState('connecting');
      setScanStatus("Initializing connection...");
      setErrorMessage("");
      
      const context = await sdk.context;
      const fid = context.user.fid;

      if (!fid) {
        setErrorMessage("No Farcaster ID found. Please open in Warpcast.");
        setLoadingState('error');
        return;
      }
      setTargetFid(fid);

      const provider = await sdk.wallet.getEthereumProvider();
      if (!provider) throw new Error("Wallet provider not found");

      const walletClient = createWalletClient({ chain: base, transport: custom(provider as any) });
      const [address] = await walletClient.requestAddresses();
      const checksumAddress = getAddress(address);
      setUserAddress(checksumAddress);

      const publicClient = createPublicClient({ 
        chain: base, 
        transport: fallback([
            http('https://mainnet.base.org'), 
            http('https://base.publicnode.com'),
            http('https://base-rpc.publicnode.com'),
            http('https://1rpc.io/base'),
            http()
        ])
      });

      setLoadingState('verifying');
      setScanStatus(`Locating Strain #${fid}...`);
      
      try {
        const owner = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: ABI,
            functionName: 'ownerOf',
            args: [BigInt(fid)]
        });

        if (owner.toLowerCase() === checksumAddress.toLowerCase()) {
            const uri = await publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: ABI,
                functionName: 'tokenURI',
                args: [BigInt(fid)]
            });

            const image = decodeTokenImage(uri);
            if (image) {
                setOwnedTokens([{ id: fid, image }]);
                setSelectedTokenId(fid);
                setLoadingState('ready');
            } else {
                 throw new Error("Failed to decode viral data.");
            }
        } else {
            setLoadingState('no-assets');
        }
      } catch (err: any) {
          if (err.message && (err.message.includes("revert") || err.message.includes("nonexistent") || err.message.includes("invalid token"))) {
              setLoadingState('no-assets');
          } else {
              throw err;
          }
      }

    } catch (e: any) {
      console.error("Error in view-3d", e);
      setErrorMessage(e.message || "Unknown error occurred");
      setLoadingState('error');
    }
  };

  useEffect(() => {
    sdk.actions.ready();
    connectAndFetch();
  }, []);

  if (loadingState !== 'ready' && loadingState !== 'no-assets' && loadingState !== 'error') {
    return (
        <MainLayout>
             <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-pulse">
                <div className="text-4xl">🧬</div>
                <h2 className="text-blue-400 font-bold tracking-widest text-lg">
                    ACCESSING BIO-DATABASE
                </h2>
                <div className="w-48 h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 animate-progress"></div>
                </div>
                <p className="text-xs text-gray-500 font-mono">{scanStatus}</p>
            </div>
        </MainLayout>
    );
  }

  if (loadingState === 'error') {
    return (
        <MainLayout>
             <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-6 bg-red-900/20 rounded-2xl border border-red-500/30 max-w-md">
                <div className="text-4xl">⚠️</div>
                <h2 className="text-xl font-bold text-red-400">Access Denied</h2>
                <p className="text-gray-400 text-xs mb-4 font-mono break-words">{errorMessage || "Could not verify assets."}</p>
                <button onClick={connectAndFetch} className="py-3 px-8 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                    RETRY
                </button>
            </div>
        </MainLayout>
    );
  }

  if (loadingState === 'no-assets') {
    return (
        <MainLayout>
            <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
                <div className="w-32 h-32 rounded-full border-4 border-dashed border-gray-700 flex items-center justify-center text-6xl opacity-30">
                    🦠
                </div>
                <div>
                    <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">STRAIN #{targetFid} MISSING</h2>
                    <p className="text-gray-500 text-sm mt-2 max-w-xs mx-auto">
                        Wallet {userAddress.slice(0,6)}...{userAddress.slice(-4)} does not own the Viral Strain for FID {targetFid}.
                    </p>
                </div>
                <Link href="/" className="py-4 px-8 bg-green-600 hover:bg-green-500 text-black font-bold rounded-xl text-lg transition-all active:scale-95 shadow-lg shadow-green-500/20">
                    MINT STRAIN #{targetFid}
                </Link>
            </div>
        </MainLayout>
    );
  }

  return (
    <MainLayout>
        <div className="relative w-full aspect-square md:aspect-[4/3] rounded-2xl overflow-hidden border-2 border-blue-500/30 shadow-[0_0_50px_rgba(59,130,246,0.2)] bg-black/80 mt-4 group">
            
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
                <h3 className="text-xl font-bold text-white drop-shadow-md">STRAIN #{selectedTokenId}</h3>
                <p className="text-[10px] text-blue-400 uppercase tracking-widest">Microscope Feed</p>
            </div>

            {selectedTokenId !== null && (
                <Canvas 
                    dpr={[1, 2]} 
                    gl={{ 
                        antialias: false, 
                        powerPreference: 'high-performance', 
                        preserveDrawingBuffer: true,
                    }}
                >
                    <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={50} />
                    
                    {/* Deep Blue Background Color */}
                    <color attach="background" args={['#000510']} />
                    
                    {/* Blue Fog to blend Background DNA */}
                    <fog attach="fog" args={['#000510', 5, 20]} />
                    
                    {/* Lighting - Cool blue tones */}
                    <ambientLight intensity={0.2} />
                    <spotLight position={[10, 10, 10]} angle={0.5} penumbra={1} intensity={2} color="#00ffff" />
                    <pointLight position={[-10, -10, -10]} intensity={1} color="#0040ff" />
                    
                    {/* NEW DNA BACKGROUND */}
                    <DnaBackground />

                    <Suspense fallback={null}>
                        <Virus3D tokenId={selectedTokenId} />
                    </Suspense>
                    
                    <OrbitControls 
                        enablePan={false} 
                        minPolarAngle={Math.PI / 4} 
                        maxPolarAngle={Math.PI / 1.5}
                        minDistance={4}
                        maxDistance={12}
                        autoRotate
                        autoRotateSpeed={0.5}
                    />
                </Canvas>
            )}
        </div>

        <div className="w-full mt-6 p-4 border border-blue-500/20 bg-blue-900/10 rounded-xl">
            <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg overflow-hidden border border-white/20">
                     {ownedTokens[0] && <img src={ownedTokens[0].image} alt="Preview" className="w-full h-full object-cover" />}
                </div>
                <div>
                    <h3 className="text-sm font-bold text-blue-300">GENETIC MATCH CONFIRMED</h3>
                    <p className="text-[10px] text-gray-400">Viewing Strain linked to Farcaster ID {targetFid}</p>
                </div>
            </div>
        </div>
    </MainLayout>
  );
}

function MainLayout({ children }: { children: React.ReactNode }) {
    return (
      <main className="relative flex min-h-screen flex-col items-center bg-black text-white font-mono p-4">
        {/* Scan lines overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 pointer-events-none bg-[length:100%_4px,3px_100%]"></div>
        
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black z-0 pointer-events-none"></div>
  
        <div className="z-10 w-full max-w-2xl flex flex-col flex-1 gap-4 relative">
          <div className="w-full flex justify-between items-center mb-2">
              <Link href="/" className="group flex items-center gap-2 px-4 py-2 bg-gray-900/80 border border-white/10 rounded-full text-xs hover:bg-gray-800 transition backdrop-blur-md text-gray-300 hover:text-white hover:border-white/30">
                  <span className="group-hover:-translate-x-0.5 transition-transform">←</span> <span>LABORATORY</span>
              </Link>
              <div className="px-4 py-1 border border-blue-500/30 rounded-full bg-blue-500/5 text-blue-400 text-[10px] tracking-[0.2em] uppercase font-bold animate-pulse">
                  MICROSCOPE ACTIVE
              </div>
          </div>
          
          {children}
        </div>
      </main>
    );
  }