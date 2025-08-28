use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use crate::errors::RaffleError;
use crate::state::RaffleState;

pub fn draw_winner(ctx: Context<DrawWinnerContext>) -> Result<()> {
    let program_id = &crate::ID_CONST;
    let authority = &ctx.accounts.raffle_owner;
    let raffle_account = &ctx.accounts.raffle_state;

    // Verify the program owns the raffle account
    if raffle_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId.into());
    }

    // Deserialize raffle state
    let mut raffle_state =
        RaffleState::deserialize_from_account(&raffle_account.try_borrow_data()?)?;

    // Verify the authority is the raffle creator
    if raffle_state.authority != *authority.key {
        return Err(ProgramError::InvalidArgument.into());
    }

    // Check if the raffle has ended
    let now: u64 = solana_program::clock::Clock::get()?
        .unix_timestamp
        .try_into()
        .expect("Negative timestamp");
    if now < raffle_state.end_time
        && raffle_state.entrants.len() < raffle_state.max_tickets as usize
    {
        return Err(RaffleError::RaffleNotEnded.into());
    }

    // Check if winner already drawn
    if raffle_state.winner.is_some() {
        return Err(RaffleError::WinnerAlreadyDrawn.into());
    }

    // use the clock to get a random number between 0 and the number of entrants
    // TODO: do something better than this
    let winner_index = now % raffle_state.sold_tickets() as u64;
    let winner = raffle_state.entrants[winner_index as usize];

    raffle_state.winner = Some(winner);

    // Update the state on the blockchain
    raffle_state.serialize_to_account(*raffle_account.try_borrow_mut_data()?)?;

    Ok(())
}



#[derive(Accounts)]
pub struct DrawWinnerContext<'info> {
    pub raffle_owner: Signer<'info>,
    #[account(mut)]
    pub raffle_state: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
