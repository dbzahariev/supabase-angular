import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
// import { ChatComponent } from './chat/chat.component';
import { AddPrediction } from './add-prediction/add-prediction';
import { MatchImportComponent } from './components/match-import/match-import.component';
import { TeamImportComponent } from './components/team-import/team-import.component';

const routes: Routes = [
    { path: '', component: AddPrediction },
    // { path: 'chat', component: ChatComponent }
    { path: 'import-matches', component: MatchImportComponent },
    { path: 'import-teams', component: TeamImportComponent }
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})
export class AppRoutingModule { }
