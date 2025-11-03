//! Raffle program
//!
//! This program implements a simple raffle with the following flow:
//! - create_raffle: Initialize a raffle state PDA with pricing, capacity, and end time.
//! - buy_tickets: Users buy one or more tickets; entrants are appended.
//! - draw_winner: Starts a VRF request to select a winner once the raffle is over.
//! - draw_winner_callback: VRF callback that finalizes winner selection and emits `WinnerDrawnEvent`.
//! - claim_prize: Winner claims the accumulated prize from the raffle account.
//! - close_raffle: Raffle manager reclaims rent once eligible.
//!
//! Documentation source of truth:
//! - Instruction docs (including Args, Errors, and Emits) live in this file inside the `#[program]` module and are propagated to the IDL.
//! - Required accounts for each instruction are documented on the corresponding `#[derive(Accounts)]` context structs under `instructions/`.
//! - On-chain state structs are documented in `state.rs` and appear under `types` in the IDL.
//! - Events are documented where they are defined (e.g., `WinnerDrawnEvent` in `draw_winner.rs`).

#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
pub use instructions::*;
pub mod errors;
pub mod instructions;
pub mod state;

declare_id!("4LcauHsjXDZqGonxZu261YLPHV3TRsLYZ7o1pTT5q2uQ");

#[program]
pub mod raffle {
    use super::*;

    /// Creates and initializes a new raffle state account (PDA) with the
    /// provided parameters.
    ///
    /// Args:
    /// - `ticket_price` (u64): price per ticket in lamports.
    /// - `max_tickets` (u32): maximum number of entrants allowed.
    /// - `end_time` (i64): Unix timestamp (seconds) when the raffle ends.
    ///
    /// Accounts: see [`CreateRaffle`] for required accounts and seeds.
    ///
    /// Errors:
    /// - `RaffleError::RaffleEndTimeInPast`: the provided `end_time` must be in the
    ///   future relative to the cluster clock.
    /// - `RaffleError::RaffleTooLarge`: the computed maximum prize pool
    ///   (`ticket_price * max_tickets`) overflowed `u64`.
    pub fn create_raffle(
        ctx: Context<CreateRaffle>,
        ticket_price: u64,
        max_tickets: u32,
        end_time: i64,
    ) -> Result<()> {
        create_raffle_impl(ctx, ticket_price, max_tickets, end_time)
    }

    /// Buys one or more tickets for the caller and transfers the ticket price
    /// in lamports from the buyer to the raffle account.
    ///
    /// Args:
    /// - `number_of_tickets` (u32): how many tickets to purchase in this call.
    ///
    /// Accounts: see [`BuyTickets`] for required accounts and seeds.
    ///
    /// Errors:
    /// - `RaffleError::RaffleHasEnded`: attempting to buy after the raffle end time.
    /// - `RaffleError::RaffleIsFull`: the purchase would exceed `max_tickets`.
    /// - `RaffleError::InsufficientTicketsToFulfillRequest`: overflow computing
    ///   `ticket_price * number_of_tickets` (treated as an invalid request).
    pub fn buy_tickets(ctx: Context<BuyTickets>, number_of_tickets: u32) -> Result<()> {
        buy_tickets_impl(ctx, number_of_tickets)
    }

    /// Requests verifiable randomness for the raffle and marks the draw process
    /// as started. This triggers an off-chain VRF flow that will later invoke
    /// the on-chain callback.
    ///
    /// Emits: none (the winner event is emitted by the callback).
    ///
    /// Accounts: see [`DrawWinner`] for required accounts and seeds.
    ///
    /// Errors:
    /// - `RaffleError::WinnerAlreadyDrawn`: a winner has already been selected.
    /// - `RaffleError::RaffleStateDataInvalid`: there are no entrants.
    /// - `RaffleError::RaffleNotOver`: the raffle has not reached its end time yet.
    pub fn draw_winner(ctx: Context<DrawWinner>) -> Result<()> {
        draw_winner_impl(ctx)
    }

    /// Callback invoked by the VRF program once randomness is available. This
    /// finalizes the selection of the winner and emits `WinnerDrawnEvent`.
    ///
    /// Args:
    /// - `randomness` ([u8; 32]): 256-bit random value provided by VRF.
    ///
    /// Emits: [`WinnerDrawnEvent`]
    ///
    /// Accounts: see [`DrawWinnerCallback`] for required accounts and seeds.
    ///
    /// Errors:
    /// - `RaffleError::DrawWinnerNotStarted`: the draw process was not started
    ///   (i.e., `draw_winner` was not called successfully before the callback).
    pub fn draw_winner_callback(
        ctx: Context<DrawWinnerCallback>,
        randomness: [u8; 32],
    ) -> Result<()> {
        draw_winner_callback_impl(ctx, randomness)
    }

    /// Transfers the total prize pool to the winner and marks the raffle as
    /// claimed. Can only be called by the winner after the winner has been
    /// drawn.
    ///
    /// Emits: none
    ///
    /// Accounts: see [`ClaimPrize`] for required accounts and seeds.
    ///
    /// Errors:
    /// - `RaffleError::WinnerNotYetDrawn`: no winner has been selected yet.
    /// - `RaffleError::Unauthorized`: the caller is not the selected winner.
    /// - `RaffleError::PrizeAlreadyClaimed`: the prize was already claimed.
    pub fn claim_prize(ctx: Context<ClaimPrize>) -> Result<()> {
        claim_prize_impl(ctx)
    }

    /// Closes the raffle state account and returns the remaining rent/lamports
    /// to the raffle manager. Only possible if no tickets were sold or the
    /// prize has already been claimed.
    ///
    /// Emits: none
    ///
    /// Accounts: see [`CloseRaffle`] for required accounts and seeds.
    ///
    /// Errors:
    /// - `RaffleError::OnlyRaffleManagerCanClose`: caller is not the
    ///   `raffle_manager`.
    /// - `RaffleError::CanNotCloseActiveRaffle`: tickets were sold and the prize
    ///   has not yet been claimed.
    pub fn close_raffle(ctx: Context<CloseRaffle>) -> Result<()> {
        close_raffle_impl(ctx)
    }
}
