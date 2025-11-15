use anchor_lang::{
    prelude::*,
    solana_program::clock::{Clock, UnixTimestamp},
};

use crate::{
    errors::RaffleError,
    state::{RaffleState, RAFFLE_SEED},
};

/// Maximum raffle duration in seconds
pub const THIRTY_DAYS_IN_SECS: i64 = 30 * 24 * 60 * 60;
/// Minimum allowed ticket price in lamports
pub const MIN_TICKET_PRICE_LAMPORTS: u64 = 100_000; // 0.0001 SOL

pub(crate) fn create_raffle_impl(
    ctx: Context<CreateRaffle>,
    ticket_price: u64,
    max_tickets: u32,
    end_time: UnixTimestamp,
) -> Result<()> {
    let raffle_owner = &ctx.accounts.raffle_owner;
    let raffle_state = &mut ctx.accounts.raffle_state;
    msg!("New state account: {}", raffle_state.key());

    let _ = ticket_price
        .checked_mul(max_tickets as u64)
        .ok_or(RaffleError::RaffleTooLarge)?;

    raffle_state.raffle_manager = *raffle_owner.key;
    raffle_state.ticket_price = ticket_price;
    raffle_state.end_time = end_time;
    raffle_state.winner_index = None;
    raffle_state.max_tickets = max_tickets;
    raffle_state.claimed = false;
    raffle_state.entrants = vec![];

    Ok(())
}

#[derive(Accounts)]
#[instruction(ticket_price: u64, max_tickets: u32, end_time: i64)]
pub struct CreateRaffle<'info> {
    /// Raffle manager and payer for raffle_state account creation
    #[account(mut)]
    pub raffle_owner: Signer<'info>,
    /// Raffle state PDA initialized with seeds [RAFFLE_SEED, raffle_owner, end_time].
    /// Space is derived from max_tickets; rent paid by `raffle_owner`.
    #[account(
        init,
        payer = raffle_owner,
        space = {8 + RaffleState::account_space(max_tickets)},
        seeds = [
            RAFFLE_SEED.as_bytes(),
            raffle_owner.key().as_ref(),
            end_time.to_le_bytes().as_ref(),
        ],
        bump,
        constraint = end_time > clock.unix_timestamp
            @ RaffleError::RaffleEndTimeInPast,
        constraint = end_time <= clock.unix_timestamp + THIRTY_DAYS_IN_SECS
            @ RaffleError::MaxRaffleLengthExceeded,
        constraint = max_tickets > 0
            @ RaffleError::MaxTicketsIsZero,
        constraint = ticket_price >= MIN_TICKET_PRICE_LAMPORTS
            @ RaffleError::TicketPriceTooLow
    )]
    pub raffle_state: Account<'info, RaffleState>,
    /// System program needed to create the raffle state account.
    pub system_program: Program<'info, System>,
    /// Clock sysvar for timestamp validation
    pub clock: Sysvar<'info, Clock>,
}
