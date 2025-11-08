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

  const localStorageKey = "walletAdapter";
  const walletAdapters = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];

  onMount(() => initRouter());
</script>

<main>
  <h1>Solana Raffle</h1>
  <div class="top-bar">
    <div class="left-nav">
      <a href="#/" class:active={$currentRoute.segments.length === 0}>Home</a>
      <a href="#/create" class:active={$currentRoute.segments[0] === "create"}>Create</a>
    </div>
    <WalletProvider {localStorageKey} wallets={walletAdapters} autoConnect />
    <WalletMultiButton />
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
</main>

<style>
  main {
    max-width: 900px;
    margin: 0 auto;
    padding: 1rem 1.25rem 3rem;
  }
  .top-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }
  .left-nav {
    display: flex;
    gap: 0.75rem;
  }
  .left-nav a {
    text-decoration: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: 1px solid transparent;
    transition: all 0.2s;
    color: #94a3b8;
  }
  .left-nav a:hover {
    border-color: #64748b;
    color: #cbd5e1;
  }
  .left-nav a.active {
    background: #35fff2;
    color: #0f172a;
    border-color: #35fff2;
    font-weight: 700;
    box-shadow: 0 0 10px rgba(53, 255, 242, 0.3);
  }
  .page-container {
    margin-top: 1rem;
  }
</style>
