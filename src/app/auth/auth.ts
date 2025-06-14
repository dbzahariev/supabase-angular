import { Component } from '@angular/core'
import { FormBuilder, ReactiveFormsModule } from '@angular/forms'
import { SupabaseService } from '../../app/supabase'
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-auth',
  standalone: true,
  templateUrl: './auth.component.html',
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  styleUrls: ['./auth.component.css'],
})
export class AuthComponent {
  loading = false

  signInForm;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly formBuilder: FormBuilder
  ) {
    this.signInForm = this.formBuilder.group({
      email: '',
    });
  }

  async onSubmit(): Promise<void> {
    try {
      this.loading = true
      const email = this.signInForm.value.email as string
      const { error } = await this.supabase.signIn(email)
      if (error) throw error
      alert('Check your email for the login link!')
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message)
      }
    } finally {
      this.signInForm.reset()
      this.loading = false
    }
  }
}