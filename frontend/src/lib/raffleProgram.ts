import {
  type Cluster,
  clusterApiUrl,
  Connection,
  PublicKey,
  type TransactionSignature,
} from "@solana/web3.js";
import { AnchorProvider, BN, type Idl, Program, setProvider, utils } from "@coral-xyz/anchor";
import idl from "../idl/raffle.json";
import type { Raffle } from "../idl/types/raffle";
import { walletStore } from "./walletStore";
import { get } from "svelte/store";

export const MIN_TICKET_PRICE_LAMPORTS = 100_000;
export const MIN_TICKET_PRICE_SOL = MIN_TICKET_PRICE_LAMPORTS / 1_000_000_000;

export const PROGRAM_ID = new PublicKey(idl.address);

const CLUSTER: Cluster = "devnet";

const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111"
);

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

  // Check if wallet is in a ready state (not just connecting)
  if (!wallet?.publicKey || wallet.connecting) {
    throw new Error("Wallet not connected or still connecting");
  }
  if (!wallet.signTransaction) {
    throw new Error("Wallet does not support transaction signing");
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
  const provider = new AnchorProvider(connection, wallet as any, AnchorProvider.defaultOptions());
  setProvider(provider);
  return provider;
}

/**
 * Gets a read-only Raffle program instance that doesn't require a wallet.
 * Use this for fetching data from the blockchain.
 * @returns The Raffle program instance
 */
function getRaffleProgramReadOnly(): Program<Raffle> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
  const provider = new AnchorProvider(connection, {} as any, AnchorProvider.defaultOptions());
  return new Program<Raffle>(idl as Idl, provider);
}

/**
 * Gets the Raffle Anchor program instance using the current wallet provider.
 * Use this for operations that require signing (transactions).
 * @returns The Raffle program instance
 * @throws Error if wallet is not connected or doesn't support signing
 */
export function getRaffleProgram(): Program<Raffle> {
  // We only support Anchor >= 0.31.1. Some older versions pass
  // the program ID below.
  return new Program<Raffle>(idl as Idl, getProvider());
}

/**
 * Fetches the raffle state account data for a given PDA.
 * @param pda - The public key of the raffle state account
 * @returns The raffle state data
 */
export async function getRaffleState(pda: PublicKey): Promise<RaffleState> {
  const program = getRaffleProgramReadOnly();
  return (await program.account.raffleState.fetch(pda, "confirmed")) as RaffleState;
}

/**
 * Creates a new raffle owned by the wallet connected to the wallet store.
 * @param ticketPrice BN
 * @param maxTickets number
 * @param endTime BN epoch seconds when the raffle should end
 * @throws Error if a raffle with the same end time already exists for this manager
 */
export async function createRaffleOnChain(
  ticketPrice: BN,
  maxTickets: number,
  endTime: BN
): Promise<[TransactionSignature, PublicKey]> {
  const raffle = getRaffleProgram();
  const raffleOwner: PublicKey = raffle.provider.publicKey!;

  const [raffleStatePda] = getRaffleStateAddress(raffleOwner, ticketPrice, maxTickets, endTime, raffle.programId);

  // Check if a raffle with this PDA already exists
  const existingAccount = await connection.getAccountInfo(raffleStatePda);
  if (existingAccount !== null) {
    throw new Error("A raffle with this configuration already exists");
  }

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

/**
 * Buys tickets for a raffle using the connected wallet.
 * @param pda - The public key of the raffle state account
 * @param numberOfTickets - Number of tickets to purchase
 * @returns Transaction signature
 */
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

/**
 * Initiates the VRF request to draw a winner for a raffle.
 * The connected wallet pays for the VRF request.
 * @param pda - The public key of the raffle state account
 * @returns Transaction signature
 */
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

/**
 * Claims the prize for a raffle. Can be called by anyone after the winner has been drawn.
 * The prize is always sent to the correct winner as determined by the VRF.
 * @param pda - The public key of the raffle state account
 * @returns Transaction signature
 * @throws Error if winner has not been drawn or raffle state is corrupted
 */
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

/**
 * Closes a raffle and returns the remaining rent/lamports to the raffle manager.
 * Can be called by either the raffle manager or the program upgrade authority.
 * Only possible if no tickets were sold or the prize has already been claimed.
 * @param pda - The public key of the raffle state account
 * @returns Transaction signature
 */
export async function closeRaffle(pda: PublicKey): Promise<TransactionSignature> {
  const program = getRaffleProgram();
  const raffleState = await getRaffleState(pda);

  return await program.methods
    .closeRaffle()
    .accounts({
      signer: program.provider.publicKey!,
      // @ts-expect-error - raffleManager and signer are in the IDL type, but the linter isn't recognizing them
      raffleManager: raffleState.raffleManager,
      raffleState: pda,
    })
    .rpc({ commitment: "confirmed" });
}

/**
 * Derives the PDA (Program Derived Address) for a raffle state account.
 * @param raffleOwner - The public key of the raffle owner/manager
 * @param ticketPrice - The raffle ticket price as a BN (lamports)
 * @param maxTickets - Maximum number of tickets for the raffle
 * @param endTime - The raffle end time as a BN (epoch seconds)
 * @param programID - The raffle program ID
 * @returns A tuple of [PDA PublicKey, bump seed]
 */
export function getRaffleStateAddress(
  raffleOwner: PublicKey,
  ticketPrice: BN,
  maxTickets: number,
  endTime: BN,
  programID: PublicKey
): [PublicKey, number] {
  const RAFFLE_SEED = "RaffleSeed";
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode(RAFFLE_SEED),
      raffleOwner.toBuffer(),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      ticketPrice.toArrayLike(Buffer, "le", 8) as Buffer,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      new BN(maxTickets).toArrayLike(Buffer, "le", 4) as Buffer,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      endTime.toArrayLike(Buffer, "le", 8) as Buffer,
    ],
    programID
  );
}

/**
 * Fetches all raffle state PDAs from the program, sorted by end time (soonest first).
 * @returns Array of tuples containing the PDA PublicKey and the RaffleState data
 */
export async function getAllRaffles(): Promise<Array<[PublicKey, RaffleState]>> {
  const program = getRaffleProgramReadOnly();
  const accounts = await program.account.raffleState.all();
  return accounts.map((account) => [account.publicKey, account.account as RaffleState]);
}

/**
 * Converts an Anchor BN (BigNumber) to a JavaScript number.
 * @param bn - The BN value to convert
 * @returns The numeric value
 */
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
 * Gets the program's upgrade authority (program owner).
 * @returns The upgrade authority's public key, or null if none is set.
 * @throws Error if the program data account is not found.
 */
export async function getProgramUpgradeAuthority(): Promise<PublicKey | null> {
  // Derive the program data account address
  const [programDataAddress] = PublicKey.findProgramAddressSync(
    [PROGRAM_ID.toBuffer()],
    BPF_LOADER_UPGRADEABLE_PROGRAM_ID
  );

  // Fetch the program data account
  const accountInfo = await connection.getAccountInfo(programDataAddress);
  if (!accountInfo) {
    throw new Error(
      `Program data account not found at ${programDataAddress.toBase58()}. ` +
        `Is the program deployed as an upgradeable program?`
    );
  }

  // Parse the UpgradeableLoaderState
  // The upgrade authority is at bytes 13-45 (after the discriminator and slot)
  // Format: 4 bytes discriminator + 8 bytes slot + 1 byte option + 32 bytes pubkey
  const UPGRADE_AUTHORITY_OFFSET = 13;

  // Check if upgrade authority is present (option byte is 1)
  if (accountInfo.data[12] === 0) {
    return null; // No upgrade authority set
  }

  const authorityBytes = accountInfo.data.slice(
    UPGRADE_AUTHORITY_OFFSET,
    UPGRADE_AUTHORITY_OFFSET + 32
  );

  return new PublicKey(authorityBytes);
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

/**
 * Converts a PublicKey or transaction signature to both short and full base58 strings.
 * @param address - The PublicKey or transaction signature to convert
 * @returns Object with `short` (abbreviated) and `full` (complete) base58 representations
 */
export function addressToString(address: PublicKey | TransactionSignature): {
  short: string;
  full: string;
} {
  const full = typeof address === "string" ? address : address.toBase58();
  const short = full.length > 10 ? full.slice(0, 5) + "..." + full.slice(-5) : full;
  return { short, full };
}
