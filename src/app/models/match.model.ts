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

export interface BetsToShow {
  row_index: MatchDetail['id'];
  match_day: string;
  match_time: string;
  group: MatchDetail['group'];
  home_team: MatchDetail['homeTeam']['name'];
  away_team: MatchDetail['awayTeam']['name'];
  home_team_score: MatchDetail['score']['fullTime']['home'] | null;
  away_team_score: MatchDetail['score']['fullTime']['away'] | null;
}

export interface PredictionWithUser extends Prediction {
  users: {
    id: number;
    name_bg: string;
    name_en: string;
  };
  matches: {
    group_name: string;
    id: number;
    home_team_id: number;
    away_team_id: number;
  };
  teams: {
    home_team: {
      name_bg: string;
      name_en: string;
    };
    away_team: {
      name_bg: string;
      name_en: string;
    };
  }[];
}

export interface MatchDetail {
  area: {
    id: number;
    name: string;
    code: string;
    flag: string | null;
  };
  competition: {
    id: number;
    name: string;
    code: string;
    type: string;
    emblem: string;
  };
  season: {
    id: number;
    startDate: string;
    endDate: string;
    currentMatchday: number;
    winner: null;
  };
  matches: {
    away_team_id: number;
    group_name: string;
    home_team_id: number;
    id: number;
  };
  home_ft: MatchDetail['score']['fullTime']['home'] | null;
  away_ft: MatchDetail['score']['fullTime']['away'] | null;

  home_ht: MatchDetail['score']['halfTime']['home'] | null;
  away_ht: MatchDetail['score']['halfTime']['away'] | null;
  teams: {
    home_team: {
      name_bg: string;
      name_en: string;
    };
    away_team: {
      name_bg: string;
      name_en: string;
    };
  }
  id: number;
  utcDate: string;
  utc_date: string;
  status: string;
  matchday: number;
  stage: string;
  group: string | null;
  lastUpdated: string;
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  score: {
    winner: string | null;
    duration: string;
    fullTime: {
      home: number | null;
      away: number | null;
    };
    halfTime: {
      home: number | null;
      away: number | null;
    };
  };
  odds: {
    msg: string;
  };
  referees: any[];
}