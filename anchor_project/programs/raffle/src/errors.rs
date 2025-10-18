use anchor_lang::prelude::*;

#[error_code]
pub enum RaffleError {
    #[msg("Raffle end time must be in the future")]
    RaffleEndTimeInPast,
    #[msg("Too few tickets to fulfill request")]
    TooManyTickets,
    #[msg("Raffle is full")]
    InsufficientTicketsAvailable,
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
    #[msg("max_tickets * ticket_price exceeds u64")]
    RaffleTooLarge,
    #[msg("Raffle state account is too small")]
    RaffleStateAccountTooSmall,
    #[msg("Raffle state data is invalid")]
    RaffleStateDataInvalid,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Randomness not fulfilled")]
    RandomnessNotFulfilled,
    #[msg("Randomness request expired")]
    RandomnessExpired,
    #[msg("Randomness already requested")]
    RandomnessAlreadyRequested,
    #[msg("Randomness already revealed")]
    RandomnessAlreadyRevealed,
    #[msg("Randomness not yet requested")]
    RandomnessNotRequested,
    #[msg("Winner already selected")]
    WinnerAlreadySelected,
    #[msg("Randomness not resolved")]
    RandomnessNotResolved,
    #[msg("Invalid randomness account provided")]
    InvalidRandomnessAccount,
    #[msg("Raffle not claimed yet")]
    RaffleNotClaimed,
}
