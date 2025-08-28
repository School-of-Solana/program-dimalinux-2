use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::system_instruction::transfer;
use crate::errors::RaffleError;
use crate::state::RaffleState;

pub fn buy_tickets(ctx: Context<BuyTicketsContext>, number_of_tickets: u32) -> Result<()> {
    let raffle_state_acct = &ctx.accounts.raffle_state;
    let buyer = &ctx.accounts.buyer;

    // Verify that the unmanaged raffle state account is owned by our program
    if raffle_state_acct.owner.ne(&crate::id()) {
        return Err(ProgramError::IncorrectProgramId.into());
    }

    let mut raffle_state =
        RaffleState::deserialize_from_account(&raffle_state_acct.try_borrow_data()?)?;

    // Check if the raffle has ended
    let now: u64 = solana_program::clock::Clock::get()?
        .unix_timestamp
        .try_into()
        .expect("Negative timestamp");
    if now >= raffle_state.end_time {
        return Err(RaffleError::RaffleEnded.into());
    }

    if !raffle_state.reserve_tickets(buyer.key, number_of_tickets) {
        return Err(RaffleError::RaffleFull.into());
    }

    // Safely compute the total price and throw an error if it overflows
    let total_price = raffle_state
        .ticket_price
        .checked_mul(number_of_tickets as u64)
        .ok_or(RaffleError::TooManyTickets)?;

    // Transfer ticket price from buyer to the raffle account
    invoke(
        &transfer(
            &buyer.key(), // Source
            &raffle_state_acct.key(), // Destination
            total_price, // Amount in lamports
        ),
        &[
            buyer.to_account_info(),
            raffle_state_acct.to_account_info(),
        ],
    )?;

    // Save updated unmanaged raffle state back to the blockchain.
    raffle_state.serialize_to_account(*raffle_state_acct.try_borrow_mut_data()?)?;

    Ok(())
}

#[derive(Accounts)]
pub struct BuyTicketsContext<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut)]
    pub raffle_state: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
