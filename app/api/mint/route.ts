import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@farcaster/quick-auth';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http, encodePacked, keccak256 } from 'viem';
import { baseSepolia } from 'viem/chains';

// 1. Setup
const authClient = createClient();
const adminAccount = privateKeyToAccount(process.env.ADMIN_PRIVATE_KEY as `0x${string}`);
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http()
});

export async function POST(req: NextRequest) {
  try {
    const { token, userAddress } = await req.json();

    // 2. Verify Farcaster User
    // Replace 'your-domain.com' with your actual ngrok or vercel domain
    const result = await authClient.verifyJwt({ token, domain: 'your-domain.com' });
    const fid = result.sub;

    // 3. Check if already minted (On-Chain)
    const hasMinted = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: [{ name: 'hasMinted', type: 'function', inputs: [{type: 'uint256'}], outputs: [{type: 'bool'}] }],
        functionName: 'hasMinted',
        args: [BigInt(fid)]
    });

    if (hasMinted) return NextResponse.json({ error: 'Already Minted' }, { status: 400 });

    // 4. Sign the Voucher
    // MUST match the order in Solidity: keccak256(abi.encodePacked(msg.sender, fid));
    const messageHash = keccak256(
      encodePacked(['address', 'uint256'], [userAddress as `0x${string}`, BigInt(fid)])
    );

    const signature = await adminAccount.signMessage({
        message: { raw: messageHash }
    });

    return NextResponse.json({ fid, signature });

  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}