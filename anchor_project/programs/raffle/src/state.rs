use anchor_lang::prelude::*;

pub const RAFFLE_SEED: &str = "RaffleSeed";

/// `RaffleState` ...
#[account]
pub struct RaffleState {
    pub owner: Pubkey,
    pub ticket_price: u64,
    pub end_time: i64, // Solana's UnixTimestamp uses i64, not u64
    pub winner: Option<Pubkey>,
    pub max_tickets: u32,
    pub claimed: bool,
    pub entrants: Vec<Pubkey>,
}

impl RaffleState {
    /// Calculates the raffle account space based on the maximum number of tickets.
    /// This does not include the 8 bytes added as a discriminator by Anchor.
    pub const fn account_space(max_tickets: u32) -> usize {
        4 +  // u32 length prefix before the serialized data
            32 +  // owner
            8 +   // ticket_price
            8 +   // end_time
            33 +  // winner (Option<Pubkey>)
            4 +   // max_tickets
            1 +   // claimed
            4 +   // length of entrant vector
            (32 * max_tickets as usize) // entrants
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_raffle_state_serialization() {
        const MAX_TICKETS: usize = 10;
        let state = RaffleState {
            owner: Pubkey::new_unique(),
            ticket_price: 1,
            end_time: 1,
            winner: Some(Pubkey::new_unique()),
            max_tickets: MAX_TICKETS as u32,
            claimed: false,
            entrants: vec![Pubkey::new_unique(); MAX_TICKETS],
        };

        let mut serialized_data = Vec::new();
        state.serialize(&mut serialized_data).unwrap();
        let expected_size = RaffleState::account_space(MAX_TICKETS as u32);
        assert_eq!(serialized_data.len(), expected_size);
    }

    #[test]
    fn test_raffle_state_account_space() {
        let max_tickets = 100;
        let expected_space = 3294;
        assert_eq!(RaffleState::account_space(max_tickets), expected_space);
    }
}
