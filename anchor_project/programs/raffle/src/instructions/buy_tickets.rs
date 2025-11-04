use core::iter;

use anchor_lang::{
    prelude::*,
    solana_program::{clock::Clock, program::invoke, system_instruction::transfer},
};

use crate::{
    errors::RaffleError,
    state::{RaffleState, RAFFLE_SEED},
};

pub fn buy_tickets_impl(ctx: Context<BuyTickets>, number_of_tickets: u32) -> Result<()> {
    let raffle_state = &mut ctx.accounts.raffle_state;
    let buyer = &ctx.accounts.buyer;
    let clock = Clock::get()?;
    require!(
        !raffle_state.is_raffle_over(&clock),
        RaffleError::RaffleHasEnded
    );

    // Check if there are enough tickets available
    // (overflow impossible: entrants.len() bounded by max_tickets which is u32)
    let new_total = raffle_state
        .entrants
        .len()
        .checked_add(number_of_tickets as usize)
        .unwrap();
    require!(
        new_total <= raffle_state.max_tickets as usize,
        RaffleError::InsufficientTickets
    );

    // Compute total price (overflow prevented by create_raffle checks)
    let total_price = raffle_state
        .ticket_price
        .checked_mul(number_of_tickets as u64)
        .unwrap();

    // Transfer ticket price from buyer to the raffle account
    invoke(
        &transfer(
            &buyer.key(),        // Source
            &raffle_state.key(), // Destination
            total_price,         // Amount in lamports
        ),
        &[buyer.to_account_info(), raffle_state.to_account_info()],
    )?;

    // Reserve tickets for the buyer
    raffle_state
        .entrants
        .extend(iter::repeat(buyer.key()).take(number_of_tickets as usize));

    Ok(())
}

#[derive(Accounts)]
pub struct BuyTickets<'info> {
    /// Buyer paying for tickets; must sign.
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// Raffle state PDA [RAFFLE_SEED, raffle_manager, end_time]; receives ticket lamports.
    #[account(
        mut,
        seeds = [
            RAFFLE_SEED.as_bytes(),
            raffle_state.raffle_manager.key().as_ref(),
            raffle_state.end_time.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub raffle_state: Account<'info, RaffleState>,
    /// System program (transfer lamports).
    pub system_program: Program<'info, System>,
}
