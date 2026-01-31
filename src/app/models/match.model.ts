export interface MatchScore {
  homeFT: number;
  awayFT: number;
  homePT: number;
  awayPT: number;
  winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW';
}

export interface Match {
  id: number;
  homeTeam: string;
  awayTeam: string;
  utcDate: string;
  group: string;
  score: MatchScore;
}
