// app/view-3d/page.tsx
'use client';

import { useEffect, useState, Suspense } from 'react';
import sdk from '@farcaster/miniapp-sdk';
import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { base } from 'viem/chains';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Stars, PerspectiveCamera } from '@react-three/drei';
import { Virus3D } from '@/components/Virus3D';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

// Minimal ABI needed for viewing
const ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'tokenOfOwnerByIndex', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'index', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'tokenURI', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'string' }] }
] as const;

// Helper to decode the on-chain SVG image for 2D preview
const decodeTokenImage = (uri: string) => {
    try {
        const base64Json = uri.split(',')[1];
        const decodedJson = JSON.parse(atob(base64Json));
        return decodedJson.image;
    } catch (e) { return null; }
};

export default function View3DPage() {
  const [loadingState, setLoadingState] = useState<'connecting' | 'scanning' | 'ready' | 'error' | 'no-assets'>('connecting');
  const [ownedTokens, setOwnedTokens] = useState<{id: number, image: string}[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [userAddress, setUserAddress] = useState<string>("");

  // THE SEAMLESS CONNECTION & FETCH LOGIC
  const connectAndFetch = async () => {
    try {
      setLoadingState('connecting');
      
      // 1. Get Ethereum Provider from Farcaster SDK
      const provider = await sdk.wallet.getEthereumProvider();
      if (!provider) throw new Error("Wallet provider not found");

      const walletClient = createWalletClient({ chain: base, transport: custom(provider as any) });
      const [address] = await walletClient.requestAddresses();
      setUserAddress(address);

      setLoadingState('scanning');
      const publicClient = createPublicClient({ chain: base, transport: http() });
      
      // 2. Check Balance on Base Mainnet
      const balance = await publicClient.readContract({
        address: CONTRACT_ADDRESS, abi: ABI, functionName: 'balanceOf', args: [address]
      });

      // FIX: Use BigInt constructor for comparison
      if (balance === BigInt(0)) {
        setLoadingState('no-assets');
        return;
      }

      // 3. Fetch Token IDs and 2D Previews
      const tokensList = [];
      // FIX: Use BigInt constructor for limit
      const limit = balance > BigInt(10) ? BigInt(10) : balance; 
      
      // FIX: Use BigInt constructor for loop start
      for (let i = BigInt(0); i < limit; i++) {
        const tokenId = await publicClient.readContract({
          address: CONTRACT_ADDRESS, abi: ABI, functionName: 'tokenOfOwnerByIndex', args: [address, i]
        });
        
        // Get the 2D image for the selection UI
        const uri = await publicClient.readContract({
          address: CONTRACT_ADDRESS, abi: ABI, functionName: 'tokenURI', args: [tokenId]
        });
        const image = decodeTokenImage(uri);
        
        if (image) {
            tokensList.push({ id: Number(tokenId), image });
        }
      }
      
      setOwnedTokens(tokensList);
      if (tokensList.length > 0) {
          setSelectedTokenId(tokensList[0].id); // Select the first one by default
      }
      setLoadingState('ready');

    } catch (e) {
      console.error("Error in 3D viewer initialization", e);
      setLoadingState('error');
    }
  };

  // Initialize on mount
  useEffect(() => {
    sdk.actions.ready();
    connectAndFetch();
  }, []);


  // --- RENDERING THE UI STATES ---

  if (loadingState === 'connecting' || loadingState === 'scanning') {
    return (
        <MainLayout>
             <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-pulse">
                <div className="text-4xl">🧬</div>
                <p className="text-blue-400 font-bold tracking-widest">
                    {loadingState === 'connecting' ? 'ESTABLISHING NEURO-LINK...' : 'SCANNING BIOMETRICS...'}
                </p>
                <p className="text-xs text-gray-500">Please connect your wallet when prompted.</p>
            </div>
        </MainLayout>
    );
  }

  if (loadingState === 'error') {
    return (
        <MainLayout>
             <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-6 bg-red-900/20 rounded-2xl border border-red-500/30">
                <div className="text-4xl">⚠️</div>
                <h2 className="text-xl font-bold text-red-400">Connection Failed</h2>
                <p className="text-gray-400 text-sm mb-4">Could not verify on-chain assets. Ensure your wallet is connected to Base network.</p>
                <button onClick={connectAndFetch} className="py-3 px-8 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm transition-all">
                    RETRY CONNECTION
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
                    <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">NO STRAINS DETECTED</h2>
                    <p className="text-gray-500 text-sm mt-2 max-w-xs mx-auto">
                        Wallet {userAddress.slice(0,6)}...{userAddress.slice(-4)} holds zero Viral Strain NFTs.
                    </p>
                </div>
                <Link href="/" className="py-4 px-8 bg-green-600 hover:bg-green-500 text-black font-bold rounded-xl text-lg transition-all active:scale-95 shadow-lg shadow-green-500/20">
                    INITIATE MINT
                </Link>
            </div>
        </MainLayout>
    );
  }

  // --- SUCCESS STATE: 3D VIEWER ---
  return (
    <MainLayout>
        {/* 3D Canvas Container */}
        <div className="relative w-full aspect-square md:aspect-[4/3] rounded-2xl overflow-hidden border-2 border-blue-500/30 shadow-[0_0_50px_rgba(59,130,246,0.2)] bg-black/80 mt-4">
            {selectedTokenId !== null && (
                <Canvas>
                    <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={45} />
                    <color attach="background" args={['#020205']} />
                    <fog attach="fog" args={['#020205', 5, 20]} />
                    
                    {/* Lighting setup for dramatic effect */}
                    <ambientLight intensity={0.1} />
                    <spotLight position={[8, 8, 8]} angle={0.3} penumbra={1} intensity={1.5} castShadow color="#ffffff" />
                    <pointLight position={[-5, -5, -5]} intensity={1} color="#0040ff" distance={15} />
                    <pointLight position={[5, -5, 5]} intensity={0.5} color="#00ff80" distance={15} />
                    
                    {/* Background elements */}
                    <Stars radius={80} depth={20} count={3000} factor={4} saturation={0.5} fade speed={0.5} />
                    {/* City environment gives good metallic reflections */}
                    <Environment preset="city" /> 

                    <Suspense fallback={null}>
                        <Virus3D tokenId={selectedTokenId} />
                    </Suspense>
                    
                    <OrbitControls 
                        enablePan={false} 
                        minPolarAngle={Math.PI / 3.5} 
                        maxPolarAngle={Math.PI / 1.5}
                        minDistance={3.5}
                        maxDistance={10}
                        autoRotate
                        autoRotateSpeed={0.8}
                    />
                    <ContactShadows position={[0, -2.5, 0]} opacity={0.6} scale={15} blur={3} far={5} color="#0020ff" />
                </Canvas>
            )}
        </div>

        {/* NFT Selector Scrollbar */}
        <div className="w-full mt-6">
            <h3 className="text-xs text-blue-400 mb-3 uppercase tracking-widest font-bold">
                Select Strain ID ({ownedTokens.length} found)
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide snap-x">
                {ownedTokens.map((token) => (
                    <button
                        key={token.id}
                        onClick={() => setSelectedTokenId(token.id)}
                        className={`relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all snap-center ${selectedTokenId === token.id ? 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)] scale-105 z-10' : 'border-white/10 hover:border-white/30 opacity-70 hover:opacity-100'}`}
                    >
                        {/* Use the 2D SVG as preview thumbnail */}
                        <img src={token.image} alt={`Strain ${token.id}`} className="w-full h-full object-cover bg-black/50" />
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-1 text-[10px] text-center font-bold">
                            #{token.id}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    </MainLayout>
  );
}

// Layout wrapper for consistent styling
function MainLayout({ children }: { children: React.ReactNode }) {
    return (
      <main className="relative flex min-h-screen flex-col items-center bg-black text-white font-mono p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black z-0 fixed pointer-events-none"></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50 z-10 fixed pointer-events-none"></div>
  
        <div className="z-10 w-full max-w-2xl flex flex-col flex-1 gap-4 relative">
          {/* Nav Header */}
          <div className="w-full flex justify-between items-center mb-2">
              <Link href="/" className="group flex items-center gap-2 px-4 py-2 bg-gray-900/80 border border-white/10 rounded-full text-xs hover:bg-gray-800 transition backdrop-blur-md text-gray-300 hover:text-white hover:border-white/30">
                  <span className="group-hover:-translate-x-0.5 transition-transform">←</span> <span>LABORATORY</span>
              </Link>
              <div className="px-4 py-1 border border-blue-500/30 rounded-full bg-blue-500/5 text-blue-400 text-[10px] tracking-[0.2em] uppercase font-bold animate-pulse">
                  3D ANALYZER ACTIVE
              </div>
          </div>
          
          {children}
        </div>
      </main>
    );
  }