import { assert } from "chai";
import { randomBytes } from "crypto";
import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionSignature,
  ConfirmOptions,
} from "@solana/web3.js";
import {
  createFundedWallet,
  printLogs,
  recoverFunds,
  solToLamports,
  assertAnchorError,
} from "./utils/test_utils";
import { Raffle } from "../target/types/raffle";

const PROVIDER_URL: string = "https://api.devnet.solana.com";

// const VRF_PROGRAM_IDENTITY = new PublicKey(
//   "9irBy75QS2BN81FUgXuHcjqceJJRuc9oDkAe8TKVvvAw"
// );

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

interface WinnerDrawnEvent {
  raffleState: PublicKey;
  winnerIndex: number;
  winner: PublicKey;
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
  const eventParser = new anchor.EventParser(program.programId, program.coder);

  it("Full Raffle Success", async () => {
    const raffleManager = await createFundedWallet(provider, 0.5);
    const ticketPrice = solToLamports(0.00001);
    let state: RaffleState = await createRaffle(
      raffleManager,
      ticketPrice,
      1,
      120
    );

    let pda = state2Pda(state);

    await buyTickets(pda, wallet.payer, 1);
    await drawWinner(pda);
    await claimPrize(pda, wallet.payer.publicKey);
    await closeRaffle(pda, raffleManager);
    await recoverFunds(provider, raffleManager);
  });

  it("createRaffle negative tests", async () => {
    await assertAnchorError(
      () =>
        createRaffle(
          provider.wallet.payer,
          solToLamports(0.00001),
          10,
          -10 // delta in past
        ),
      "RaffleEndTimeInPast"
    );

    await assertAnchorError(
      () =>
        createRaffle(
          provider.wallet.payer,
          solToLamports(0.00001),
          0, // maxTickets is zero
          120
        ),
      "MaxTicketsIsZero"
    );

    await assertAnchorError(
      () =>
        createRaffle(
          provider.wallet.payer,
          new BN("18446744073709551615"), // u64::MAX
          2,
          120
        ),
      "RaffleTooLarge"
    );
  });

  it("buyTickets negative tests", async () => {
    let state = await createRaffle(
      provider.wallet.payer,
      solToLamports(0.00001),
      1,
      120
    );
    let pda = state2Pda(state);

    // Buy 2 tickets when only 1 is available
    await assertAnchorError(
      () => buyTickets(pda, provider.wallet.payer, 2),
      "InsufficientTickets"
    );

    // Buy the last ticket to end the raffle
    await buyTickets(pda, provider.wallet.payer, 1);

    // Try to buy another ticket after raffle is full
    await assertAnchorError(
      () => buyTickets(pda, provider.wallet.payer, 1),
      "RaffleHasEnded"
    );

    await drawWinner(pda);
    await claimPrize(pda, wallet.payer.publicKey);
    await closeRaffle(pda, wallet.payer);
  });

  it("drawWinner negative tests", async () => {
    let state = await createRaffle(
      provider.wallet.payer,
      solToLamports(0.00001),
      2,
      120
    );
    let pda = state2Pda(state);

    // Test NoEntrants error
    await assertAnchorError(() => drawWinner(pda), "NoEntrants");

    // Buy 1 ticket, so we bypass the NoEntrants check
    await buyTickets(pda, provider.wallet.payer, 1);

    // Test RaffleNotOver error
    await assertAnchorError(() => drawWinner(pda), "RaffleNotOver");

    // Buy the 2nd ticket to end the raffle
    await buyTickets(pda, provider.wallet.payer, 1);

    // Test ConstraintAddress error with invalid oracle queue
    await assertAnchorError(
      () =>
        program.methods
          .drawWinner()
          .accounts({
            oraclePayer: provider.wallet.publicKey,
            raffleState: pda,
            oracleQueue: PublicKey.unique(), // Invalid oracle queue
          })
          .signers([provider.wallet.payer])
          .rpc({ commitment: "confirmed" }),
      "ConstraintAddress",
      "oracle_queue"
    );

    // Successful drawWinner call
    await drawWinner(pda);

    // Test WinnerAlreadyDrawn error
    await assertAnchorError(() => drawWinner(pda), "WinnerAlreadyDrawn");

    await claimPrize(pda, wallet.payer.publicKey);
    await closeRaffle(pda, wallet.payer);
  });

  it("drawWinnerCallback negative tests", async () => {
    let state = await createRaffle(
      provider.wallet.payer,
      solToLamports(0.00001),
      1,
      120
    );
    let pda = state2Pda(state);

    // end the raffle
    await buyTickets(pda, provider.wallet.payer, 1);

    await assertAnchorError(
      () => drawWinnerCallback(pda),
      "DrawWinnerNotStarted"
    );

    // To get past the DrawWinnerNotStarted check, we need to call drawWinner
    // call first, but we don't want a race condition with the VRF. We put
    // both instructions in a single transaction, so they'll fail together
    // and the VRF won't be called.
    let drawWinnerIx = await drawWinnerIX(pda);
    await assertAnchorError(
      () => drawWinnerCallback(pda, [drawWinnerIx]),
      "CallbackNotInvokedByVRF"
    );

    // Successful drawWinner call and callback if we get past the next line
    await drawWinner(pda);

    await assertAnchorError(
      () => drawWinnerCallback(pda),
      "CallbackAlreadyInvoked"
    );

    // cleanup
    await claimPrize(pda, wallet.payer.publicKey);
    await closeRaffle(pda, wallet.payer);
  });

  it("claimPrize negative tests", async () => {
    const alice = await createFundedWallet(provider, 0.1);
    const mallory = await createFundedWallet(provider, 0.1);
    const ticketPrice = solToLamports(0.00001);

    let state: RaffleState = await createRaffle(
      provider.wallet.payer,
      ticketPrice,
      3,
      120
    );

    let pda = state2Pda(state);

    // Alice buys all 3 tickets
    await buyTickets(pda, alice, 3);

    await assertAnchorError(
      () => claimPrize(pda, alice.publicKey),
      "WinnerNotYetDrawn"
    );

    await drawWinner(pda);

    await assertAnchorError(
      () => claimPrize(pda, mallory.publicKey),
      "NotWinner"
    );

    await claimPrize(pda, alice.publicKey);
    await closeRaffle(pda, provider.wallet.payer);
    await recoverFunds(provider, alice);
    await recoverFunds(provider, mallory);
  });

  it("closeRaffle negative tests", async () => {
    const manager = await createFundedWallet(provider, 0.1);
    const notManager = await createFundedWallet(provider, 0.1);

    let state: RaffleState = await createRaffle(
      manager,
      solToLamports(0.00001),
      2,
      120
    );

    let pda = state2Pda(state);

    await assertAnchorError(
      () => closeRaffle(pda, notManager),
      "OnlyRaffleManagerCanClose"
    );

    await buyTickets(pda, notManager, 1);

    await assertAnchorError(
      () => closeRaffle(pda, manager),
      "CanNotCloseActiveRaffle"
    );

    // buy the last ticket to end the raffle
    await buyTickets(pda, notManager, 1);
    await drawWinner(pda);
    await claimPrize(pda, notManager.publicKey);
    await closeRaffle(pda, manager);
    await recoverFunds(provider, manager);
    await recoverFunds(provider, notManager);
  });

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

  async function getRaffleState(pda: PublicKey): Promise<RaffleState> {
    return (await program.account.raffleState.fetch(
      pda,
      "confirmed"
    )) as RaffleState;
  }

  async function createRaffle(
    raffleOwner: Keypair,
    ticketPrice: BN,
    maxTickets: number,
    deltaToRaffleEndSecs: number
  ): Promise<RaffleState> {
    const now = Math.floor(Date.now() / 1000);
    const endTime = new BN(now + deltaToRaffleEndSecs);
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

    await printLogs("createRaffle", connection, sig);

    const state = await getRaffleState(pda);
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

  async function buyTickets(
    raffleState: PublicKey,
    buyer: Keypair,
    numTickets = 1
  ): Promise<RaffleState> {
    let sig = await program.methods
      .buyTickets(numTickets)
      .accounts({
        buyer: buyer.publicKey,
        raffleState: raffleState,
      })
      .signers([buyer])
      .rpc({ commitment: "confirmed" });

    await printLogs("buyTickets", connection, sig);

    let state = await getRaffleState(raffleState);
    assert.isAtLeast(state.entrants.length, numTickets);
    let start = state.entrants.length - numTickets;
    let end = state.entrants.length;
    for (let i = start; i < end; i++) {
      assert.isTrue(state.entrants[i].equals(buyer.publicKey));
    }

    return state;
  }

  async function drawWinner(raffleState: PublicKey): Promise<RaffleState> {
    console.log("drawWinner starting");

    // Start listening for the callback before calling drawWinner to avoid
    // missing the event.
    const callbackPromise = waitForDrawWinnerCallback(raffleState);

    const sig: TransactionSignature = await program.methods
      .drawWinner()
      .accounts({
        oraclePayer: provider.wallet.publicKey,
        raffleState: raffleState,
      })
      .signers([provider.wallet.payer])
      .rpc({ commitment: "confirmed" });

    await printLogs("drawWinner", connection, sig);

    try {
      const callbackSig = await callbackPromise;
      await printLogs("drawWinnerCallback", connection, callbackSig);
    } catch (e) {
      // If a timeout happens, we may have just missed the winnerDrawnEvent, so
      // we'll check the state directly before failing.
      console.warn(e);
    }

    let state = await getRaffleState(raffleState);
    assert.isTrue(state.drawWinnerStarted);
    assert.isNotNull(state.winnerIndex);
    assert.isTrue(
      state.winnerIndex! >= 0 && state.winnerIndex! < state.entrants.length
    );

    return state;
  }

  async function drawWinnerIX(
    raffleState: PublicKey
  ): Promise<TransactionInstruction> {
    return program.methods
      .drawWinner()
      .accounts({
        oraclePayer: provider.wallet.publicKey,
        raffleState: raffleState,
      })
      .signers([provider.wallet.payer])
      .instruction();
  }

  // This function is only for negative testing purposes. drawWinnerCallback can
  // only be executed by CPI from the VRF program. The address of the
  // vrf_program_identity is tested last in the Rust code, so all the
  // constraints are testable.
  async function drawWinnerCallback(
    raffleState: PublicKey,
    prepend_ixs: TransactionInstruction[] = []
  ): Promise<void> {
    const invalid_vrf_program_identity = provider.wallet.payer;

    await program.methods
      .drawWinnerCallback(Array.from(randomBytes(32)))
      .accounts({
        vrfProgramIdentity: invalid_vrf_program_identity.publicKey,
        raffleState: raffleState,
      })
      .signers([invalid_vrf_program_identity])
      .preInstructions(prepend_ixs)

      .rpc({ commitment: "confirmed" });

    assert.fail("drawWinnerCallback should have failed");
  }

  // Listen for the `winnerDrawnEvent` on our specific raffle to
  // detect when the `drawWinnerCallback` has been executed by
  // the VRF. We log the winner and returns the transaction
  // signature of the callback transaction.
  async function waitForDrawWinnerCallback(
    raffleState: PublicKey
  ): Promise<TransactionSignature> {
    const timeoutMs = 8000;
    let listenerId: number | null = null;

    async function cancelListener(): Promise<void> {
      if (listenerId !== null) {
        await connection.removeOnLogsListener(listenerId);
        listenerId = null;
      }
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cancelListener();
        reject(new Error("Timeout waiting for winnerDrawnEvent"));
      }, timeoutMs);

      // We have to use the more complicated connection.onLogs listener instead
      // of program.addEventListener, because the drawWinnerCallback instruction
      // is called via by from the VRF program. I'm not clear if the limitation
      // is due to CPI use or if it's because the transaction is not sent by us.
      listenerId = connection.onLogs(
        program.programId,
        (logsResult) => {
          if (logsResult.err) return;
          const events = eventParser.parseLogs(logsResult.logs, false);
          for (const event of events) {
            if (event.name === "winnerDrawnEvent") {
              const e = event.data as WinnerDrawnEvent;
              if (!raffleState.equals(e.raffleState)) continue;
              clearTimeout(timeout);
              cancelListener();
              console.log(
                `winnerDrawnEvent: index=${
                  e.winnerIndex
                } winner=${e.winner.toBase58()}`
              );
              return resolve(logsResult.signature);
            }
          }
        },
        "confirmed"
      );
    });
  }

  async function claimPrize(
    raffleState: PublicKey,
    winner: PublicKey
  ): Promise<RaffleState> {
    console.error("claimPrize starting");

    const sig: TransactionSignature = await program.methods
      .claimPrize()
      .accounts({
        winner: winner,
        raffleState: raffleState,
      })
      .rpc({ commitment: "confirmed" });

    await printLogs("claimPrize", connection, sig);

    let state = await getRaffleState(raffleState);
    assert.isTrue(state.claimed);
    assert.isNotNull(state.winnerIndex);
    assert.isTrue(winner.equals(state.entrants[state.winnerIndex!]));

    return state;
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

    await printLogs("closeRaffle", connection, sig);
  }
});
