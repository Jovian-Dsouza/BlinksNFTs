import { Program } from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { useEffect, useMemo } from "react";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";

import { IDL, AnchorMarketplace, programId } from "@/contracts/anchor_marketplace";

import { SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useAnchorWallet, useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { web3 } from "@coral-xyz/anchor";

export function useAnchorMarketplaceProgram() {
  const {
    publicKey: walletPublicKey,
    signTransaction,
    sendTransaction,
  } = useWallet();
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const provider = useMemo(() => {
    if (wallet) {
      return new anchor.AnchorProvider(connection, wallet, {
        preflightCommitment: "processed",
      });
    }
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) {
      return null;
    }
    return new Program<AnchorMarketplace>(IDL, programId, provider);
  }, [provider]);

  async function processAndSend(
    instruction: anchor.web3.TransactionInstruction,
  ) {
    const txn = new Transaction().add(instruction);
    txn.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    txn.feePayer = walletPublicKey!;

    const signedTransaction = await signTransaction!(txn);
    const txid = await connection.sendRawTransaction(
      signedTransaction.serialize(),
    );
    await connection.confirmTransaction(txid);

    // Provide Solscan link
    console.log(`View transaction on Solscan: https://solscan.io/tx/${txid}`);
  }

  const value = useMemo(
    () => ({
      program,
    }),
    [program],
  );

  return value;
}
