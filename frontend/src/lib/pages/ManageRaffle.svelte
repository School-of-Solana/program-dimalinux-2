<script lang="ts">
  import { onMount } from "svelte";
  import {getRaffleState, drawWinner, claimPrize, type RaffleState} from "../Raffle";
  import { walletStore } from "../walletStore";
  import { PublicKey } from "@solana/web3.js";

  export let pda: string; // raffle PDA

  let loading = true;
  let error: string | null = null;
  let raffleState: RaffleState | null = null;
  let actionError: string | null = null;
  let actionSig: string | null = null;
  let busy = false;

  async function load() {
    loading = true;
    error = null;
    actionError = null;
    actionSig = null;
    try {
      raffleState = await getRaffleState(new PublicKey(pda));
    } catch (e: any) {
      error = e.message || String(e);
    } finally {
      loading = false;
    }
  }

  onMount(load);

  function refreshAfterDelay() {
    setTimeout(load, 1200);
  }

  async function doDrawWinnerClicked() {
    actionError = null;
    actionSig = null;
    busy = true;
    try {
      const sig = await drawWinner(new PublicKey(pda));
      actionSig = sig;
      refreshAfterDelay();
    } catch (e: any) {
      actionError = e.message || String(e);
    } finally {
      busy = false;
    }
  }

  async function claimPrizeClicked() {
    actionError = null;
    actionSig = null;
    busy = true;
    try {
      const sig = await claimPrize(new PublicKey(pda));
      actionSig = sig;
      refreshAfterDelay();
    } catch (e: any) {
      actionError = e.message || String(e);
    } finally {
      busy = false;
    }
  }

  // derived reactive values (camelCase fields)
  $: ownerStr = raffleState?.owner ? raffleState.owner.toBase58() : "";
  $: userKey = $walletStore?.publicKey ? $walletStore.publicKey.toBase58() : null;
  $: isOwner = !!ownerStr && !!userKey && ownerStr === userKey;
  $: endTimeUnix = raffleState ? raffleState.endTime.toNumber() : null;
  $: ended = endTimeUnix ? (Date.now() / 1000) > endTimeUnix : false;
  $: winnerStr = raffleState?.winner ? raffleState.winner.toBase58() : null;
  $: claimed = !!raffleState?.claimed;
  $: winnerDrawn = !!winnerStr;
  $: userIsWinner = !!winnerStr && !!userKey && winnerStr === userKey;
  // New reactive values for sold-out logic
  $: ticketsSold = raffleState ? raffleState.entrants.length : 0;
  $: maxTickets = raffleState ? raffleState.maxTickets : 0;
  $: soldOut = maxTickets > 0 && ticketsSold >= maxTickets;
</script>

<div class="manage-raffle">
  <h2>Manage Raffle</h2>
  <div class="pda">PDA: {pda}</div>
  {#if loading}
    <p>Loading...</p>
  {:else if error}
    <p class="error">Error: {error}</p>
    <button on:click={load}>Retry</button>
  {:else if !isOwner}
    <p>You are not the owner of this raffle.</p>
  {:else}
    <div class="status">
      <p>
        <strong>End Time:</strong>
        {endTimeUnix ? new Date(endTimeUnix * 1000).toLocaleString() : "—"} (ended:
        {ended ? "Yes" : "No"})<br/>
        <strong>Sold Out:</strong> {soldOut ? "Yes" : "No"} ({ticketsSold}/{maxTickets})
      </p>
      <p>
        <strong>Winner:</strong>
        {winnerStr || "Not drawn"}
        {winnerDrawn && claimed ? "(claimed)" : ""}
      </p>
    </div>
    <div class="actions">
      <button on:click={doDrawWinnerClicked} disabled={!(ended || soldOut) || winnerDrawn || busy}
        >Draw Winner</button
      >
      <button
        on:click={claimPrizeClicked}
        disabled={!winnerDrawn || !userIsWinner || claimed || busy}
        >Claim Prize (as winner)</button
      >
      <button on:click={load} disabled={busy}>Refresh</button>
    </div>
    {#if actionSig}
      <div class="action-sig">
        Tx: <a
          target="_blank"
          rel="noopener"
          href={`https://explorer.solana.com/tx/${actionSig}?cluster=devnet`}
          >{actionSig}</a
        >
      </div>
    {/if}
    {#if actionError}
      <div class="action-error">{actionError}</div>
    {/if}
  {/if}
</div>

<style>
  .manage-raffle {
    max-width: 600px;
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
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0.75rem 0;
  }
  .actions button {
    padding: 0.5rem 0.9rem;
  }
  .action-sig {
    font-size: 0.7rem;
    word-break: break-all;
    margin-top: 0.5rem;
  }
  .status p {
    margin: 0.25rem 0;
  }
</style>
