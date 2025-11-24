import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@farcaster/quick-auth';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http, encodeAbiParameters, keccak256, parseAbiParameters } from 'viem';
import { base } from 'viem/chains'; // CHANGED: baseSepolia -> base

const authClient = createClient();
const publicClient = createPublicClient({ chain: base, transport: http() }); // CHANGED: base

export async function POST(req: NextRequest) {
  try {
    let rawKey = process.env.ADMIN_PRIVATE_KEY;
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
    
    if (!rawKey || !contractAddress) return NextResponse.json({ error: "Config Error" }, { status: 500 });

    rawKey = rawKey.trim().replace(/"/g, '');
    if (!rawKey.startsWith('0x')) rawKey = `0x${rawKey}`;
    const adminAccount = privateKeyToAccount(rawKey as `0x${string}`);

    const host = req.headers.get('host') || ''; 
    const { token, userAddress } = await req.json();

    // 1. Verify Farcaster User
    const result = await authClient.verifyJwt({ token, domain: host });
    const fid = result.sub;

    // 2. Check Contract to see if already minted
    const hasMinted = await publicClient.readContract({
        address: contractAddress,
        abi: [{ name: 'hasMinted', type: 'function', inputs: [{type: 'uint256'}], outputs: [{type: 'bool'}] }],
        functionName: 'hasMinted',
        args: [BigInt(fid)]
    });

    if (hasMinted) return NextResponse.json({ error: 'Already Minted' }, { status: 400 });

    // 3. Generate Signature
    // MUST MATCH SOLIDITY: keccak256(abi.encode(user, fid, contract, chainid))
    const messageHash = keccak256(
      encodeAbiParameters(
        parseAbiParameters('address, uint256, address, uint256'), 
        [
            userAddress as `0x${string}`, 
            BigInt(fid),
            contractAddress, 
            BigInt(base.id) // CHANGED: base.id (8453)
        ]
      )
    );

    const signature = await adminAccount.signMessage({ message: { raw: messageHash } });

    return NextResponse.json({ fid, signature });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 });
  }
}