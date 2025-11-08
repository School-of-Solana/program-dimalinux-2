<script lang="ts">
  import { onMount } from "svelte";
  import {
    getRaffleState,
    drawWinner,
    claimPrize,
    buyTickets,
    closeRaffle,
    type RaffleState,
  } from "../Raffle";
  import { walletStore } from "../walletStore";
  import { PublicKey } from "@solana/web3.js";
  import { navigate } from "../router";

  export let pda: string; // raffle PDA

  let loading = true;
  let error: string | null = null;
  let raffleState: RaffleState | null = null;
  let buyError: string | null = null;
  let buySig: string | null = null;
  let actionError: string | null = null;
  let actionSig: string | null = null;
  let busy = false;
  let qty = 1;

  async function load(): Promise<void> {
    loading = true;
    error = null;
    buyError = null;
    buySig = null;
    actionError = null;
    actionSig = null;
    try {
      raffleState = await getRaffleState(new PublicKey(pda));
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }
  onMount(load);

  function refreshAfterDelay(): void {
    setTimeout(load, 1200);
  }

  function safeToNumber(bn: { toNumber: () => number; toString: () => string }): number {
    try {
      return bn.toNumber();
    } catch {
      // If toNumber fails, parse as string (for very large numbers)
      return parseInt(bn.toString(), 10);
    }
  }

  async function buyClicked(): Promise<void> {
    if (!raffleState) return;
    buyError = null;
    buySig = null;
    busy = true;
    clampQty();
    try {
      const sig = await buyTickets(new PublicKey(pda), qty);
      buySig = sig;
      refreshAfterDelay();
    } catch (e: unknown) {
      buyError = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
  async function drawClicked(): Promise<void> {
    actionError = null;
    actionSig = null;
    busy = true;
    try {
      const sig = await drawWinner(new PublicKey(pda));
      actionSig = sig;
      refreshAfterDelay();
    } catch (e: unknown) {
      actionError = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
  async function claimClicked(): Promise<void> {
    actionError = null;
    actionSig = null;
    busy = true;
    try {
      const sig = await claimPrize(new PublicKey(pda));
      actionSig = sig;
      refreshAfterDelay();
    } catch (e: unknown) {
      actionError = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  async function closeClicked(): Promise<void> {
    actionError = null;
    actionSig = null;
    busy = true;
    try {
      const sig = await closeRaffle(new PublicKey(pda));
      actionSig = sig;
      // Navigate to home page since the raffle account no longer exists
      setTimeout(() => navigate("/"), 1000);
    } catch (e: unknown) {
      actionError = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  // derived
  const LAMPORTS_PER_SOL = 1_000_000_000;
  $: raffleManagerStr = raffleState?.raffleManager ? raffleState.raffleManager.toBase58() : "";
  $: userKey = $walletStore?.publicKey ? $walletStore.publicKey.toBase58() : null;
  $: isRaffleManager = !!raffleManagerStr && !!userKey && raffleManagerStr === userKey;
  $: ticketPriceLamports = raffleState ? safeToNumber(raffleState.ticketPrice) : 0;
  $: ticketPriceSol = ticketPriceLamports / LAMPORTS_PER_SOL;
  $: endTimeUnix = raffleState ? safeToNumber(raffleState.endTime) : null;
  $: ended = endTimeUnix ? Date.now() / 1000 > endTimeUnix : false;
  $: winnerStr =
    raffleState?.winnerIndex !== null && raffleState?.winnerIndex !== undefined
      ? raffleState.entrants[raffleState.winnerIndex]?.toBase58() || null
      : null;
  $: claimed = !!raffleState?.claimed;
  $: winnerDrawn = !!winnerStr;
  $: userIsWinner = !!winnerStr && !!userKey && winnerStr === userKey;
  $: ticketsSold = raffleState ? raffleState.entrants.length : 0;
  $: maxTickets = raffleState ? raffleState.maxTickets : 0;
  $: soldOut = maxTickets > 0 && ticketsSold >= maxTickets;
  $: remaining = Math.max(0, maxTickets - ticketsSold);
  $: canBuy = $walletStore.connected && !ended && !soldOut && !winnerDrawn;
  $: canDraw = !winnerDrawn && (ended || soldOut) && ticketsSold > 0;
  $: canClaim = $walletStore.connected && winnerDrawn && !claimed;
  $: isClaimingForSelf = userIsWinner;
  $: canClose = isRaffleManager && (claimed || ticketsSold === 0);
  $: totalSol = qty * ticketPriceSol || 0;

  function clampQty(): void {
    if (qty < 1) qty = 1;
    if (remaining && qty > remaining) qty = remaining;
  }
</script>

<div class="raffle-page">
  <h2>Raffle</h2>
  <div class="pda">PDA: {pda}</div>
  {#if loading}
    <p>Loading...</p>
  {:else if error}
    <p class="error">Error: {error}</p>
    <button on:click={load}>Retry</button>
  {:else if raffleState}
    <table class="raffle-info">
      <tbody>
        <tr><th>Raffle Manager</th><td>{raffleManagerStr}</td></tr>
        <tr><th>Ticket Price</th><td>{ticketPriceSol} SOL</td></tr>
        <tr><th>Max Tickets</th><td>{maxTickets}</td></tr>
        <tr><th>Sold</th><td>{ticketsSold}</td></tr>
        <tr><th>Sold Out</th><td>{soldOut ? "Yes" : "No"}</td></tr>
        <tr
          ><th>End Time</th><td
            >{endTimeUnix ? new Date(endTimeUnix * 1000).toLocaleString() : "—"}</td
          ></tr
        >
        <tr><th>Winner</th><td>{winnerStr || "—"}</td></tr>
        {#if winnerDrawn}<tr><th>Claimed</th><td>{claimed ? "Yes" : "No"}</td></tr>{/if}
      </tbody>
    </table>

    <div class="action-bar">
      {#if canBuy}
        <button class="buy-btn" on:click={buyClicked} disabled={busy || qty < 1}>Buy Tickets</button
        >
        <input class="qty" type="number" min="1" bind:value={qty} on:input={clampQty} />
        <span class="total">Total: {totalSol.toFixed(4)} SOL</span>
      {/if}
      {#if canDraw}
        <button class="draw-btn" on:click={drawClicked} disabled={busy}>Draw Winner</button>
      {/if}
      {#if canClaim}
        <button class="claim-btn" on:click={claimClicked} disabled={busy}>
          {isClaimingForSelf ? "Claim Prize" : "Facilitate Claim"}
        </button>
      {/if}
      {#if canClose}
        <button class="close-btn" on:click={closeClicked} disabled={busy}>Close Raffle</button>
      {/if}
      <button class="refresh-btn" on:click={load} disabled={busy}>Refresh</button>
    </div>

    {#if buySig}<div class="tx-line">
        Buy Tx: <a
          target="_blank"
          rel="noopener"
          href={`https://explorer.solana.com/tx/${buySig}?cluster=devnet`}>{buySig}</a
        >
      </div>{/if}
    {#if buyError}<div class="error small">{buyError}</div>{/if}
    {#if actionSig}<div class="tx-line">
        Action Tx: <a
          target="_blank"
          rel="noopener"
          href={`https://explorer.solana.com/tx/${actionSig}?cluster=devnet`}>{actionSig}</a
        >
      </div>{/if}
    {#if actionError}<div class="error small">{actionError}</div>{/if}
  {/if}
</div>

<style>
  .raffle-page {
    max-width: 760px;
    margin: 1rem auto;
  }
  h2 {
    margin: 0 0 0.5rem;
  }
  .pda {
    font-size: 0.7rem;
    word-break: break-all;
    margin-bottom: 0.5rem;
    color: #555;
  }
  .error {
    color: #c62828;
  }
  .error.small {
    font-size: 0.75rem;
  }

  /* Table styling copied from former ViewRaffle */
  table.raffle-info {
    border-collapse: collapse;
    width: 100%;
    margin-top: 0.5rem;
    margin-bottom: 1rem;
  }
  table.raffle-info th,
  table.raffle-info td {
    text-align: left;
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid #eee;
    font-weight: normal;
    background: transparent;
  }
  table.raffle-info tr:last-child th,
  table.raffle-info tr:last-child td {
    border-bottom: none;
  }

  /* Action bar & controls */
  .action-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.75rem;
  }
  .action-bar button {
    padding: 0.7rem 1.25rem;
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
  }
  .action-bar button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .qty {
    width: 90px;
    padding: 0.45rem 0.5rem;
    font-size: 0.95rem;
  }
  .total {
    font-size: 0.8rem;
  }

  .tx-line {
    font-size: 0.7rem;
    word-break: break-all;
    margin: 0.25rem 0;
  }
  a {
    color: #1565c0;
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
</style>
