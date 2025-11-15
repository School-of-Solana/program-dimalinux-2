use anchor_lang::prelude::*;

#[error_code]
pub enum RaffleError {
    // create_raffle errors
    RaffleEndTimeInPast,
    MaxRaffleLengthExceeded,
    MaxTicketsIsZero,
    RaffleTooLarge,
    TicketPriceTooLow,

    // buy_tickets errors
    RaffleHasEnded,
    InsufficientTickets,

    // draw_winner errors
    WinnerAlreadyDrawn,
    RaffleNotOver,
    NoEntrants,

    // draw_winner_callback errors
    DrawWinnerNotStarted,
    CallbackAlreadyInvoked,
    CallbackNotInvokedByVRF,

    // claim_prize errors
    WinnerNotYetDrawn,
    NotWinner,
    PrizeAlreadyClaimed,

    // close_raffle errors
    OnlyRaffleManagerOrProgramOwnerCanClose,
    CanNotCloseActiveRaffle,
}
