import { NextRequest, NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http, encodeAbiParameters, parseAbiParameters, keccak256, isAddress, Address } from 'viem'; 
import { baseSepolia } from 'viem/chains';

// Setup (using existing keys)
const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });

export async function POST(req: NextRequest) {
  try {
    let rawKey = process.env.ADMIN_PRIVATE_KEY;
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

    if (!rawKey || !contractAddress) {
        return NextResponse.json({ error: "Server Config Error" }, { status: 500 });
    }

    // 1. Sanitize the key string
    let privateKeyClean = rawKey.trim().replace(/"/g, '');

    // 2. Ensure '0x' prefix and assert the final type
    const privateKey = (
        privateKeyClean.startsWith('0x') ? privateKeyClean : `0x${privateKeyClean}`
    ) as `0x${string}`; 

    // 3. Initialize Admin Signer
    const adminAccount = privateKeyToAccount(privateKey);
    
    const { testFid, userAddress } = await req.json();

    if (!isAddress(userAddress)) {
        return NextResponse.json({ error: "Invalid Wallet Address" }, { status: 400 });
    }

    const userAddressTyped = userAddress as Address;

    // 4. Sign the Voucher
    // MUST MATCH SOLIDITY: keccak256(abi.encode(user, fid, contract, chainid))
    // We replaced your provided 'encodePacked' with 'encodeAbiParameters' to match ViralStrain.sol
    const messageHash = keccak256(
      encodeAbiParameters(
        parseAbiParameters('address, uint256, address, uint256'), 
        [
            userAddressTyped, 
            BigInt(testFid),
            contractAddress, 
            BigInt(baseSepolia.id)
        ]
      )
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