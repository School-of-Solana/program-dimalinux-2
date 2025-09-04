use anchor_lang::{prelude::*, solana_program::clock::Clock};

use crate::{
    errors::RaffleError,
    state::{RaffleState, RAFFLE_SEED},
};

pub fn draw_winner_impl(ctx: Context<DrawWinner>) -> Result<()> {
    let raffle_owner = &ctx.accounts.raffle_owner;
    let raffle_state = &mut ctx.accounts.raffle_state;

    // Verify that the signer owns this particular raffle
    require!(
        raffle_state.owner.eq(raffle_owner.key),
        RaffleError::Unauthorized
    );

    // The raffle is over if all the tickets are sold or the end time has passed
    let now = Clock::get()?.unix_timestamp;
    require!(
        raffle_state.entrants.len() >= raffle_state.max_tickets as usize
            || now >= raffle_state.end_time,
        RaffleError::RaffleNotEnded
    );

    // Check if winner was already drawn
    require!(
        raffle_state.winner.is_none(),
        RaffleError::WinnerAlreadyDrawn
    );

    // use the clock to get a random number between 0 and the number of entrants
    // TODO: do something better than this
    let winner_index = now as usize % raffle_state.entrants.len();
    let winner = raffle_state.entrants[winner_index];

    raffle_state.winner = Some(winner);

    Ok(())
}

#[derive(Accounts)]
pub struct DrawWinner<'info> {
    pub raffle_owner: Signer<'info>,
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
