import * as chai from "chai";
import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN, Program, Provider } from "@coral-xyz/anchor";
import { Randomness } from "@switchboard-xyz/on-demand";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionSignature,
  ConfirmOptions,
  TransactionInstruction,
} from "@solana/web3.js";
import { Raffle } from "../target/types/raffle";

const PROVIDER_URL: string = "https://api.devnet.solana.com";

interface RaffleConf {
  owner: Keypair;
  ticketPrice: BN;
  maxTickets: number;
  endTime: BN;
  pda: PublicKey;
  bump: number;
}
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

  it.skip("Create Raffle", async () => {
    console.error("Creating Raffle");
    const config = await createRaffle(
      new BN(0.0001 * anchor.web3.LAMPORTS_PER_SOL),
      5,
      300
    );
    console.error("Created raffle with state:", config.pda.toBase58());
    const state = await raffleState(config.pda);
    console.error("Created raffle with state:", state);
    chai.assert(state.raffleManager.equals(config.owner.publicKey));
    chai.assert(state.ticketPrice.eq(config.ticketPrice));
    chai.assert(state.maxTickets === config.maxTickets);
    chai.assert(state.winnerIndex === null);
    chai.assert(!state.drawWinnerStarted);
    chai.assert(!state.claimed);
  });

  it("Full Raffle", async () => {
    const ticketPrice = new BN(0.00001 * anchor.web3.LAMPORTS_PER_SOL);
    const config = await createRaffle(ticketPrice, 1, 120); // 5s end
    console.error("Created raffle with state:", config.pda.toBase58());

    let sig: TransactionSignature = await buyTickets(
      config.pda,
      wallet.payer,
      1
    );
    await printLogs("buyTickets", sig);

    let state: RaffleState = await raffleState(config.pda);
    chai.assert(state.maxTickets == 1);
    chai.assert(state.entrants.length == 1);
    await drawWinner(config.pda);
    console.error("drew winner started");

    // add a 3 second pause for the draw winner callback to complete
    await new Promise((resolve) => setTimeout(resolve, 6000));

    state = await raffleState(config.pda);
    console.error("Raffle state after drawing winner:", state);
    chai.assert(state.drawWinnerStarted);
    chai.assert(!state.claimed);
    chai.assert(state.winnerIndex !== null);
    chai.assert(state.entrants.length == 1);
    chai.assert(state.entrants[state.winnerIndex!].equals(wallet.publicKey));

    await claimPrize(config.pda, wallet.payer);
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
  async function raffleState(pda: PublicKey): Promise<RaffleState> {
    console.error("Fetching raffle state PDA:", pda.toBase58());
    return (await program.account.raffleState.fetch(
      pda,
      "confirmed"
    )) as RaffleState;
  }

  async function createRaffle(
    ticketPrice: BN,
    maxTickets: number,
    endDelta: number
  ): Promise<RaffleConf> {
    const now = Math.floor(Date.now() / 1000);
    const endTime = new BN(now + endDelta);
    const owner = await createFundedWallet();
    console.error("Funding raffle owner:", owner.publicKey.toBase58());
    const [pda, bump] = rafflePda(owner.publicKey, endTime);
    console.error("Raffle PDA:", pda.toBase58());
    let sig: TransactionSignature = await program.methods
      .createRaffle(ticketPrice, maxTickets, endTime)
      .accounts({
        raffleOwner: owner.publicKey,
        raffleState: pda,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc({ commitment: "confirmed" });
    await printLogs("createRaffle", sig);
    const state = await raffleState(pda);
    chai.assert(state.raffleManager.equals(owner.publicKey));
    chai.assert(state.ticketPrice.eq(ticketPrice));
    chai.assert(state.maxTickets === maxTickets);
    chai.assert(state.winnerIndex === null);

    chai.assert(!state.claimed);
    return {
      owner,
      ticketPrice,
      maxTickets,
      endTime,
      pda,
      bump,
    };
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
        systemProgram: SystemProgram.programId,
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
        systemProgram: SystemProgram.programId,
      })
      .signers([provider.wallet.payer])
      .rpc({ commitment: "confirmed" });

    await printLogs("drawWinner", sig);
  }

  async function claimPrize(raffleState: PublicKey, winner: Keypair): Promise<void> {
    console.error("claimPrize starting");

    const sig: TransactionSignature = await program.methods
        .claimPrize()
        .accounts({
          winner: winner.publicKey,
          raffleState: raffleState,
          systemProgram: SystemProgram.programId,
        })
        .signers([winner])
        .rpc({ commitment: "confirmed" });

    await printLogs("claimPrize", sig);
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
});
