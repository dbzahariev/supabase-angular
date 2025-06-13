import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { App } from '../app/app';
import { AuthComponent } from './auth/auth';
import { AccountComponent } from './account/account';
import { AddPrediction } from "./add-prediction/add-prediction";
@NgModule({
  declarations: [App],
  imports: [BrowserModule, AuthComponent, AccountComponent, AddPrediction],
  providers: [],
  bootstrap: [App],
})
export class AppModule { }
