# Project Description

**Deployed Frontend URL:** https://solana-raffle-phi.vercel.app/

**Solana Program ID:** Rafs56vPtgBLfMQoafTVmf4QB11gqqkysfJx949d99p

## Project Overview

### Description

Solana raffle program where ticket purchases and payouts are in SOL.
Magic Block's Ephemeral VRF is used to select winners on-chain. Frontend
dApp was written using SvelteKit instead of React.

### Key Features

- Create raffles: ticket price, maximum tickets, and end time are fixed at
  creation. A single PDA -  dynamically sized for `max_tickets` - is allocated
  per raffle. The creator receives the rent refund on close.
- Buy multiple tickets in one transaction until sold out or end time reached.
- Draw winner: CPI to the VRF program requests randomness; callback sets the
  winner. Any user can trigger draw post‑end so managers cannot stall outcome.
- Claim prize: Any account can facilitate; funds always go to the recorded
  winner. Prevents a passive winner from blocking closure.
- Close raffle: Manager or BPF upgrade authority reclaims rent for the manager
  after prize claimed or if zero entrants.

### How to Use the dApp

1. Connect a Phantom or Solflare browser wallet.
2. Browse raffles or create a new one; open the detailed view to buy tickets or
   create a new raffle using the create raffle button. UI enforces limits (e.g.
   end_time ≤ 30 days).
3. Buy tickets.
4. Wait for raffle to end or buy the remaining tickets. End time expiration or
   tickets selling out ends the raffle.
5. Draw winner. Any user can initiate once ended (raffle manager can't be
   blocker); VRF callback selects winner within seconds.
6. Claim prize. Any user can facilitate (winner can't be blocker); lamports
   go entirely to the winner.
7. Close raffle. Raffle manager or upgrade authority can close the raffle,
   reclaimed rent only goes to the raffle manager.

## Program Architecture

The program uses a single PDA per raffle. The PDA is sized at creation based on
`max_tickets` (avoids over‑allocating rent while guaranteeing capacity).
There are six instructions described below.

### PDA Usage

`RaffleState` PDA seeds: ["RaffleSeed", manager, ticket_price, max_tickets,
end_time]. Including all configuration values prevents closing + recreating
with altered parameters at the same address.

### Program Instructions

- **create_raffle**: Initializes a new raffle. Errors: end time in past; >30 day
  duration; zero max tickets; prize pool overflow (ticket_price * max_tickets);
  ticket price < 0.0001 SOL.
- **buy_tickets**: Purchases N tickets. Errors: raffle ended; purchase exceeds
  remaining capacity; insufficient balance (implicit by runtime failure).
- **draw_winner**: Requests VRF randomness; flags start. Errors: winner already
  drawn; raffle not over; no entrants.
- **draw_winner_callback**: VRF CPI callback; sets `winner_index` and emits
  event. Errors: draw not started; callback replay; non‑VRF caller.
- **claim_prize**: Transfers full pool (`ticket_price * entrants.len()`) to
  winner; marks claimed. Errors: winner not yet drawn; wrong winner account;
  already claimed.
- **close_raffle**: Closes account, returns lamports + rent to manager. Errors:
  unauthorized caller; active raffle (not claimed & has entrants).

### Account Structure

```rust
#[account]
pub struct RaffleState {
    pub raffle_manager: Pubkey,     // Creator; rent refund target
    pub ticket_price: u64,          // Lamports per ticket
    pub end_time: i64,              // Unix epoch timestamp cutoff
    pub winner_index: Option<u32>,  // Set in VRF callback
    pub max_tickets: u32,           // Max size of entrants vector
    pub claimed: bool,              // Prize claimed flag
    pub draw_winner_started: bool,  // VRF request issued
    pub entrants: Vec<Pubkey>,      // One per ticket (append-only)
}
```

## Testing

### Test Coverage

**Happy Path:** Full lifecycle (create, multi‑buyer purchases, draw, observe
WinnerDrawn event, claim, close).

**Error Paths:** All custom error conditions per instruction:
- create_raffle: RaffleEndTimeInPast; MaxRaffleLengthExceeded; MaxTicketsIsZero;
  RaffleTooLarge; TicketPriceTooLow
- buy_tickets: RaffleHasEnded; InsufficientTickets
- draw_winner: WinnerAlreadyDrawn; RaffleNotOver; NoEntrants
- draw_winner_callback: DrawWinnerNotStarted; CallbackAlreadyInvoked;
  CallbackNotInvokedByVRF
- claim_prize: WinnerNotYetDrawn; NotWinner; PrizeAlreadyClaimed
- close_raffle: OnlyRaffleManagerOrProgramOwnerCanClose; CanNotCloseActiveRaffle

### Running Tests

**IMPORTANT**: Tests must run on devnet where VRF oracles are present. To use the
existing deployment:

```bash
yarn install
solana config set --url devnet
anchor test --skip-local-validator --skip-deploy
```

Devnet airdrops are unreliable, so tests rely on existing provider funds. All
created  PDA accounts are closed; transient balances swept back. Net cost
≈ transaction fees (~0.005 SOL typical).

## Additional Notes

The biggest challenge was VRF integration. Initially, I used Switchboard's VRF,
but ran into broken example code, unnecessarily complicated APIs and devnet
oracles that were not always available. Discovering Magic Block's VRF saved me.
It works like a dream in comparison. I would have submitted this project last
season if I had discovered Magic Block's VRF sooner!

I'd like to thank this project for providing a working example of how to
integrate Solana wallets into a Svelte app:

https://github.com/xcaptain/solana-wallet-svelte
