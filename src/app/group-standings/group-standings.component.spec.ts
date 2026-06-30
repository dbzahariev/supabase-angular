import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { GroupStandingsComponent, StandingRow } from './group-standings.component';
import { SupabaseService } from '../supabase';
import { ThemeService } from '../services/theme.service';

describe('GroupStandingsComponent', () => {
  let component: GroupStandingsComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupStandingsComponent, TranslateModule.forRoot()],
      providers: [
        {
          provide: SupabaseService,
          useValue: {
            getAllTeams: () => Promise.resolve({ data: [] }),
            getCompetitionStandingsFromBE: () => of(null),
          },
        },
        {
          provide: ThemeService,
          useValue: {
            getThemeColor: () => 'green',
            themeColor$: of('green'),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(GroupStandingsComponent);
    component = fixture.componentInstance;
  });

  it('marks 2nd place as guaranteed when group is finished even if tied on points with 3rd', () => {
    const rows = buildRows([
      { position: 1, points: 7, gd: 4, playedGames: 3 },
      { position: 2, points: 4, gd: 5, playedGames: 3 },
      { position: 3, points: 4, gd: -1, playedGames: 3 },
      { position: 4, points: 1, gd: -8, playedGames: 3 },
    ]);

    expect(component.isGuaranteedQualified(rows, rows[1])).toBeTrue();
  });

  it('does not mark 3rd place as guaranteed when group is finished', () => {
    const rows = buildRows([
      { position: 1, points: 7, gd: 4, playedGames: 3 },
      { position: 2, points: 4, gd: 5, playedGames: 3 },
      { position: 3, points: 4, gd: -1, playedGames: 3 },
      { position: 4, points: 1, gd: -8, playedGames: 3 },
    ]);

    expect(component.isGuaranteedQualified(rows, rows[2])).toBeFalse();
  });

  it('does not mark 2nd place as guaranteed in unfinished group when 3 teams can still catch up', () => {
    const rows = buildRows([
      { position: 1, points: 6, gd: 4, playedGames: 2 },
      { position: 2, points: 4, gd: 0, playedGames: 2 },
      { position: 3, points: 4, gd: -2, playedGames: 2 },
      { position: 4, points: 3, gd: -2, playedGames: 2 },
    ]);

    expect(component.isGuaranteedQualified(rows, rows[1])).toBeFalse();
  });
});

function buildRows(
  items: { position: number; points: number; gd: number; playedGames: number }[]
): StandingRow[] {
  return items.map((item, index) => ({
    position: item.position,
    team: {
      id: index + 1,
      name: `Team ${index + 1}`,
    },
    playedGames: item.playedGames,
    won: 0,
    draw: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: item.gd,
    points: item.points,
  }));
}
