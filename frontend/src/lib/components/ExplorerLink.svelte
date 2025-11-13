<script lang="ts">
  import { explorerURL, addressToString } from "../raffleProgram";
  import type { PublicKey, TransactionSignature } from "@solana/web3.js";

  export let address: PublicKey | TransactionSignature | undefined = undefined;
  export let short: boolean = false; // Show abbreviated version

  $: if (!address) {
    throw new Error("ExplorerLink requires either address or signature prop");
  }

  $: url = explorerURL(address!);
  $: displayText = addressToString(address!, short);
</script>

<a href={url} target="_blank" rel="noopener noreferrer" class="explorer-link">
  {displayText}
</a>

<style>
  .explorer-link {
    color: #35fff2;
    text-decoration: none;
    font-family: monospace;
    font-size: 0.9em;
  }
  .explorer-link:hover {
    text-decoration: underline;
  }
</style>
