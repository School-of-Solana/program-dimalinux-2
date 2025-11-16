<!-- eslint-env browser -->
<script lang="ts">
  import { explorerURL, addressToString } from "../raffleProgram";
  import type { PublicKey, TransactionSignature } from "@solana/web3.js";

  export let address: PublicKey | TransactionSignature | undefined = undefined;

  let copied = false;

  $: if (!address) {
    throw new Error("ExplorerLink requires either address or signature prop");
  }

  $: url = explorerURL(address!);
  $: addressStrings = addressToString(address!);

  async function copyToClipboard(): Promise<void> {
    try {
      // eslint-disable-next-line no-undef
      await navigator.clipboard.writeText(addressStrings.full);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }
</script>

<span class="explorer-link-wrapper">
  <a href={url} target="_blank" rel="noopener noreferrer" class="explorer-link">
    {addressStrings.short}
  </a>
  <button
    class="copy-btn"
    on:click={copyToClipboard}
    title="Copy full address to clipboard"
    aria-label="Copy address"
  >
    {#if copied}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    {:else}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    {/if}
  </button>
</span>

<style>
  .explorer-link-wrapper {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .explorer-link {
    color: #cbd5e1;
    text-decoration: none;
    font-family: monospace;
    font-size: 0.9em;
    transition: color 0.2s;
  }
  .explorer-link:hover {
    color: #35fff2;
    text-decoration: underline;
  }

  .copy-btn {
    background: none;
    border: none;
    outline: none;
    padding: 0.2rem;
    cursor: pointer;
    color: #94a3b8;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
    line-height: 0;
  }

  .copy-btn:hover {
    color: #35fff2;
  }

  .copy-btn svg {
    stroke-width: 2;
  }
</style>
