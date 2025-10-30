use anchor_lang::prelude::*;

#[error_code]
pub enum RaffleError {
    RaffleEndTimeInPast,
    InsufficientTicketsToFulfillRequest,
    RaffleIsFull,
    RaffleHasEnded,
    RaffleNotOver,
    WinnerNotYetDrawn,
    WinnerAlreadyDrawn,
    PrizeAlreadyClaimed,
    RaffleTooLarge,
    RaffleStateAccountTooSmall,
    RaffleStateDataInvalid,
    Unauthorized,
    WinnerAlreadySelected,
    DrawWinnerNotStarted,
    RaffleNotClaimed,
}
