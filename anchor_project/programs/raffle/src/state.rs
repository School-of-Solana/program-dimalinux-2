use anchor_lang::prelude::*;

pub const RAFFLE_SEED: &str = "RaffleSeed";

/// Raffle state account stored as a PDA. Tracks configuration and lifecycle
/// of a single raffle instance.
#[account]
pub struct RaffleState {
    /// The manager/creator of the raffle. The only party that can close the
    /// raffle to receive the rent refund.
    pub raffle_manager: Pubkey,
    /// Ticket price in lamports.
    pub ticket_price: u64,
    /// Maximum number of tickets/entrants allowed.
    pub max_tickets: u32,
    /// Raffle end time as Unix timestamp (seconds). No new tickets may be
    /// bought after this time; drawing is allowed once this time is reached.
    pub end_time: i64,
    /// Index of the winner in `entrants` once drawn; `None` until selected.
    pub winner_index: Option<u32>, // index of the winner in the entrants vec
    /// Whether `draw_winner` has been invoked and the VRF flow started.
    pub draw_winner_started: bool,
    /// Whether the prize has been claimed by the selected winner.
    pub claimed: bool,
    /// Entrant public keys, one entry per ticket purchased.
    pub entrants: Vec<Pubkey>,
}

impl RaffleState {
    /// Calculates the raffle account space based on the maximum number of tickets.
    /// This does not include the 8 bytes added as a discriminator by Anchor.
    pub const fn account_space(max_tickets: u32) -> usize {
        32 +  // raffle_manager
            8 +   // ticket_price
            4 +   // max_tickets
            8 +   // end_time
            5 +   // winner (Option<u32>)
            1 +   // claimed
            1 +   // draw_winner_started
            4 +   // length of entrants vec
            (32 * max_tickets as usize) // entrants
    }

    pub fn is_raffle_over(&self, now: &Clock) -> bool {
        self.entrants.len() >= self.max_tickets as usize || now.unix_timestamp >= self.end_time
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_raffle_state_account_space() {
        const MAX_TICKETS: usize = 10;
        let state = RaffleState {
            raffle_manager: Pubkey::new_unique(),
            ticket_price: 1,
            end_time: 1,
            winner_index: Some(1),
            max_tickets: MAX_TICKETS as u32,
            claimed: false,
            draw_winner_started: false,
            entrants: vec![Pubkey::new_unique(); MAX_TICKETS],
        };

        let mut serialized_data = Vec::new();
        state.serialize(&mut serialized_data).unwrap();
        let expected_size = RaffleState::account_space(MAX_TICKETS as u32);
        assert_eq!(serialized_data.len(), expected_size);
    }
}
