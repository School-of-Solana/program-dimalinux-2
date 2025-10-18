use anchor_lang::prelude::*;
use switchboard_on_demand::on_demand::accounts::randomness::RandomnessAccountData;

use crate::{
    errors::RaffleError,
    state::{RaffleState, RAFFLE_SEED},
};

pub fn shuffle_tickets_impl(ctx: Context<ShuffleTickets>) -> Result<()> {
    let raffle_state = &mut ctx.accounts.raffle_state;
    let clock = Clock::get()?;

    require!(
        raffle_state.is_raffle_over(&clock),
        RaffleError::RaffleNotEnded
    );

    require!(
        raffle_state.entrants.len() > 0,
        RaffleError::RaffleStateDataInvalid
    );

    let randomness_data =
        RandomnessAccountData::parse(ctx.accounts.randomness_account.data.borrow()).unwrap();

    let prev_slot = clock
        .slot
        .checked_sub(1)
        .ok_or(RaffleError::RandomnessExpired)?;
    if randomness_data.seed_slot != prev_slot {
        msg!("seed_slot: {}", randomness_data.seed_slot);
        msg!("slot: {}", clock.slot);
        return Err(RaffleError::RandomnessAlreadyRevealed.into());
    }
    // Track the player's commited values so you know they don't request randomness
    // multiple times.
    raffle_state.randomness_account = ctx.accounts.randomness_account.key();
    raffle_state.commit_slot = randomness_data.seed_slot;

    Ok(())
}

#[derive(Accounts)]
pub struct ShuffleTickets<'info> {
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
    /// CHECK: Switchboard randomness account (created & requested client-side)
    pub randomness_account: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}
