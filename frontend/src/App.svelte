<script lang="ts">
  import WalletMultiButton from "./lib/WalletMultiButton.svelte";
  import WalletProvider from "./lib/WalletProvider.svelte";
  import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
  import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
  import { onMount } from "svelte";
  import { currentRoute, initRouter } from "./lib/router";
  import Home from "./lib/pages/Home.svelte";
  import CreateRaffle from "./lib/pages/CreateRaffle.svelte";
  import ManageRaffle from "./lib/pages/ManageRaffle.svelte";

  const localStorageKey = "walletAdapter";
  const walletAdapters = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];

  onMount(() => initRouter());
</script>

<main>
  <h1>Solana Raffle</h1>
  <div class="top-bar">
    <div class="left-nav">
      <a href="#/">Home</a>
      <a href="#/create">Create</a>
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
      <ManageRaffle pda={$currentRoute.params.pda} />
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
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    border: 1px solid transparent;
  }
  .left-nav a:hover {
    border-color: #ccc;
  }
  .page-container {
    margin-top: 1rem;
  }
</style>
