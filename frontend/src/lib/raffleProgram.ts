import {
  Connection,
  PublicKey,
  type TransactionSignature,
  clusterApiUrl,
  type Cluster,
} from "@solana/web3.js";
import { Program, AnchorProvider, utils, BN, setProvider, type Idl } from "@coral-xyz/anchor";
import idl from "../idl/raffle.json";
import type { Raffle } from "../idl/types/raffle";
import { walletStore } from "./walletStore";
import { get } from "svelte/store";

export const PROGRAM_ID = new PublicKey(idl.address);

const CLUSTER: Cluster = "devnet";

const connection = new Connection(clusterApiUrl(CLUSTER), "confirmed");

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
 * Generates a Solana explorer URL for a transaction or address.
 * @param addressOrSignature - The address or transaction signature
 * @returns The block explorer URL
 */
export function explorerURL(addressOrSignature: PublicKey | TransactionSignature): string {
  const baseUrl = "https://orb.helius.dev";

  // Auto-detect: string = signature, PublicKey object = address
  const isSig = typeof addressOrSignature === "string";
  const route = isSig ? "tx" : "address";
  const value =
    typeof addressOrSignature === "string" ? addressOrSignature : addressOrSignature.toBase58();

  return `${baseUrl}/${route}/${value}?cluster=${CLUSTER}`;
}

export function addressToString(
  address: PublicKey | TransactionSignature,
  short: boolean = false
): string {
  let str = typeof address === "string" ? address : address.toBase58();
  if (short && str.length > 10) {
    str = str.slice(0, 4) + "..." + str.slice(-4);
  }
  return str;
}
