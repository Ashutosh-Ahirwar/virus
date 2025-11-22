import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@farcaster/quick-auth';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http, encodePacked, keccak256 } from 'viem';
import { baseSepolia } from 'viem/chains';

const authClient = createClient();
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http()
});

export async function POST(req: NextRequest) {
  try {
    console.log("1. API Hit");

    // --- 1. SETUP KEYS (Safe check) ---
    let rawKey = process.env.ADMIN_PRIVATE_KEY;
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

    if (!rawKey || !contractAddress) {
      return NextResponse.json({ error: "Server Config Error" }, { status: 500 });
    }

    // Auto-fix missing '0x' prefix
    rawKey = rawKey.trim().replace(/"/g, '');
    if (!rawKey.startsWith('0x')) rawKey = `0x${rawKey}`;
    
    const adminAccount = privateKeyToAccount(rawKey as `0x${string}`);

    // --- 2. DYNAMIC DOMAIN DETECTION (No Hardcoding!) ---
    // We get the domain from the request headers.
    // Example: 'abc-123.ngrok-free.app' or 'viral-strain.vercel.app'
    const host = req.headers.get('host');
    
    if (!host) {
        return NextResponse.json({ error: "Missing Host Header" }, { status: 400 });
    }

    console.log(`2. Verifying for dynamic domain: ${host}`);

    const { token, userAddress } = await req.json();

    // Verify using the DETECTED host
    const result = await authClient.verifyJwt({ 
        token, 
        domain: host // <--- This adapts to wherever you are running
    });
    const fid = result.sub;

    // --- 3. CHECK BLOCKCHAIN (Rate Limit) ---
    const hasMinted = await publicClient.readContract({
        address: contractAddress,
        abi: [{ name: 'hasMinted', type: 'function', inputs: [{type: 'uint256'}], outputs: [{type: 'bool'}] }],
        functionName: 'hasMinted',
        args: [BigInt(fid)]
    });

    if (hasMinted) return NextResponse.json({ error: 'Already Minted' }, { status: 400 });

    // --- 4. SIGN VOUCHER ---
    const messageHash = keccak256(
      encodePacked(['address', 'uint256'], [userAddress as `0x${string}`, BigInt(fid)])
    );

    const signature = await adminAccount.signMessage({
        message: { raw: messageHash }
    });

    console.log(`✅ Success! Voucher signed for FID ${fid}`);
    return NextResponse.json({ fid, signature });

  } catch (error: any) {
    console.error("API Error:", error);
    // If domain mismatch happens, this error message will tell you exactly why
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 });
  }
}