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
    [key: string]: unknown;
}

export interface FifaCalendarMatchesResponse {
    ContinuationToken: string | null;
    ContinuationHash: string | null;
    Results: FifaCalendarMatch[];
}

@Injectable({
    providedIn: 'root',
})
export class FifaCalendarService {
    private readonly httpClient = inject(HttpClient);
    private readonly baseUrl = 'https://api.fifa.com/api/v3/calendar/matches';

    getSeasonMatches(): Observable<FifaCalendarMatchesResponse> {
        const params = new HttpParams()
            .set('language', 'en')
            .set('count', '500')
            .set('idSeason', '285023');

        return this.httpClient.get<FifaCalendarMatchesResponse>(this.baseUrl, { params });
    }

    getSeasonMatchesResult() {
        return this.getSeasonMatches().pipe(
            map(response => response.Results ?? [])
        );
    }

    getSeasonMatchesFilteredByDate(filterByDate: string) {
        return this.getSeasonMatches().pipe(
            map(response => response.Results?.find(match => match.Date === filterByDate) ?? undefined)
        );
    }
}
