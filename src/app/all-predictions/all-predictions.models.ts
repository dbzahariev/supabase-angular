/* eslint-disable @typescript-eslint/no-explicit-any */

export interface SupabaseResponse<T> {
    error: { message: string; details?: string } | null;
    data: T[] | null;
}

export interface FilterSet {
    season: string;
}

export interface ResultSet {
    count: number;
    first: string;
    last: string;
    played: number;
}

export interface CompetitionInfo {
    id: number;
    name: string;
    code: string;
    type: string;
    emblem: string;
}

export interface MatchesApiResponse {
    filters: FilterSet;
    resultSet: ResultSet;
    competition: CompetitionInfo;
    matches: Match[];
}

export interface Bet {
    row_index: number;
    match_day: string;
    match_time: string;
    group: string;
    stage: string;
    phase: string;
    id: number;
    home_team: string;
    away_team: string;
    score?: Match['score'];
    matchUtcDate?: string;
    matchStatus?: "TIMED" | string;
}

export interface User {
    id: number;
    name_bg: string;
    name_en: string;
    total_points?: number;
}

export interface Team {
    id: number;
    name_en: string;
    name_bg: string;
}

export interface Prediction {
    points?: number;
    id: number;
    utc_date: string;
    home_ft: number;
    away_ft: number;
    home_pt: number;
    away_pt: number;
    winner: string;
    users: User;
    matches: {
        id: number;
        group_name?: string;
        away_team_id: number;
        home_team_id: number;
    };
    teams: {
        away_team: { name_bg: string; name_en: string };
        home_team: { name_bg: string; name_en: string };
    };
}

export interface Match {
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
        winner: string | null;
    };
    id: number;
    utcDate: string;
    status: string;
    matchday: number;
    stage: string;
    group: string;
    myGroup: string;
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
        fullTime: { home: number | null; away: number | null };
        halfTime: { home: number | null; away: number | null };
    };
    odds: { msg: string };
    referees: any[];
    myId: number;
}

export interface PredictionBackupEntry {
    event_id: string;
    timestamp: string;
    action: 'insert' | 'update' | 'delete' | 'skip' | 'error' | 'download';
    user_id: number;
    match_id: number;
    prediction_id: number | null;
    column_index: number;
    input_value: string;
    payload: Record<string, any>;
    error_message?: string;
}

export interface PredictionBackupEventRow {
    event_id: string;
    event_timestamp: string;
    action: 'insert' | 'update' | 'delete' | 'skip' | 'error' | 'download';
    user_id: number;
    match_id: number;
    prediction_id: number | null;
    column_index: number;
    input_value: string;
    payload: Record<string, unknown>;
    error_message?: string;
    source?: string;
}

export interface SupabaseMatch {
    id: number;
    home_team_id: number;
    away_team_id: number;
    utc_date: string;
    group_name: string;
    home_ft: number;
    away_ft: number;
    home_pt: number;
    away_pt: number;
    winner: string;
}
