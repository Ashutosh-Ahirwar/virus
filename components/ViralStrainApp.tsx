'use client';

import { useEffect, useState, useCallback } from 'react';
import sdk from '@farcaster/miniapp-sdk';
import { 
  createWalletClient, 
  createPublicClient, 
  custom, 
  http, 
  parseEther, 
  encodeFunctionData 
} from 'viem';
import { base } from 'viem/chains';
import Link from 'next/link';
import { useMiniKit } from '@coinbase/onchainkit/minikit';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

const ABI = [
  { name: 'mint', type: 'function', stateMutability: 'payable', inputs: [{ name: 'fid', type: 'uint256' }, { name: 'signature', type: 'bytes' }], outputs: [] },
  { name: 'hasMinted', type: 'function', stateMutability: 'view', inputs: [{ name: 'fid', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'tokenURI', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'string' }] },
  // Validates current price from contract to ensure TX success
  { name: 'price', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }
] as const;

const decodeTokenUri = (uri: string): string => {
    try {
        const base64Json = uri.split(',')[1];
        const decodedJson = JSON.parse(atob(base64Json));
        return decodedJson.image; 
    } catch (e) { return ""; }
};

export default function ViralStrainApp() {
  const { isFrameReady, context } = useMiniKit(); 

  const [status, setStatus] = useState<'loading' | 'idle' | 'minting' | 'success' | 'error' | 'minted'>('loading');
  const [txHash, setTxHash] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [userFid, setUserFid] = useState<number>(0);
  const [nftImageUrl, setNftImageUrl] = useState<string | null>(null);
  
  // State for dynamic price (defaulting to 0.00069)
  const [mintPrice, setMintPrice] = useState<bigint>(parseEther('0.00069')); 

  useEffect(() => {
    const init = async () => {
      try {
        const loadContext = sdk.context;
        const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 1000));
        const fcContext: any = await Promise.race([loadContext, timeout]);

        if (!fcContext) {
          console.warn("Farcaster context timed out or missing");
          setUserFid(context?.user?.fid ? Number(context.user.fid) : 0);
        } else {
          const fid = fcContext.user.fid ?? (context?.user?.fid ?? 0);
          setUserFid(fid);
          
          const publicClient = createPublicClient({ chain: base, transport: http() });

          // 1. Fetch Dynamic Price (Background check)
          try {
             const price = await publicClient.readContract({
                address: CONTRACT_ADDRESS, abi: ABI, functionName: 'price' 
             });
             setMintPrice(price as bigint);
          } catch (err) {
             console.warn("Could not fetch price, using default", err);
          }

          // 2. Check if minted
          if (fid > 0) {
              const hasMinted = await publicClient.readContract({
                address: CONTRACT_ADDRESS, abi: ABI, functionName: 'hasMinted', args: [BigInt(fid)]
              });

              if (hasMinted) {
                  setStatus('minted');
                  const uri = await publicClient.readContract({
                      address: CONTRACT_ADDRESS, abi: ABI, functionName: 'tokenURI', args: [BigInt(fid)]
                  });
                  setNftImageUrl(decodeTokenUri(uri));
              } else {
                  setStatus('idle');
              }
          } else {
              setStatus('idle');
          }
        }
      } catch (e) {
        console.error("Init failed", e);
        setStatus('idle');
      } finally {
        sdk.actions.ready();
      }
    };
    init();
  }, [context]);

  const handleMint = useCallback(async () => {
    if (status === 'minted') return;
    try {
      setStatus('loading');
      setErrorMsg('');

      const { token } = await sdk.quickAuth.getToken();
      
      let userAddress: string;
      let provider: any = null;

      const miniKitGlobal = (window as any).MiniKit;

      if (miniKitGlobal?.isInstalled) {
         const addresses = await miniKitGlobal.commands.getWalletAddress();
         userAddress = addresses?.[0] || "";
      } else {
         provider = await sdk.wallet.getEthereumProvider();
         if (!provider) throw new Error("No Wallet Found");
         const walletClient = createWalletClient({ chain: base, transport: custom(provider as any) });
         const [address] = await walletClient.requestAddresses();
         userAddress = address;
      }

      const response = await fetch('/api/mint', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, userAddress })
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Verification Failed");
      }

      const { fid, signature } = await response.json();
      setStatus('minting');
      
      if (miniKitGlobal?.isInstalled) {
        const encodedData = encodeFunctionData({
            abi: ABI,
            functionName: 'mint',
            args: [BigInt(fid), signature]
        });

        const txResponse = await miniKitGlobal.commands.sendTransaction({
            transaction: {
                to: CONTRACT_ADDRESS,
                value: mintPrice.toString(), 
                data: encodedData,
            }
        });

        if (txResponse && txResponse.commandId) {
             setStatus('success');
             setTimeout(() => window.location.reload(), 4000); 
        } else {
            throw new Error("Transaction disregarded");
        }

      } else {
        const walletClient = createWalletClient({ chain: base, transport: custom(provider) });
        const publicClient = createPublicClient({ chain: base, transport: http() });
        
        try { await walletClient.switchChain({ id: base.id }); } catch (e) { console.warn("Switch failed", e); }

        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS, abi: ABI, functionName: 'mint',
          args: [BigInt(fid), signature], 
          account: userAddress as `0x${string}`,
          value: mintPrice 
        });

        setTxHash(hash);
        await publicClient.waitForTransactionReceipt({ hash });
        
        const uri = await publicClient.readContract({
          address: CONTRACT_ADDRESS, abi: ABI, functionName: 'tokenURI', args: [BigInt(fid)]
        });
        setNftImageUrl(decodeTokenUri(uri));
        setStatus('success');
      }

    } catch (e: any) {
      console.error(e);
      let msg = e.message || "Something went wrong";
      if (msg.includes("User rejected")) msg = "Transaction Cancelled";
      setErrorMsg(msg);
      setStatus('error');
    }
  }, [status, context, userFid, mintPrice]);

  const handleBookmark = useCallback(async () => {
      try { await sdk.actions.addMiniApp(); } catch (e) { console.log(e); }
  }, []);

  const handleShare = useCallback(async () => {
    try {
        const shareText = `My identity strand rewrote itself. 🧬\n\nViral Strain #${userFid} is live — generated from the genome of my Farcaster FID.\nDecode yours:`;
        const openseaUrl = `https://opensea.io/assets/base/${CONTRACT_ADDRESS}/${userFid}`;
        await sdk.actions.composeCast({
            text: shareText,
            embeds: ['https://virus-orcin.vercel.app', openseaUrl] 
        });
    } catch (e) { console.error("Share failed", e); }
  }, [userFid]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-black text-white font-mono p-4 pb-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-green-900/20 via-black to-black z-0 fixed"></div>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-50 z-10 fixed"></div>

      <div className="z-10 max-w-md w-full flex flex-col items-center gap-6">
        <div className="w-full flex justify-end">
            <button onClick={handleBookmark} className="flex items-center gap-2 px-3 py-1 bg-gray-900/80 border border-white/20 rounded-full text-xs hover:bg-gray-800 transition backdrop-blur-md text-gray-300">
                <span>🔖</span><span>Bookmark</span>
            </button>
        </div>

        <div className="text-center space-y-2">
          <div className="inline-block px-3 py-1 border border-green-500/30 rounded-full bg-green-500/10 text-green-400 text-xs tracking-widest uppercase mb-4">SYSTEM ONLINE</div>
          <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">VIRAL STRAIN</h1>
          <p className="text-gray-500 text-sm uppercase tracking-widest">SURVIVAL PROBABILITY: UNKNOWN</p>
        </div>

        <div className="relative group w-full">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl blur opacity-30 group-hover:opacity-75 transition duration-1000"></div>
          <div className="relative bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
            <div className="relative w-40 h-40 mx-auto mb-8 flex items-center justify-center">
              {nftImageUrl ? (
                 <img src={nftImageUrl} alt="Minted NFT Strain" className="w-full h-full object-cover rounded-full border-2 border-green-500/50 shadow-[0_0_20px_rgba(74,222,128,0.3)]" />
              ) : (
                <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
                    <div className={`absolute inset-0 border-2 border-dashed rounded-full ${status === 'loading' || status === 'minting' ? 'border-yellow-500/50 animate-spin-slow' : 'border-green-500/30 animate-spin-slower'}`}></div>
                    <div className={`absolute inset-4 border border-green-500/20 rounded-full ${status === 'loading' || status === 'minting' ? 'animate-ping' : ''}`}></div>
                    <div className="text-6xl z-10 transition-transform duration-500 hover:scale-110 cursor-default">
                        {status === 'loading' && '⏳'}
                        {status === 'minting' && '⚙️'}
                        {status === 'minted' && '🧬'}
                        {status === 'success' && '🧪'}
                        {status === 'error' && '⚠️'}
                        {status === 'idle' && '🦠'}
                    </div>
                </div>
              )}
            </div>

            <div className="text-center space-y-6">
              {status === 'loading' && (
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-yellow-400 animate-pulse">INITIALIZING...</h3>
                  <p className="text-xs text-gray-400">Establishing Secure Connection</p>
                </div>
              )}

              {status === 'minting' && (
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-blue-400 animate-pulse">MINTING...</h3>
                  <p className="text-xs text-gray-400">Confirm Transaction in Wallet</p>
                </div>
              )}

              {(status === 'success' || status === 'minted') && (
                <div className="space-y-4">
                    <div>
                        <h3 className="text-2xl font-bold text-green-400 tracking-tight">{status === 'minted' ? "ALREADY INFECTED" : "STRAIN GENERATED!"}</h3>
                        <p className="text-xs text-gray-500 mt-1">ID: {userFid}</p>
                    </div>
                    <div className="flex flex-col gap-3">
                        <button onClick={handleShare} className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white border border-purple-400 rounded-lg transition-all text-sm font-bold flex items-center justify-center gap-2 animate-pulse">
                            <span>📢</span> Share Mutation
                        </button>
                        <a href={`https://opensea.io/assets/base/${CONTRACT_ADDRESS}/${userFid}`} target="_blank" rel="noreferrer" className="block w-full py-3 bg-blue-600/20 border border-blue-500/50 hover:bg-blue-600/40 text-blue-300 rounded-lg transition-all text-sm font-bold">🌊 View on OpenSea</a>
                        <Link href="/view-3d" className="block w-full py-3 bg-purple-600/20 border border-purple-500/50 hover:bg-purple-600/40 text-purple-300 rounded-lg transition-all text-sm font-bold text-center flex items-center justify-center gap-2"><span>🧊</span> View Your Strains in 3D</Link>
                         {txHash && <a href={`https://basescan.org/tx/${txHash}`} target="_blank" className="text-[10px] text-gray-500 hover:text-white underline">View on BaseScan</a>}
                    </div>
                </div>
              )}

              {status === 'error' && (
                <div className="space-y-4">
                  <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
                    <h3 className="font-bold text-red-400 mb-1">ERROR DETECTED</h3>
                    <p className="text-xs text-red-300">{errorMsg}</p>
                  </div>
                  <button onClick={() => setStatus('idle')} className="text-sm text-gray-400 hover:text-white underline decoration-gray-600 underline-offset-4">Reset System</button>
                </div>
              )}

              {status === 'idle' && (
                <div className="space-y-4">
                    <button onClick={handleMint} className="group relative w-full py-4 px-6 bg-green-600 hover:bg-green-500 text-black font-bold rounded-xl text-lg transition-all active:scale-[0.98] overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                        <span className="relative flex items-center justify-center gap-2">
                            MINT STRAIN
                        </span>
                    </button>
                    <p className="text-xs text-gray-500">One Virus Per Farcaster ID.</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="mt-8 text-center pb-8">
          <div className="h-1 w-16 bg-green-900 mx-auto rounded-full mb-2"></div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider">The virus learns faster than we do</p>
        </div>
      </div>
    </main>
  );
}