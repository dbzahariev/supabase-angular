import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MatchImportComponent } from './components/match-import/match-import.component';
import { TeamImportComponent } from './components/team-import/team-import.component';
import { AllPredictionsComponent } from './all-predictions/all-predictions.component';
import { RulesComponent } from './rules/rules';
import { MatchDetailsComponent } from './match-details/match-details.component';
import { LiveMonitorComponent } from './live-monitor/live-monitor.component';
import { LiveMonitorFullComponent } from './live-monitor/live-monitor-full.component';
import { KnockoutBracketComponent } from './knockout-bracket/knockout-bracket.component';
import { adminGuard } from './guards/admin.guard';
import { GroupStandingsComponent } from './group-standings/group-standings.component';
import { EliminationsComponent } from './eliminations/eliminations.component';

const routes: Routes = [
    { path: 'import-matches', component: MatchImportComponent, canActivate: [adminGuard] },
    { path: 'import-teams', component: TeamImportComponent, canActivate: [adminGuard] },
    { path: '', component: AllPredictionsComponent },
    { path: 'group-standings', component: GroupStandingsComponent },
    { path: 'eliminations', component: EliminationsComponent },
    // { path: 'eliminations', component: KnockoutBracketComponent },
    { path: 'knockout-bracket', component: KnockoutBracketComponent },
    { path: 'rules', component: RulesComponent },
    { path: 'match-details', component: MatchDetailsComponent, canActivate: [adminGuard] },
    { path: 'live-monitor', component: LiveMonitorComponent, canActivate: [adminGuard] },
    { path: 'live-monitor-full', component: LiveMonitorFullComponent, canActivate: [adminGuard] },
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})
export class AppRoutingModule { }
