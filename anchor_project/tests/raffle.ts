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
import {
  loadSbProgram,
  loadOrCreateRandomnessAccount,
  setupQueue,
} from "./utils/randomness";

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
  owner: PublicKey;
  ticketPrice: BN;
  endTime: BN;
  winnerIndex: number | null;
  maxTickets: number;
  entrants: PublicKey[];
  randomnessAccount: PublicKey;
  commitSlot: BN;
  claimed: boolean;
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
  let queueKey: PublicKey;
  let rngKp: Keypair;
  let randomness: Randomness;

  before(async function () {
    queueKey = await setupQueue(connection.rpcEndpoint);
    const sbProgram = await loadSbProgram(provider);
    // load or create randomness account
    [randomness, rngKp] = await loadOrCreateRandomnessAccount(
      provider,
      sbProgram,
      queueKey
    );
  });

  after(async function () {
    // console.error("Closing out randomness account");
    // if (randomness && (await connection.getAccountInfo(randomness.pubkey))) {
    //   await randomness.closeIx();
    // } else {
    //   console.warn("Randomness account does not exist on-chain, skipping closeIx.");
    // }
  });

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
    chai.assert(state.owner.equals(config.owner.publicKey));
    chai.assert(state.ticketPrice.eq(config.ticketPrice));
    chai.assert(state.maxTickets === config.maxTickets);
    chai.assert(state.winnerIndex === null);
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
    await shuffleAndDrawWinner(config.pda);
    console.error("shuffled and drew winner");
    // TODO: Test claim prize
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
    chai.assert(state.owner.equals(owner.publicKey));
    chai.assert(state.ticketPrice.eq(ticketPrice));
    chai.assert(state.maxTickets === maxTickets);
    chai.assert(state.winnerIndex === null);
    //chai.assert(state.commitSlot === new BN(0));
    console.error("Commit slot:", state.commitSlot);
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

  async function shuffleAndDrawWinner(raffleState: PublicKey): Promise<void> {
    console.error("shuffleAndDrawWinner starting");

    console.error("Requesting commit instruction from randomness account");
    const commitIx = await randomness.commitIx(queueKey);
    console.error("Successfully obtained commit instruction");

    let sig: TransactionSignature = await program.methods
      .shuffleTickets()
      .accounts({
        raffleState: raffleState,
        randomnessAccount: rngKp.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([commitIx], true)
      .rpc({ commitment: "confirmed" });

    await printLogs("commitIx+shuffleTickets", sig);

    console.error("Waiting 5 seconds for oracle to respond...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.error("Requesting reveal instruction from randomness account");
    const revealIx: TransactionInstruction = await randomness.revealIx(
      provider.wallet.publicKey
    );
    console.error("Successfully obtained reveal instruction: ", revealIx);

    let sig2: TransactionSignature = await program.methods
      .drawWinner()
      .accounts({
        raffleState: raffleState,
        randomnessAccount: rngKp.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([provider.wallet.payer])
      .preInstructions([revealIx], true)
      .rpc({ commitment: "confirmed" });

    await printLogs("revealIx+drawWinner", sig2);
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
