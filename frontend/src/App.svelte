<script lang="ts">
  import { onMount } from "svelte";
  import WalletMultiButton from "./lib/WalletMultiButton.svelte";
  import WalletProvider from "./lib/WalletProvider.svelte";
  import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
  import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
  import { currentRoute, initRouter } from "./lib/router";
  import Home from "./lib/pages/Home.svelte";
  import CreateRaffle from "./lib/pages/CreateRaffle.svelte";
  import ViewRaffle from "./lib/pages/ViewRaffle.svelte";
  import ExplorerLink from "./lib/components/ExplorerLink.svelte";
  import { PROGRAM_ID } from "./lib/raffleProgram";

  const localStorageKey = "walletAdapter";
  const walletAdapters = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];

  onMount(() => initRouter());
</script>

<main>
  <div class="app-header">
    <h1>Solana Raffle</h1>
    <div class="wallet-controls">
      <WalletProvider {localStorageKey} wallets={walletAdapters} autoConnect />
      <WalletMultiButton />
    </div>
  </div>

  <div class="page-container">
    {#if $currentRoute.segments.length === 0}
      <Home />
    {:else if $currentRoute.segments[0] === "create"}
      <CreateRaffle />
    {:else if $currentRoute.segments[0] === "raffle" && $currentRoute.params.pda}
      <ViewRaffle pda={$currentRoute.params.pda} />
    {:else}
      <p>Page not found.</p>
    {/if}
  </div>

  <footer class="app-footer">
    <div class="footer-content">
      <span class="footer-label">Program Id:</span>
      <ExplorerLink address={PROGRAM_ID} />
    </div>
  </footer>
</main>

<style>
  main {
    max-width: 900px;
    margin: 0 auto;
    padding: 1rem 1.25rem 3rem;
  }

  .app-header {
    display: flex;
    align-items: center;
    justify-content: center; /* center the group (title + button) */
    gap: 1.5rem;
    margin-bottom: 1rem;
    flex-wrap: nowrap;
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 800;
    background: linear-gradient(135deg, #35fff2 0%, #8b5cf6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0.5rem 0 0.25rem;
    letter-spacing: -0.02em;
    text-shadow: 0 0 30px rgba(53, 255, 242, 0.2);
    text-align: center; /* ensure centered when stacked */
  }

  .wallet-controls {
    display: flex;
    align-items: center;
    justify-content: center; /* center with title */
    gap: 0.75rem;
    /* remove min-width to avoid pushing layout */
    flex: 0 0 auto;
  }

  .page-container {
    margin-top: 1rem;
  }

  .app-footer {
    margin-top: 3rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(53, 255, 242, 0.15);
    text-align: center;
  }

  .footer-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 0.85rem;
  }

  .footer-label {
    color: #94a3b8;
  }

  @media (max-width: 900px) {
    .app-header {
      flex-direction: column; /* stack title over button */
      gap: 0.5rem; /* keep tighter gap when stacked */
    }
    .wallet-controls {
      width: auto;
      justify-content: center; /* keep centered under title */
    }
  }
</style>
