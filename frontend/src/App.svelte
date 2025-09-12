<script lang="ts">
  import WalletMultiButton from "./lib/WalletMultiButton.svelte";
  import WalletProvider from "./lib/WalletProvider.svelte";
  import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
  import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
  import Transfer from "./lib/Transfer.svelte";
  import CreateRaffle from "./lib/CreateRaffle.svelte";

  const localStorageKey = "walletAdapter";
  const walletAdapters = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ];
</script>

<main>
  <h1>Solana Raffle</h1>

  <div class="card">
    <WalletProvider {localStorageKey} wallets={walletAdapters} autoConnect />
    <WalletMultiButton />
    <Transfer />
    <CreateRaffle />
  </div>
</main>

<style>
</style>
