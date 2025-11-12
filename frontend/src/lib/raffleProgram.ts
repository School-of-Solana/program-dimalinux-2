import { Connection, PublicKey, type TransactionSignature, clusterApiUrl } from "@solana/web3.js";
import { Program, AnchorProvider, utils, BN, setProvider, type Idl } from "@coral-xyz/anchor";
import idl from "../idl/raffle.json";
import type { Raffle } from "../idl/types/raffle";
import { walletStore } from "./walletStore";
import { get } from "svelte/store";
new PublicKey(idl.address);

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

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

function getProvider(): AnchorProvider {
  const wallet = get(walletStore);
  if (!wallet?.publicKey) {
    throw new Error("Wallet not connected");
  }
  if (!wallet.signTransaction) {
    throw new Error("Wallet does not support transaction signing");
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
  const provider = new AnchorProvider(connection, wallet as any, AnchorProvider.defaultOptions());
  setProvider(provider);
  return provider;
}

export function getRaffleProgram(): Program<Raffle> {
  // We only support Anchor >= 0.31.1. Some older versions pass
  // the program ID below.
  return new Program<Raffle>(idl as Idl, getProvider());
}

export async function getRaffleState(pda: PublicKey): Promise<RaffleState> {
  const program = getRaffleProgram();
  return (await program.account.raffleState.fetch(pda, "confirmed")) as RaffleState;
}

/**
 * Creates a new raffle owned by the wallet connected to the wallet store.
 * @param ticketPrice BN
 * @param maxTickets number
 * @param endTime BN epoch seconds when the raffle should end
 */
export async function createRaffleOnChain(
  ticketPrice: BN,
  maxTickets: number,
  endTime: BN
): Promise<[TransactionSignature, PublicKey]> {
  const raffle = getRaffleProgram();
  const raffleOwner: PublicKey = raffle.provider.publicKey!;

  const [raffleStatePda] = getRaffleStateAddress(raffleOwner, endTime, raffle.programId);

  const signature: TransactionSignature = await raffle.methods
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    .createRaffle(ticketPrice, maxTickets, endTime)
    .accounts({
      raffleOwner: raffleOwner,
      // @ts-expect-error - raffleState is in the IDL type, but the linter isn't recognizing it
      raffleState: raffleStatePda,
    })
    .rpc({ commitment: "confirmed" });

  return [signature, raffleStatePda];
}

export async function buyTickets(
  pda: PublicKey,
  numberOfTickets: number
): Promise<TransactionSignature> {
  const program = getRaffleProgram();
  const buyer = program.provider.publicKey!;
  return await program.methods
    .buyTickets(numberOfTickets)
    .accounts({
      buyer,
      // @ts-expect-error - raffleState is in the IDL type, but the linter isn't recognizing it
      raffleState: pda,
    })
    .rpc({ commitment: "confirmed" });
}

export async function drawWinner(pda: PublicKey): Promise<TransactionSignature> {
  const program = getRaffleProgram();
  const oraclePayer = program.provider.publicKey!;
  return await program.methods
    .drawWinner()
    .accounts({
      oraclePayer,
      // @ts-expect-error - raffleState is in the IDL type, but the linter isn't recognizing it
      raffleState: pda,
    })
    .rpc({ commitment: "confirmed" });
}

export async function claimPrize(pda: PublicKey): Promise<TransactionSignature> {
  const program = getRaffleProgram();

  const raffleState = await getRaffleState(pda);
  if (raffleState.winnerIndex === null || raffleState.winnerIndex === undefined) {
    throw new Error("Winner has not been drawn yet");
  }

  const winner = raffleState.entrants[raffleState.winnerIndex];
  if (!winner) {
    throw new Error("Winner unknown (corrupted raffle state?)");
  }

  return await program.methods
    .claimPrize()
    .accounts({
      winner,
      // @ts-expect-error - raffleState is in the IDL type, but the linter isn't recognizing it
      raffleState: pda,
    })
    .rpc({ commitment: "confirmed" });
}

export async function closeRaffle(pda: PublicKey): Promise<TransactionSignature> {
  const program = getRaffleProgram();
  const raffleManager = program.provider.publicKey!;
  return await program.methods
    .closeRaffle()
    .accounts({
      raffleManager,
      raffleState: pda,
    })
    .rpc({ commitment: "confirmed" });
}

export function getRaffleStateAddress(
  raffleOwner: PublicKey,
  endTime: BN,
  programID: PublicKey
): [PublicKey, number] {
  const RAFFLE_SEED = "RaffleSeed";
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode(RAFFLE_SEED),
      raffleOwner.toBuffer(),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      endTime.toArrayLike(Buffer, "le", 8) as Buffer,
    ],
    programID
  );
}

/**
 * Fetches all raffle state accounts from the program.
 * @returns Array of tuples containing the PDA PublicKey and the RaffleState data
 */
export async function getAllRaffles(): Promise<Array<[PublicKey, RaffleState]>> {
  const program = getRaffleProgram();
  const accounts = await program.account.raffleState.all();
  return accounts.map((account) => [account.publicKey, account.account as RaffleState]);
}

export function bnToNumber(bn: BN): number {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return bn.toNumber();
  } catch {
    // If toNumber fails, parse as string (for very large numbers)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    return parseInt(bn.toString(), 10);
  }
}

/**
 * Contains both the display text and CSS class for a raffle status.
 */
export interface StatusInfo {
  /** Human-readable display text */
  readonly display: string;
  /** CSS-class-friendly identifier */
  readonly cssClass: string;
}

/**
 * Represents the various states a raffle can be in.
 * Each status contains both display text and a CSS class name.
 */
export const RaffleStatus = {
  Active: { display: "Active", cssClass: "active" } as StatusInfo,
  ReadyToDraw: { display: "Ready to Draw", cssClass: "ready-to-draw" } as StatusInfo,
  Drawing: { display: "Drawing...", cssClass: "drawing" } as StatusInfo,
  AwaitingClaim: { display: "Awaiting Claim", cssClass: "awaiting-claim" } as StatusInfo,
  Claimed: { display: "Claimed", cssClass: "claimed" } as StatusInfo,
  EntriesClosed: { display: "Entries Closed", cssClass: "entries-closed" } as StatusInfo,
} as const;

/**
 * Determines the current status of a raffle based on its state.
 * @param state - The raffle state from the blockchain
 * @returns StatusInfo containing display text and CSS class
 */
export function getRaffleStatus(state: RaffleState): StatusInfo {
  const now = Date.now() / 1000;
  const endTime = bnToNumber(state.endTime);
  const isOver = state.entrants.length >= state.maxTickets || now >= endTime;

  if (!isOver) {
    return RaffleStatus.Active;
  }

  // Raffle is over - check final states
  const winnerDrawn = state.winnerIndex !== null && state.winnerIndex !== undefined;

  if (winnerDrawn) {
    return state.claimed ? RaffleStatus.Claimed : RaffleStatus.AwaitingClaim;
  }

  // Raffle is over, but there are no contestants
  if (state.entrants.length === 0) {
    return RaffleStatus.EntriesClosed;
  }

  return state.drawWinnerStarted ? RaffleStatus.Drawing : RaffleStatus.ReadyToDraw;
}
