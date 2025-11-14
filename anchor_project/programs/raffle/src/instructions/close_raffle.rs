use anchor_lang::{prelude::*, solana_program::bpf_loader_upgradeable};

use crate::{
    errors::RaffleError,
    state::{RaffleState, RAFFLE_SEED},
};

pub(crate) fn close_raffle_impl(_ctx: Context<CloseRaffle>) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
pub struct CloseRaffle<'info> {
    /// Either the raffle manager or the program upgrade authority; must sign.
    #[account(mut)]
    pub signer: Signer<'info>,

    /// CHECK: Raffle manager key from raffle_state; receives rent refund.
    /// When signer is the raffle manager, this is the same account.
    /// When signer is the program owner, this is where rent goes.
    #[account(mut)]
    pub raffle_manager: UncheckedAccount<'info>,

    /// Raffle state PDA [RAFFLE_SEED, raffle_manager, end_time]; closed to `raffle_manager`.
    #[account(
        mut,
        close = raffle_manager,
        has_one = raffle_manager @ RaffleError::OnlyRaffleManagerOrProgramOwnerCanClose,
        seeds = [
            RAFFLE_SEED.as_bytes(),
            raffle_state.raffle_manager.key().as_ref(),
            raffle_state.end_time.to_le_bytes().as_ref()
        ],
        bump,
        constraint = raffle_state.claimed || raffle_state.entrants.is_empty()
            @ RaffleError::CanNotCloseActiveRaffle,
        constraint = raffle_state.raffle_manager == signer.key()
            || program_data.upgrade_authority_address == Some(signer.key())
            @ RaffleError::OnlyRaffleManagerOrProgramOwnerCanClose
    )]
    pub raffle_state: Account<'info, RaffleState>,

    /// The program data account containing upgrade authority for this program.
    #[account(
        seeds = [crate::ID.as_ref()],
        bump,
        seeds::program = bpf_loader_upgradeable::id(),
    )]
    pub program_data: Account<'info, ProgramData>,
}
