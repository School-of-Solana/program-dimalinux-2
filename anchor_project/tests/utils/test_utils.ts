import {
    Commitment,
    Connection,
    Keypair, LAMPORTS_PER_SOL, Message,
    PublicKey, sendAndConfirmTransaction,
    SystemProgram,
    Transaction,
    TransactionSignature
} from "@solana/web3.js";
import {AnchorProvider} from "@coral-xyz/anchor";

/**
 * Fetches and prints the program logs for a given transaction signature.
 * @param instructionName The name of the instruction being called (for output clarity).
 * @param connection Solana RPC connection.
 * @param txSignature The signature to fetch logs for.
 */
export async function printLogs(
    instructionName: string,
    connection: Connection,
    txSignature: TransactionSignature
) {
    const txDetails = await connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
    });

    const logs = txDetails?.meta?.logMessages;

    console.log(`\n--- Program Logs for Instruction: ${instructionName} ---`);

    if (logs) {
        logs.forEach((log) => console.log(log));
    } else {
        console.log(`No logs found for transaction: ${txSignature}`);
    }

    console.log(`--- End Logs ---\n`);
}

/**
 * Recovers all remaining SOL from a temporary wallet back to the provider's wallet.
 * @param provider The AnchorProvider instance.
 * @param tmpWallet The temporary wallet Keypair to recover funds from.
 */
export async function recoverFunds(provider: AnchorProvider, tmpWallet: Keypair): Promise<void> {
    const connection = provider.connection;
    const destination = provider.wallet.publicKey;

    const sig = await sweepSol(connection, tmpWallet, destination);
    if (sig) {
        await printLogs("sweepSol", connection, sig);
    } else {
        console.error(
            `No sweep transaction created for ${tmpWallet.publicKey.toBase58()}`
        );
    }
}

/**
 * Sweeps all remaining SOL from a source wallet into a destination public key,
 * automatically calculating and deducting the transaction fee.
 * @param connection - The Solana Connection object.
 * @param fromWallet - The Keypair of the source wallet (the one to be swept).
 * @param toWallet - The PublicKey of the destination wallet.
 * @param commitment - The desired commitment level for the transaction.
 * @returns The transaction signature.
 */
export async function sweepSol(
    connection: Connection,
    fromWallet: Keypair,
    toWallet: PublicKey,
    commitment: Commitment = "confirmed"
): Promise<TransactionSignature | null> {
    const tempWalletPublicKey = fromWallet.publicKey;

    const balanceInLamports = await connection.getBalance(
        tempWalletPublicKey,
        commitment
    );

    if (balanceInLamports === 0) {
        console.log(
            `Wallet ${tempWalletPublicKey.toBase58()} has zero SOL. Nothing to sweep.`
        );
        return null;
    }

    // Create a placeholder transaction to estimate the fee. The fee is not
    // dependent on the amount being transferred, so we just use 1 lamport.
    const feeTransaction: Transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: tempWalletPublicKey,
            toPubkey: toWallet,
            lamports: 1, // Placeholder amount for fee calculation
        })
    );

    // Set the fee payer and recent blockhash, essential for compilation
    feeTransaction.feePayer = tempWalletPublicKey;
    let blockHashInfo = await connection.getLatestBlockhash("processed");
    feeTransaction.recentBlockhash = blockHashInfo.blockhash;

    const message: Message = feeTransaction.compileMessage();
    const feeResult = await connection.getFeeForMessage(message, "processed");

    if (feeResult.value === null) {
        throw new Error(
            "Failed to get fee estimate. Blockhash might be too old or invalid."
        );
    }

    const requiredFee = feeResult.value;

    // 4. Calculate the maximum sweep amount
    const maxSweepAmount = balanceInLamports - requiredFee;

    if (maxSweepAmount <= 0) {
        // This case occurs if the balance is exactly equal to or less than the fee.
        // The wallet cannot afford the transfer.
        console.error(
            `Insufficient funds to cover the fee. Balance (${balanceInLamports}) < Fee (${requiredFee}). Sweep not possible.`
        );
        return null;
    }

    console.log(`Total Balance: ${balanceInLamports} lamports`);
    console.log(
        `Sweep Amount: ${maxSweepAmount} lamports (${
            maxSweepAmount / LAMPORTS_PER_SOL
        } SOL)`
    );
    console.log(`Destination: ${toWallet.toBase58()}`);

    // Create the final transaction now that we know the maximum sweep amount
    const finalTransaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: tempWalletPublicKey,
            toPubkey: toWallet,
            lamports: maxSweepAmount, // The exact calculated amount
        })
    );

    // Re-fetch the latest blockhash just before sending
    blockHashInfo = await connection.getLatestBlockhash("processed");
    feeTransaction.recentBlockhash = blockHashInfo.blockhash;
    finalTransaction.feePayer = tempWalletPublicKey;

    const sig: TransactionSignature = await sendAndConfirmTransaction(
        connection,
        finalTransaction,
        [fromWallet], // Signer must be the temporary wallet
        { commitment: commitment }
    );

    console.log(
        `Swept ${maxSweepAmount / LAMPORTS_PER_SOL} SOL (fee ${
            requiredFee / LAMPORTS_PER_SOL
        } SOL) from ${fromWallet.publicKey} to ${toWallet}`
    );

    return sig;
}
