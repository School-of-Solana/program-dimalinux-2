<script lang="ts">
  import { navigate } from "../router";
  import { onMount } from "svelte";
  import { currentRoute } from "../router";
  let pdaInput = "";
  let pdaInputEl: HTMLInputElement | null = null;
  function goCreate() {
    navigate("/create");
  }
  function goView() {
    if (pdaInput.trim()) navigate("/raffle/" + pdaInput.trim());
  }
  onMount(() => {
    pdaInputEl?.focus();
  });
</script>

<div class="home">
  <div class="view-existing">
    <label for="pda">View Existing Raffle</label>
    <div class="input-row">
      <input id="pda" bind:this={pdaInputEl} bind:value={pdaInput} placeholder="Raffle PDA" />
      <button on:click={goView} disabled={!pdaInput.trim()}>View</button>
    </div>
  </div>
  <div class="actions">
    <button on:click={goCreate}>Create a Raffle</button>
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
  /* New flex row for input + button */
  .view-existing .input-row {
    display: flex;
    gap: 0.5rem;
    align-items: stretch;
  }
  .view-existing .input-row input {
    margin-bottom: 0; /* remove bottom margin when inline */
  }
  .view-existing .input-row button {
    padding: 0.6rem 1rem;
    white-space: nowrap;
  }
</style>
