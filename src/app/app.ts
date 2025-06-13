import { Component, OnInit, Inject } from '@angular/core'
import { SupabaseService } from '../app/supabase'
@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
  providers: [SupabaseService]
})
export class App {
  title = 'angular-user-management'
  session: any

  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {
    this.session = this.supabase.session
  }

  ngOnInit() {
    this.supabase.authChanges((_, session) => (this.session = session))
  }
}