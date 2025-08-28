use core::iter;
use anchor_lang::prelude::*;
use crate::errors::RaffleError;

/// `RaffleState` is a PDA that we don't use Anchor to manage, as we don't know
/// the maximum size of the `entrants` vector at compile time. The maximum size of
/// `entrants` is constrained by the `max_tickets` field, which is set when the
/// individual raffle is created.
#[derive(Debug, borsh::BorshSerialize, borsh::BorshDeserialize)]
pub struct RaffleState {
    pub authority: Pubkey,
    pub ticket_price: u64,
    pub end_time: u64,
    pub winner: Option<Pubkey>,
    pub max_tickets: u32,
    pub claimed: bool,
    pub entrants: Vec<Pubkey>,
}

impl RaffleState {
    pub fn max_size_in_bytes(&self) -> usize {
        4 +  // u32 length prefix before the serialized data
            32 +  // authority
            8 +   // ticket_price
            8 +   // end_time
            33 +  // winner (Option<Pubkey>)
            4 +   // max_tickets
            1 +   // claimed
            4 +   // length of entrant vector
            (32 * self.max_tickets as usize) // entrants
    }

    pub fn sold_tickets(&self) -> usize {
        self.entrants.len()
    }

    pub fn prize_amount(&self) -> u64 {
        self.ticket_price * self.entrants.len() as u64
    }

    #[allow(dead_code)]
    pub fn is_full(&self) -> bool {
        self.sold_tickets() >= self.max_tickets as usize
    }

    pub fn reserve_tickets(&mut self, holder: &Pubkey, num_tickets: u32) -> bool {
        if let Some(new_total) = self.sold_tickets().checked_add(num_tickets as usize) {
            if new_total <= self.max_tickets as usize {
                self.entrants
                    .extend(iter::repeat(*holder).take(num_tickets as usize));
                return true;
            }
        }
        false
    }

    pub fn serialize_to_account(&self, account_data: &mut [u8]) -> Result<()> {
        // Borsh deserialization throws an error if the input data length is
        // longer than the bytes needed to deserialize the struct. Because of
        // this, we write a u32 length prefix before the serialized RaffleState
        // data.

        let mut raffle_state_bytes = Vec::new();
        self.serialize(&mut raffle_state_bytes)?;


        let raffle_state_len = raffle_state_bytes.len();

        // Check if the account data is long enough to hold the length prefix and serialized data
        require!(account_data.len() >= 4 + raffle_state_len, RaffleError::RaffleStateDataInvalid);

        let len_prefix_bytes = (raffle_state_len as u32).to_le_bytes();
        account_data[..4].copy_from_slice(&len_prefix_bytes);
        account_data[4..4 + raffle_state_len].copy_from_slice(&raffle_state_bytes);
        Ok(())
    }

    pub fn deserialize_from_account(account_data: &[u8]) -> Result<Self> {
        // Check if the data is long enough to contain the length prefix
        require!(account_data.len() >= 4, RaffleError::RaffleStateDataInvalid);

        let length = u32::from_le_bytes(account_data[..4].try_into().unwrap()) as usize;
        // Check if the data is long enough to contain the length specified in the prefix
        require!(account_data.len() >= 4 + length, RaffleError::RaffleStateDataInvalid);

        RaffleState::try_from_slice(&account_data[4..4 + length])
            .map_err(|_| error!(RaffleError::RaffleStateDataInvalid))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_raffle_state_serialization() {
        const MAX_TICKETS: usize = 10;
        let state = RaffleState {
            authority: Pubkey::new_unique(),
            ticket_price: 1,
            end_time: 1,
            winner: Some(Pubkey::new_unique()),
            max_tickets: MAX_TICKETS as u32,
            claimed: false,
            entrants: vec![Pubkey::new_unique(); MAX_TICKETS],
        };

        let mut account_data = vec![0_u8; state.max_size_in_bytes()];

        state
            .serialize_to_account(account_data.as_mut_slice())
            .unwrap();
        let deserialized = RaffleState::deserialize_from_account(account_data.as_slice()).unwrap();

        assert_eq!(deserialized.authority, state.authority);
        assert_eq!(deserialized.ticket_price, state.ticket_price);
        assert_eq!(deserialized.sold_tickets(), state.sold_tickets());
        assert_eq!(deserialized.end_time, state.end_time);
        assert_eq!(deserialized.winner, state.winner);
        assert_eq!(deserialized.max_tickets, state.max_tickets);
        assert_eq!(deserialized.claimed, state.claimed);
        assert_eq!(deserialized.entrants, state.entrants);
    }
}
