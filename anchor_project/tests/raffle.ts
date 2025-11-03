import { assert } from "chai";
import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionSignature,
  ConfirmOptions,
} from "@solana/web3.js";
import {
  createFundedWallet,
  printLogs,
  recoverFunds,
  solToLamports,
} from "./utils/test_utils";
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

  it("Full Raffle", async () => {
    const raffleManager = await createFundedWallet(provider, 0.5);
    const ticketPrice = solToLamports(0.00001);
    let state: RaffleState = await createRaffle(
      raffleManager,
      ticketPrice,
      1,
      120
    ); // 5s end

    let pda = state2Pda(state);

    await buyTickets(pda, wallet.payer, 1);
    await drawWinner(pda);
    await claimPrize(pda, wallet.payer);
    await closeRaffle(pda, raffleManager);
    await recoverFunds(provider, raffleManager);
  });

  it("Create Raffle Error: RaffleEndTimeInPast", async () => {
    const deltaToRaffleEndSecs: number = -10; // delta in past

    try {
      await createRaffle(
        provider.wallet.payer,
        solToLamports(0.00001),
        10,
        deltaToRaffleEndSecs
      );
      assert.fail("Expected createRaffle to fail with RaffleEndTimeInPast");
    } catch (err) {
      assert(err instanceof anchor.AnchorError);
      assert.equal(err.error.errorCode.code, "RaffleEndTimeInPast");
    }
  });

  it("Create Raffle Error: RaffleTooLarge", async () => {
    const ticketPrice = new BN("18446744073709551615"); // u64::MAX
    const maxTickets = 2;

    try {
      await createRaffle(
        provider.wallet.payer,
        ticketPrice,
        maxTickets,
        120
      );
      assert.fail("Expected createRaffle to fail with RaffleTooLarge");
    } catch (err) {
      assert(err instanceof anchor.AnchorError);
      assert.equal(err.error.errorCode.code, "RaffleTooLarge");
    }
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
    assert(state.raffleManager.equals(raffleOwner.publicKey));
    assert(state.ticketPrice.eq(ticketPrice));
    assert(state.maxTickets === maxTickets);
    assert(state.endTime.eq(endTime));
    assert(state.winnerIndex === null);
    assert(!state.drawWinnerStarted);
    assert(!state.claimed);
    assert(state.entrants.length === 0);

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
    assert(state.entrants.length >= numTickets);
    let start = state.entrants.length - numTickets;
    let end = state.entrants.length;
    for (let i = start; i < end; i++) {
      assert(state.entrants[i].equals(buyer.publicKey));
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
    assert(state.drawWinnerStarted);
    assert(state.winnerIndex !== null);
    assert(
      state.winnerIndex! >= 0 && state.winnerIndex! < state.entrants.length
    );

    return state;
  }

  // Listen for the `winnerDrawnEvent` on our specific raffle to
  // detect when the `drawWinnerCallback` has been executed by
  // the VRF. We log the winner and returns the transaction
  // signature of the callback transaction.
  async function waitForDrawWinnerCallback(
    raffleState: PublicKey
  ): Promise<TransactionSignature> {
    const timeoutMs = 5000;
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
        "processed"
      );
    });
  }

  async function claimPrize(
    raffleState: PublicKey,
    winner: Keypair
  ): Promise<RaffleState> {
    console.error("claimPrize starting");

    const sig: TransactionSignature = await program.methods
      .claimPrize()
      .accounts({
        winner: winner.publicKey,
        raffleState: raffleState,
      })
      .signers([winner])
      .rpc({ commitment: "confirmed" });

    await printLogs("claimPrize", connection, sig);

    let state = await getRaffleState(raffleState);
    assert(state.claimed);
    assert(state.winnerIndex !== null);
    assert(winner.publicKey.equals(state.entrants[state.winnerIndex!]));

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
