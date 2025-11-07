import * as anchor from "@coral-xyz/anchor";
import { Program, BN, EventParser } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionSignature,
} from "@solana/web3.js";
import { Raffle } from "../../target/types/raffle";
import { printLogs, vrf_random_u64 } from "./test_utils";
import { assert } from "chai";

export interface RaffleState {
  raffleManager: PublicKey;
  ticketPrice: BN;
  maxTickets: number;
  endTime: BN;
  winnerIndex: number | null;
  drawWinnerStarted: boolean;
  claimed: boolean;
  entrants: PublicKey[];
}

interface WinnerDrawnEvent {
  raffleState: PublicKey;
  winner: PublicKey;
  randomness: number[]; // Randomness from VRF (32 bytes)
}

/**
 * Helper class for testing raffle program operations. Encapsulates operations,
 * adds expected state-change asserts, and prints on-chain program logs.
 */
export class RaffleTestHelper {
  readonly program: Program<Raffle>;
  readonly connection: Connection;
  readonly eventParser: EventParser;

  constructor(program: Program<Raffle>) {
    this.program = program;
    this.connection = program.provider.connection;
    this.eventParser = new EventParser(program.programId, program.coder);
  }

  /**
   * Creates a new raffle.
   * @param raffleOwner The keypair that will own and manage the raffle.
   * @param ticketPrice Price per ticket in lamports.
   * @param maxTickets Maximum number of tickets that can be sold.
   * @param deltaToEndSecs Number of seconds from now until the raffle ends.
   * @returns The created raffle state.
   */
  async create(
    raffleOwner: Keypair,
    ticketPrice: BN,
    maxTickets: number,
    deltaToEndSecs: number
  ): Promise<RaffleState> {
    const now = Math.floor(Date.now() / 1000);
    const endTime = new BN(now + deltaToEndSecs);
    const [pda, bump] = this.pda(raffleOwner.publicKey, endTime);
    console.log(`Raffle PDA: ${pda.toBase58()}, bump: ${bump}`);

    const sig: TransactionSignature = await this.program.methods
      .createRaffle(ticketPrice, maxTickets, endTime)
      .accounts({
        raffleOwner: raffleOwner.publicKey,
        raffleState: pda,
      })
      .signers([raffleOwner])
      .rpc({ commitment: "confirmed" });

    await printLogs("createRaffle", this.connection, sig);

    const state = await this.getState(pda);
    assert.isTrue(state.raffleManager.equals(raffleOwner.publicKey));
    assert.isTrue(state.ticketPrice.eq(ticketPrice));
    assert.strictEqual(state.maxTickets, maxTickets);
    assert.isTrue(state.endTime.eq(endTime));
    assert.isNull(state.winnerIndex);
    assert.isFalse(state.drawWinnerStarted);
    assert.isFalse(state.claimed);
    assert.strictEqual(state.entrants.length, 0);

    return state;
  }

  /**
   * Buys tickets for a raffle.
   * @param raffleState The PDA of the raffle state account.
   * @param buyer The keypair buying the tickets.
   * @param numTickets Number of tickets to buy.
   * @returns The updated raffle state.
   */
  async buyTickets(raffleState: PublicKey, buyer: Keypair, numTickets = 1): Promise<RaffleState> {
    const sig = await this.program.methods
      .buyTickets(numTickets)
      .accounts({
        buyer: buyer.publicKey,
        raffleState: raffleState,
      })
      .signers([buyer])
      .rpc({ commitment: "confirmed" });

    await printLogs("buyTickets", this.connection, sig);

    const state = await this.getState(raffleState);
    assert.isAtLeast(state.entrants.length, numTickets);
    const start = state.entrants.length - numTickets;
    const end = state.entrants.length;
    for (let i = start; i < end; i++) {
      assert.isTrue(state.entrants[i].equals(buyer.publicKey));
    }

    return state;
  }

  /**
   * Draws a winner for a raffle using VRF.
   * Waits for the callback to be executed by the VRF program.
   * @param raffleState The PDA of the raffle state account.
   * @returns The updated raffle state with winner selected.
   */
  async drawWinner(raffleState: PublicKey): Promise<RaffleState> {
    console.log("drawWinner starting");

    // Start listening for the callback before calling drawWinner to avoid
    // missing the event.
    const callbackPromise = this.waitForDrawWinnerCallback(raffleState);

    const sig: TransactionSignature = await this.program.methods
      .drawWinner()
      .accounts({
        oraclePayer: this.program.provider.publicKey,
        raffleState: raffleState,
      })
      .rpc({ commitment: "confirmed" });

    await printLogs("drawWinner", this.connection, sig);

    let event: WinnerDrawnEvent | null = null;
    try {
      let callbackSig: TransactionSignature;
      [event, callbackSig] = await callbackPromise;
      await printLogs("drawWinnerCallback", this.connection, callbackSig);
    } catch (e) {
      // If a timeout happens, we may have just missed the winnerDrawnEvent, so
      // we'll check the state directly before failing.
      console.warn(e);
    }

    const state = await this.getState(raffleState);
    assert.isTrue(state.drawWinnerStarted);
    assert.isNotNull(state.winnerIndex);
    assert.isTrue(state.winnerIndex >= 0 && state.winnerIndex < state.entrants.length);
    if (event) {
      const calcIndex = vrf_random_u64(event.randomness).modn(state.entrants.length);
      assert.strictEqual(calcIndex, state.winnerIndex);
    }

    return state;
  }

  /**
   * Creates a drawWinner instruction (for testing purposes).
   * @param raffleState The PDA of the raffle state account.
   * @returns The instruction to be used in a transaction.
   */
  async drawWinnerIX(raffleState: PublicKey): Promise<TransactionInstruction> {
    return this.program.methods
      .drawWinner()
      .accounts({
        oraclePayer: this.program.provider.publicKey,
        raffleState: raffleState,
      })
      .instruction();
  }

  /**
   * Calls drawWinnerCallback directly (for negative testing only).
   * This function is only for negative testing purposes. drawWinnerCallback can
   * only be executed by CPI from the VRF program. The address of the
   * vrf_program_identity is tested last in the Rust code, so all the
   * constraints are testable.
   * @param raffleState The PDA of the raffle state account.
   * @param prepend_ixs Optional instructions to prepend to the transaction.
   */
  async drawWinnerCallback(
    raffleState: PublicKey,
    prepend_ixs: TransactionInstruction[] = []
  ): Promise<void> {
    const invalid_vrf_program_identity = this.program.provider.publicKey;

    await this.program.methods
      .drawWinnerCallback(Array.from(new Uint8Array(32)))
      .accounts({
        vrfProgramIdentity: invalid_vrf_program_identity,
        raffleState: raffleState,
      })
      .preInstructions(prepend_ixs)
      .rpc({ commitment: "confirmed" });

    assert.fail("drawWinnerCallback should have failed");
  }

  /**
   * Listens for the winnerDrawnEvent to detect when drawWinnerCallback has been executed.
   * @param raffleState The PDA of the raffle state account.
   * @returns Promise that resolves with the callback transaction signature.
   */
  private async waitForDrawWinnerCallback(
    raffleState: PublicKey
  ): Promise<[WinnerDrawnEvent, TransactionSignature]> {
    const timeoutMs = 8000;
    let listenerId: number | null = null;

    async function cancelListener(connection: Connection): Promise<void> {
      if (listenerId !== null) {
        await connection.removeOnLogsListener(listenerId);
        listenerId = null;
      }
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        void cancelListener(this.connection);
        reject(new Error("Timeout waiting for winnerDrawnEvent"));
      }, timeoutMs);

      // We have to use the more complicated connection.onLogs listener instead
      // of program.addEventListener, because the drawWinnerCallback instruction
      // is called via CPI from the VRF program. I'm not clear if the limitation
      // is due to CPI use or if it's because the transaction is not sent by us.
      listenerId = this.connection.onLogs(
        this.program.programId,
        (logsResult) => {
          if (logsResult.err) {
            return;
          }
          const events = this.eventParser.parseLogs(logsResult.logs, false);
          for (const event of events) {
            if (event.name === "winnerDrawnEvent") {
              const e = event.data as WinnerDrawnEvent;
              if (!raffleState.equals(e.raffleState)) {
                continue;
              }
              clearTimeout(timeout);
              void cancelListener(this.connection);
              console.log(
                `winnerDrawnEvent:\n  tx: ${
                  logsResult.signature
                }\n  pda: ${e.raffleState.toBase58()}\n  winner: ${e.winner.toBase58()}\n  randomness: 0x${Buffer.from(
                  e.randomness
                ).toString("hex")}`
              );
              return resolve([e, logsResult.signature]);
            }
          }
        },
        "confirmed"
      );
    });
  }

  /**
   * Claims the prize for a winning raffle ticket.
   * @param raffleState The PDA of the raffle state account.
   * @param winner The public key of the winner.
   * @returns The updated raffle state.
   */
  async claimPrize(raffleState: PublicKey, winner: PublicKey): Promise<RaffleState> {
    console.log("claimPrize starting");

    const sig: TransactionSignature = await this.program.methods
      .claimPrize()
      .accounts({
        winner: winner,
        raffleState: raffleState,
      })
      .rpc({ commitment: "confirmed" });

    await printLogs("claimPrize", this.connection, sig);

    const state = await this.getState(raffleState);
    assert.isTrue(state.claimed);
    assert.isNotNull(state.winnerIndex);
    assert.isTrue(winner.equals(state.entrants[state.winnerIndex]));

    return state;
  }

  /**
   * Closes a raffle and returns the rent to the manager.
   * @param raffleState The PDA of the raffle state account.
   * @param raffleManager The keypair of the raffle manager.
   */
  async close(raffleState: PublicKey, raffleManager: Keypair): Promise<void> {
    console.log("closeRaffle starting");

    const sig: TransactionSignature = await this.program.methods
      .closeRaffle()
      .accounts({
        raffleManager: raffleManager.publicKey,
        raffleState: raffleState,
      })
      .signers([raffleManager])
      .rpc({ commitment: "confirmed" });

    await printLogs("closeRaffle", this.connection, sig);
  }

  /**
   * Derives the PDA for a raffle state account.
   */
  pda(raffleOwner: PublicKey, endTime: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("RaffleSeed"),
        raffleOwner.toBuffer(),
        endTime.toArrayLike(Buffer, "le", 8),
      ],
      this.program.programId
    );
  }

  /**
   * Converts a RaffleState to its PDA address.
   */
  state2Pda(state: RaffleState): PublicKey {
    const [pda, _bump] = this.pda(state.raffleManager, state.endTime);
    return pda;
  }

  /**
   * Fetches the current state of a raffle account.
   */
  async getState(pda: PublicKey): Promise<RaffleState> {
    return (await this.program.account.raffleState.fetch(pda, "confirmed")) as RaffleState;
  }
}
