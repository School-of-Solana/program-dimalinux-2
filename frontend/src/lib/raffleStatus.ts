import type { RaffleState } from "./raffleProgram";
import { bnToNumber } from "./raffleProgram";

/**
 * Contains both the display text and CSS class for a raffle status.
 */
export interface StatusInfo {
  /** Human-readable display text */
  readonly display: string;
  /** CSS-class-friendly identifier */
  readonly cssClass: string;
}

/**
 * Represents the various states a raffle can be in.
 * Each status contains both display text and a CSS class name.
 */
export const RaffleStatus = {
  Active: { display: "Active", cssClass: "active" } as StatusInfo,
  ReadyToDraw: { display: "Ready to Draw", cssClass: "ready-to-draw" } as StatusInfo,
  Drawing: { display: "Drawing...", cssClass: "drawing" } as StatusInfo,
  AwaitingClaim: { display: "Awaiting Claim", cssClass: "awaiting-claim" } as StatusInfo,
  Claimed: { display: "Claimed", cssClass: "claimed" } as StatusInfo,
  EntriesClosed: { display: "Entries Closed", cssClass: "entries-closed" } as StatusInfo,
} as const;

// Added: explicit status order for sorting (most interesting first)
export const RAFFLE_STATUS_ORDER: readonly StatusInfo[] = [
  RaffleStatus.Active,
  RaffleStatus.ReadyToDraw,
  RaffleStatus.Drawing,
  RaffleStatus.AwaitingClaim,
  RaffleStatus.Claimed,
  RaffleStatus.EntriesClosed,
];

// Precompute rank lookup by cssClass for O(1) access.
const STATUS_RANK: Record<string, number> = Object.fromEntries(
  RAFFLE_STATUS_ORDER.map((s, i) => [s.cssClass, i])
);

/** Return the numeric rank of a status (lower is higher priority). */
export function getStatusRank(info: StatusInfo): number {
  return STATUS_RANK[info.cssClass] ?? 999;
}

/** Convenience helper: derive a composite sort key [statusRank, endTimeSeconds]. */
export function getRaffleSortKey(state: RaffleState): [number, number] {
  const statusInfo = getRaffleStatus(state);
  const rank = getStatusRank(statusInfo);
  const endTime = bnToNumber(state.endTime);
  const now = Math.floor(Date.now() / 1000);
  // Future raffles: sort by soonest first (ASC). Past raffles: sort by most recent first (DESC via negative key).
  const timeKey = endTime >= now ? endTime : -endTime;
  return [rank, timeKey];
}

/**
 * Determines the current status of a raffle based on its state.
 * @param state - The raffle state from the blockchain
 * @returns StatusInfo containing display text and CSS class
 */
export function getRaffleStatus(state: RaffleState): StatusInfo {
  const now = Date.now() / 1000;
  const endTime = bnToNumber(state.endTime);
  const isOver = state.entrants.length >= state.maxTickets || now >= endTime;

  if (!isOver) {
    return RaffleStatus.Active;
  }

  // Raffle is over - check final states
  const winnerDrawn = state.winnerIndex !== null && state.winnerIndex !== undefined;

  if (winnerDrawn) {
    return state.claimed ? RaffleStatus.Claimed : RaffleStatus.AwaitingClaim;
  }

  // Raffle is over, but there are no contestants
  if (state.entrants.length === 0) {
    return RaffleStatus.EntriesClosed;
  }

  return state.drawWinnerStarted ? RaffleStatus.Drawing : RaffleStatus.ReadyToDraw;
}
