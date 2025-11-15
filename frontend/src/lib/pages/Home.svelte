<script lang="ts">
  import { navigate } from "../router";
  import { onMount } from "svelte";
  import { getAllRaffles, type RaffleState, bnToNumber } from "../raffleProgram";
  import { getRaffleStatus } from "../raffleStatus";
  import type { PublicKey } from "@solana/web3.js";
  import { walletStore } from "../walletStore";
  import ExplorerLink from "../components/ExplorerLink.svelte";

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

  async function loadRaffles(): Promise<void> {
    loading = true;
    error = null;
    try {
      raffles = await getAllRaffles();
      // Sort by end time descending (most recent first)
      raffles.sort((a, b) => bnToNumber(b[1].endTime) - bnToNumber(a[1].endTime));
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadRaffles();
  });

  // Reload raffles when wallet connection or account changes
  // This ensures UI updates when user connects/disconnects/switches wallets
  let prevConnected: boolean | undefined = undefined;
  let prevPublicKey: string | null = null;

  $: {
    const currentConnected = $walletStore.connected;
    const currentPublicKey = $walletStore.publicKey?.toBase58() ?? null;

    // Reload if connection state or public key changed
    // (getAllRaffles doesn't need wallet, but UI elements like "canBuy" depend on wallet state)
    if (
      prevConnected !== undefined &&
      (prevConnected !== currentConnected || prevPublicKey !== currentPublicKey)
    ) {
      void loadRaffles();
    }

    prevConnected = currentConnected;
    prevPublicKey = currentPublicKey;
  }
</script>

<div class="home">
  <div class="header">
    <h1>Raffles</h1>
    <button class="create-btn" on:click={goCreate}>+ Create Raffle</button>
  </div>

  {#if loading}
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
        {@const status = getRaffleStatus(state)}
        <button class="raffle-item" on:click={() => goToRaffle(pda)}>
          <div class="raffle-main">
            <div class="raffle-status status-{status.cssClass}">
              {status.display}
            </div>
            <div class="raffle-info">
              <div class="raffle-price">
                {(bnToNumber(state.ticketPrice) / 1_000_000_000).toFixed(4)} SOL
              </div>
              <div class="raffle-tickets">
                {state.entrants.length} / {state.maxTickets} tickets
              </div>
            </div>
          </div>
          <div class="raffle-details">
            <div class="raffle-end">Ends: {formatDate(bnToNumber(state.endTime))}</div>
            <div class="raffle-pda">PDA: <ExplorerLink address={pda} /></div>
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
    max-width: 400px;
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
    color: #cbd5e1;
  }

  .error {
    color: #fca5a5;
  }

  .empty p {
    margin: 0.5rem 0;
    color: #94a3b8;
  }

  .raffle-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 2rem;
  }

  .raffle-item {
    background: rgba(30, 41, 59, 0.4);
    border: 1px solid rgba(53, 255, 242, 0.3);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }

  .raffle-item:hover {
    background: rgba(53, 255, 242, 0.08);
    border-color: rgba(53, 255, 242, 0.5);
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(53, 255, 242, 0.15);
  }

  .raffle-main {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.35rem;
  }

  .raffle-status {
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .status-active {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .status-ready-to-draw {
    background: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(251, 191, 36, 0.3);
  }

  .status-drawing {
    background: rgba(168, 85, 247, 0.2);
    color: #a855f7;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }

  .status-awaiting-claim {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .status-claimed {
    background: rgba(107, 114, 128, 0.2);
    color: #9ca3af;
    border: 1px solid rgba(107, 114, 128, 0.3);
  }

  .status-entries-closed {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.3);
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
    color: #94a3b8;
    font-size: 0.9rem;
  }

  .raffle-details {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
    color: #94a3b8;
  }

  .raffle-end {
    color: #cbd5e1;
  }

  .raffle-pda {
    font-family: monospace;
    font-size: 0.8rem;
  }

  .quick-jump {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(139, 92, 246, 0.3);
  }

  .quick-jump details {
    cursor: pointer;
  }

  .quick-jump summary {
    color: #a78bfa;
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
