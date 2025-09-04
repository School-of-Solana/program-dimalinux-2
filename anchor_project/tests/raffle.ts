import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Raffle } from "../target/types/raffle";

interface RaffleConf {
  owner: anchor.web3.Keypair;
  ticketPrice: anchor.BN;
  maxTickets: number;
  endTime: anchor.BN;
  pda: anchor.web3.PublicKey;
  bump: number;
}

describe("raffle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.raffle as Program<Raffle>;

  it("Create Raffle", async () => {
    const ticketPrice = new anchor.BN(0.01 * anchor.web3.LAMPORTS_PER_SOL);
    const maxTickets = 100;
    const endDelta = 7 * 24 * 60 * 60; // 7 days

    const config = await createRaffle(ticketPrice, maxTickets, endDelta);

    console.log("raffle", config);
  });

  async function airdrop(connection: any, address: any, amount = 1000000000) {
    await connection.confirmTransaction(
      await connection.requestAirdrop(address, amount),
      "confirmed"
    );
  }

  function getRaffleStateAddress(
    raffleOwner: anchor.web3.PublicKey,
    endTime: anchor.BN,
    programID: anchor.web3.PublicKey
  ) {
    const RAFFLE_SEED = "RaffleSeed";
    return anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode(RAFFLE_SEED),
        raffleOwner.toBuffer(),
        endTime.toArrayLike(Buffer, "le", 8),
      ],
      programID
    );
  }

  /**
   * Creates a raffle and returns the funded raffle owner.
   * @param ticketPrice BN
   * @param maxTickets number
   * @param endDelta number (seconds from now when the raffle should end)
   */
  async function createRaffle(
    ticketPrice: anchor.BN,
    maxTickets: number,
    endDelta: number
  ): Promise<RaffleConf> {
    const now = Math.floor(Date.now() / 1000);
    const endTime = new anchor.BN(now + endDelta);

    const raffleOwner = anchor.web3.Keypair.generate();
    await airdrop(provider.connection, raffleOwner.publicKey);

    const [raffleStatePda, bump] = getRaffleStateAddress(
      raffleOwner.publicKey,
      endTime,
      program.programId
    );

    await program.methods
      .createRaffle(ticketPrice, maxTickets, endTime)
      .accounts({
        raffleOwner: raffleOwner.publicKey,
        raffleState: raffleStatePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([raffleOwner])
      .rpc({ commitment: "confirmed" });

    return {
      owner: raffleOwner,
      ticketPrice,
      maxTickets,
      endTime,
      pda: raffleStatePda,
      bump,
    };
  }
});
