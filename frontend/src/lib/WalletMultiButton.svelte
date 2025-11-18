<script lang="ts">
  import { type Adapter } from "@solana/wallet-adapter-base";
  import { walletStore, type Wallet } from "./walletStore";
  import { onMount, onDestroy } from "svelte";

  const byInstalledStatus = (a: Wallet, b: Wallet): number => {
    if (a.readyState === "Installed" && b.readyState !== "Installed") {
      return -1;
    }
    if (a.readyState !== "Installed" && b.readyState === "Installed") {
      return 1;
    }
    return 0;
  };
  $: installedWalletAdaptersWithReadyState = $walletStore.wallets
    .filter((walletAdapterAndReadyState) => {
      return walletAdapterAndReadyState.readyState === "Installed";
    })
    .sort((walletAdapterAndReadyStateA, walletAdapterAndReadyStateB) => {
      return byInstalledStatus(walletAdapterAndReadyStateA, walletAdapterAndReadyStateB);
    });

  async function handleConnect(wallet: Adapter): Promise<void> {
    await $walletStore.select(wallet.name);
    await $walletStore.connect();
  }

  async function copyToClipboard(): Promise<void> {
    if (typeof window !== "undefined" && window.navigator?.clipboard) {
      await window.navigator.clipboard.writeText($walletStore.publicKey!.toBase58());
    }
  }

  async function handleDisconnect(): Promise<void> {
    await $walletStore.disconnect();
  }

  function abbrAddress(address: string): string {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }

  let menuOpen = false;
  function toggleMenu(): void {
    menuOpen = !menuOpen;
  }
  function closeMenu(): void {
    menuOpen = false;
  }
  function onDocumentClick(e: MouseEvent): void {
    if (!menuOpen) {
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest(".wallet-popover")) {
      return;
    }
    closeMenu();
  }
  onMount(() => {
    document.addEventListener("click", onDocumentClick);
  });
  onDestroy(() => {
    document.removeEventListener("click", onDocumentClick);
  });

  $: adapterName = $walletStore.adapter ? $walletStore.adapter.name : "";
  $: adapterIcon = $walletStore.adapter ? $walletStore.adapter.icon : "";
  $: abbreviatedAddress = $walletStore.publicKey
    ? abbrAddress($walletStore.publicKey.toBase58())
    : "";
</script>

{#if $walletStore.connected}
  <div class="wallet-popover">
    <button
      id="connected-wallet-btn"
      type="button"
      on:click={toggleMenu}
      aria-expanded={menuOpen}
      aria-controls="connected-wallet-menu"
    >
      {#if adapterIcon}<img alt={"icon of " + adapterName} src={adapterIcon} width="32" />{/if}
      <span>{abbreviatedAddress}</span>
    </button>
    {#if menuOpen}
      <ul id="connected-wallet-menu" class="wallet-menu" role="menu">
        <li role="none">
          <button class="wallet-op-btn" on:click={copyToClipboard} type="button" role="menuitem"
            >Copy Address</button
          >
        </li>
        <li role="none">
          <button class="wallet-op-btn" on:click={handleDisconnect} type="button" role="menuitem"
            >Disconnect</button
          >
        </li>
      </ul>
    {/if}
  </div>
{:else}
  <div class="wallet-popover">
    <button
      id="select-wallet-btn"
      type="button"
      on:click={toggleMenu}
      aria-expanded={menuOpen}
      aria-controls="select-wallet-menu">Connect Solana Wallet</button
    >
    {#if menuOpen}
      <ul id="select-wallet-menu" class="wallet-menu" role="menu">
        {#each installedWalletAdaptersWithReadyState as wallet}
          <li role="none">
            {#if !wallet.adapter.connected}
              <button
                class="wallet-item-btn"
                on:click={async () => {
                  await handleConnect(wallet.adapter);
                  closeMenu();
                }}
                type="button"
                role="menuitem"
              >
                <img alt={"icon of " + wallet.adapter.name} src={wallet.adapter.icon} width="32" />
                <span>{wallet.adapter.name}</span>
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

<style>
  ul {
    list-style-type: none;
    padding: 0;
    margin: 0;
  }
  li {
    list-style-type: none;
  }
  .wallet-popover {
    position: relative;
    display: inline-flex;
  }
  .wallet-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    z-index: 1000;
    margin: 0;
    padding: 0.5rem;
    border: 1px solid #444;
    border-radius: 6px;
    background: #1a1a1a;
    color: #fff;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
    min-width: 220px;
  }
  #connected-wallet-btn,
  #select-wallet-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #202e33;
    border: 1px solid #324147;
    color: #e2e8f0;
    padding: 0.5rem 0.8rem;
    font-size: 0.85rem;
    border-radius: 6px;
    cursor: pointer;
  }
  #connected-wallet-btn:hover,
  #select-wallet-btn:hover {
    background: #263940;
  }
  .wallet-item-btn,
  .wallet-op-btn {
    width: 100%;
    text-align: left;
  }
  .wallet-item-btn {
    display: flex;
    align-items: center;
    padding: 8px;
    border: none;
    background: none;
    cursor: pointer;
  }
  .wallet-item-btn img {
    margin-right: 10px;
  }
  .wallet-item-btn:hover {
    background: #2a2a2a;
  }
  .wallet-op-btn {
    padding: 8px;
    background: none;
    border: none;
    cursor: pointer;
    color: #fff;
  }
  .wallet-op-btn:hover {
    background: #2a2a2a;
  }
</style>
