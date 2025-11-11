<script lang="ts">
  import { navigate } from "../router";
  import { onMount } from "svelte";
  import { getAllRaffles, type RaffleState } from "../raffleProgram";
  import type { PublicKey } from "@solana/web3.js";
  import { walletStore } from "../walletStore";

  let pdaInput = "";
  let raffles: Array<[PublicKey, RaffleState]> = [];
  let loading = false;
  let error: string | null = null;

  function goCreate(): void {
    navigate("/create");
  }

  function goView(): void {
    if (pdaInput.trim()) {
      navigate("/raffle/" + pdaInput.trim());
    }
  }

  function goToRaffle(pda: PublicKey): void {
    navigate("/raffle/" + pda.toBase58());
  }

  function formatDate(epochSeconds: number): string {
    const d = new Date(epochSeconds * 1000);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  }

  function safeToNumber(bn: { toNumber: () => number; toString: () => string }): number {
    try {
      return bn.toNumber();
    } catch {
      // If toNumber fails, parse as string (for very large numbers)
      return parseInt(bn.toString(), 10);
    }
  }

  function getRaffleStatus(state: RaffleState): string {
    const now = Date.now() / 1000;
    const endTime = safeToNumber(state.endTime);
    const isOver = state.entrants.length >= state.maxTickets || now >= endTime;
    const winnerDrawn = state.winnerIndex !== null && state.winnerIndex !== undefined;

    if (isOver) {
      if (winnerDrawn) {
        if (state.claimed) {
          return "Claimed";
        }
        return "Awaiting Claim";
      }

      if (state.entrants.length === 0) {
        return "Entries Closed";
      }

      if (state.drawWinnerStarted) {
        return "Drawing...";
      }

      return "Ready to Draw";
    }

    return "Active";
  }

  async function loadRaffles(): Promise<void> {
    if (!$walletStore.connected) {
      raffles = [];
      error = null;
      loading = false;
      return;
    }

    loading = true;
    error = null;
    try {
      raffles = await getAllRaffles();
      // Sort by end time descending (most recent first)
      raffles.sort((a, b) => safeToNumber(b[1].endTime) - safeToNumber(a[1].endTime));
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadRaffles();
  });

  // Reload raffles when wallet connection changes
  $: if ($walletStore.connected !== undefined) {
    void loadRaffles();
  }
</script>

<div class="home">
  <div class="header">
    <h1>Raffles</h1>
    <button class="create-btn" on:click={goCreate}>+ Create Raffle</button>
  </div>

  {#if !$walletStore.connected}
    <div class="wallet-prompt">
      <p>Connect your wallet to view raffles</p>
    </div>
  {:else if loading}
    <div class="loading">Loading raffles...</div>
  {:else if error}
    <div class="error">Error loading raffles: {error}</div>
  {:else if raffles.length === 0}
    <div class="empty">
      <p>No raffles found.</p>
      <p>Create the first one!</p>
    </div>
  {:else}
    <div class="raffle-list">
      {#each raffles as [pda, state]}
        <button class="raffle-item" on:click={() => goToRaffle(pda)}>
          <div class="raffle-main">
            <div
              class="raffle-status status-{getRaffleStatus(state)
                .toLowerCase()
                .replaceAll(' ', '-')}"
            >
              {getRaffleStatus(state)}
            </div>
            <div class="raffle-info">
              <div class="raffle-price">
                {(safeToNumber(state.ticketPrice) / 1_000_000_000).toFixed(4)} SOL
              </div>
              <div class="raffle-tickets">
                {state.entrants.length} / {state.maxTickets} tickets
              </div>
            </div>
          </div>
          <div class="raffle-details">
            <div class="raffle-end">Ends: {formatDate(safeToNumber(state.endTime))}</div>
            <div class="raffle-pda">{pda.toBase58().slice(0, 8)}...{pda.toBase58().slice(-8)}</div>
          </div>
        </button>
      {/each}
    </div>
  {/if}

  <div class="quick-jump">
    <details>
      <summary>Quick Jump to Raffle PDA</summary>
      <div class="input-row">
        <input bind:value={pdaInput} placeholder="Enter Raffle PDA" />
        <button on:click={goView} disabled={!pdaInput.trim()}>Go</button>
      </div>
    </details>
  </div>
</div>

<style>
  .home {
    max-width: 640px;
    margin: 1rem auto;
    padding: 0 1rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .header h1 {
    margin: 0;
    font-size: 1.8rem;
  }

  .create-btn {
    padding: 0.6rem 1.2rem;
    background: #35fff2;
    color: #0f172a;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .create-btn:hover {
    background: #2ee5d8;
    transform: translateY(-1px);
  }

  .loading,
  .error,
  .empty,
  .wallet-prompt {
    text-align: center;
    padding: 2rem;
    color: #64748b;
  }

  .error {
    color: #ef4444;
  }

  .empty p {
    margin: 0.5rem 0;
  }

  .raffle-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 2rem;
  }

  .raffle-item {
    background: rgba(15, 23, 42, 0.02);
    border: 1px solid rgba(53, 255, 242, 0.2);
    border-radius: 8px;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }

  .raffle-item:hover {
    background: rgba(53, 255, 242, 0.05);
    border-color: rgba(53, 255, 242, 0.4);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(53, 255, 242, 0.1);
  }

  .raffle-main {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .raffle-status {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .status-active {
    background: #10b981;
    color: white;
  }

  .status-ready-to-draw {
    background: #f59e0b;
    color: white;
  }

  .status-drawing {
    background: #8b5cf6;
    color: white;
  }

  .status-awaiting-claim {
    background: #3b82f6;
    color: white;
  }

  .status-claimed {
    background: #6b7280;
    color: white;
  }

  .status-entries-closed {
    background: #ef4444;
    color: white;
  }

  .raffle-info {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .raffle-price {
    font-size: 1.1rem;
    font-weight: 600;
    color: #35fff2;
  }

  .raffle-tickets {
    color: #64748b;
    font-size: 0.9rem;
  }

  .raffle-details {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
    color: #64748b;
  }

  .raffle-pda {
    font-family: monospace;
    font-size: 0.8rem;
  }

  .quick-jump {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(53, 255, 242, 0.2);
  }

  .quick-jump details {
    cursor: pointer;
  }

  .quick-jump summary {
    color: #64748b;
    font-size: 0.9rem;
    user-select: none;
    list-style: none;
  }

  .quick-jump summary::-webkit-details-marker {
    display: none;
  }

  .quick-jump summary::before {
    content: "▶ ";
    display: inline-block;
    transition: transform 0.2s;
  }

  .quick-jump details[open] summary::before {
    transform: rotate(90deg);
  }

  .quick-jump .input-row {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .quick-jump input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid rgba(53, 255, 242, 0.2);
    border-radius: 4px;
    background: rgba(15, 23, 42, 0.02);
  }

  .quick-jump button {
    padding: 0.5rem 1rem;
    white-space: nowrap;
  }
</style>
