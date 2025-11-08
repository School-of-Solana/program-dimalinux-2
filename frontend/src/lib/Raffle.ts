import {
  Connection,
  PublicKey,
  SystemProgram,
  type TransactionSignature,
  clusterApiUrl,
} from "@solana/web3.js";
import { Program, AnchorProvider, utils, BN, setProvider, type Idl } from "@coral-xyz/anchor";
import idl from "../idl/raffle.json";
import type { Raffle } from "../idl/types/raffle";
import { walletStore } from "./walletStore";
import { get } from "svelte/store";
new PublicKey(idl.address);

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

export interface RaffleState {
  owner: PublicKey;
  ticketPrice: BN;
  endTime: BN;
  winner: PublicKey | null;
  maxTickets: number;
  claimed: boolean;
  entrants: PublicKey[];
}

function getProvider(): AnchorProvider {
  const wallet = get(walletStore);
  if (!wallet?.publicKey) {
    throw new Error("Wallet not connected");
  }
  const provider = new AnchorProvider(
    connection,
    get(walletStore) as any,
    AnchorProvider.defaultOptions()
  );
  setProvider(provider);
  return provider;
}

export function getRaffleProgram(): Program<Raffle> {
  // Copilot: We only support Anchor 0.31.1. Do not pass the program ID below.
  return new Program<Raffle>(idl as Idl, getProvider());
}

export async function getRaffleState(pda: PublicKey): Promise<RaffleState> {
  const program = getRaffleProgram();
  const raw: any = await (program.account as any).raffleState.fetch(pda);
  // Normalize snake_case -> camelCase if necessary
  return {
    owner: raw.owner,
    ticketPrice: raw.ticketPrice ?? raw.ticket_price,
    endTime: raw.endTime ?? raw.end_time,
    winner: raw.winner ?? null,
    maxTickets: raw.maxTickets ?? raw.max_tickets,
    claimed: raw.claimed,
    entrants: raw.entrants || [],
  };
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
    .createRaffle(ticketPrice, maxTickets, endTime)
    .accounts({
      raffleOwner: raffleOwner,
      raffleState: raffleStatePda,
      systemProgram: SystemProgram.programId,
    })
    .rpc({ commitment: "confirmed" });

  return [signature, raffleStatePda];
}

export async function buyTickets(pda: PublicKey, numberOfTickets: number) {
  const program = getRaffleProgram();
  const buyer = program.provider.publicKey!;
  return await program.methods
    .buyTickets(numberOfTickets)
    .accounts({
      buyer,
      raffleState: pda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function drawWinner(pda: PublicKey) {
  const program = getRaffleProgram();
  const raffleOwner = program.provider.publicKey!;
  return await program.methods
    .drawWinner()
    .accounts({
      raffleOwner,
      raffleState: pda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function claimPrize(pda: PublicKey) {
  const program = getRaffleProgram();
  const winner = program.provider.publicKey!;
  return await program.methods
    .claimPrize()
    .accounts({
      winner,
      raffleState: pda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export function getRaffleStateAddress(raffleOwner: PublicKey, endTime: BN, programID: PublicKey) {
  const RAFFLE_SEED = "RaffleSeed";
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode(RAFFLE_SEED),
      raffleOwner.toBuffer(),
      endTime.toArrayLike(Buffer, "le", 8),
    ],
    programID
  );
}
