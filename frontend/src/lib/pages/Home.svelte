<script lang="ts">
  import { navigate } from "../router";
  import { onMount } from "svelte";
  import { currentRoute } from "../router";
  let pdaInput = "";
  function goCreate() {
    navigate("/create");
  }
  function goView() {
    if (pdaInput.trim()) navigate("/view/" + pdaInput.trim());
  }
</script>

<div class="home">
  <h2>Raffle Dapp</h2>
  <div class="actions">
    <button on:click={goCreate}>Create a Raffle</button>
  </div>
  <div class="view-existing">
    <label for="pda">View Existing Raffle (PDA)</label>
    <input id="pda" bind:value={pdaInput} placeholder="Raffle PDA" />
    <button on:click={goView} disabled={!pdaInput.trim()}>View</button>
  </div>
</div>

<style>
  .home {
    max-width: 480px;
    margin: 1rem auto;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .actions button {
    padding: 0.6rem 1rem;
  }
  .view-existing label {
    display: block;
    margin-bottom: 0.25rem;
  }
  .view-existing input {
    width: 100%;
    padding: 0.4rem;
    margin-bottom: 0.5rem;
  }
</style>
