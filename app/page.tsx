'use client';

import { useEffect, useState, useCallback } from 'react';
import sdk from '@farcaster/miniapp-sdk';
import { createWalletClient, createPublicClient, custom, http } from 'viem';
import { baseSepolia } from 'viem/chains';

// 1. CONFIGURATION
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

const ABI = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'fid', type: 'uint256' }, { name: 'signature', type: 'bytes' }],
    outputs: []
  },
  {
    name: 'hasMinted',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'fid', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }]
  },
  // === FIX 1: Added tokenURI to ABI ===
  {
    name: 'tokenURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }]
  }
] as const;

// === FIX 2: Added Helper to decode the On-Chain Metadata ===
const decodeTokenUri = (uri: string): string => {
    try {
        const base64Json = uri.split(',')[1];
        const decodedJson = JSON.parse(atob(base64Json));
        return decodedJson.image; 
    } catch (e) {
        console.error("Error decoding URI", e);
        return "";
    }
};

export default function Home() {
  const [status, setStatus] = useState<'loading' | 'idle' | 'minted' | 'error' | 'success'>('loading');
  const [txHash, setTxHash] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [userFid, setUserFid] = useState<number>(0);
  const [testFidInput, setTestFidInput] = useState<string>('100000'); 
  const [nftImageUrl, setNftImageUrl] = useState<string | null>(null);

  // === FIX 3: Reusable Image Fetcher ===
  const fetchNftImage = useCallback(async (tokenId: bigint) => {
    try {
        const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
        const uri = await publicClient.readContract({
            address: CONTRACT_ADDRESS, abi: ABI, functionName: 'tokenURI', args: [tokenId]
        });
        setNftImageUrl(decodeTokenUri(uri));
    } catch (e) {
        console.warn("Could not fetch image yet (might be indexing or not minted)", e);
    }
  }, []);

  // 2. INITIALIZATION
  useEffect(() => {
    const init = async () => {
      try {
        const context = await sdk.context;
        const fid = context.user.fid ?? 0; 
        setUserFid(fid);

        const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
        const hasMinted = await publicClient.readContract({
          address: CONTRACT_ADDRESS, abi: ABI, functionName: 'hasMinted',
          args: [BigInt(fid)]
        });

        if (hasMinted) {
          setStatus('minted');
          // === FIX 4: Fetch image if already minted ===
          const uri = await publicClient.readContract({
            address: CONTRACT_ADDRESS, abi: ABI, functionName: 'tokenURI', args: [BigInt(fid)]
          });
          setNftImageUrl(decodeTokenUri(uri));
        } else {
          setStatus('idle');
        }
        
        sdk.actions.ready();

      } catch (e) {
        console.error("Init failed", e);
        setStatus('idle');
        sdk.actions.ready();
      }
    };

    init();
  }, []);

  // 3. MINT HANDLER
  const handleMint = useCallback(async () => {
    if (status === 'minted') return;
    
    const testFid = parseInt(testFidInput);
    if (isNaN(testFid) || testFid < 1) {
        setErrorMsg("Please enter a valid Test FID.");
        setStatus('error');
        return;
    }
    
    try {
      setStatus('loading');
      setErrorMsg('');

      const provider = await sdk.wallet.getEthereumProvider();
      if (!provider) throw new Error("No Wallet Found");
      
      const walletClient = createWalletClient({
        chain: baseSepolia, transport: custom(provider as any)
      });

      const [address] = await walletClient.requestAddresses();
      
      try { await walletClient.switchChain({ id: baseSepolia.id }); } catch (e) { console.warn("Switch failed", e); }

      // --- CALL TEST API ---
      const response = await fetch('/api/test-sign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testFid, userAddress: address })
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Verification Failed");
      }

      const { fid, signature } = await response.json();

      // --- WRITE TO CONTRACT ---
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS, abi: ABI, functionName: 'mint',
        args: [BigInt(fid), signature], account: address
      });

      // === FIX 5: Fetch Image Immediately After Mint ===
      await fetchNftImage(BigInt(fid));
      
      setTxHash(hash);
      setStatus('success');

    } catch (e: any) {
      console.error(e);
      let msg = e.message || "Something went wrong";
      if (msg.includes("ContractPaused")) msg = "Contract is Paused!";
      if (msg.includes("chain")) msg = "Wrong Network. Switch to Base Sepolia.";
      
      setErrorMsg(msg);
      setStatus('error');
    }
  }, [status, testFidInput, fetchNftImage]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-black text-white font-mono overflow-hidden">
      
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-green-900/20 via-black to-black z-0"></div>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-50"></div>

      <div className="z-10 max-w-md w-full p-6">
        
        {/* Header */}
        <div className="text-center mb-10 space-y-2">
          <div className="inline-block px-3 py-1 border border-red-500/30 rounded-full bg-red-500/10 text-red-400 text-xs tracking-widest uppercase mb-4">
            TEST MODE: INSECURE
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
            VIRAL STRAIN
          </h1>
          <p className="text-gray-500 text-sm uppercase tracking-widest">SURVIVAL PROBABILITY: {status === 'minted' ? '99%' : 'UNKNOWN'}</p>
        </div>

        {/* Main Card */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl blur opacity-30 group-hover:opacity-75 transition duration-1000"></div>
          
          <div className="relative bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
            
            {/* VISUALIZER CIRCLE / IMAGE DISPLAY */}
            <div className="relative w-40 h-40 mx-auto mb-8 flex items-center justify-center">
              {nftImageUrl ? (
                 <img src={nftImageUrl} alt="Minted NFT Strain" className="w-full h-full object-cover rounded-full border-2 border-green-500/50 shadow-[0_0_20px_rgba(74,222,128,0.3)]" />
              ) : (
                <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
                    <div className={`absolute inset-0 border-2 border-dashed rounded-full ${status === 'loading' ? 'border-yellow-500/50 animate-spin-slow' : 'border-green-500/30 animate-spin-slower'}`}></div>
                    <div className={`absolute inset-4 border border-green-500/20 rounded-full ${status === 'loading' ? 'animate-ping' : ''}`}></div>
                    <div className="text-6xl z-10 transition-transform duration-500 hover:scale-110 cursor-default">
                        {status === 'loading' && '⏳'}
                        {status === 'minted' && '🧬'}
                        {status === 'success' && '🧪'}
                        {status === 'error' && '⚠️'}
                        {status === 'idle' && '🦠'}
                    </div>
                </div>
              )}
            </div>

            {/* STATUS MESSAGES & BUTTONS */}
            <div className="text-center space-y-6">
              
              {status === 'loading' && (
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-yellow-400 animate-pulse">PROCESSING...</h3>
                  <p className="text-xs text-gray-400">Requesting Test Voucher</p>
                </div>
              )}

              {status === 'minted' && (
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold text-green-400 tracking-tight">ALREADY INFECTED</h3>
                  <div className="inline-block px-4 py-1 bg-green-900/30 border border-green-500/30 rounded text-green-300 font-mono text-sm">
                    Your Real FID: {userFid}
                  </div>
                  <p className="text-xs text-gray-500">Deployment confirmed.</p>
                  
                  <button 
                    onClick={() => {
                        setStatus('idle');
                        setNftImageUrl(null);
                    }}
                    className="mt-4 text-[10px] text-yellow-600 hover:text-yellow-400 uppercase tracking-widest hover:underline cursor-pointer"
                  >
                    [DEBUG] Force Mint Variation
                  </button>
                </div>
              )}

              {status === 'success' && (
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-white tracking-tight">STRAIN GENERATED!</h3>
                  <p className="text-sm text-gray-400">Test FID {testFidInput} produced a unique mutation.</p>
                  <a 
                    href={`https://sepolia.basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full py-3 bg-blue-600/20 border border-blue-500/50 hover:bg-blue-600/40 text-blue-300 rounded-lg transition-all text-sm"
                  >
                    View on BaseScan →
                  </a>

                  <button
                    onClick={() => {
                        setStatus('idle');
                        setNftImageUrl(null);
                        setTestFidInput((prev) => (parseInt(prev) + 1).toString());
                    }}
                    className="block w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all text-sm border border-white/10"
                  >
                    Mint Next Variation ↻
                  </button>
                </div>
              )}

              {status === 'error' && (
                <div className="space-y-4">
                  <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
                    <h3 className="font-bold text-red-400 mb-1">ERROR DETECTED</h3>
                    <p className="text-xs text-red-300">{errorMsg}</p>
                  </div>
                  <button 
                    onClick={() => setStatus('idle')}
                    className="text-sm text-gray-400 hover:text-white underline decoration-gray-600 underline-offset-4"
                  >
                    Reset System
                  </button>
                </div>
              )}

              {status === 'idle' && (
                <div className="space-y-4">
                    <input
                        type="number"
                        value={testFidInput}
                        onChange={(e) => setTestFidInput(e.target.value)}
                        placeholder="Test FID (e.g., 100001)"
                        className="w-full py-2 px-4 bg-gray-800 text-green-400 border border-green-700/50 rounded-lg text-center font-mono placeholder-gray-500 focus:ring-green-500 focus:border-green-500"
                        min="1"
                    />
                    
                    <button
                        onClick={handleMint}
                        className="group relative w-full py-4 px-6 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded-xl text-lg transition-all active:scale-[0.98] overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                        <span className="relative flex items-center justify-center gap-2">
                            TEST NEXT STRAIN
                        </span>
                    </button>
                    <p className="text-xs text-gray-500">
                        Enter different numbers to see visual variations.
                    </p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="h-1 w-16 bg-green-900 mx-auto rounded-full mb-2"></div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider">
            The virus learns faster than we do
          </p>
        </div>

      </div>
    </main>
  );
}