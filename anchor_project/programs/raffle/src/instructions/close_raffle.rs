use anchor_lang::prelude::*;

use crate::{
    errors::RaffleError,
    state::{RaffleState, RAFFLE_SEED},
};

pub(crate) fn close_raffle_impl(_ctx: Context<CloseRaffle>) -> Result<()> {
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
        has_one = raffle_manager @ RaffleError::OnlyRaffleManagerCanClose,
        seeds = [
            RAFFLE_SEED.as_bytes(),
            raffle_state.raffle_manager.key().as_ref(),
            raffle_state.end_time.to_le_bytes().as_ref()
        ],
        bump,
        constraint = raffle_state.claimed || raffle_state.entrants.is_empty()
            @ RaffleError::CanNotCloseActiveRaffle
    )]
    pub raffle_state: Account<'info, RaffleState>,
}
