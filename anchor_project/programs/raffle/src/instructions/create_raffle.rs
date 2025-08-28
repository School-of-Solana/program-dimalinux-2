use crate::state::RaffleState;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::system_instruction::create_account;
use anchor_lang::system_program;

pub fn create_raffle(ctx: Context<CreateRaffleContext>, ticket_price: u64, max_tickets: u32, end_time: u64) -> Result<()> {
    let raffle_owner = &ctx.accounts.raffle_owner;
    let raffle_stat_acct = &ctx.accounts.raffle_state;

    // Check that the account data length is zero (not initialized)
    if raffle_stat_acct.data_len() != 0 {
        return Err(ProgramError::AccountAlreadyInitialized.into());
    }

    // Check that the account owner is the system program ID. After we
    // create the account, the owner will be our program ID.
    if raffle_stat_acct.owner != &system_program::ID {
        return Err(ProgramError::IncorrectProgramId.into());
    }

    // Create raffle state
    let raffle_state = RaffleState {
        authority: *raffle_owner.key,
        ticket_price,
        end_time,
        winner: None,
        max_tickets,
        claimed: false,
        entrants: vec![],
    };

    let account_space = raffle_state.max_size_in_bytes();
    let required_lamports = Rent::get()?.minimum_balance(account_space);

    invoke(
        &create_account(
            raffle_owner.key,   // Account paying for the new account
            raffle_stat_acct.key,   // Account to be created
            required_lamports,    // Amount of lamports to transfer to the new account
            account_space as u64, // Size in bytes to allocate for the data field
            &crate::id(),           // Set program owner to our program
        ),
        &[
            raffle_owner.to_account_info(),
            raffle_stat_acct.to_account_info(),
        ],
    )?;

    // Somehow, the owner changes to the program ID during account creation,
    // even though we didn't pass it to `invoke` as mutable.
    if raffle_stat_acct.owner.ne(&crate::id()) {
        return Err(ProgramError::IncorrectProgramId.into());
    }

    // Serialize and save the state
    raffle_state.serialize_to_account(*raffle_stat_acct.try_borrow_mut_data()?)?;

    Ok(())
}


#[derive(Accounts)]
pub struct CreateRaffleContext<'info> {
    #[account(mut)]
    pub raffle_owner: Signer<'info>,
    #[account(mut)]
    pub raffle_state: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
