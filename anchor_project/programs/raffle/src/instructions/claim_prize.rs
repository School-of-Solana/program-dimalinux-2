use anchor_lang::prelude::*;

use crate::{
    errors::RaffleError,
    state::{RaffleState, RAFFLE_SEED},
};

pub fn claim_prize_impl(ctx: Context<ClaimPrize>) -> Result<()> {
    let raffle_state = &mut ctx.accounts.raffle_state;
    let winner = &mut ctx.accounts.winner;

    // Check if winner exists and randomness fulfilled
    require!(
        raffle_state.winner_index.is_some(),
        RaffleError::WinnerNotYetDrawn
    );
    let winner_index = raffle_state.winner_index.unwrap() as usize;

    require!(
        raffle_state.entrants[winner_index].eq(winner.key),
        RaffleError::Unauthorized
    );
    require!(!raffle_state.claimed, RaffleError::PrizeAlreadyClaimed);

    let prize_amount = raffle_state.ticket_price * raffle_state.entrants.len() as u64;

    raffle_state.sub_lamports(prize_amount)?;
    winner.add_lamports(prize_amount)?;
    raffle_state.claimed = true;

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimPrize<'info> {
    #[account(mut)]
    pub winner: Signer<'info>,
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
    pub system_program: Program<'info, System>,
}
