use crate::errors::RaffleError;
use crate::state::RaffleState;
use anchor_lang::prelude::*;

pub fn claim_prize(ctx: Context<ClaimPrizeContext>) -> Result<()> {
    let program_id = &crate::ID_CONST;
    let raffle_state_acct = &ctx.accounts.raffle_state;
    let winner = &ctx.accounts.winner;

    // Verify the program owns the raffle account
    if raffle_state_acct.owner != program_id {
        return Err(ProgramError::IncorrectProgramId.into());
    }

    // Verify the winner signed the transaction
    if !winner.is_signer {
        return Err(ProgramError::MissingRequiredSignature.into());
    }

    // Deserialize the raffle state
    let mut raffle_state =
        RaffleState::deserialize_from_account(&raffle_state_acct.try_borrow_data()?)?;

    // Check if winner exists
    if raffle_state.winner.is_none() {
        return Err(RaffleError::WinnerNotYetDrawn.into());
    }

    let actual_winner = raffle_state.winner.unwrap();
    if *winner.key != actual_winner {
        return Err(ProgramError::InvalidArgument.into());
    }

    // Check if prize already claimed
    if raffle_state.claimed {
        return Err(RaffleError::PrizeAlreadyClaimed.into());
    }

    let prize_amount = raffle_state.prize_amount();
    let raffle_balance = raffle_state_acct.lamports();
    let winner_balance = winner.lamports();

    let new_raffle_balance = raffle_balance
        .checked_sub(prize_amount)
        .ok_or(ProgramError::InsufficientFunds)?;
    let new_winner_balance = winner_balance
        .checked_add(prize_amount)
        .ok_or(ProgramError::InvalidArgument)?;

    **raffle_state_acct.try_borrow_mut_lamports()? = new_raffle_balance;
    **winner.try_borrow_mut_lamports()? = new_winner_balance;

    // Mark prize as claimed
    raffle_state.claimed = true;

    // Save updated state
    raffle_state.serialize_to_account(*raffle_state_acct.try_borrow_mut_data()?)?;

    Ok(())
}


#[derive(Accounts)]
pub struct ClaimPrizeContext<'info> {
    #[account(mut)]
    pub winner: Signer<'info>,
    #[account(mut)]
    pub raffle_state: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>, // required?
}
