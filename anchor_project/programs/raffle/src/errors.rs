use anchor_lang::prelude::*;

#[error_code]
pub enum RaffleError {
    #[msg("Too ew tickets to fulfill request")]
    TooManyTickets,
    #[msg("Raffle is full")]
    RaffleFull,
    #[msg("Raffle has ended")]
    RaffleEnded,
    #[msg("Raffle has not ended")]
    RaffleNotEnded,
    #[msg("Winner not yet drawn")]
    WinnerNotYetDrawn,
    #[msg("Winner already drawn")]
    WinnerAlreadyDrawn,
    #[msg("Prize already claimed")]
    PrizeAlreadyClaimed,
    #[msg("Invalid prize amount")]
    InvalidPrizeAmount,
    #[msg("Raffle state account is too small")]
    RaffleStateAccountTooSmall,
    #[msg("Raffle state data is invalid")]
    RaffleStateDataInvalid,
}
