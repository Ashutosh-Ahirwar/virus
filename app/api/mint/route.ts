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
    console.log("1. API Hit: Starting verification...");
    
    const privateKey = process.env.ADMIN_PRIVATE_KEY as `0x${string}`;
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

    if (!privateKey || !contractAddress) {
      console.error("❌ Error: Missing Env Vars");
      return NextResponse.json({ error: "Server Config Error" }, { status: 500 });
    }

    const adminAccount = privateKeyToAccount(privateKey);
    const { token, userAddress } = await req.json();

    // DEBUGGING: Print the domain we are expecting
    // CHANGE THIS STRING TO MATCH YOUR URL (No https://)
    const EXPECTED_DOMAIN = 'viral-strain.vercel.app'; 
    console.log(`2. Verifying JWT for domain: ${EXPECTED_DOMAIN}`);

    const result = await authClient.verifyJwt({ 
        token, 
        domain: EXPECTED_DOMAIN
    });
    
    console.log("3. Verified! FID:", result.sub);
    const fid = result.sub;

    const hasMinted = await publicClient.readContract({
        address: contractAddress,
        abi: [{ name: 'hasMinted', type: 'function', inputs: [{type: 'uint256'}], outputs: [{type: 'bool'}] }],
        functionName: 'hasMinted',
        args: [BigInt(fid)]
    });

    if (hasMinted) {
        console.log("❌ Error: Already Minted");
        return NextResponse.json({ error: 'Already Minted' }, { status: 400 });
    }

    console.log("4. Signing Voucher...");
    const messageHash = keccak256(
      encodePacked(['address', 'uint256'], [userAddress as `0x${string}`, BigInt(fid)])
    );

    const signature = await adminAccount.signMessage({
        message: { raw: messageHash }
    });

    console.log("✅ Success! Voucher created.");
    return NextResponse.json({ fid, signature });

  } catch (error: any) {
    // THIS IS THE IMPORTANT PART: Log the actual error message
    console.error("🚨 FULL ERROR LOG:", error);
    
    // Return the specific error message to the frontend
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 });
  }
}