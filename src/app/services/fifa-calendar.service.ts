import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

export interface FifaLocalizedText {
    Locale: string;
    Description: string;
}

export interface FifaWeather {
    Humidity: number | null;
    Temperature: number | null;
    WindSpeed: number | null;
    Type: number | null;
    TypeLocalized: FifaLocalizedText[];
}

export interface FifaCalendarSide {
    TeamName?: FifaLocalizedText[] | null;
    IdTeam: string;
}

export interface FifaCalendarMatch {
    IdCompetition: string;
    IdSeason: string;
    IdStage: string;
    IdGroup: string;
    IdMatch: string;
    MatchNumber?: number | string | null;
    Home?: FifaCalendarSide | null;
    Away?: FifaCalendarSide | null;
    PlaceHolderA?: string | null;
    PlaceHolderB?: string | null;
    MatchDay: number | null;
    Date: string;
    Attendance: string | null;
    StageName: FifaLocalizedText[];
    GroupName: FifaLocalizedText[];
    CompetitionName: FifaLocalizedText[];
    SeasonName: FifaLocalizedText[];
    SeasonShortName: FifaLocalizedText[];
    Weather: FifaWeather;
    Winner: string;
    [key: string]: unknown;
}

export interface FifaCalendarMatchesResponse {
    ContinuationToken: string | null;
    ContinuationHash: string | null;
    Results: FifaCalendarMatch[];
}

export interface FifaLineupPlayer {
    IdPlayer: string;
    IdTeam: string;
    PlayerName: FifaLocalizedText[];
    ShortName: FifaLocalizedText[];
    Position: number;
    Status: number; // 1 for starting, 2 for substitute, 3 for on bench
    Captain: boolean;
    ShirtNumber: number;
    FieldStatus: number;
}

export interface FifaTeamLineup {
    IdTeam: string;
    TeamName: FifaLocalizedText[];
    Lineup: FifaLineupPlayer[];
    Substitutes: FifaLineupPlayer[];
    Coach: {
        IdCoach: string;
        Name: FifaLocalizedText[];
    } | null;
}

export interface FifaLiveMatchData {
    IdCompetition: string;
    IdSeason: string;
    IdStage: string;
    IdGroup: string | null;
    IdMatch: string;
    HomeTeam: FifaTeamLineup;
    AwayTeam: FifaTeamLineup;
    [key: string]: unknown;
}

export interface FifaTimelineEvent {
    IdEvent: string;
    Timestamp: string;
    Type: number;
    TypeLocalized: FifaLocalizedText[];
    Period: number;
    HomeTeam: FifaTeamLineup | null;
    AwayTeam: FifaTeamLineup | null;
    EventDescription: FifaLocalizedText[];
    [key: string]: unknown;
}

export interface FifaTimelineResponse {
    IdCompetition: string;
    IdSeason: string;
    IdStage: string;
    IdMatch: string;
    Event: FifaTimelineEvent[];
    [key: string]: unknown;
}


@Injectable({
    providedIn: 'root',
})
export class FifaCalendarService {
    private readonly httpClient = inject(HttpClient);
    private readonly calendarBaseUrl = 'https://api.fifa.com/api/v3/calendar/matches';
    private readonly timelinesBaseUrl = 'https://api.fifa.com/api/v3/timelines';

    getSeasonMatches(): Observable<FifaCalendarMatchesResponse> {
        const params = new HttpParams()
            .set('language', 'en')
            .set('count', '500')
            .set('idSeason', '285023');

        return this.httpClient.get<FifaCalendarMatchesResponse>(this.calendarBaseUrl, { params });
    }


    //https://api.fifa.com/api/v3/teamform/43960?to=2026-06-30T23%3A59%3A59Z&count=5&language=en

    /**
     * Извлича събитията (timeline) за конкретен мач.
     * @param idCompetition ID на състезанието
     * @param idSeason ID на сезона
     * @param idStage ID на фазата
     * @param idMatch ID на мача
     * @returns Observable със събитията за мача.
     */
    getMatchTimeline(idCompetition: string, idSeason: string, idStage: string, idMatch: string): Observable<FifaTimelineResponse> {
        const url = `${this.timelinesBaseUrl}/${idCompetition}/${idSeason}/${idStage}/${idMatch}`;
        const params = new HttpParams().set('language', 'en-GB');
        return this.httpClient.get<FifaTimelineResponse>(url, { params });
    }

    getSeasonMatchesResult() {
        return this.getSeasonMatches().pipe(
            map(response => response.Results ?? [])
        );
    }

    // getSeasonMatchesFilteredByDate(filterByDate: string) {
    //     return this.getSeasonMatches().pipe(
    //         map(response => response.Results?.find(match => match.Date === filterByDate) ?? undefined)
    //     );
    // }
}
