use anchor_lang::prelude::*;

#[error_code]
pub enum RaffleError {
    RaffleEndTimeInPast,
    InsufficientTickets,
    RaffleHasEnded,
    RaffleNotOver,
    WinnerNotYetDrawn,
    WinnerAlreadyDrawn,
    PrizeAlreadyClaimed,
    RaffleTooLarge,
    RaffleStateAccountTooSmall,
    NoEntrants,
    Unauthorized,
    WinnerAlreadySelected,
    DrawWinnerNotStarted,
    RaffleNotClaimed,
    OnlyRaffleManagerCanClose,
    CanNotCloseActiveRaffle,
    MaxTicketsIsZero,
}
