import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@farcaster/quick-auth';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http, encodePacked, keccak256 } from 'viem';
import { baseSepolia } from 'viem/chains';

// 1. Setup Public Clients (Safe to keep outside)
// These don't use secrets, so they won't crash the build.
const authClient = createClient();
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http()
});

export async function POST(req: NextRequest) {
  try {
    // 2. SAFE SETUP (Lazy Loading)
    // We read the secrets INSIDE the function so the build doesn't crash.
    const privateKey = process.env.ADMIN_PRIVATE_KEY as `0x${string}`;
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

    // Safety Check: If variables are missing (like during a build), stop here.
    if (!privateKey || !contractAddress) {
      console.error("Missing Environment Variables");
      return NextResponse.json({ error: "Server Config Error" }, { status: 500 });
    }

    // Initialize the Admin Signer now
    const adminAccount = privateKeyToAccount(privateKey);

    // 3. Parse Request
    const { token, userAddress } = await req.json();

    // 4. Verify Farcaster User
    // IMPORTANT: Change 'viral-strain.vercel.app' to your actual Vercel domain!
    // Do not include 'https://', just the domain name.
    const result = await authClient.verifyJwt({ 
        token, 
        domain: 'viral-strain.vercel.app' 
    });
    const fid = result.sub;

    // 5. Check Rate Limit (On-Chain)
    const hasMinted = await publicClient.readContract({
        address: contractAddress,
        abi: [{ name: 'hasMinted', type: 'function', inputs: [{type: 'uint256'}], outputs: [{type: 'bool'}] }],
        functionName: 'hasMinted',
        args: [BigInt(fid)]
    });

    if (hasMinted) {
        return NextResponse.json({ error: 'Already Minted' }, { status: 400 });
    }

    // 6. Sign the Voucher
    // This matches the Solidity: keccak256(abi.encodePacked(msg.sender, fid));
    const messageHash = keccak256(
      encodePacked(['address', 'uint256'], [userAddress as `0x${string}`, BigInt(fid)])
    );

    const signature = await adminAccount.signMessage({
        message: { raw: messageHash }
    });

    return NextResponse.json({ fid, signature });

  } catch (error) {
    console.error("Mint API Error:", error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}