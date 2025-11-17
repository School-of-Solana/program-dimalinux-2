//! Raffle program
//!
//! Implements a raffle with the following flow:
//! - create_raffle: Initialize a raffle state PDA with pricing, capacity, and end time.
//! - buy_tickets: Users buy one or more tickets; entrants are appended.
//! - draw_winner: Starts a VRF request to select a winner once the raffle is over.
//! - draw_winner_callback: VRF callback that finalizes winner selection and emits `WinnerDrawnEvent`.
//! - claim_prize: Winner claims the accumulated prize from the raffle account.
//! - close_raffle: Raffle manager reclaims rent once eligible.

#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
pub use instructions::*;
pub mod errors;
pub mod instructions;
pub mod state;

declare_id!("Rafs56vPtgBLfMQoafTVmf4QB11gqqkysfJx949d99p");

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
    /// - `RaffleError::MaxRaffleLengthExceeded`: the provided `end_time` cannot be more
    ///   than 30 days from the current time.
    /// - `RaffleError::MaxTicketsIsZero`: `max_tickets` must be at least 1.
    /// - `RaffleError::RaffleTooLarge`: the computed maximum prize pool
    ///   (`ticket_price * max_tickets`) overflowed `u64`.
    /// - `RaffleError::TicketPriceTooLow`: `ticket_price` must be at least
    ///   `MIN_TICKET_PRICE_LAMPORTS` (currently 100_000 lamports, i.e. 0.0001 SOL).
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
    /// - `RaffleError::InsufficientTickets`: the purchase would exceed available tickets.
    pub fn buy_tickets(ctx: Context<BuyTickets>, number_of_tickets: u32) -> Result<()> {
        buy_tickets_impl(ctx, number_of_tickets)
    }

    /// Requests verifiable randomness for the raffle and marks the draw process
    /// as started. This triggers an off-chain VRF flow that later (within a few
    /// seconds) invokes the `draw_winner_callback` callback that does the actual
    /// winner selection.
    ///
    /// Accounts: see [`DrawWinner`] for required accounts and seeds.
    ///
    /// Errors:
    /// - `RaffleError::WinnerAlreadyDrawn`: a winner has already been selected.
    /// - `RaffleError::RaffleNotOver`: the raffle has not reached its end time yet.
    /// - `RaffleError::NoEntrants`: there are no entrants in the raffle.
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
    /// - `RaffleError::WinnerAlreadyDrawn`: a winner has already been set by a previous callback.
    pub fn draw_winner_callback(
        ctx: Context<DrawWinnerCallback>,
        randomness: [u8; 32],
    ) -> Result<()> {
        draw_winner_callback_impl(ctx, randomness)
    }

    /// Transfers the total prize pool to the winner and marks the raffle as
    /// claimed. Can be called by anyone after the winner has been drawn; the
    /// prize is always sent to the winner selected by `draw_winner_callback`
    /// using the VRF's randomness.
    ///
    /// Accounts: see [`ClaimPrize`] for required accounts and seeds.
    ///
    /// Errors:
    /// - `RaffleError::WinnerNotYetDrawn`: no winner has been selected yet.
    /// - `RaffleError::Unauthorized`: the provided winner account does not match the selected winner.
    /// - `RaffleError::PrizeAlreadyClaimed`: the prize was already claimed.
    pub fn claim_prize(ctx: Context<ClaimPrize>) -> Result<()> {
        claim_prize_impl(ctx)
    }

    /// Closes the raffle state account and returns the remaining rent/lamports
    /// to the raffle manager. Can be called by either the raffle manager or the
    /// program upgrade authority. Only possible if no tickets were sold or the
    /// prize has already been claimed.
    ///
    /// Emits: none
    ///
    /// Accounts: see [`CloseRaffle`] for required accounts and seeds.
    ///
    /// Errors:
    /// - `RaffleError::OnlyRaffleManagerOrProgramOwnerCanClose`: caller is neither
    ///   the raffle manager nor the program upgrade authority.
    /// - `RaffleError::CanNotCloseActiveRaffle`: tickets were sold and the prize
    ///   has not yet been claimed.
    pub fn close_raffle(ctx: Context<CloseRaffle>) -> Result<()> {
        close_raffle_impl(ctx)
    }
}
