use anchor_lang::prelude::*;

declare_id!("ZjrgSoDagK6qA712jfrFuecHX2Zj8MXByns7FV2UMhs");

#[program]
pub mod raffle {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
