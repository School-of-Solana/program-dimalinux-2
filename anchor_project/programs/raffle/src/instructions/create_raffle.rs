use anchor_lang::{
    prelude::*,
    solana_program::clock::{Clock, UnixTimestamp},
};

use crate::{
    errors::RaffleError,
    state::{RaffleState, RAFFLE_SEED},
};

pub fn create_raffle_impl(
    ctx: Context<CreateRaffle>,
    ticket_price: u64,
    max_tickets: u32,
    end_time: UnixTimestamp,
) -> Result<()> {
    // Log the values of max_tickets and end_time
    msg!(
        "Creating raffle max_tickets: {}, end_time: {}",
        max_tickets,
        UnixTimestamp::from(end_time)
    );
    msg!("Raffle state account: {}", ctx.accounts.raffle_state.key());

    let raffle_owner = &ctx.accounts.raffle_owner;
    let raffle_state = &mut ctx.accounts.raffle_state;

    let now = Clock::get()?.unix_timestamp;
    require!(
        now > raffle_state.end_time,
        RaffleError::RaffleEndTimeInPast
    );

    let _ = ticket_price
        .checked_mul(max_tickets as u64)
        .ok_or(RaffleError::RaffleTooLarge)?;

    raffle_state.owner = *raffle_owner.key;
    raffle_state.ticket_price = ticket_price;
    raffle_state.end_time = end_time;
    raffle_state.winner_index = None;
    raffle_state.max_tickets = max_tickets;
    raffle_state.claimed = false;
    raffle_state.entrants = vec![];

    Ok(())
}

#[derive(Accounts)]
#[instruction(ticket_price: u64, max_tickets: u32, end_time: i64)]
pub struct CreateRaffle<'info> {
    #[account(mut)]
    pub raffle_owner: Signer<'info>,
    #[account(
        init,
        payer = raffle_owner,
        space = {8 + RaffleState::account_space(max_tickets)},
        seeds = [
            RAFFLE_SEED.as_bytes(),
            raffle_owner.key().as_ref(),
            end_time.to_le_bytes().as_ref(),
        ],
        bump
    )]
    pub raffle_state: Account<'info, RaffleState>,
    pub system_program: Program<'info, System>,
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use super::*;

    #[test]
    fn test_raffle_seed() {
        let program_id = crate::id();
        let raffle_owner =
            Pubkey::from_str("4SZPbRanvK5NeS5QdeemLCnfp5Zf42yQxM5TxxA5MbTR").unwrap();
        let end_time: u64 = 1757544278_u64;
        let expected_pda_addr = "2maAJzgpg4PeGUGDqwnbJru874fzPLDD9dCYei3caPFx";
        let seeds = &[
            RAFFLE_SEED.as_bytes(),
            raffle_owner.as_ref(),
            &end_time.to_le_bytes(),
        ];
        let pda_addr = Pubkey::find_program_address(seeds, &program_id);
        assert_eq!(pda_addr.0.to_string(), expected_pda_addr.to_string());
    }
}
