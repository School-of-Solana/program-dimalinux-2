import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  ConfirmOptions,
} from "@solana/web3.js";
import {
  createFundedWallet,
  recoverFunds,
  solToLamports,
  assertAnchorError,
} from "./utils/test_utils";
import { Raffle } from "../target/types/raffle";
import {
  RaffleTestHelper,
  RaffleState,
} from "./utils/raffle_helper";
const PROVIDER_URL: string = "https://api.devnet.solana.com";

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

  const raffle = new RaffleTestHelper(program);

  it("Full Raffle Success", async () => {
    const raffleManager = await createFundedWallet(provider, 0.5);
    const ticketPrice = solToLamports(0.00001);
    let state: RaffleState = await raffle.create(
      raffleManager,
      ticketPrice,
      1,
      120
    );

    let pda = raffle.state2Pda(state);

    await raffle.buyTickets(pda, wallet.payer, 1);
    await raffle.drawWinner(pda);
    await raffle.claimPrize(pda, wallet.payer.publicKey);
    await raffle.close(pda, raffleManager);
    await recoverFunds(provider, raffleManager);
  });

  it("createRaffle negative tests", async () => {
    await assertAnchorError(
      () =>
        raffle.create(
          provider.wallet.payer,
          solToLamports(0.00001),
          10,
          -10 // delta in past
        ),
      "RaffleEndTimeInPast"
    );

    await assertAnchorError(
      () =>
        raffle.create(
          provider.wallet.payer,
          solToLamports(0.00001),
          0, // maxTickets is zero
          120
        ),
      "MaxTicketsIsZero"
    );

    await assertAnchorError(
      () =>
        raffle.create(
          provider.wallet.payer,
          new BN("18446744073709551615"), // u64::MAX
          2,
          120
        ),
      "RaffleTooLarge"
    );
  });

  it("buyTickets negative tests", async () => {
    let state = await raffle.create(
      provider.wallet.payer,
      solToLamports(0.00001),
      1,
      120
    );
    let pda = raffle.state2Pda(state);

    // Buy 2 tickets when only 1 is available
    await assertAnchorError(
      () => raffle.buyTickets(pda, provider.wallet.payer, 2),
      "InsufficientTickets"
    );

    // Buy the last ticket to end the raffle
    await raffle.buyTickets(pda, provider.wallet.payer, 1);

    // Try to buy another ticket after raffle is full
    await assertAnchorError(
      () => raffle.buyTickets(pda, provider.wallet.payer, 1),
      "RaffleHasEnded"
    );

    await raffle.drawWinner(pda);
    await raffle.claimPrize(pda, wallet.payer.publicKey);
    await raffle.close(pda, wallet.payer);
  });

  it("drawWinner negative tests", async () => {
    let state = await raffle.create(
      provider.wallet.payer,
      solToLamports(0.00001),
      2,
      120
    );
    let pda = raffle.state2Pda(state);

    // Test NoEntrants error
    await assertAnchorError(() => raffle.drawWinner(pda), "NoEntrants");

    // Buy 1 ticket, so we bypass the NoEntrants check
    await raffle.buyTickets(pda, provider.wallet.payer, 1);

    // Test RaffleNotOver error
    await assertAnchorError(() => raffle.drawWinner(pda), "RaffleNotOver");

    // Buy the 2nd ticket to end the raffle
    await raffle.buyTickets(pda, provider.wallet.payer, 1);

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
    await raffle.drawWinner(pda);

    // Test WinnerAlreadyDrawn error
    await assertAnchorError(() => raffle.drawWinner(pda), "WinnerAlreadyDrawn");

    await raffle.claimPrize(pda, wallet.payer.publicKey);
    await raffle.close(pda, wallet.payer);
  });

  it("drawWinnerCallback negative tests", async () => {
    let state = await raffle.create(
      provider.wallet.payer,
      solToLamports(0.00001),
      1,
      120
    );
    let pda = raffle.state2Pda(state);

    // end the raffle
    await raffle.buyTickets(pda, provider.wallet.payer, 1);

    await assertAnchorError(
      () => raffle.drawWinnerCallback(pda),
      "DrawWinnerNotStarted"
    );

    // To get past the DrawWinnerNotStarted check, we need to call drawWinner
    // call first, but we don't want a race condition with the VRF. We put
    // both instructions in a single transaction, so they'll fail together
    // and the VRF won't be called.
    let drawWinnerIx = await raffle.drawWinnerIX(pda);
    await assertAnchorError(
      () => raffle.drawWinnerCallback(pda, [drawWinnerIx]),
      "CallbackNotInvokedByVRF"
    );

    // Successful drawWinner call and callback if we get past the next line
    await raffle.drawWinner(pda);

    await assertAnchorError(
      () => raffle.drawWinnerCallback(pda),
      "CallbackAlreadyInvoked"
    );

    // cleanup
    await raffle.claimPrize(pda, wallet.payer.publicKey);
    await raffle.close(pda, wallet.payer);
  });

  it("claimPrize negative tests", async () => {
    const alice = await createFundedWallet(provider, 0.1);
    const mallory = await createFundedWallet(provider, 0.1);
    const ticketPrice = solToLamports(0.00001);

    let state: RaffleState = await raffle.create(
      provider.wallet.payer,
      ticketPrice,
      3,
      120
    );

    let pda = raffle.state2Pda(state);

    // Alice buys all 3 tickets
    await raffle.buyTickets(pda, alice, 3);

    await assertAnchorError(
      () => raffle.claimPrize(pda, alice.publicKey),
      "WinnerNotYetDrawn"
    );

    await raffle.drawWinner(pda);

    await assertAnchorError(
      () => raffle.claimPrize(pda, mallory.publicKey),
      "NotWinner"
    );

    await raffle.claimPrize(pda, alice.publicKey);
    await raffle.close(pda, provider.wallet.payer);
    await recoverFunds(provider, alice);
    await recoverFunds(provider, mallory);
  });

  it("closeRaffle negative tests", async () => {
    const manager = await createFundedWallet(provider, 0.1);
    const notManager = await createFundedWallet(provider, 0.1);

    let state: RaffleState = await raffle.create(
      manager,
      solToLamports(0.00001),
      2,
      120
    );

    let pda = raffle.state2Pda(state);

    await assertAnchorError(
      () => raffle.close(pda, notManager),
      "OnlyRaffleManagerCanClose"
    );

    await raffle.buyTickets(pda, notManager, 1);

    await assertAnchorError(
      () => raffle.close(pda, manager),
      "CanNotCloseActiveRaffle"
    );

    // buy the last ticket to end the raffle
    await raffle.buyTickets(pda, notManager, 1);
    await raffle.drawWinner(pda);
    await raffle.claimPrize(pda, notManager.publicKey);
    await raffle.close(pda, manager);
    await recoverFunds(provider, manager);
    await recoverFunds(provider, notManager);
  });
});
