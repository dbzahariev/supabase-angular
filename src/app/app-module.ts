import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { App } from '../app/app';
import { AuthComponent } from './auth/auth';
import { AccountComponent } from './account/account';
import { AddPrediction } from './add-prediction/add-prediction';
@NgModule({
  declarations: [App, AddPrediction],
  imports: [BrowserModule, AuthComponent, AccountComponent],
  providers: [],
  bootstrap: [App],
})
export class AppModule { }
