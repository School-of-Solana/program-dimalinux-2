#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
pub use instructions::*;
pub mod errors;
pub mod instructions;
pub mod state;

declare_id!("Heymiw7KZPy5uiXyHVjUTCDtESmzZfT4rZQdiebqS8KC");

#[program]
pub mod raffle {
    use super::*;

    pub fn create_raffle(
        ctx: Context<CreateRaffle>,
        ticket_price: u64,
        max_tickets: u32,
        end_time: i64,
    ) -> Result<()> {
        create_raffle_impl(ctx, ticket_price, max_tickets, end_time)
    }

    pub fn buy_tickets(ctx: Context<BuyTickets>, number_of_tickets: u32) -> Result<()> {
        buy_tickets_impl(ctx, number_of_tickets)
    }

    pub fn shuffle_tickets(ctx: Context<ShuffleTickets>) -> Result<()> {
        shuffle_tickets_impl(ctx)
    }

    pub fn draw_winner(ctx: Context<DrawWinner>) -> Result<()> {
        draw_winner_impl(ctx)
    }

    pub fn claim_prize(ctx: Context<ClaimPrize>) -> Result<()> {
        claim_prize_impl(ctx)
    }
}
