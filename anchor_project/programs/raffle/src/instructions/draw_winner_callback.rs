use anchor_lang::prelude::*;

use crate::{
    errors::RaffleError,
    state::{RaffleState, RAFFLE_SEED},
};

use ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY;

pub fn draw_winner_callback_impl(
    ctx: Context<DrawWinnerCallback>,
    randomness: [u8; 32],
) -> Result<()> {
    let raffle_state = &mut ctx.accounts.raffle_state;

    let randomness_str: String = randomness
        .iter()
        .map(|byte| format!("{:02x}", byte))
        .collect();
    msg!("Received random data: 0x{}", randomness_str);

    let random_num = ephemeral_vrf_sdk::rnd::random_u64(&randomness) as usize;
    let winner_index = random_num % raffle_state.entrants.len();
    raffle_state.winner_index = Some(winner_index as u32);

    emit!(WinnerDrawnEvent {
        raffle_state: raffle_state.key(),
        winner_index: winner_index as u32,
        winner: raffle_state.entrants[winner_index],
    });

    Ok(())
}

#[derive(Accounts)]
pub struct DrawWinnerCallback<'info> {
    /// Callback can only be executed by the VRF program through CPI.
    #[account(address = VRF_PROGRAM_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,
    /// Raffle state PDA [RAFFLE_SEED, raffle_manager, end_time]; mutated to set winner.
    /// Validated first to make the draw_winner_started and winner_index checks testable.
    #[account(
        mut,
        seeds = [
            RAFFLE_SEED.as_bytes(),
            raffle_state.raffle_manager.key().as_ref(),
            raffle_state.end_time.to_le_bytes().as_ref()
        ],
        bump,
        constraint = raffle_state.draw_winner_started @ RaffleError::DrawWinnerNotStarted,
        constraint = raffle_state.winner_index.is_none() @ RaffleError::WinnerAlreadyDrawn
    )]
    pub raffle_state: Account<'info, RaffleState>,
}

#[event]
/// Emitted when a winner has been selected for a raffle.
///
/// Fields:
/// - `raffle_state`: the raffle state PDA for which the winner was drawn.
/// - `winner_index`: index into `entrants` vector for the winning entry.
/// - `winner`: public key of the winning entrant.
pub struct WinnerDrawnEvent {
    /// Raffle state PDA for which the winner was drawn.
    pub raffle_state: Pubkey,
    /// Index into `entrants` corresponding to the winner.
    pub winner_index: u32,
    /// Winner's public key.
    pub winner: Pubkey,
}
