<script lang="ts">
  import { onMount } from "svelte";
  import { getRaffleState, buyTickets, type RaffleState } from "../Raffle";
  import { walletStore } from "../walletStore"; // (walletStore imported earlier but unused; keep if needed later)
  import { PublicKey } from "@solana/web3.js";

  export let pda: string;

  let loading = true;
  let error: string | null = null;
  let raffleState: RaffleState | null = null; // allow null until loaded
  let qty = 1;
  let txSig: string | null = null;
  let actionError: string | null = null;
  let busy = false;

  async function load() {
    loading = true;
    error = null;
    txSig = null;
    actionError = null;
    try {
      raffleState = await getRaffleState(new PublicKey(pda));
    } catch (e: any) {
      error = e.message || String(e);
    } finally {
      loading = false;
    }
  }

  onMount(load);

  const LAMPORTS_PER_SOL = 1_000_000_000;
  // Derived reactive values using camelCase fields from normalized RaffleState
  $: ticketPriceLamports = raffleState ? raffleState.ticketPrice.toNumber() : 0;
  $: ticketPriceSol = ticketPriceLamports / LAMPORTS_PER_SOL;
  $: entrants = raffleState ? raffleState.entrants : [];
  $: maxTickets = raffleState ? raffleState.maxTickets : 0;
  $: remaining = maxTickets ? maxTickets - entrants.length : 0;
  $: endTimeUnix = raffleState ? raffleState.endTime.toNumber() : null;
  $: ended = endTimeUnix ? Date.now() / 1000 > endTimeUnix : false;
  $: totalCostLamports = qty * ticketPriceLamports;
  $: totalCostSol = totalCostLamports / LAMPORTS_PER_SOL;

  function clampQty() {
    if (qty < 1) qty = 1;
    else if (remaining && qty > remaining) qty = remaining;
    else if (!remaining && qty > 1_000_000) qty = 1_000_000; // guard
  }

  async function purchase() {
    clampQty();
    actionError = null;
    txSig = null;
    busy = true;
    try {
      const sig = await buyTickets(new PublicKey(pda), qty);
      txSig = sig;
      // refresh shortly after purchase to reflect updated entrants
      setTimeout(load, 1200);
    } catch (e: any) {
      actionError = e.message || String(e);
    } finally {
      busy = false;
    }
  }
</script>

<div class="buy-tickets">
  <h2>Buy Tickets</h2>
  <div class="pda">PDA: {pda}</div>
  {#if loading}
    <p>Loading...</p>
  {:else if error}
    <p class="error">Error: {error}</p>
    <button on:click={load}>Retry</button>
  {:else}
    <div class="summary">
      <p>
        <strong>Ticket Price:</strong>
        {ticketPriceSol} SOL
      </p>
      <p><strong>Sold:</strong> {entrants.length} / {maxTickets}</p>
      <p><strong>Remaining:</strong> {remaining}</p>
      <p>
        <strong>Ends:</strong>
        {endTimeUnix ? new Date(endTimeUnix * 1000).toLocaleString() : "—"}
        {ended ? "(Ended)" : ""}
      </p>
    </div>

    <div class="purchase-panel">
      <label for="qty">Quantity</label>
      <input
        id="qty"
        type="number"
        min="1"
        bind:value={qty}
        on:input={clampQty}
        disabled={busy || ended || remaining === 0}
      />
      <div class="cost">Total: {totalCostSol} SOL</div>
      <button
        on:click={purchase}
        disabled={busy || ended || remaining === 0 || qty < 1}>Buy</button
      >
    </div>

    {#if txSig}
      <div class="tx-sig">
        Tx: <a
          target="_blank"
          rel="noopener"
          href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
          >{txSig}</a
        >
      </div>
    {/if}
    {#if actionError}
      <div class="action-error">{actionError}</div>
    {/if}
  {/if}
</div>

<style>
  .buy-tickets {
    max-width: 520px;
    margin: 1rem auto;
  }
  .pda {
    font-size: 0.75rem;
    word-break: break-all;
    margin-bottom: 0.75rem;
  }
  .error,
  .action-error {
    color: #c00;
    margin-top: 0.5rem;
  }
  .summary p {
    margin: 0.25rem 0;
  }
  .purchase-panel {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    max-width: 260px;
  }
  .purchase-panel input {
    padding: 0.4rem;
  }
  .purchase-panel button {
    padding: 0.55rem 0.9rem;
  }
  .tx-sig {
    font-size: 0.7rem;
    word-break: break-all;
    margin-top: 0.6rem;
  }
  .cost {
    font-size: 0.85rem;
    color: #444;
  }
</style>
