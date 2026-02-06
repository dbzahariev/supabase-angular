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

export interface Prediction {
  id: number;
  user_id: number;
  match_id: number;
  utc_date: string;
  match_group: string;
  home_ft: number;
  away_ft: number;
  home_pt: number;
  away_pt: number;
  winner: string;
}

export interface PredictionWithUser extends Prediction {
  name_bg: string;
  name_en: string;
}
