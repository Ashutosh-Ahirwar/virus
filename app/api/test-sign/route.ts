import { NextRequest, NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
// 1. ADD isAddress and Address to imports
import { createPublicClient, http, encodePacked, keccak256, isAddress, Address } from 'viem'; 
import { baseSepolia } from 'viem/chains';

// Setup (using existing keys)
const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });

// app/api/test-sign/route.ts

// ... (keep imports the same) ...

export async function POST(req: NextRequest) {
  try {
    const privateKeyRaw = process.env.ADMIN_PRIVATE_KEY;
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

    if (!privateKeyRaw || !contractAddress) {
        return NextResponse.json({ error: "Server Config Error" }, { status: 500 });
    }

    // === FIX START: ISOLATE KEY FORMATTING AND ASSERT TYPE ===
    
    // 1. Sanitize the key string
    let privateKeyClean = privateKeyRaw.trim().replace(/"/g, '');

    // 2. Ensure '0x' prefix and assert the final type
    const privateKey = (
        privateKeyClean.startsWith('0x') ? privateKeyClean : `0x${privateKeyClean}`
    ) as `0x${string}`; // Assert final key type

    // 3. Initialize Admin Signer (Now safe)
    const adminAccount = privateKeyToAccount(privateKey);
    
    // === FIX END ===

    const { testFid, userAddress } = await req.json();

    if (!isAddress(userAddress)) {
        return NextResponse.json({ error: "Invalid Wallet Address" }, { status: 400 });
    }

    const userAddressTyped = userAddress as Address;

    // ... (rest of the logic including publicClient.readContract) ...

    // 4. Sign the Voucher
    const messageHash = keccak256(
      encodePacked(['address', 'uint256'], [userAddressTyped, BigInt(testFid)])
    );

    const signature = await adminAccount.signMessage({
        message: { raw: messageHash }
    });

    return NextResponse.json({ fid: testFid, signature });

  } catch (error) {
    console.error("Test API Error:", error);
    return NextResponse.json({ error: 'Test Signer Failed' }, { status: 401 });
  }
}