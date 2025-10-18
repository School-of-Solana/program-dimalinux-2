use anchor_lang::prelude::*;

pub const RAFFLE_SEED: &str = "RaffleSeed";

/// `RaffleState` ...
#[account]
pub struct RaffleState {
    pub owner: Pubkey,
    pub ticket_price: u64,
    pub end_time: i64,             // Solana's UnixTimestamp uses i64, not u64
    pub winner_index: Option<u32>, // index of the winner in the entrants vec
    pub max_tickets: u32,
    pub entrants: Vec<Pubkey>,
    pub randomness_account: Pubkey, // Switchboard randomness account (or default if none)
    pub commit_slot: u64,           // slot recorded when randomness requested
    pub claimed: bool,
}

impl RaffleState {
    /// Calculates the raffle account space based on the maximum number of tickets.
    /// This does not include the 8 bytes added as a discriminator by Anchor.
    pub const fn account_space(max_tickets: u32) -> usize {
        4 +  // u32 length prefix
            32 +  // owner
            8 +   // ticket_price
            8 +   // end_time
            5 +   // winner (Option<u32>)
            4 +   // max_tickets
            1 +   // claimed
            4 +   // length of entrants vec
            (32 * max_tickets as usize) + // entrants
            32 +  // randomness_account
            8 +   // commit_slot
            9 // winner_index (Option<u64>)
    }

    pub fn is_raffle_over(&self, now: &Clock) -> bool {
        self.entrants.len() >= self.max_tickets as usize || now.unix_timestamp >= self.end_time
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
            winner_index: Some(1),
            max_tickets: MAX_TICKETS as u32,
            claimed: false,
            entrants: vec![Pubkey::new_unique(); MAX_TICKETS],
            randomness_account: Pubkey::default(),
            commit_slot: 0,
        };

        let mut serialized_data = Vec::new();
        state.serialize(&mut serialized_data).unwrap();
        let expected_size = RaffleState::account_space(MAX_TICKETS as u32);
        assert_eq!(serialized_data.len(), expected_size);
    }

    #[test]
    fn test_raffle_state_account_space() {
        let max_tickets = 100;
        let expected_space = 3408; // updated for new fields
        assert_eq!(RaffleState::account_space(max_tickets), expected_space);
    }
}
