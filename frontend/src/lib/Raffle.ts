import {
  Connection,
  PublicKey,
  SystemProgram,
  type TransactionSignature,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  Program,
  AnchorProvider,
  utils,
  BN,
  setProvider,
  type Idl,
} from "@coral-xyz/anchor";
import idl from "../idl/raffle.json";
import type { Raffle } from "../idl/types/raffle";
import { walletStore } from "./walletStore";
import { get } from "svelte/store";

const RAFFLE_PROGRAM_ID = new PublicKey(idl.address);
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

const getProvider = () => {
  // TODO: Fix the typing of walletStore
  const provider = new AnchorProvider(
    connection,
    get(walletStore) as any,
    AnchorProvider.defaultOptions(),
  );
  setProvider(provider);
  return provider;
};

function getRaffleProgram(provider: AnchorProvider): Program<Raffle> {
  return new Program<Raffle>(idl as Idl, provider);
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
  endTime: BN,
): Promise<TransactionSignature> {
  let raffle = getRaffleProgram(getProvider());
  const raffleOwner: PublicKey = raffle.provider.publicKey!;
  console.log("raffle owner", raffleOwner.toBase58());

  const [raffleStatePda] = getRaffleStateAddress(
    raffleOwner,
    endTime,
    raffle.programId,
  );

  return await raffle.methods
    .createRaffle(ticketPrice, maxTickets, endTime)
    .accounts({
      raffleOwner: raffleOwner,
      raffleState: raffleStatePda,
      systemProgram: SystemProgram.programId,
    })
    .rpc({ commitment: "confirmed" });
}

function getRaffleStateAddress(
  raffleOwner: PublicKey,
  endTime: BN,
  programID: PublicKey,
) {
  const RAFFLE_SEED = "RaffleSeed";
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode(RAFFLE_SEED),
      raffleOwner.toBuffer(),
      endTime.toArrayLike(Buffer, "le", 8),
    ],
    programID,
  );
}
