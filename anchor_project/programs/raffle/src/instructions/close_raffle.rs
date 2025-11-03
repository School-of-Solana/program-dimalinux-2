use anchor_lang::prelude::*;

use crate::{
    errors::RaffleError,
    state::{RaffleState, RAFFLE_SEED},
};

pub fn close_raffle_impl(_ctx: Context<CloseRaffle>) -> Result<()> {
    let raffle_manager = &_ctx.accounts.raffle_manager;
    let raffle_state = &_ctx.accounts.raffle_state;
    require!(
        raffle_state.raffle_manager.eq(raffle_manager.key),
        RaffleError::OnlyRaffleManagerCanClose
    );
    require!(
        raffle_state.claimed || raffle_state.entrants.len() == 0,
        RaffleError::CanNotCloseActiveRaffle
    );
    Ok(())
}

#[derive(Accounts)]
pub struct CloseRaffle<'info> {
    /// Raffle manager; must sign. Receives the rent refund when account closes.
    #[account(mut)]
    pub raffle_manager: Signer<'info>,
    /// Raffle state PDA [RAFFLE_SEED, raffle_manager, end_time]; closed to `raffle_manager`.
    #[account(
        mut,
        close = raffle_manager,
        seeds = [
            RAFFLE_SEED.as_bytes(),
            raffle_state.raffle_manager.key().as_ref(),
            raffle_state.end_time.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub raffle_state: Account<'info, RaffleState>,
}
