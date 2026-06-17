import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MatchImportComponent } from './components/match-import/match-import.component';
import { TeamImportComponent } from './components/team-import/team-import.component';
import { AllPredictionsComponent } from './all-predictions/all-predictions.component';
import { RulesComponent } from './rules/rules';
import { MatchDetailsComponent } from './match-details/match-details.component';
import { LiveMonitorComponent } from './live-monitor/live-monitor.component';
import { adminGuard } from './guards/admin.guard';

const routes: Routes = [
    { path: 'import-matches', component: MatchImportComponent, canActivate: [adminGuard] },
    { path: 'import-teams', component: TeamImportComponent, canActivate: [adminGuard] },
    { path: '', component: AllPredictionsComponent },
    { path: 'rules', component: RulesComponent },
    { path: 'match-details', component: MatchDetailsComponent, canActivate: [adminGuard] },
    { path: 'live-monitor', component: LiveMonitorComponent, canActivate: [adminGuard] },
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})
export class AppRoutingModule { }
