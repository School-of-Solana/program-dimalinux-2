#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
mod state;
mod errors;
mod instructions;

use instructions::{CreateRaffleContext, BuyTicketsContext, DrawWinnerContext, ClaimPrizeContext};

declare_id!("ZjrgSoDagK6qA712jfrFuecHX2Zj8MXByns7FV2UMhs");

#[allow(deprecated)] // see if this can be removed when upgrading Anchor libs
pub mod raffle {
    use super::*;

    pub fn create_raffle(ctx: Context<CreateRaffleContext>, ticket_price: u64, max_tickets: u32, end_time: u64) -> Result<()> {
        instructions::create_raffle(ctx, ticket_price, max_tickets, end_time)
    }

    pub fn draw_winner(ctx: Context<DrawWinnerContext>) -> Result<()> {
        instructions::draw_winner(ctx)
    }

    pub fn buy_tickets(ctx: Context<BuyTicketsContext>, number_of_tickets: u32) -> Result<()> {
        instructions::buy_tickets(ctx, number_of_tickets)
    }

    pub fn claim_prize(ctx: Context<ClaimPrizeContext>) -> Result<()> {
        instructions::claim_prize(ctx)
    }

}
