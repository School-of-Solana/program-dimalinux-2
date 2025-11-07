use anchor_lang::prelude::*;

use crate::{
    errors::RaffleError,
    state::{RaffleState, RAFFLE_SEED},
};

pub(crate) fn claim_prize_impl(ctx: Context<ClaimPrize>) -> Result<()> {
    let raffle_state = &mut ctx.accounts.raffle_state;
    let winner = &mut ctx.accounts.winner;

    let prize_amount = raffle_state.ticket_price * raffle_state.entrants.len() as u64;

    raffle_state.sub_lamports(prize_amount)?;
    winner.add_lamports(prize_amount)?;
    raffle_state.claimed = true;

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimPrize<'info> {
    /// Winner receives prize lamports. Anyone can trigger the claim on behalf
    /// of the winner.
    /// CHECK: Winner is validated against raffle_state.entrants[winner_index]
    /// via the constraint on raffle_state.
    #[account(mut)]
    pub winner: UncheckedAccount<'info>,
    /// Raffle state PDA [RAFFLE_SEED, raffle_manager, end_time]; pays prize to winner and flips `claimed`.
    #[account(
        mut,
        seeds = [
            RAFFLE_SEED.as_bytes(),
            raffle_state.raffle_manager.key().as_ref(),
            raffle_state.end_time.to_le_bytes().as_ref()
        ],
        bump,
        constraint = raffle_state.winner_index.is_some()
            @ RaffleError::WinnerNotYetDrawn,
        constraint = raffle_state.entrants[raffle_state.winner_index.unwrap() as usize]
            .eq(winner.key)
            @ RaffleError::NotWinner,
        constraint = !raffle_state.claimed
            @ RaffleError::PrizeAlreadyClaimed
    )]
    pub raffle_state: Account<'info, RaffleState>,
}
