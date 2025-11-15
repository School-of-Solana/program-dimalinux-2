import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, ConfirmOptions } from "@solana/web3.js";
import {
  createFundedWallet,
  recoverFunds,
  solToLamports,
  assertAnchorError,
} from "./utils/test_utils";
import { Raffle } from "../target/types/raffle";
import { RaffleTestHelper, RaffleState } from "./utils/raffle_helper";
import { assert } from "chai";

// Due to the VRF oracle requirements, the tests must be run on devnet
// and not a local validator.
const PROVIDER_URL: string = "https://api.devnet.solana.com";

const opts: ConfirmOptions = {
  preflightCommitment: "confirmed",
  commitment: "confirmed",
  skipPreflight: false,
};

describe("raffle", () => {
  const wallet = anchor.AnchorProvider.env().wallet;
  assert.isDefined(wallet.payer);
  const walletPayer = wallet.payer;
  const connection = new Connection(PROVIDER_URL);
  const provider = new AnchorProvider(connection, wallet, opts);
  anchor.setProvider(provider);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const program = anchor.workspace.raffle as Program<Raffle>;

  const raffle = new RaffleTestHelper(program);

  it("Full Raffle Success", async () => {
    const raffleManager = await createFundedWallet(provider, 0.5);
    const alice = await createFundedWallet(provider, 0.1);
    const bob = await createFundedWallet(provider, 0.1);
    const ticketPrice = solToLamports(0.0001);
    const state: RaffleState = await raffle.create(raffleManager, ticketPrice, 5, 120);

    const pda = raffle.state2Pda(state);

    // Alice buys 2 tickets
    await raffle.buyTickets(pda, alice, 2);

    // Bob buys 3 tickets
    await raffle.buyTickets(pda, bob, 3);

    await raffle.drawWinner(pda);

    // Get the winner to claim the prize
    const raffleStateAfterDraw = await raffle.getState(pda);
    assert.isNotNull(raffleStateAfterDraw.winnerIndex);
    const winnerPubkey = raffleStateAfterDraw.entrants[raffleStateAfterDraw.winnerIndex];

    await raffle.claimPrize(pda, winnerPubkey);
    await raffle.close(pda, raffleManager);

    await recoverFunds(provider, raffleManager);
    await recoverFunds(provider, alice);
    await recoverFunds(provider, bob);
  });

  it("createRaffle negative tests", async () => {
    await assertAnchorError(
      () =>
        raffle.create(
          walletPayer,
          solToLamports(0.0001),
          10,
          -10 // delta in past
        ),
      "RaffleEndTimeInPast"
    );

    await assertAnchorError(
      () =>
        raffle.create(
          walletPayer,
          solToLamports(0.0001),
          10,
          31 * 24 * 60 * 60 // 31 days in future (exceeds 30-day limit)
        ),
      "MaxRaffleLengthExceeded"
    );

    await assertAnchorError(
      () =>
        raffle.create(
          walletPayer,
          solToLamports(0.0001),
          0, // maxTickets is zero
          120
        ),
      "MaxTicketsIsZero"
    );

    // Ticket price too low (set below 100_000 lamports)
    await assertAnchorError(
      () =>
        raffle.create(
          walletPayer,
          solToLamports(0.000099999), // 1 lamport below minimum
          2,
          120
        ),
      "TicketPriceTooLow"
    );

    await assertAnchorError(
      () =>
        raffle.create(
          walletPayer,
          new BN("18446744073709551615"), // u64::MAX
          2,
          120
        ),
      "RaffleTooLarge"
    );
  });

  it("buyTickets negative tests", async () => {
    const state = await raffle.create(walletPayer, solToLamports(0.0001), 1, 120);
    const pda = raffle.state2Pda(state);

    // Buy 2 tickets when only 1 is available
    await assertAnchorError(() => raffle.buyTickets(pda, walletPayer, 2), "InsufficientTickets");

    // Buy the last ticket to end the raffle
    await raffle.buyTickets(pda, walletPayer, 1);

    // Try to buy another ticket after raffle is full
    await assertAnchorError(() => raffle.buyTickets(pda, walletPayer, 1), "RaffleHasEnded");

    await raffle.drawWinner(pda);
    await raffle.claimPrize(pda, walletPayer.publicKey);
    await raffle.close(pda, walletPayer);
  });

  it("drawWinner negative tests", async () => {
    const state = await raffle.create(walletPayer, solToLamports(0.0001), 2, 120);
    const pda = raffle.state2Pda(state);

    // Test NoEntrants error
    await assertAnchorError(() => raffle.drawWinner(pda), "NoEntrants");

    // Buy 1 ticket, so we bypass the NoEntrants check
    await raffle.buyTickets(pda, walletPayer, 1);

    // Test RaffleNotOver error
    await assertAnchorError(() => raffle.drawWinner(pda), "RaffleNotOver");

    // Buy the 2nd ticket to end the raffle
    await raffle.buyTickets(pda, walletPayer, 1);

    // Test ConstraintAddress error with invalid oracle queue
    await assertAnchorError(
      () =>
        program.methods
          .drawWinner()
          .accounts({
            oraclePayer: provider.wallet.publicKey,
            // @ts-expect-error - raffleState is in the IDL type, but the linter isn't recognizing it
            raffleState: pda,
            oracleQueue: PublicKey.unique(), // Invalid oracle queue
          })
          .signers([walletPayer])
          .rpc({ commitment: "confirmed" }),
      "ConstraintAddress",
      "oracle_queue"
    );

    // Successful drawWinner call
    await raffle.drawWinner(pda);

    // Test WinnerAlreadyDrawn error
    await assertAnchorError(() => raffle.drawWinner(pda), "WinnerAlreadyDrawn");

    await raffle.claimPrize(pda, walletPayer.publicKey);
    await raffle.close(pda, walletPayer);
  });

  it("drawWinnerCallback negative tests", async () => {
    const state = await raffle.create(walletPayer, solToLamports(0.0001), 1, 120);
    const pda = raffle.state2Pda(state);

    // end the raffle
    await raffle.buyTickets(pda, walletPayer, 1);

    await assertAnchorError(() => raffle.drawWinnerCallback(pda), "DrawWinnerNotStarted");

    // To get past the DrawWinnerNotStarted check, we need to call drawWinner
    // call first, but we don't want a race condition with the VRF. We put
    // both instructions in a single transaction, so they'll fail together
    // and the VRF won't be called.
    const drawWinnerIx = await raffle.drawWinnerIX(pda);
    await assertAnchorError(
      () => raffle.drawWinnerCallback(pda, [drawWinnerIx]),
      "CallbackNotInvokedByVRF"
    );

    // Successful drawWinner call and callback if we get past the next line
    await raffle.drawWinner(pda);

    await assertAnchorError(() => raffle.drawWinnerCallback(pda), "CallbackAlreadyInvoked");

    // cleanup
    await raffle.claimPrize(pda, walletPayer.publicKey);
    await raffle.close(pda, walletPayer);
  });

  it("claimPrize negative tests", async () => {
    const alice = await createFundedWallet(provider, 0.1);
    const mallory = await createFundedWallet(provider, 0.1);
    const ticketPrice = solToLamports(0.0001);

    const state: RaffleState = await raffle.create(walletPayer, ticketPrice, 3, 120);

    const pda = raffle.state2Pda(state);

    // Alice buys all 3 tickets
    await raffle.buyTickets(pda, alice, 3);

    await assertAnchorError(() => raffle.claimPrize(pda, alice.publicKey), "WinnerNotYetDrawn");

    await raffle.drawWinner(pda);

    await assertAnchorError(() => raffle.claimPrize(pda, mallory.publicKey), "NotWinner");

    await raffle.claimPrize(pda, alice.publicKey);
    await raffle.close(pda, walletPayer);
    await recoverFunds(provider, alice);
    await recoverFunds(provider, mallory);
  });

  it("closeRaffle negative tests", async () => {
    const manager = await createFundedWallet(provider, 0.1);
    const notManager = await createFundedWallet(provider, 0.1);

    const state: RaffleState = await raffle.create(manager, solToLamports(0.0001), 2, 120);

    const pda = raffle.state2Pda(state);

    await assertAnchorError(
      () => raffle.close(pda, notManager),
      "OnlyRaffleManagerOrProgramOwnerCanClose"
    );

    await raffle.buyTickets(pda, notManager, 1);

    await assertAnchorError(() => raffle.close(pda, manager), "CanNotCloseActiveRaffle");

    // buy the last ticket to end the raffle
    await raffle.buyTickets(pda, notManager, 1);
    await raffle.drawWinner(pda);
    await raffle.claimPrize(pda, notManager.publicKey);
    await raffle.close(pda, manager);
    await recoverFunds(provider, manager);
    await recoverFunds(provider, notManager);
  });

  it("closeRaffle by program owner", async () => {
    const upgradeAuthority = await raffle.getProgramUpgradeAuthority();

    // Only run this test if the wallet provider is the upgrade authority
    if (!upgradeAuthority?.equals(walletPayer.publicKey)) {
      console.log("Skipping: Wallet is not the program upgrade authority");
      return;
    }

    console.log("Running: Wallet is the program upgrade authority");
    const upgradeAuthorityKeypair = walletPayer;

    const raffleManager = await createFundedWallet(provider, 0.1);
    console.log(`Raffle manager created: ${raffleManager.publicKey.toBase58()}`);

    const state: RaffleState = await raffle.create(raffleManager, solToLamports(0.0001), 2, 120);
    const pda = raffle.state2Pda(state);

    const balanceBefore = await connection.getBalance(raffleManager.publicKey, "confirmed");

    // Close the raffle with the program owner (before any tickets are sold)
    // Rent refund should still go to raffleManager
    await raffle.close(pda, upgradeAuthorityKeypair);

    const balanceAfter = await connection.getBalance(raffleManager.publicKey, "confirmed");
    console.log(
      `Rent refund: ${balanceAfter} - ${balanceBefore} = ${balanceAfter - balanceBefore} lamports`
    );

    // Verify the raffle manager's received the rent refund and not the program owner
    assert.isAbove(balanceAfter, balanceBefore);

    // Verify the raffle account was closed
    const closedAccount = await program.account.raffleState.fetchNullable(pda);
    assert.isNull(closedAccount);

    await recoverFunds(provider, raffleManager);
  });
});
