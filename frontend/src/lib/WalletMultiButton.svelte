<script lang="ts">
  import { type Adapter } from "@solana/wallet-adapter-base";
  import { walletStore, type Wallet } from "./walletStore";

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
</script>

{#if $walletStore.connected}
  <button id="connected-wallet-btn" popovertarget="connected-wallet-menu">
    <img alt="icon of {$walletStore.adapter!.name}" src={$walletStore.adapter!.icon} width="38px" />
    <span>{abbrAddress($walletStore.publicKey!.toBase58())}</span></button
  >
  <ul id="connected-wallet-menu" popover="auto">
    <li>
      <button class="wallet-op-btn" onclick={copyToClipboard}>Copy Address</button>
    </li>
    <li>
      <button class="wallet-op-btn" onclick={handleDisconnect}>Disconnect</button>
    </li>
  </ul>
{:else}
  <button id="select-wallet-btn" popovertarget="select-wallet-modal">Connect Solana Wallet</button>
  <ul id="select-wallet-modal" popover="auto">
    {#each installedWalletAdaptersWithReadyState as wallet}
      <li>
        {#if !wallet.adapter.connected}
          <button
            class="wallet-item-btn"
            onclick={async () => {
              await handleConnect(wallet.adapter);
            }}
            type="button"
          >
            <img alt="icon of {wallet.adapter.name}" src={wallet.adapter.icon} width="38px" />
            <span>{wallet.adapter.name}</span></button
          >
        {/if}
      </li>
    {/each}
  </ul>
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
  [popover] {
    margin: 0;
    padding: 0;
    border: 0;
  }

  #connected-wallet-btn {
    anchor-name: --connected-wallet-btn;
    display: flex;
    align-items: center;
  }
  #connected-wallet-btn img {
    margin-right: 10px;
  }
  #connected-wallet-btn span {
    flex: 1;
  }

  #connected-wallet-menu {
    position: absolute;
    position-anchor: --connected-wallet-btn;
    right: anchor(right);
    top: anchor(bottom);
    inset-area: bottom;
  }

  #select-wallet-btn {
    anchor-name: --select-wallet-btn;
  }
  #select-wallet-modal {
    position-anchor: --select-wallet-btn;
    right: anchor(right);
    bottom: anchor(bottom);
    inset-area: bottom;
  }

  .wallet-item-btn {
    display: flex;
    align-items: center; /* Vertically center align */
    justify-content: flex-start; /* Align to the left horizontally */
    width: 100%; /* Make button take full width of parent element */
    padding: 10px; /* Optional: Set button padding */
    border: none; /* Optional: Remove button border */
    background: none; /* Optional: Remove button background */
    cursor: pointer; /* Optional: Set cursor style on hover */
  }

  .wallet-item-btn img {
    margin-right: 10px; /* Set spacing between icon and text */
  }

  .wallet-item-btn span {
    flex: 1; /* Make text occupy remaining space */
  }
</style>
