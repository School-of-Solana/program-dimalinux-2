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
        RaffleError::RaffleEnded
    );

    let tickets_reserved: bool = reserve_tickets(raffle_state, buyer.key(), number_of_tickets);
    require!(tickets_reserved, RaffleError::InsufficientTicketsAvailable);

    // Safely compute the total price and throw an error if it overflows
    let total_price = raffle_state
        .ticket_price
        .checked_mul(number_of_tickets as u64)
        .ok_or(RaffleError::TooManyTickets)?;

    // Transfer ticket price from buyer to the raffle account
    invoke(
        &transfer(
            &buyer.key(),        // Source
            &raffle_state.key(), // Destination
            total_price,         // Amount in lamports
        ),
        &[buyer.to_account_info(), raffle_state.to_account_info()],
    )?;

    Ok(())
}

pub fn reserve_tickets(
    raffle_state: &mut Account<RaffleState>,
    buyer: Pubkey,
    num_tickets: u32,
) -> bool {
    if let Some(new_total) = raffle_state
        .entrants
        .len()
        .checked_add(num_tickets as usize)
    {
        if new_total <= raffle_state.max_tickets as usize {
            raffle_state
                .entrants
                .extend(iter::repeat(buyer).take(num_tickets as usize));
            return true;
        }
    }
    false
}

#[derive(Accounts)]
pub struct BuyTickets<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(
        mut,
        seeds = [
            RAFFLE_SEED.as_bytes(),
            raffle_state.owner.key().as_ref(),
            raffle_state.end_time.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub raffle_state: Account<'info, RaffleState>,
    pub system_program: Program<'info, System>,
}
