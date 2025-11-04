use anchor_lang::prelude::*;

#[error_code]
pub enum RaffleError {
    // create_raffle errors
    RaffleEndTimeInPast,
    MaxTicketsIsZero,
    RaffleTooLarge,

    // buy_tickets errors
    RaffleHasEnded,
    InsufficientTickets,

    // draw_winner errors
    WinnerAlreadyDrawn,
    RaffleNotOver,
    NoEntrants,

    // draw_winner_callback errors
    DrawWinnerNotStarted,

    // claim_prize errors
    WinnerNotYetDrawn,
    Unauthorized,
    PrizeAlreadyClaimed,

    // close_raffle errors
    OnlyRaffleManagerCanClose,
    CanNotCloseActiveRaffle,
}
