import * as chai from "chai";
import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN, Program, Provider } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionSignature,
  ConfirmOptions,
  Commitment,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { Raffle } from "../target/types/raffle";

const PROVIDER_URL: string = "https://api.devnet.solana.com";

interface RaffleState {
  raffleManager: PublicKey;
  ticketPrice: BN;
  maxTickets: number;
  endTime: BN;
  winnerIndex: number | null;
  drawWinnerStarted: boolean;
  claimed: boolean;
  entrants: PublicKey[];
}

const opts: ConfirmOptions = {
  preflightCommitment: "confirmed",
  commitment: "confirmed",
  skipPreflight: false,
};

describe("raffle", () => {
  const wallet = anchor.AnchorProvider.env().wallet;
  const connection = new Connection(PROVIDER_URL);

  const provider = new AnchorProvider(connection, wallet, opts);
  anchor.setProvider(provider);
  const program = anchor.workspace.raffle as Program<Raffle>;
  anchor.setProvider(provider);

  it("Create Raffle", async () => {
    const raffleManager = await createFundedWallet(0.5);
    console.error("Creating Raffle");

    const state = await createRaffle(
      raffleManager,
      new BN(0.0001 * anchor.web3.LAMPORTS_PER_SOL),
      5,
      300
    );

    const [statePDA, statePDABump] = rafflePda(
      state.raffleManager,
      state.endTime
    );

    await closeRaffle(statePDA, raffleManager);
    await recoverFunds(raffleManager);
  });

  it("Full Raffle", async () => {
    const raffleManager = await createFundedWallet(0.5);
    const ticketPrice = new BN(0.00001 * anchor.web3.LAMPORTS_PER_SOL);
    let state: RaffleState = await createRaffle(
      raffleManager,
      ticketPrice,
      1,
      120
    ); // 5s end

    let pda = state2Pda(state);

    let sig: TransactionSignature = await buyTickets(pda, wallet.payer, 1);
    await printLogs("buyTickets", sig);

    state = await raffleState(pda);
    chai.assert(state.maxTickets == 1);
    chai.assert(state.entrants.length == 1);
    await drawWinner(pda);
    console.error("drew winner started");

    // add a 3 second pause for the draw winner callback to complete
    await new Promise((resolve) => setTimeout(resolve, 6000));

    state = await raffleState(pda);
    console.error("Raffle state after drawing winner:", state);
    chai.assert(state.drawWinnerStarted);
    chai.assert(!state.claimed);
    chai.assert(state.winnerIndex !== null);
    chai.assert(state.entrants.length == 1);
    chai.assert(state.entrants[state.winnerIndex!].equals(wallet.publicKey));

    await claimPrize(pda, wallet.payer);
    await closeRaffle(pda, raffleManager);
    await recoverFunds(raffleManager);
  });

  /* Helpers */
  async function createFundedWallet(amountInSOL = 0.1): Promise<Keypair> {
    const wallet = Keypair.generate();
    const amountInLamports = amountInSOL * anchor.web3.LAMPORTS_PER_SOL;
    let balance = await connection.getBalance(provider.wallet.publicKey);
    if (balance < amountInLamports) {
      throw new Error(
        `Default anchor wallet has insufficient funds ${balance} < ${amountInLamports}`
      );
    }

    let sig: TransactionSignature = await transfer(
      provider,
      wallet.publicKey,
      amountInSOL * anchor.web3.LAMPORTS_PER_SOL
    );
    await printLogs("transfer", sig);

    return wallet;
  }

  async function transfer(
    provider: Provider,
    to: PublicKey,
    amount: number
  ): Promise<TransactionSignature> {
    return await provider.sendAndConfirm(
      new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: provider.publicKey,
          toPubkey: to,
          lamports: amount, // Amount in lamports
        })
      )
    );
  }

  function rafflePda(raffleOwner: PublicKey, endTime: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("RaffleSeed"),
        raffleOwner.toBuffer(),
        endTime.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
  }

  function state2Pda(state: RaffleState): PublicKey {
    const [pda, _bump] = rafflePda(state.raffleManager, state.endTime);
    return pda;
  }

  async function raffleState(pda: PublicKey): Promise<RaffleState> {
    console.error("Fetching raffle state PDA:", pda.toBase58());
    return (await program.account.raffleState.fetch(
      pda,
      "confirmed"
    )) as RaffleState;
  }

  async function createRaffle(
    raffleOwner: Keypair,
    ticketPrice: BN,
    maxTickets: number,
    endDelta: number
  ): Promise<RaffleState> {
    const now = Math.floor(Date.now() / 1000);
    const endTime = new BN(now + endDelta);
    const [pda, bump] = rafflePda(raffleOwner.publicKey, endTime);
    console.error(`Raffle PDA: ${pda.toBase58()}, bump: ${bump}`);

    let sig: TransactionSignature = await program.methods
      .createRaffle(ticketPrice, maxTickets, endTime)
      .accounts({
        raffleOwner: raffleOwner.publicKey,
        raffleState: pda,
      })
      .signers([raffleOwner])
      .rpc({ commitment: "confirmed" });

    await printLogs("createRaffle", sig);

    const state = await raffleState(pda);
    chai.assert(state.raffleManager.equals(raffleOwner.publicKey));
    chai.assert(state.ticketPrice.eq(ticketPrice));
    chai.assert(state.maxTickets === maxTickets);
    chai.assert(state.endTime.eq(endTime));
    chai.assert(state.winnerIndex === null);
    chai.assert(!state.drawWinnerStarted);
    chai.assert(!state.claimed);
    chai.assert(state.entrants.length === 0);

    return state;
  }

  async function buyTickets(
    raffleState: PublicKey,
    buyer: Keypair,
    numTickets = 1
  ): Promise<TransactionSignature> {
    return await program.methods
      .buyTickets(numTickets)
      .accounts({
        buyer: buyer.publicKey,
        raffleState: raffleState,
      })
      .signers([buyer])
      .rpc({ commitment: "confirmed" });
  }

  async function drawWinner(raffleState: PublicKey): Promise<void> {
    console.error("drawWinner starting");

    let sig: TransactionSignature = await program.methods
      .drawWinner()
      .accounts({
        oraclePayer: provider.wallet.publicKey,
        raffleState: raffleState,
      })
      .signers([provider.wallet.payer])
      .rpc({ commitment: "confirmed" });

    await printLogs("drawWinner", sig);
  }

  async function claimPrize(
    raffleState: PublicKey,
    winner: Keypair
  ): Promise<void> {
    console.error("claimPrize starting");

    const sig: TransactionSignature = await program.methods
      .claimPrize()
      .accounts({
        winner: winner.publicKey,
        raffleState: raffleState,
      })
      .signers([winner])
      .rpc({ commitment: "confirmed" });

    await printLogs("claimPrize", sig);
  }

  async function closeRaffle(
    raffleState: PublicKey,
    raffle_manager: Keypair
  ): Promise<void> {
    console.error("closeRaffle starting");

    const sig: TransactionSignature = await program.methods
      .closeRaffle()
      .accounts({
        raffleManager: raffle_manager.publicKey,
        raffleState: raffleState,
      })
      .signers([raffle_manager])
      .rpc({ commitment: "confirmed" });

    await printLogs("closeRaffle", sig);
  }

  /**
   * Fetches and prints the program logs for a given transaction signature.
   * @param txSignature The signature returned from the .rpc() call.
   * @param instructionName The name of the instruction being called (for clarity in the output).
   */
  async function printLogs(
    instructionName: string,
    txSignature: TransactionSignature
  ) {
    const txDetails = await provider.connection.getTransaction(txSignature, {
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
  async function recoverFunds(tmpWallet: Keypair): Promise<void> {
    const connection = provider.connection;
    const destination = provider.wallet.publicKey;

    let sig = await sweepSol(connection, tmpWallet, destination);
    await printLogs("sweepSol", sig);
  }
});

/**
 * Sweeps all remaining SOL from a source wallet into a destination public key,
 * automatically calculating and deducting the transaction fee.
 * @param connection - The Solana Connection object.
 * @param fromWallet - The Keypair of the source wallet (the one to be swept).
 * @param toWallet - The PublicKey of the destination wallet.
 * @param commitment - The desired commitment level for the transaction.
 * @returns The transaction signature.
 */
async function sweepSol(
  connection: Connection,
  fromWallet: Keypair,
  toWallet: PublicKey,
  commitment: Commitment = "confirmed"
): Promise<TransactionSignature> {
  const tempWalletPublicKey = fromWallet.publicKey;

  // 1. Fetch the current balance of the temporary wallet
  const balanceInLamports = await connection.getBalance(
    tempWalletPublicKey,
    commitment
  );

  if (balanceInLamports === 0) {
    console.log(
      `🧹 Source wallet ${tempWalletPublicKey.toBase58()} has zero SOL. Nothing to sweep.`
    );
    return "N/A (Zero Balance)";
  }

  // --- FEE CALCULATION STRATEGY ---
  // 2. Create a placeholder transaction to estimate the fee.
  // The fee is based on the transaction structure (number of signatures/instructions),
  // not the amount being transferred. We use a minimal transfer (1 lamport) as a placeholder.
  const feeTransaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: tempWalletPublicKey,
      toPubkey: toWallet,
      lamports: 1, // Placeholder amount for fee calculation
    })
  );

  // Set the fee payer and recent blockhash, essential for compilation
  feeTransaction.feePayer = tempWalletPublicKey;
  feeTransaction.recentBlockhash = (
    await connection.getLatestBlockhash(commitment)
  ).blockhash;

  // 3. Compile the message and use getFeeForMessage to get the exact fee
  const message = feeTransaction.compileMessage();
  const feeResult = await connection.getFeeForMessage(message, commitment);

  if (feeResult.value === null) {
    throw new Error(
      "Failed to get fee estimate. Blockhash might be too old or invalid."
    );
  }

  const requiredFee = feeResult.value;
  console.log(
    `Transaction Fee required: ${requiredFee} lamports (${
      requiredFee / LAMPORTS_PER_SOL
    } SOL)`
  );

  // 4. Calculate the maximum sweep amount
  const sweepAmount = balanceInLamports - requiredFee;

  if (sweepAmount <= 0) {
    // This case occurs if the balance is exactly equal to or less than the fee.
    // The wallet cannot afford the transfer.
    console.error(
      `❌ Insufficient funds to cover the fee. Balance (${balanceInLamports}) < Fee (${requiredFee}). Sweep not possible.`
    );
    return "N/A (Insufficient Funds)";
  }

  console.log(`Total Balance: ${balanceInLamports} lamports`);
  console.log(
    `Sweep Amount: ${sweepAmount} lamports (${
      sweepAmount / LAMPORTS_PER_SOL
    } SOL)`
  );
  console.log(`Destination: ${toWallet.toBase58()}`);

  // --- FINAL TRANSACTION ---
  // 5. Create the final transaction with the exact sweep amount
  const finalTransaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: tempWalletPublicKey,
      toPubkey: toWallet,
      lamports: sweepAmount, // The exact calculated amount
    })
  );

  // Re-fetch the latest blockhash just before sending
  finalTransaction.recentBlockhash = (
    await connection.getLatestBlockhash(commitment)
  ).blockhash;
  finalTransaction.feePayer = tempWalletPublicKey;

  // 6. Sign and send the transaction
  const signature = await sendAndConfirmTransaction(
    connection,
    finalTransaction,
    [fromWallet], // Signer must be the temporary wallet
    { commitment: commitment }
  );

  console.log(`✅ Sweep successful!`);
  console.log(`Transaction Signature: ${signature}`);
  return signature;
}
