/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/raffle.json`.
 */
export type Raffle = {
  address: "H3yT9Lb96D6JsbSWQeUdMZHj6avCEnU8vJAdEot4AkWw";
  metadata: {
    name: "raffle";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Simple raffle program";
  };
  instructions: [
    {
      name: "buyTickets";
      discriminator: [48, 16, 122, 137, 24, 214, 198, 58];
      accounts: [
        {
          name: "buyer";
          writable: true;
          signer: true;
        },
        {
          name: "raffleState";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [82, 97, 102, 102, 108, 101, 83, 101, 101, 100];
              },
              {
                kind: "account";
                path: "raffle_state.owner";
                account: "raffleState";
              },
              {
                kind: "account";
                path: "raffle_state.end_time";
                account: "raffleState";
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "numberOfTickets";
          type: "u32";
        },
      ];
    },
    {
      name: "claimPrize";
      discriminator: [157, 233, 139, 121, 246, 62, 234, 235];
      accounts: [
        {
          name: "winner";
          writable: true;
          signer: true;
        },
        {
          name: "raffleState";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [82, 97, 102, 102, 108, 101, 83, 101, 101, 100];
              },
              {
                kind: "account";
                path: "raffle_state.owner";
                account: "raffleState";
              },
              {
                kind: "account";
                path: "raffle_state.end_time";
                account: "raffleState";
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "createRaffle";
      discriminator: [226, 206, 159, 34, 213, 207, 98, 126];
      accounts: [
        {
          name: "raffleOwner";
          writable: true;
          signer: true;
        },
        {
          name: "raffleState";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [82, 97, 102, 102, 108, 101, 83, 101, 101, 100];
              },
              {
                kind: "account";
                path: "raffleOwner";
              },
              {
                kind: "arg";
                path: "endTime";
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "ticketPrice";
          type: "u64";
        },
        {
          name: "maxTickets";
          type: "u32";
        },
        {
          name: "endTime";
          type: "i64";
        },
      ];
    },
    {
      name: "drawWinner";
      discriminator: [250, 103, 118, 147, 219, 235, 169, 220];
      accounts: [
        {
          name: "raffleOwner";
          signer: true;
        },
        {
          name: "raffleState";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [82, 97, 102, 102, 108, 101, 83, 101, 101, 100];
              },
              {
                kind: "account";
                path: "raffle_state.owner";
                account: "raffleState";
              },
              {
                kind: "account";
                path: "raffle_state.end_time";
                account: "raffleState";
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
  ];
  accounts: [
    {
      name: "raffleState";
      discriminator: [160, 186, 30, 174, 174, 156, 156, 244];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "raffleEndTimeInPast";
      msg: "Raffle end time must be in the future";
    },
    {
      code: 6001;
      name: "tooManyTickets";
      msg: "Too few tickets to fulfill request";
    },
    {
      code: 6002;
      name: "raffleFull";
      msg: "Raffle is full";
    },
    {
      code: 6003;
      name: "raffleEnded";
      msg: "Raffle has ended";
    },
    {
      code: 6004;
      name: "raffleNotEnded";
      msg: "Raffle has not ended";
    },
    {
      code: 6005;
      name: "winnerNotYetDrawn";
      msg: "Winner not yet drawn";
    },
    {
      code: 6006;
      name: "winnerAlreadyDrawn";
      msg: "Winner already drawn";
    },
    {
      code: 6007;
      name: "prizeAlreadyClaimed";
      msg: "Prize already claimed";
    },
    {
      code: 6008;
      name: "raffleTooLarge";
      msg: "max_tickets * ticket_price exceeds u64";
    },
    {
      code: 6009;
      name: "raffleStateAccountTooSmall";
      msg: "Raffle state account is too small";
    },
    {
      code: 6010;
      name: "raffleStateDataInvalid";
      msg: "Raffle state data is invalid";
    },
    {
      code: 6011;
      name: "unauthorized";
      msg: "unauthorized";
    },
  ];
  types: [
    {
      name: "raffleState";
      docs: ["`RaffleState` ..."];
      type: {
        kind: "struct";
        fields: [
          {
            name: "owner";
            type: "pubkey";
          },
          {
            name: "ticketPrice";
            type: "u64";
          },
          {
            name: "endTime";
            type: "i64";
          },
          {
            name: "winner";
            type: {
              option: "pubkey";
            };
          },
          {
            name: "maxTickets";
            type: "u32";
          },
          {
            name: "claimed";
            type: "bool";
          },
          {
            name: "entrants";
            type: {
              vec: "pubkey";
            };
          },
        ];
      };
    },
  ];
};
