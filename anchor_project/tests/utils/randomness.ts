import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor";
import * as sb from "@switchboard-xyz/on-demand";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const RANDOMNESS_KEYPAIR_PATH = path.join(__dirname, "randomness-keypair.json");

export async function loadSbProgram(
  provider: AnchorProvider
): Promise<Program> {
  const sbIdl: Idl = await anchor.Program.fetchIdl(
    sb.ON_DEMAND_DEVNET_PID,
    provider
  );
  return new anchor.Program(sbIdl!, provider);
}

export async function loadOrCreateRandomnessAccount(
  provider: AnchorProvider,
  sbProgram: Program,
  queue: any
): Promise<[randomness: sb.Randomness, rngKp: Keypair]> {
  if (fs.existsSync(RANDOMNESS_KEYPAIR_PATH)) {
    console.error("Loading existing randomness account...");
    const keypairData = JSON.parse(
      fs.readFileSync(RANDOMNESS_KEYPAIR_PATH, "utf8")
    );
    let rngKp: Keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
    console.error("Loaded randomness account:", rngKp.publicKey.toString());

    const randomness = new sb.Randomness(sbProgram, rngKp.publicKey);
    return [randomness, rngKp];
  }

  console.error("Creating new randomness account...");
  let rngKp = Keypair.generate();

  fs.writeFileSync(
    RANDOMNESS_KEYPAIR_PATH,
    JSON.stringify(Array.from(rngKp.secretKey))
  );
  console.error("Saved randomness keypair to", RANDOMNESS_KEYPAIR_PATH);

  const [randomness, createIx] = await sb.Randomness.create(
    sbProgram,
    rngKp,
    queue
  );
  console.error("Created randomness account:", randomness.pubkey.toString());

  if (createIx) {
    const createRandomnessTx = new Transaction().add(createIx);
    console.error("about to send tx to create randomness account");
    const sig = await provider.sendAndConfirm(createRandomnessTx, [
      provider.wallet.payer,
      rngKp,
    ]);
    console.error("transaction sig for randomness account: ", sig);
  } else {
    console.error(
      "Reusing existing randomness account:",
      randomness.pubkey.toString()
    );
  }

  return [randomness, rngKp];
}

export async function setupQueue(solanaRPCUrl: string): Promise<PublicKey> {
  const queueAccount = await sb.getDefaultQueue(solanaRPCUrl);
  console.error("Queue account", queueAccount.pubkey.toString());
  try {
    await queueAccount.loadData();
  } catch (err) {
    console.error("Queue not found:", err);
    process.exit(1);
  }
  return queueAccount.pubkey;
}
