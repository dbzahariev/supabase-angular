import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ChatComponent } from './chat/chat.component';
import { AddPrediction } from './add-prediction/add-prediction';

const routes: Routes = [
    { path: '', component: AddPrediction },
    { path: 'chat', component: ChatComponent }
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})
export class AppRoutingModule { }
