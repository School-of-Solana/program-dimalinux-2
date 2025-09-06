import * as chai from "chai";
import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  Keypair,
  Connection,
  PublicKey,
  SystemProgram,
  TransactionSignature,
} from "@solana/web3.js";
import { Raffle } from "../target/types/raffle";

interface RaffleConf {
  owner: Keypair;
  ticketPrice: anchor.BN;
  maxTickets: number;
  endTime: anchor.BN;
  pda: PublicKey;
  bump: number;
}

interface RaffleState {
  owner: PublicKey;
  ticketPrice: BN;
  endTime: BN;
  winner: PublicKey | null;
  maxTickets: number;
  claimed: boolean;
  entrants: PublicKey[];
}

describe("raffle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.raffle as Program<Raffle>;

  it("Create Raffle", async () => {
    const ticketPrice = new anchor.BN(0.01 * anchor.web3.LAMPORTS_PER_SOL);
    const maxTickets = 100;
    const endDelta = 7 * 24 * 60 * 60; // 7 days

    const config = await createRaffle(ticketPrice, maxTickets, endDelta);
    let state = await raffleState(config.pda);

    chai.assert(state.owner.equals(config.owner.publicKey));
    chai.assert(state.ticketPrice.eq(ticketPrice));
    chai.assert(state.endTime.eq(config.endTime));
    chai.assert(state.maxTickets === maxTickets);
    chai.assert(state.winner === null);
    chai.assert(state.claimed === false);
    chai.assert(state.entrants.length === 0);
  });

  it("Buy tickets", async () => {
    const ticketPrice = new anchor.BN(0.01 * anchor.web3.LAMPORTS_PER_SOL);
    const maxTickets = 10;
    const endDelta = 24 * 60 * 60; // 1 days

    const config = await createRaffle(ticketPrice, maxTickets, endDelta);
    let buyer1 = await createFundedWallet();
    let buyer2 = await createFundedWallet();

    await buyTickets(config.pda, buyer1, 2);
    await buyTickets(config.pda, buyer2, 1);

    let state = await raffleState(config.pda);
    chai.assert(state.entrants.length === 3);
    chai.assert(state.entrants[0].equals(buyer1.publicKey));
    chai.assert(state.entrants[1].equals(buyer1.publicKey));
    chai.assert(state.entrants[2].equals(buyer2.publicKey));
  });

  it("Draw winner", async () => {
    const ticketPrice = new anchor.BN(0.00001 * anchor.web3.LAMPORTS_PER_SOL);
    const maxTickets = 2;
    const endDelta = 10; // 10 seconds from now

    const config = await createRaffle(ticketPrice, maxTickets, endDelta);
    let buyer1 = await createFundedWallet();
    let buyer2 = await createFundedWallet();

    await buyTickets(config.pda, buyer1, 1);
    await buyTickets(config.pda, buyer2, 1);

    const stateBefore: RaffleState = await raffleState(config.pda);
    await drawWinner(config.pda, config.owner);
    const stateAfter: RaffleState = await raffleState(config.pda);

    chai.assert(stateBefore.winner === null);
    chai.assert(stateAfter.winner !== null);

    if (stateAfter.winner.equals(buyer1.publicKey)) {
      console.log("Buyer 1 is the winner!");
    } else if (stateAfter.winner.equals(buyer2.publicKey)) {
      console.log("Buyer 2 is the winner!");
    } else {
      throw new Error("Winner is neither buyer 1 nor buyer 2!");
    }
  });

  async function createFundedWallet(
    amountInSOL: number = 0.1
  ): Promise<Keypair> {
    const wallet: Keypair = anchor.web3.Keypair.generate();
    const lamports: number = amountInSOL * anchor.web3.LAMPORTS_PER_SOL;
    let connection: Connection = provider.connection;
    const signature: TransactionSignature = await connection.requestAirdrop(
      wallet.publicKey,
      lamports
    );
    const latestBlockhash = await connection.getLatestBlockhash();

    await connection.confirmTransaction(
      {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      "confirmed"
    );

    return wallet;
  }

  function getRaffleStateAddress(
    raffleOwner: anchor.web3.PublicKey,
    endTime: anchor.BN,
    programID: anchor.web3.PublicKey
  ) {
    const RAFFLE_SEED = "RaffleSeed";
    return anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode(RAFFLE_SEED),
        raffleOwner.toBuffer(),
        endTime.toArrayLike(Buffer, "le", 8),
      ],
      programID
    );
  }

  async function raffleState(pda: PublicKey): Promise<RaffleState> {
    return (await program.account.raffleState.fetch(pda)) as RaffleState;
  }

  /**
   * Creates a raffle and returns the funded raffle owner.
   * @param ticketPrice BN
   * @param maxTickets number
   * @param endDelta number (seconds from now when the raffle should end)
   */
  async function createRaffle(
    ticketPrice: anchor.BN,
    maxTickets: number,
    endDelta: number
  ): Promise<RaffleConf> {
    const now = Math.floor(Date.now() / 1000);
    const endTime = new anchor.BN(now + endDelta);

    const raffleOwner: Keypair = await createFundedWallet();

    const [raffleStatePda, bump] = getRaffleStateAddress(
      raffleOwner.publicKey,
      endTime,
      program.programId
    );

    await program.methods
      .createRaffle(ticketPrice, maxTickets, endTime)
      .accounts({
        raffleOwner: raffleOwner.publicKey,
        raffleState: raffleStatePda,
        systemProgram: SystemProgram.programId,
      })
      .signers([raffleOwner])
      .rpc({ commitment: "confirmed" });

    return {
      owner: raffleOwner,
      ticketPrice,
      maxTickets,
      endTime,
      pda: raffleStatePda,
      bump,
    };
  }

  async function buyTickets(
    raffleState: PublicKey,
    buyer: Keypair,
    numTickets: number = 1
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

  async function drawWinner(
    raffleState: PublicKey,
    owner: Keypair
  ): Promise<TransactionSignature> {
    return await program.methods
      .drawWinner()
      .accounts({
        raffleOwner: owner.publicKey,
        raffleState: raffleState,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc({ commitment: "confirmed" });
  }
});
