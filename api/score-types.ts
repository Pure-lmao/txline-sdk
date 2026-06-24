/**
 * Sport-specific score payload shapes and nested components.
 *
 * **Sport ids on the wire:** `Soccer` = association football (e.g. World Cup);
 * `UsFootball` = American football (NFL); `Basketball` = basketball.
 *
 * Nested objects and live score events use PascalCase (`ApiScoreEvent`).
 */

/** Empty-object enum marker used throughout fixture status / type fields. */
export type ApiScoreMarker = Record<string, never>;

/** `Soccer` = association football; `UsFootball` = American football (NFL). */
export type ApiScoreSport = 'Soccer' | 'Basketball' | 'UsFootball';

export type ApiScoreStats = Record<string, number>;

// --- Shared nested types ---

/** Match clock on live score events (`Running` / `Seconds`). */
export interface ApiScoreClock {
   Running: boolean;
   Seconds: number;
}

export interface ApiUsFootballFixtureDown {
   number: number;
   yardsToGo: number;
   scrimmageLine: number;
   possession: ApiScoreMarker;
   side: ApiScoreMarker;
}

export interface ApiInPlayInfo {
   BallSnapped: boolean;
   PlayersLiningUp: boolean;
   TimeoutParti1: boolean;
   TimeoutParti2: boolean;
   TVTimeout: boolean;
   Outcome?: ApiScoreMarker;
   NewSetOfDowns?: boolean;
   PenaltyIncreasedDown?: boolean;
}

export interface ApiKickoffInfo {
   Team: ApiScoreMarker;
   Type?: ApiScoreMarker;
   Outcome?: ApiScoreMarker;
   KickoffPreviousAction?: ApiScoreMarker;
   PenaltyYards?: number;
}

export interface ApiKickoffDetails {
   Team?: ApiScoreMarker;
}

export interface ApiLineupData {
   id: string;
   normativeId: number;
   preferredName: string;
   gender: string;
   updateDateMillis: number;
   lineups?: ApiPlayerLineupData[];
}

export interface ApiPlayerData {
   id: string;
   normativeId: number;
   country: string;
   team: string;
   dateOfBirth: string;
   gender: string;
   preferredName: string;
   updateDateMillis: number;
}

export interface ApiPlayerLineupData {
   fixturePlayerId: number;
   statusId: number;
   positionId: number;
   unitId: number;
   rosterNumber: string;
   starter: boolean;
   starred: boolean;
   player: ApiPlayerData;
}

// --- Soccer (association football) ---

export interface ApiSoccerScore {
   Goals: number;
   YellowCards: number;
   RedCards: number;
   Corners: number;
}

export interface ApiSoccerTotalScore {
   H1?: ApiSoccerScore;
   HT?: ApiSoccerScore;
   H2?: ApiSoccerScore;
   ET1?: ApiSoccerScore;
   ET2?: ApiSoccerScore;
   PE?: ApiSoccerScore;
   ETTotal?: ApiSoccerScore;
   Total?: ApiSoccerScore;
}

export interface ApiSoccerFixtureScore {
   Participant1: ApiSoccerTotalScore;
   Participant2: ApiSoccerTotalScore;
}

export interface ApiSoccerUpdateReference {
   Clock?: ApiScoreClock;
   FreeKickType?: ApiScoreMarker;
   GoalType?: ApiScoreMarker;
   Minutes?: number;
   Participant?: number;
   PlayerId?: number;
   PlayerInId?: number;
   PlayerOutId?: number;
   StatusId?: number;
   ThrowInType?: string;
   Type?: string;
}

export interface ApiSoccerData {
   Action?: string;
   Color?: string;
   Conditions?: string[];
   New?: ApiSoccerUpdateReference;
   Corner?: boolean;
   FreeKickType?: string;
   Goal?: boolean;
   GoalType?: ApiScoreMarker;
   Minutes?: number;
   Outcome?: string;
   Participant?: number;
   Penalty?: boolean;
   PlayerId?: number;
   PlayerInId?: number;
   PlayerOutId?: number;
   Previous?: ApiSoccerUpdateReference;
   StatusId?: number;
   ThrowInType?: string;
   Type?: string;
   RedCard?: boolean;
   YellowCard?: boolean;
   VAR?: boolean;
   VenueType?: ApiScoreMarker;
}

export interface ApiSoccerStreamData {
   Participant?: number;
   PlayerId?: number;
   Outcome?: string;
}

export interface ApiSoccerPartiState {
   PossibleEvent: ApiSoccerPossiblePartiEvent;
}

export interface ApiSoccerPossiblePartiEvent {
   Goal: boolean;
   Penalty: boolean;
   Corner: boolean;
}

export interface ApiSoccerPossibleNeutralEvent {
   RedCard: boolean;
   YellowCard: boolean;
   VAR: boolean;
}

// --- Basketball ---

export interface ApiBasketballScore {
   Score: number;
   Fouls: number;
   PersonalFouls: number;
   Blocks: number;
   Rebounds: number;
   FreeThrows_made: number;
   '2pts_made': number;
   '3pts_made': number;
   FreeThrows_missed: number;
   '2pts_missed': number;
   '3pts_missed': number;
   FreeThrows_attempts: number;
   '2pts_attempts': number;
   '3pts_attempts': number;
   Assists: number;
   Turnovers: number;
   Steals: number;
   UsedTimeouts: number;
}

export interface ApiBasketballTotalScore {
   Period?: Record<string, ApiBasketballScore>;
   HT?: ApiBasketballScore;
   OT?: Record<string, ApiBasketballScore>;
   OTTotal?: ApiBasketballScore;
   Total?: ApiBasketballScore;
}

export interface ApiBasketballFixtureScore {
   Participant1: ApiBasketballTotalScore;
   Participant2: ApiBasketballTotalScore;
}

export interface ApiBasketballUpdateReference {
   AssistConfirmed?: boolean;
   AssistId?: number;
   BlockConfirmed?: boolean;
   BlockerId?: number;
   Clock?: ApiScoreClock;
   FouledId?: number;
   Id?: number;
   Outcome?: string;
   ReplaceId?: number;
   Type?: string;
}

export interface ApiBasketballData {
   Action?: string;
   Active?: boolean;
   AssistConfirmed?: boolean;
   AssistId?: number;
   BlockConfirmed?: boolean;
   BlockerId?: number;
   Clock?: ApiScoreClock;
   FouledId?: number;
   Id?: number;
   New?: ApiBasketballUpdateReference;
   Outcome?: string;
   Previous?: ApiBasketballUpdateReference;
   ReplaceId?: number;
   Type?: string;
}

export interface ApiBasketballPartiState {
   AttackingBasket: boolean;
   ActiveTimeout: boolean;
   Challenges: number;
}

// --- American football (NFL) — API sport id `UsFootball` ---

export interface ApiUsFootballScore {
   Score: number;
   Touchdown: number;
   Safety: number;
   '1ptSafety': number;
   '1ptConversion': number;
   '2ptConversion': number;
   FieldGoal: number;
   Defensive2ptConversion: number;
}

export interface ApiUsFootballTotalScore {
   Q1?: ApiUsFootballScore;
   Q2?: ApiUsFootballScore;
   HT?: ApiUsFootballScore;
   Q3?: ApiUsFootballScore;
   Q4?: ApiUsFootballScore;
   OT?: Record<string, ApiUsFootballScore>;
   OTTotal?: ApiUsFootballScore;
   Total?: ApiUsFootballScore;
}

export interface ApiUsFootballFixtureScore {
   Participant1: ApiUsFootballTotalScore;
   Participant2: ApiUsFootballTotalScore;
}

export interface ApiUpdateReference {
   Clock?: ApiScoreClock;
   Down?: string;
   Id?: number;
   Outcome?: string;
   Participant?: number;
   ReplaceId?: number;
   Type?: string;
   Yards?: number;
   YardsToGo?: number;
   YardsToEndzone?: number;
}

export interface ApiUsFootballData {
   Action?: string;
   Active?: boolean;
   BigPlay?: boolean;
   Challenge?: boolean;
   Clock?: ApiScoreClock;
   Down?: string;
   FieldGoal?: boolean;
   Id?: number;
   IsTeam?: boolean;
   New?: ApiUpdateReference;
   NewSetOfDowns?: boolean;
   Origin?: string;
   Outcome?: string;
   Participant?: number;
   Participants?: number[];
   PasserId?: number;
   Penalty?: boolean;
   PlayerId?: number;
   Posession?: number;
   Previous?: ApiUpdateReference;
   ReceiverId?: number;
   ReplaceId?: number;
   ReviewType?: string;
   RusherId?: number;
   SackedPlayerId?: number;
   Safety?: boolean;
   ScrimmageLine?: number;
   Side?: string;
   Touchdown?: boolean;
   Turnover?: boolean;
   Type?: string;
   Yards?: number;
   YardsToGo?: number;
   YardsToEndzone?: number;
}

export interface ApiUsFootballPartiState {
   Timeouts: number;
   Challenges: number;
   PossibleEvent: ApiUsFootballPossiblePartiEvent;
}

export interface ApiUsFootballPossiblePartiEvent {
   touchdown: boolean;
   fieldGoal: boolean;
   safety: boolean;
   '4thDownConversion': boolean;
   '2ptConversionAttempt': boolean;
   '1stDown': boolean;
   bigPlay: boolean;
   punt: boolean;
}

export interface ApiUsFootballPossibleEvent {
   penalty: boolean;
   turnover: boolean;
   challenge: boolean;
}

/** Live REST/SSE fields when `Type` is `Soccer` (association football). */
export interface ApiSoccerScoreEventFields {
   Type?: 'Soccer' | ApiScoreMarker;
   /** Match phase / status (snapshot, historical, and most SSE events). */
   StatusId?: number;
   /**
    * Same role as {@link StatusId} on some scores SSE events.
    * Misnamed on the API — only seen on soccer (`Type: "Soccer"`), not NFL.
    */
   StatusUsFootballId?: number;
   Clock?: ApiScoreClock;
   Score?: ApiSoccerFixtureScore;
   /** Event detail (snapshot / historical). */
   Data?: ApiSoccerData;
   /**
    * Event detail on scores SSE for soccer.
    * Misnamed on the API — not American football; see {@link ApiSoccerStreamData}.
    */
   DataUsFootball?: ApiSoccerStreamData;
   Possession?: number;
   PossessionType?: string;
   Parti1State?: ApiSoccerPartiState | ApiScoreMarker;
   Parti2State?: ApiSoccerPartiState | ApiScoreMarker;
   PossibleEvent?: ApiSoccerPossibleNeutralEvent | ApiScoreMarker;
}

export interface ApiBasketballScoreEventFields {
   Type?: 'Basketball' | ApiScoreMarker;
   StatusBasketballId?: ApiScoreMarker;
   ScoreBasketball?: ApiBasketballFixtureScore;
   DataBasketball?: ApiBasketballData;
   Parti1StateBasketball?: ApiBasketballPartiState;
   Parti2StateBasketball?: ApiBasketballPartiState;
}

/** Live REST/SSE fields when `Type` is `UsFootball` (American football / NFL). */
export interface ApiUsFootballScoreEventFields {
   Type?: 'UsFootball' | ApiScoreMarker;
   StatusId?: number | ApiScoreMarker;
   Clock?: ApiScoreClock;
   Down?: ApiUsFootballFixtureDown;
   InPlayInfo?: ApiInPlayInfo;
   KickoffInfo?: ApiKickoffInfo;
   Score?: ApiUsFootballFixtureScore;
   Data?: ApiUsFootballData;
   Parti1StateUsFootball?: ApiUsFootballPartiState;
   Parti2StateUsFootball?: ApiUsFootballPartiState;
   PossibleEventUsFootball?: ApiUsFootballPossibleEvent;
}
