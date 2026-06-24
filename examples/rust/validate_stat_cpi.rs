//! # Verifying TxLINE score stats inside your Solana program
//!
//! Pinocchio reference: Borsh-decode the TxLINE `validate_stat` ix once in your handler,
//! check stat keys / period against **program constants** (never trust client input
//! for period), then CPI the same bytes through unchanged.
//!
//! ```toml
//! # Cargo.toml
//! borsh = { version = "1", default-features = false }
//! ```
//!
//! ## Off-chain
//!
//! 1. `GET /api/scores/stat-validation` → `encodeValidateStatIxData` (TS SDK).
//! 2. Your ix data is **only** those bytes (passthrough). Fixture id is checked
//!    against your on-chain bet account, not supplied by the client.
//!
//! ## Program constants (soccer full-time home win example)
//!
//! | Constant | Value | Meaning |
//! |----------|-------|---------|
//! | `STAT_HOME_GOALS` | 1 | Home goals |
//! | `STAT_AWAY_GOALS` | 2 | Away goals |
//! | `PERIOD_FULL_TIME` | 5 | Full-time result |

use borsh::BorshDeserialize;
use pinocchio::{
   AccountView, Address, ProgramResult,
   address::address_eq,
   cpi::invoke,
   error::ProgramError,
   instruction::{InstructionAccount, InstructionView},
};

pub const TXLINE_PROGRAM_ID: Address = Address::new_from_array([
   0x56, 0x75, 0x9f, 0x2c, 0x90, 0x5f, 0x78, 0x60, 0xc8, 0x63, 0x77, 0x14, 0xbf, 0x24, 0x91, 0x30,
   0x9d, 0xc0, 0x71, 0x81, 0x51, 0x3f, 0x7a, 0x24, 0xbf, 0x3e, 0xda, 0xf8, 0x7f, 0x77, 0x50, 0x03,
]);

pub const VALIDATE_STAT_IX_DISCRIMINATOR: [u8; 8] =
   [107, 197, 232, 90, 191, 136, 105, 185];

const DISC_LEN: usize = 8;
const DAILY_SCORES_ROOTS_SEED: &[u8] = b"daily_scores_roots";
const MS_PER_DAY: u64 = 86_400_000;

/// Soccer stat keys / periods — enforced on-chain, not passed in ix data.
pub mod soccer {
   pub const STAT_HOME_GOALS: u32 = 1;
   pub const STAT_AWAY_GOALS: u32 = 2;
   pub const PERIOD_FULL_TIME: i32 = 5;
}

// --- Borsh types (mirror TxLINE IDL / `program/codex.ts` field order) ---

#[derive(BorshDeserialize, Debug)]
pub struct ScoreStat {
   pub key: u32,
   pub value: i32,
   pub period: i32,
}

#[derive(BorshDeserialize, Debug)]
pub struct ScoresUpdateStats {
   pub update_count: i32,
   pub min_timestamp: i64,
   pub max_timestamp: i64,
}

#[derive(BorshDeserialize, Debug)]
pub struct ScoresBatchSummary {
   pub fixture_id: i64,
   pub update_stats: ScoresUpdateStats,
   pub events_sub_tree_root: [u8; 32],
}

#[derive(BorshDeserialize, Debug)]
pub struct ProofNode {
   pub hash: [u8; 32],
   pub is_right_sibling: u8,
}

#[derive(BorshDeserialize, Debug, PartialEq, Eq)]
pub enum Comparison {
   GreaterThan = 0,
   LessThan = 1,
   EqualTo = 2,
}

#[derive(BorshDeserialize, Debug)]
pub struct TraderPredicate {
   pub threshold: i32,
   pub comparison: Comparison,
}

#[derive(BorshDeserialize, Debug)]
pub struct StatTerm {
   pub stat_to_prove: ScoreStat,
   pub event_stat_root: [u8; 32],
   pub stat_proof: Vec<ProofNode>,
}

#[derive(BorshDeserialize, Debug, PartialEq, Eq)]
pub enum BinaryExpression {
   Add = 0,
   Subtract = 1,
}

/// Payload after the 8-byte Anchor discriminator.
#[derive(BorshDeserialize, Debug)]
pub struct ValidateStatIx {
   pub ts: i64,
   pub fixture_summary: ScoresBatchSummary,
   pub fixture_proof: Vec<ProofNode>,
   pub main_tree_proof: Vec<ProofNode>,
   pub predicate: TraderPredicate,
   pub stat_a: StatTerm,
   pub stat_b: Option<StatTerm>,
   pub op: Option<BinaryExpression>,
}

pub fn parse_and_validate_stat_ix(data: &[u8]) -> Result<ValidateStatIx, ProgramError> {
   if data.len() < DISC_LEN || data[..DISC_LEN] != VALIDATE_STAT_IX_DISCRIMINATOR {
      return Err(ProgramError::InvalidInstructionData);
   }
   ValidateStatIx::try_from_slice(&data[DISC_LEN..]).map_err(|_| ProgramError::InvalidInstructionData)
}

/// Enforce full-time home-win market shape using **program** constants only.
pub fn validate_full_time_home_win(ix: &ValidateStatIx) -> ProgramResult {
   if ix.stat_a.stat_to_prove.period != soccer::PERIOD_FULL_TIME {
      return Err(ProgramError::InvalidInstructionData);
   }
   if ix.stat_a.stat_to_prove.key != soccer::STAT_HOME_GOALS {
      return Err(ProgramError::InvalidInstructionData);
   }
   let stat_b = ix.stat_b.as_ref().ok_or(ProgramError::InvalidInstructionData)?;
   if stat_b.stat_to_prove.period != soccer::PERIOD_FULL_TIME {
      return Err(ProgramError::InvalidInstructionData);
   }
   if stat_b.stat_to_prove.key != soccer::STAT_AWAY_GOALS {
      return Err(ProgramError::InvalidInstructionData);
   }
   if ix.op != Some(BinaryExpression::Subtract) {
      return Err(ProgramError::InvalidInstructionData);
   }
   if ix.predicate.comparison != Comparison::GreaterThan || ix.predicate.threshold != 0 {
      return Err(ProgramError::InvalidInstructionData);
   }
   Ok(())
}

fn epoch_day_from_ts_ms(ts_ms: i64) -> u16 {
   ((ts_ms as u64) / MS_PER_DAY).min(u16::MAX as u64) as u16
}

fn verify_daily_scores_roots_pda(daily_scores_roots: &AccountView, ts_ms: i64) -> ProgramResult {
   let epoch_day = epoch_day_from_ts_ms(ts_ms);
   let seeds = [DAILY_SCORES_ROOTS_SEED, epoch_day.to_le_bytes().as_slice()];
   let (expected, _bump) = Address::find_program_address(&seeds, &TXLINE_PROGRAM_ID);
   if !address_eq(daily_scores_roots.address(), &expected) {
      return Err(ProgramError::InvalidSeeds);
   }
   Ok(())
}

/// CPI only — caller already parsed and validated; pass `ts_ms` from that parse.
pub fn cpi_validate_stat(
   txline_program: &AccountView,
   daily_scores_roots: &AccountView,
   ts_ms: i64,
   validate_stat_ix_data: &[u8],
) -> ProgramResult {
   if !address_eq(txline_program.address(), &TXLINE_PROGRAM_ID) || !txline_program.executable() {
      return Err(ProgramError::IncorrectProgramId);
   }
   verify_daily_scores_roots_pda(daily_scores_roots, ts_ms)?;

   let ix_accounts = [InstructionAccount::new(daily_scores_roots.address(), false, false)];
   let ix = InstructionView {
      program_id: txline_program.address(),
      accounts: &ix_accounts,
      data: validate_stat_ix_data,
   };
   invoke(&ix, &[daily_scores_roots.as_ref()])
}

/// Example bet account: `fixture_id` at offset 0.
const BET_FIXTURE_ID_OFFSET: usize = 0;

fn read_bet_fixture_id(bet_account: &AccountView) -> Result<u64, ProgramError> {
   let data = bet_account.try_borrow()?;
   if data.len() < 8 {
      return Err(ProgramError::InvalidInstructionData);
   }
   Ok(u64::from_le_bytes(data[BET_FIXTURE_ID_OFFSET..BET_FIXTURE_ID_OFFSET + 8].try_into().unwrap()))
}

/// Accounts:
///   0. `bet_account` (readonly) — stores `fixture_id` on-chain
///   1. `txline_program` (readonly, executable)
///   2. `daily_scores_merkle_roots` (readonly)
///
/// Data: `validate_stat_ix_data` only (full TxLINE ix from `encodeValidateStatIxData`).
pub fn process_settle_with_txline(accounts: &mut [AccountView], data: &[u8]) -> ProgramResult {
   let [bet_account, txline_program, daily_scores_roots] = accounts else {
      return Err(ProgramError::NotEnoughAccountKeys);
   };

   let bet_fixture_id = read_bet_fixture_id(bet_account)?;
   let ix = parse_and_validate_stat_ix(data)?;

   if ix.fixture_summary.fixture_id < 0 {
      return Err(ProgramError::InvalidInstructionData);
   }
   if ix.fixture_summary.fixture_id as u64 != bet_fixture_id {
      return Err(ProgramError::InvalidInstructionData);
   }

   validate_full_time_home_win(&ix)?;

   cpi_validate_stat(txline_program, daily_scores_roots, ix.ts, data)?;
   Ok(())
}
