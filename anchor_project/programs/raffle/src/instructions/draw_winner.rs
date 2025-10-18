use anchor_lang::{prelude::*, solana_program::clock::Clock};
use switchboard_on_demand::on_demand::accounts::randomness::RandomnessAccountData;

use crate::{
    errors::RaffleError,
    state::{RaffleState, RAFFLE_SEED},
};

pub fn draw_winner_impl(ctx: Context<DrawWinner>) -> Result<()> {
    let raffle_state = &mut ctx.accounts.raffle_state;
    require!(
        raffle_state.winner_index.is_none(),
        RaffleError::WinnerAlreadyDrawn
    );
    require!(
        raffle_state.entrants.len() > 0,
        RaffleError::RaffleStateDataInvalid
    );
    let clock: Clock = Clock::get()?;
    require!(
        raffle_state.is_raffle_over(&clock),
        RaffleError::RaffleNotEnded
    );

    // Require that randomness was requested
    require!(
        raffle_state.commit_slot != 0,
        RaffleError::RandomnessNotRequested
    );
    require!(
        raffle_state.randomness_account != Pubkey::default(),
        RaffleError::RandomnessNotRequested
    );

    // Verify that the provided randomness account matches the stored one
    if ctx.accounts.randomness_account.key() != raffle_state.randomness_account {
        return Err(RaffleError::InvalidRandomnessAccount.into());
    }

    // call the switchboard on-demand parse function to get the randomness data
    let randomness_data: core::cell::Ref<RandomnessAccountData> =
        RandomnessAccountData::parse(ctx.accounts.randomness_account.data.borrow()).unwrap();
    if randomness_data.seed_slot != raffle_state.commit_slot {
        return Err(RaffleError::RandomnessExpired.into());
    }

    // call the switchboard on-demand get_value function to get the revealed random value
    let randomness: [u8; 32] = randomness_data
        .get_value(clock.slot)
        .map_err(|_| RaffleError::RandomnessNotResolved)?;

    let random_num = usize::from_le_bytes(randomness[0..16].try_into().unwrap());
    let winner_index = random_num % raffle_state.entrants.len();
    raffle_state.winner_index = Some(winner_index as u32);

    Ok(())
}

#[derive(Accounts)]
pub struct DrawWinner<'info> {
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
    /// CHECK: Must point to the Switchboard randomness account used during request
    pub randomness_account: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}
