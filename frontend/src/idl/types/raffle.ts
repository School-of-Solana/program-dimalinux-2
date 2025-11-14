/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/raffle.json`.
 */
export type Raffle = {
  "address": "4LcauHsjXDZqGonxZu261YLPHV3TRsLYZ7o1pTT5q2uQ",
  "metadata": {
    "name": "raffle",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Simple raffle program"
  },
  "instructions": [
    {
      "name": "buyTickets",
      "docs": [
        "Buys one or more tickets for the caller and transfers the ticket price",
        "in lamports from the buyer to the raffle account.",
        "",
        "Args:",
        "- `number_of_tickets` (u32): how many tickets to purchase in this call.",
        "",
        "Accounts: see [`BuyTickets`] for required accounts and seeds.",
        "",
        "Errors:",
        "- `RaffleError::RaffleHasEnded`: attempting to buy after the raffle end time.",
        "- `RaffleError::InsufficientTickets`: the purchase would exceed available tickets."
      ],
      "discriminator": [
        48,
        16,
        122,
        137,
        24,
        214,
        198,
        58
      ],
      "accounts": [
        {
          "name": "buyer",
          "docs": [
            "Buyer paying for tickets; must sign."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "raffleState",
          "docs": [
            "Raffle state PDA [RAFFLE_SEED, raffle_manager, end_time]; receives ticket lamports."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  82,
                  97,
                  102,
                  102,
                  108,
                  101,
                  83,
                  101,
                  101,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "raffle_state.raffle_manager",
                "account": "raffleState"
              },
              {
                "kind": "account",
                "path": "raffle_state.end_time",
                "account": "raffleState"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "docs": [
            "System program (transfer lamports)."
          ],
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "clock",
          "docs": [
            "Clock sysvar for timestamp validation"
          ],
          "address": "SysvarC1ock11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "numberOfTickets",
          "type": "u32"
        }
      ]
    },
    {
      "name": "claimPrize",
      "docs": [
        "Transfers the total prize pool to the winner and marks the raffle as",
        "claimed. Can be called by anyone after the winner has been drawn; the",
        "prize is always sent to the correct winner as determined by the VRF.",
        "",
        "Emits: none",
        "",
        "Accounts: see [`ClaimPrize`] for required accounts and seeds.",
        "",
        "Errors:",
        "- `RaffleError::WinnerNotYetDrawn`: no winner has been selected yet.",
        "- `RaffleError::Unauthorized`: the provided winner account does not match the selected winner.",
        "- `RaffleError::PrizeAlreadyClaimed`: the prize was already claimed."
      ],
      "discriminator": [
        157,
        233,
        139,
        121,
        246,
        62,
        234,
        235
      ],
      "accounts": [
        {
          "name": "winner",
          "docs": [
            "Winner receives prize lamports. Anyone can trigger the claim on behalf",
            "of the winner.",
            "via the constraint on raffle_state."
          ],
          "writable": true
        },
        {
          "name": "raffleState",
          "docs": [
            "Raffle state PDA [RAFFLE_SEED, raffle_manager, end_time]; pays prize to winner and flips `claimed`."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  82,
                  97,
                  102,
                  102,
                  108,
                  101,
                  83,
                  101,
                  101,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "raffle_state.raffle_manager",
                "account": "raffleState"
              },
              {
                "kind": "account",
                "path": "raffle_state.end_time",
                "account": "raffleState"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "closeRaffle",
      "docs": [
        "Closes the raffle state account and returns the remaining rent/lamports",
        "to the raffle manager. Can be called by either the raffle manager or the",
        "program upgrade authority. Only possible if no tickets were sold or the",
        "prize has already been claimed.",
        "",
        "Emits: none",
        "",
        "Accounts: see [`CloseRaffle`] for required accounts and seeds.",
        "",
        "Errors:",
        "- `RaffleError::OnlyRaffleManagerOrProgramOwnerCanClose`: caller is neither",
        "the raffle manager nor the program upgrade authority.",
        "- `RaffleError::CanNotCloseActiveRaffle`: tickets were sold and the prize",
        "has not yet been claimed."
      ],
      "discriminator": [
        220,
        129,
        128,
        51,
        70,
        66,
        209,
        124
      ],
      "accounts": [
        {
          "name": "signer",
          "docs": [
            "Either the raffle manager or the program upgrade authority; must sign."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "raffleManager",
          "docs": [
            "When signer is the raffle manager, this is the same account.",
            "When signer is the program owner, this is where rent goes."
          ],
          "writable": true,
          "relations": [
            "raffleState"
          ]
        },
        {
          "name": "raffleState",
          "docs": [
            "Raffle state PDA [RAFFLE_SEED, raffle_manager, end_time]; closed to `raffle_manager`."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  82,
                  97,
                  102,
                  102,
                  108,
                  101,
                  83,
                  101,
                  101,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "raffle_state.raffle_manager",
                "account": "raffleState"
              },
              {
                "kind": "account",
                "path": "raffle_state.end_time",
                "account": "raffleState"
              }
            ]
          }
        },
        {
          "name": "programData",
          "docs": [
            "The program data account containing upgrade authority for this program."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  49,
                  153,
                  84,
                  233,
                  78,
                  136,
                  22,
                  15,
                  89,
                  148,
                  69,
                  178,
                  154,
                  19,
                  116,
                  43,
                  163,
                  35,
                  246,
                  239,
                  43,
                  127,
                  111,
                  1,
                  44,
                  126,
                  12,
                  124,
                  174,
                  125,
                  107,
                  3
                ]
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                2,
                168,
                246,
                145,
                78,
                136,
                161,
                176,
                226,
                16,
                21,
                62,
                247,
                99,
                174,
                43,
                0,
                194,
                185,
                61,
                22,
                193,
                36,
                210,
                192,
                83,
                122,
                16,
                4,
                128,
                0,
                0
              ]
            }
          }
        }
      ],
      "args": []
    },
    {
      "name": "createRaffle",
      "docs": [
        "Creates and initializes a new raffle state account (PDA) with the",
        "provided parameters.",
        "",
        "Args:",
        "- `ticket_price` (u64): price per ticket in lamports.",
        "- `max_tickets` (u32): maximum number of entrants allowed.",
        "- `end_time` (i64): Unix timestamp (seconds) when the raffle ends.",
        "",
        "Accounts: see [`CreateRaffle`] for required accounts and seeds.",
        "",
        "Errors:",
        "- `RaffleError::RaffleEndTimeInPast`: the provided `end_time` must be in the",
        "future relative to the cluster clock.",
        "- `RaffleError::RaffleExceeds30Days`: the provided `end_time` cannot be more",
        "than 30 days from the current time.",
        "- `RaffleError::MaxTicketsIsZero`: `max_tickets` must be at least 1.",
        "- `RaffleError::RaffleTooLarge`: the computed maximum prize pool",
        "(`ticket_price * max_tickets`) overflowed `u64`."
      ],
      "discriminator": [
        226,
        206,
        159,
        34,
        213,
        207,
        98,
        126
      ],
      "accounts": [
        {
          "name": "raffleOwner",
          "docs": [
            "Raffle manager and payer for raffle_state account creation"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "raffleState",
          "docs": [
            "Raffle state PDA initialized with seeds [RAFFLE_SEED, raffle_owner, end_time].",
            "Space is derived from max_tickets; rent paid by `raffle_owner`."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  82,
                  97,
                  102,
                  102,
                  108,
                  101,
                  83,
                  101,
                  101,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "raffleOwner"
              },
              {
                "kind": "arg",
                "path": "endTime"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "docs": [
            "System program needed to create the raffle state account."
          ],
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "clock",
          "docs": [
            "Clock sysvar for timestamp validation"
          ],
          "address": "SysvarC1ock11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "ticketPrice",
          "type": "u64"
        },
        {
          "name": "maxTickets",
          "type": "u32"
        },
        {
          "name": "endTime",
          "type": "i64"
        }
      ]
    },
    {
      "name": "drawWinner",
      "docs": [
        "Requests verifiable randomness for the raffle and marks the draw process",
        "as started. This triggers an off-chain VRF flow that will later invoke",
        "the on-chain callback.",
        "",
        "Emits: none (the winner event is emitted by the callback).",
        "",
        "Accounts: see [`DrawWinner`] for required accounts and seeds.",
        "",
        "Errors:",
        "- `RaffleError::WinnerAlreadyDrawn`: a winner has already been selected.",
        "- `RaffleError::RaffleNotOver`: the raffle has not reached its end time yet.",
        "- `RaffleError::NoEntrants`: there are no entrants in the raffle."
      ],
      "discriminator": [
        250,
        103,
        118,
        147,
        219,
        235,
        169,
        220
      ],
      "accounts": [
        {
          "name": "oraclePayer",
          "docs": [
            "Payer for the VRF request and any CPI fees; must sign."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "raffleState",
          "docs": [
            "Raffle state PDA [RAFFLE_SEED, raffle_manager, end_time]; marked started and used as VRF caller seed."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  82,
                  97,
                  102,
                  102,
                  108,
                  101,
                  83,
                  101,
                  101,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "raffle_state.raffle_manager",
                "account": "raffleState"
              },
              {
                "kind": "account",
                "path": "raffle_state.end_time",
                "account": "raffleState"
              }
            ]
          }
        },
        {
          "name": "oracleQueue",
          "writable": true,
          "address": "Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh"
        },
        {
          "name": "clock",
          "docs": [
            "Clock sysvar for timestamp validation"
          ],
          "address": "SysvarC1ock11111111111111111111111111111111"
        },
        {
          "name": "programIdentity",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  100,
                  101,
                  110,
                  116,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "vrfProgram",
          "address": "Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz"
        },
        {
          "name": "slotHashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "drawWinnerCallback",
      "docs": [
        "Callback invoked by the VRF program once randomness is available. This",
        "finalizes the selection of the winner and emits `WinnerDrawnEvent`.",
        "",
        "Args:",
        "- `randomness` ([u8; 32]): 256-bit random value provided by VRF.",
        "",
        "Emits: [`WinnerDrawnEvent`]",
        "",
        "Accounts: see [`DrawWinnerCallback`] for required accounts and seeds.",
        "",
        "Errors:",
        "- `RaffleError::DrawWinnerNotStarted`: the draw process was not started",
        "(i.e., `draw_winner` was not called successfully before the callback).",
        "- `RaffleError::WinnerAlreadyDrawn`: a winner has already been set by a previous callback."
      ],
      "discriminator": [
        151,
        64,
        86,
        128,
        12,
        9,
        190,
        153
      ],
      "accounts": [
        {
          "name": "vrfProgramIdentity",
          "docs": [
            "Callback can only be executed by the VRF program through CPI. Value must be",
            "9irBy75QS2BN81FUgXuHcjqceJJRuc9oDkAe8TKVvvAw. MagicBlock calls this PDA",
            "the \"program identity\", but it is a PDA owned by the VRF program, not the",
            "VRF program itself."
          ],
          "signer": true
        },
        {
          "name": "raffleState",
          "docs": [
            "Raffle state PDA [RAFFLE_SEED, raffle_manager, end_time]; mutated to set winner.",
            "Validated first to make the draw_winner_started and winner_index checks testable."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  82,
                  97,
                  102,
                  102,
                  108,
                  101,
                  83,
                  101,
                  101,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "raffle_state.raffle_manager",
                "account": "raffleState"
              },
              {
                "kind": "account",
                "path": "raffle_state.end_time",
                "account": "raffleState"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "randomness",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "raffleState",
      "discriminator": [
        160,
        186,
        30,
        174,
        174,
        156,
        156,
        244
      ]
    }
  ],
  "events": [
    {
      "name": "winnerDrawnEvent",
      "discriminator": [
        244,
        93,
        18,
        122,
        163,
        125,
        164,
        89
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "raffleEndTimeInPast"
    },
    {
      "code": 6001,
      "name": "raffleExceeds30Days"
    },
    {
      "code": 6002,
      "name": "maxTicketsIsZero"
    },
    {
      "code": 6003,
      "name": "raffleTooLarge"
    },
    {
      "code": 6004,
      "name": "raffleHasEnded"
    },
    {
      "code": 6005,
      "name": "insufficientTickets"
    },
    {
      "code": 6006,
      "name": "winnerAlreadyDrawn"
    },
    {
      "code": 6007,
      "name": "raffleNotOver"
    },
    {
      "code": 6008,
      "name": "noEntrants"
    },
    {
      "code": 6009,
      "name": "drawWinnerNotStarted"
    },
    {
      "code": 6010,
      "name": "callbackAlreadyInvoked"
    },
    {
      "code": 6011,
      "name": "callbackNotInvokedByVrf"
    },
    {
      "code": 6012,
      "name": "winnerNotYetDrawn"
    },
    {
      "code": 6013,
      "name": "notWinner"
    },
    {
      "code": 6014,
      "name": "prizeAlreadyClaimed"
    },
    {
      "code": 6015,
      "name": "onlyRaffleManagerOrProgramOwnerCanClose"
    },
    {
      "code": 6016,
      "name": "canNotCloseActiveRaffle"
    }
  ],
  "types": [
    {
      "name": "raffleState",
      "docs": [
        "Raffle state account stored as a PDA. Tracks configuration and lifecycle",
        "of a single raffle instance."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "raffleManager",
            "docs": [
              "The manager/creator of the raffle. The only party that can close the",
              "raffle to receive the rent refund."
            ],
            "type": "pubkey"
          },
          {
            "name": "ticketPrice",
            "docs": [
              "Ticket price in lamports."
            ],
            "type": "u64"
          },
          {
            "name": "maxTickets",
            "docs": [
              "Maximum number of tickets/entrants allowed."
            ],
            "type": "u32"
          },
          {
            "name": "endTime",
            "docs": [
              "Raffle end time as Unix timestamp (seconds). No new tickets may be",
              "bought after this time; drawing is allowed once this time is reached."
            ],
            "type": "i64"
          },
          {
            "name": "winnerIndex",
            "docs": [
              "Index of the winner in `entrants` once drawn; `None` until selected."
            ],
            "type": {
              "option": "u32"
            }
          },
          {
            "name": "drawWinnerStarted",
            "docs": [
              "Whether `draw_winner` has been invoked and the VRF flow started."
            ],
            "type": "bool"
          },
          {
            "name": "claimed",
            "docs": [
              "Whether the prize has been claimed by the selected winner."
            ],
            "type": "bool"
          },
          {
            "name": "entrants",
            "docs": [
              "Entrant public keys, one entry per ticket purchased."
            ],
            "type": {
              "vec": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "winnerDrawnEvent",
      "docs": [
        "Emitted when a winner has been selected for a raffle.",
        "",
        "Fields:",
        "- `raffle_state`: the raffle state PDA for which the winner was drawn.",
        "- `winner_index`: index into `entrants` vector for the winning entry.",
        "- `winner`: public key of the winning entrant."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "raffleState",
            "docs": [
              "Raffle state PDA for which the winner was drawn."
            ],
            "type": "pubkey"
          },
          {
            "name": "winner",
            "docs": [
              "Winner's public key."
            ],
            "type": "pubkey"
          },
          {
            "name": "randomness",
            "docs": [
              "Randomness from VRF used to draw the winner."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    }
  ]
};
