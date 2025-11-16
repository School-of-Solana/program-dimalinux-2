<script lang="ts">
  export let unixTimestamp: number | null;

  import { TimeFormat, nextFormat, formatTime } from "../timeFormat";

  let format: TimeFormat = TimeFormat.Local;

  function cycleFormat(): void {
    format = nextFormat(format);
  }

  $: displayValue = formatTime(unixTimestamp, format);
  $: formatLabel = format.toUpperCase();
</script>

<div class="time-display">
  <span class="time-value">{displayValue}</span>
  <button class="format-indicator" on:click={cycleFormat} title="Click to change format">
    {formatLabel}
  </button>
</div>

<style>
  .time-display {
    display: inline-flex;
    align-items: center;
    gap: 1em;
  }

  .time-value {
    flex: 0 0 auto;
  }

  .format-indicator {
    padding: 0.15rem 0.4rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 3px;
    color: #a78bfa;
    font-size: 0.65rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    letter-spacing: 0.03em;
  }

  .format-indicator:hover {
    background: rgba(139, 92, 246, 0.25);
    border-color: rgba(139, 92, 246, 0.5);
  }
</style>
