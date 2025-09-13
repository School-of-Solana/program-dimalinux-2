<script lang="ts">
  import { onMount } from "svelte";
  import { getRaffleState, type RaffleState } from "../Raffle";
  import { walletStore } from "../walletStore";
  import { PublicKey } from "@solana/web3.js";

  // Accept PDA as string from router
  export let pda: string;

  let pdaKey: PublicKey | null = null;
  let loading = true;
  let error: string | null = null;
  let raffleState: RaffleState | null = null;

  const LAMPORTS_PER_SOL = 1_000_000_000;

  async function load() {
    if (!pda) return;
    loading = true;
    error = null;
    raffleState = null;
    try {
      pdaKey = new PublicKey(pda);
      raffleState = await getRaffleState(pdaKey);
      console.log("Raffle state:", raffleState);
    } catch (e: any) {
      error = e.message || String(e);
    } finally {
      loading = false;
    }
  }

  onMount(load);
  $: if (pda) {
    /* reactive reload if route pda changes */
  }

  // Derived display helpers
  $: ownerStr = raffleState?.owner ? raffleState.owner.toBase58() : "";
  $: userKey = $walletStore?.publicKey
    ? $walletStore.publicKey.toBase58()
    : null;
  $: isOwner = !!ownerStr && !!userKey && ownerStr === userKey;

  $: ticketPriceLamports = raffleState?.ticketPrice
    ? raffleState.ticketPrice.toNumber()
    : 0;
  $: ticketPriceSol = ticketPriceLamports / LAMPORTS_PER_SOL;

  $: endTimeUnix = raffleState?.endTime ? raffleState.endTime.toNumber() : null;
  $: endTimeLocal = endTimeUnix
    ? new Date(endTimeUnix * 1000).toLocaleString()
    : "—";

  $: winnerStr = raffleState?.winner ? raffleState.winner.toBase58() : "—";
  $: entrants = raffleState?.entrants || [];
  $: timeZoneId = Intl.DateTimeFormat().resolvedOptions().timeZone;
</script>

<div class="view-raffle">
  <h2>Raffle</h2>
  <div class="pda">PDA: {pda}</div>
  {#if loading}
    <p>Loading...</p>
  {:else if error}
    <p class="error">Error: {error}</p>
    <button on:click={load}>Retry</button>
  {:else if raffleState}
    <table>
      <tbody>
        <tr><th>Owner</th><td>{ownerStr}</td></tr>
        <tr><th>Ticket Price</th><td>{ticketPriceSol} SOL</td></tr>
        <tr><th>Max Tickets</th><td>{raffleState.maxTickets}</td></tr>
        <tr><th>Sold</th><td>{entrants.length}</td></tr>
        <tr
          ><th>End Time</th><td
            >{endTimeLocal}{#if timeZoneId}
              ({timeZoneId}){/if}</td
          ></tr
        >
        <tr><th>Winner</th><td>{winnerStr}</td></tr>
        {#if winnerStr !== "—"}
          <tr><th>Claimed</th><td>{raffleState.claimed ? "Yes" : "No"}</td></tr>
        {/if}
      </tbody>
    </table>
    <div class="nav-links">
      {#if pdaKey}<a href={`#/buy/${pdaKey.toBase58()}`}>Buy Tickets</a>{/if}
      {#if isOwner && pdaKey}<a href={`#/manage/${pdaKey.toBase58()}`}>Manage</a
        >{/if}
    </div>
    <div class="entrants">
      <h3>Entrants ({entrants.length})</h3>
      {#if entrants.length === 0}
        <p>No tickets sold yet.</p>
      {:else}
        <ul>
          {#each entrants as e}
            <li>{e.toBase58()}</li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>

<style>
  .view-raffle {
    max-width: 640px;
    margin: 1rem auto;
  }
  .view-raffle .pda {
    font-size: 0.8rem;
    word-break: break-all;
    margin-bottom: 0.75rem;
  }
  .error {
    color: #c00;
  }
  .nav-links {
    display: flex;
    gap: 1rem;
    margin: 0.75rem 0 1rem;
  }
  .nav-links a {
    text-decoration: none;
    padding: 0.35rem 0.6rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  .nav-links a:hover {
    background: #f5f5f5;
  }
  .view-raffle table {
    border-collapse: collapse;
    width: 100%;
    margin-top: 0.5rem;
  }
  .view-raffle th,
  .view-raffle td {
    text-align: left;
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid #eee;
    font-weight: normal;
  }
  .entrants ul {
    list-style: monospace;
    padding-left: 1rem;
    max-height: 220px;
    overflow: auto;
  }
</style>
