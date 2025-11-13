<script lang="ts">
  import { walletStore } from "../walletStore";
  import { createRaffleOnChain } from "../raffleProgram";
  import { onMount } from "svelte";
  import { web3, BN } from "@coral-xyz/anchor";
  import type { TransactionSignature, PublicKey } from "@solana/web3.js";
  import { navigate } from "../router";

  const { LAMPORTS_PER_SOL } = web3;

  let maxTickets: number = 50;
  let ticketPrice: number = 0.05;
  let expirationDate: string = ""; // yyyy-mm-dd
  let expirationTime: string = ""; // HH:MM (24-hour)
  let expirationEpoch: number | null = null;
  let tzMode: "local" | "utc" = "local";

  let ticketPriceLamports: number = Math.round(ticketPrice * LAMPORTS_PER_SOL);

  function pad(n: number): string {
    return n.toString().padStart(2, "0");
  }
  function formatDateLocal(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function formatTimeLocal(d: Date): string {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  onMount(() => {
    const now = new Date();
    const oneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (!expirationDate) {
      expirationDate = formatDateLocal(oneWeek);
    }
    if (!expirationTime) {
      expirationTime = formatTimeLocal(oneWeek);
    }
  });

  function parseDateTimeToEpoch(
    dateStr: string,
    timeStr: string,
    mode: "local" | "utc"
  ): number | null {
    if (!dateStr) {
      return null;
    }
    const dateParts = dateStr.split("-").map(Number);
    if (dateParts.length !== 3) {
      return null;
    }
    const [y, m, d] = dateParts;
    const timeParts = (timeStr || "00:00").split(":").map(Number);
    const [hh = 0, mm = 0] = timeParts;
    if ([y, m, d, hh, mm].some((v) => Number.isNaN(v))) {
      return null;
    }
    // Always calculate epoch in UTC for blockchain consistency
    // If mode is "local", interpret the input as local time and convert to UTC
    if (mode === "utc") {
      const ms = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
      return Math.floor(ms / 1000);
    } else {
      // User entered local time - convert to UTC epoch
      const ms = new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
      return Math.floor(ms / 1000);
    }
  }

  // Track the previous timezone mode to detect changes
  let prevTzMode: "local" | "utc" = tzMode;

  // Manual update to avoid reactive cycles
  function updateInputFieldsForTimezone(): void {
    if (expirationEpoch === null) {
      return;
    }
    const d = new Date(expirationEpoch * 1000);
    if (tzMode === "utc") {
      // Show UTC values in the input fields
      expirationDate = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
      expirationTime = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    } else {
      // Show local values in the input fields
      expirationDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      expirationTime = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }

  // Watch for timezone changes
  $: {
    if (tzMode !== prevTzMode) {
      updateInputFieldsForTimezone();
      prevTzMode = tzMode;
    }
  }

  // Calculate epoch whenever inputs change
  $: {
    if (expirationDate && !expirationTime) {
      expirationTime = "00:00";
    }
    expirationEpoch = parseDateTimeToEpoch(expirationDate, expirationTime, tzMode);
  }

  // Validate max tickets when user leaves the field
  function handleMaxTicketsBlur(e: Event): void {
    const target = e.target as HTMLInputElement;
    const v = parseInt(target.value || "", 10);
    const MAX_U32 = 4_294_967_295; // Solana's u32 maximum

    if (Number.isNaN(v) || v < 1) {
      maxTickets = 1; // Set to minimum valid value
    } else if (v > MAX_U32) {
      maxTickets = MAX_U32; // Cap at maximum valid value
      // Show a brief message that the value was capped
      raffleError = `Max tickets capped at ${MAX_U32.toLocaleString()}`;
      setTimeout(() => {
        if (raffleError?.includes("capped")) {
          raffleError = null;
        }
      }, 3000);
    } else {
      maxTickets = v;
    }
  }

  // Validate ticket price when user leaves the field
  function handleTicketPriceBlur(e: Event): void {
    const target = e.target as HTMLInputElement;
    const v = parseFloat(target.value || "");
    if (Number.isNaN(v) || v <= 0) {
      ticketPrice = 0.001; // Set to reasonable minimum
    } else {
      ticketPrice = v;
    }
  }
  $: ticketPriceLamports = Math.round(
    (Number.isFinite(ticketPrice) ? ticketPrice : 0) * LAMPORTS_PER_SOL
  );

  let raffleTxSig: string | null = null;
  let raffleExplorerUrl: string | null = null;
  let raffleError: string | null = null;
  let createdRafflePda: string | null = null;

  async function createRaffleClicked(): Promise<void> {
    raffleTxSig = null;
    raffleExplorerUrl = null;
    raffleError = null;
    createdRafflePda = null;
    try {
      const [signature, rafflePda]: [TransactionSignature, PublicKey] = await createRaffleOnChain(
        new BN(ticketPriceLamports),
        maxTickets,
        new BN(expirationEpoch!)
      );
      raffleTxSig = signature;
      createdRafflePda = rafflePda.toBase58();
      raffleExplorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
      // Automatically navigate to the new raffle overview page
      navigate(`/raffle/${encodeURIComponent(createdRafflePda)}`);
    } catch (err) {
      raffleError = err instanceof Error ? err.message : String(err);
      console.log("Error creating raffle:", err);
    }
  }
</script>

<div class="create-raffle-form">
  <div class="page-header">
    <button class="back-btn" on:click={() => navigate("/")}>
      <span class="back-arrow">←</span> Back to Raffles
    </button>
    <h2>Create New Raffle</h2>
  </div>

  <div class="field-row">
    <label for="maxTickets">Max Tickets:</label>
    <input
      id="maxTickets"
      type="number"
      min="1"
      max="4294967295"
      step="1"
      inputmode="numeric"
      bind:value={maxTickets}
      on:blur={handleMaxTicketsBlur}
      placeholder="Enter max tickets"
    />
  </div>
  <div class="field-row">
    <label for="ticketPrice">Ticket Price (SOL):</label>
    <input
      id="ticketPrice"
      type="number"
      min="0.000000001"
      step="0.000000001"
      bind:value={ticketPrice}
      on:blur={handleTicketPriceBlur}
      placeholder="Enter price in SOL"
    />
  </div>
  <div class="price-preview preview">{ticketPrice} SOL = {ticketPriceLamports} lamports</div>
  <fieldset class="expiration-row">
    <legend>Raffle End:</legend>
    <div class="expiration-controls" role="group" aria-label="Expiration controls">
      <div class="control tz-control">
        <label for="tzMode" class="small-label">Zone</label>
        <select
          id="tzMode"
          bind:value={tzMode}
          aria-label="Timezone mode"
          title="Select timezone interpretation"
        >
          <option value="local">Local</option>
          <option value="utc">UTC</option>
        </select>
      </div>
      <div class="control date-control">
        <label for="expirationDate" class="small-label">Date</label>
        <input
          id="expirationDate"
          type="date"
          bind:value={expirationDate}
          aria-label="Expiration date"
        />
      </div>
      <div class="control time-control">
        <label for="expirationTime" class="small-label">Time</label>
        <input
          id="expirationTime"
          type="time"
          bind:value={expirationTime}
          aria-label="Expiration time"
        />
      </div>
    </div>
    {#if expirationEpoch}
      <div class="expiration-preview preview">
        <span class="epoch-line"
          ><span class="epoch-label">UTC epoch seconds:</span>&nbsp;<span class="epoch-value"
            >{expirationEpoch}</span
          ></span
        >
      </div>
    {/if}
  </fieldset>
  <div>
    {#if $walletStore.connected}
      <button
        on:click={async () => await createRaffleClicked()}
        disabled={!(maxTickets > 0) || !(ticketPrice > 0) || !expirationDate || !expirationTime}
        >Create Raffle</button
      >
      {#if raffleTxSig && raffleExplorerUrl}
        <div class="tx-result">
          <div>
            <span>New raffle created: </span><a
              href={raffleExplorerUrl}
              target="_blank"
              rel="noopener noreferrer">{raffleTxSig}</a
            >
          </div>
          {#if createdRafflePda}
            <div class="pda-link">
              Open raffle: <a href={`#/raffle/${encodeURIComponent(createdRafflePda)}`}
                >{createdRafflePda}</a
              >
            </div>
            <div class="pda-link">
              Raffle Manager tools: <a
                href={`#/raffle/${encodeURIComponent(createdRafflePda)}?tab=owner`}>manage</a
              >
            </div>
          {/if}
        </div>
      {/if}
      {#if raffleError}
        <div class="tx-error">
          {raffleError}
        </div>
      {/if}
    {:else}
      <span class="wallet-warning">Connect your wallet to create a raffle.</span>
    {/if}
  </div>
</div>

<style>
  .create-raffle-form {
    max-width: 400px;
    margin: 2rem auto;
    padding: 2rem;
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 12px;
    font-family: inherit;
    background: rgba(30, 41, 59, 0.3);
  }

  .page-header {
    margin-bottom: 1.5rem;
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
    margin-bottom: 1rem;
  }

  .back-btn:hover {
    background: rgba(53, 255, 242, 0.1);
    border-color: #35fff2;
  }

  .back-arrow {
    font-size: 1.2rem;
    line-height: 1;
  }

  .create-raffle-form h2 {
    margin: 0;
    font-size: 1.5rem;
    background: linear-gradient(135deg, #35fff2 0%, #8b5cf6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .field-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .field-row label {
    width: 140px;
    margin: 0;
    white-space: nowrap;
    font-weight: 500;
    font-size: 1rem;
    color: #cbd5e1;
  }
  .create-raffle-form .field-row input {
    width: 8rem;
    max-width: 10rem;
    padding: 0.5rem 0.6rem;
    border-radius: 4px;
    border: 1px solid rgba(139, 92, 246, 0.3);
    background: rgba(15, 23, 42, 0.6);
    color: #e2e8f0;
    font-family: inherit;
  }

  .create-raffle-form .field-row input:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
  }

  .expiration-row {
    margin-bottom: 1rem;
    text-align: center;
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 6px;
    padding: 1rem;
  }
  .expiration-row legend {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 1rem;
    color: #cbd5e1;
  }
  .expiration-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.25rem;
  }
  .expiration-controls .control {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 4.5rem;
  }
  .expiration-controls .control input,
  .expiration-controls .control select {
    padding: 0.5rem 0.6rem;
    box-sizing: border-box;
    border-radius: 4px;
    border: 1px solid rgba(139, 92, 246, 0.3);
    background: rgba(15, 23, 42, 0.6);
    color: #e2e8f0;
  }
  .small-label {
    font-size: 0.9rem;
    margin-bottom: 0.3rem;
    font-weight: 500;
    color: #cbd5e1;
  }
  .preview {
    display: inline-block;
    margin-top: 0.6rem;
    padding: 0.4rem 0.6rem;
    background: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
    border-radius: 4px;
    border: 1px solid rgba(139, 92, 246, 0.3);
    font-size: 0.9rem;
    line-height: 1;
    font-weight: 500;
  }
  .epoch-line {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
  }
  .create-raffle-form input {
    width: 100%;
    padding: 0.5rem;
    box-sizing: border-box;
  }
  .create-raffle-form button {
    padding: 0.7rem 1.25rem;
    font-size: 1rem;
  }

  .tx-error {
    color: #fca5a5;
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 4px;
  }

  .wallet-warning {
    color: #fbbf24;
  }

  .tx-result {
    margin-top: 0.75rem;
    font-size: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .tx-result a {
    word-break: break-all;
  }
  .pda-link a {
    font-weight: 600;
  }
  @media (max-width: 480px) {
    .field-row {
      flex-direction: column;
      align-items: stretch;
    }
    .field-row label {
      width: auto;
    }
    .create-raffle-form .field-row input {
      width: 100%;
    }
    .expiration-controls {
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  }
</style>
