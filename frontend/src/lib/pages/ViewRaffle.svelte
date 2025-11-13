<script lang="ts">
  import { onMount } from "svelte";
  import {
    buyTickets,
    claimPrize,
    closeRaffle,
    drawWinner,
    getRaffleState,
    bnToNumber,
    type RaffleState,
  } from "../raffleProgram";
  import { getRaffleStatus, RaffleStatus } from "../raffleStatus";
  import { walletStore } from "../walletStore";
  import { PublicKey } from "@solana/web3.js";
  import { navigate } from "../router";
  import ExplorerLink from "../components/ExplorerLink.svelte";

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
    setTimeout(() => {
      void load();
    }, 1200);
  }

  async function buyClicked(): Promise<void> {
    if (!raffleState) {
      return;
    }
    buyError = null;
    buySig = null;
    busy = true;
    clampQty();
    try {
      buySig = await buyTickets(new PublicKey(pda), qty);
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
      actionSig = await drawWinner(new PublicKey(pda));
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
      actionSig = await claimPrize(new PublicKey(pda));
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
      actionSig = await closeRaffle(new PublicKey(pda));
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

  // Reference wallet store directly to avoid race conditions with intermediate variables
  $: userKey = $walletStore.publicKey ? $walletStore.publicKey.toBase58() : null;

  $: isRaffleManager = !!raffleManagerStr && !!userKey && raffleManagerStr === userKey;
  $: ticketPriceLamports = raffleState ? bnToNumber(raffleState.ticketPrice) : 0;
  $: ticketPriceSol = ticketPriceLamports / LAMPORTS_PER_SOL;
  $: endTimeUnix = raffleState ? bnToNumber(raffleState.endTime) : null;
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
  $: totalSol = qty * ticketPriceSol;

  function clampQty(): void {
    if (qty < 1) {
      qty = 1;
    }
    if (remaining && qty > remaining) {
      qty = remaining;
    }
  }
</script>

<div class="raffle-page">
  <button class="back-btn" on:click={() => navigate("/")}>
    <span class="back-arrow">←</span> Back to Raffles
  </button>

  {#if loading}
    <p>Loading...</p>
  {:else if error}
    <p class="error">Error: {error}</p>
    <button on:click={load}>Retry</button>
  {:else if raffleState}
    <div class="raffle-info-grid">
      <div class="info-card">
        <div class="info-label">Raffle Address</div>
        <div class="info-value"><ExplorerLink address={new PublicKey(pda)} /></div>
      </div>

      <div class="info-card">
        <div class="info-label">Raffle Manager</div>
        <div class="info-value"><ExplorerLink address={raffleState.raffleManager} /></div>
      </div>

      <div class="info-card">
        <div class="info-label">Ticket Price</div>
        <div class="info-value highlight">{ticketPriceSol} SOL</div>
      </div>

      <div class="info-card">
        <div class="info-label">Tickets Sold</div>
        <div class="info-value">
          <span class="ticket-count">{ticketsSold} / {maxTickets}</span>
          {#if soldOut}<span class="sold-out-badge">SOLD OUT</span>{/if}
        </div>
      </div>

      <div class="info-card">
        <div class="info-label">End Time</div>
        <div class="info-value">
          {endTimeUnix ? new Date(endTimeUnix * 1000).toLocaleString() : "—"}
        </div>
      </div>

      {#if raffleState}
        {@const status = getRaffleStatus(raffleState)}
        {#if status !== RaffleStatus.Active && status !== RaffleStatus.EntriesClosed}
          <div class="info-card winner-card">
            <div class="info-label">Winner</div>
            {#if winnerStr && raffleState.winnerIndex !== null && raffleState.winnerIndex !== undefined}
              <div class="info-value">
                <ExplorerLink address={raffleState.entrants[raffleState.winnerIndex]} />
              </div>
            {/if}
            <div class="winner-status">
              <span class="status-badge status-{status.cssClass}">{status.display}</span>
            </div>
          </div>
        {/if}
      {/if}
    </div>

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

    {#if buySig}
      <div class="tx-line">
        Buy Tx: <ExplorerLink address={buySig} short />
      </div>
    {/if}
    {#if buyError}<div class="error small">{buyError}</div>{/if}
    {#if actionSig}
      <div class="tx-line">
        Action Tx: <ExplorerLink address={actionSig} short />
      </div>
    {/if}
    {#if actionError}<div class="error small">{actionError}</div>{/if}
  {/if}
</div>

<style>
  .raffle-page {
    max-width: 760px;
    margin: 1rem auto;
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: 1px solid rgba(53, 255, 242, 0.3);
    border-radius: 4px;
    color: #35fff2;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 1.5rem;
  }

  .back-btn:hover {
    background: rgba(53, 255, 242, 0.1);
    border-color: #35fff2;
  }

  .back-arrow {
    font-size: 1.2rem;
    line-height: 1;
  }

  .error {
    color: #fca5a5;
  }
  .error.small {
    font-size: 0.75rem;
    padding: 0.5rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 4px;
    margin-top: 0.5rem;
  }

  .raffle-info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .info-card {
    background: rgba(30, 41, 59, 0.4);
    border: 1px solid rgba(53, 255, 242, 0.2);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    transition: all 0.2s;
  }

  .info-card:hover {
    border-color: rgba(53, 255, 242, 0.4);
    box-shadow: 0 2px 8px rgba(53, 255, 242, 0.1);
  }

  .info-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #a78bfa;
    margin-bottom: 0.4rem;
    font-weight: 600;
  }

  .info-value {
    font-size: 0.95rem;
    color: #f1f5f9;
    word-break: break-word;
  }

  .info-value.highlight {
    font-size: 1.25rem;
    font-weight: 600;
    color: #35fff2;
  }

  .ticket-count {
    font-weight: 500;
  }

  .winner-card {
    position: relative;
    border-color: rgba(139, 92, 246, 0.3);
  }

  .winner-status {
    margin-top: 0.75rem;
  }

  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .status-badge.status-ready-to-draw {
    background: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(251, 191, 36, 0.3);
  }

  .status-badge.status-drawing {
    background: rgba(168, 85, 247, 0.2);
    color: #a855f7;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }

  .status-badge.status-awaiting-claim {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .status-badge.status-claimed {
    background: rgba(34, 197, 94, 0.2);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .sold-out-badge {
    display: inline-block;
    margin-left: 0.5rem;
    padding: 0.25rem 0.75rem;
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
    font-size: 0.8rem;
    font-weight: 600;
    border-radius: 4px;
    border: 1px solid rgba(239, 68, 68, 0.3);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    vertical-align: baseline;
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
  }
</style>
