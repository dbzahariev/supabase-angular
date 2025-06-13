import { Component, Input, OnInit } from '@angular/core'
import { FormBuilder, ReactiveFormsModule } from '@angular/forms'
import { AuthSession } from '@supabase/supabase-js'
import { Profile, SupabaseService } from '../../app/supabase'
import { CommonModule } from '@angular/common'

@Component({
  selector: 'app-account',
  standalone: true,
  templateUrl: './account.component.html',
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  styleUrls: ['./account.component.css'],
})
export class AccountComponent implements OnInit {
  loading = false
  profile!: Profile

  @Input()
  session!: AuthSession

  updateProfileForm: ReturnType<FormBuilder['group']> | undefined;

  constructor(
    private readonly supabase: SupabaseService,
    private formBuilder: FormBuilder
  ) {
    this.updateProfileForm = this.formBuilder.group({
      username: '',
      website: '',
      avatar_url: '',
    });
  }

  async ngOnInit(): Promise<void> {
    await this.getProfile()

    const { username, website, avatar_url } = this.profile
    if (this.updateProfileForm) {
      this.updateProfileForm.patchValue({
        username,
        website,
        avatar_url,
      })
    }
  }

  async getProfile() {
    try {
      this.loading = true
      const { user } = this.session
      const { data: profile, error, status } = await this.supabase.profile(user)
      debugger

      if (error && status !== 406) {
        throw error
      }

      if (profile) {
        this.profile = profile
      }
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message)
      }
    } finally {
      this.loading = false
    }
  }

  async updateProfile(): Promise<void> {
    try {
      this.loading = true
      const { user } = this.session

      const username = this.updateProfileForm?.value.username as string ?? ''
      const website = this.updateProfileForm?.value.website as string ?? ''
      const avatar_url = this.updateProfileForm?.value.avatar_url as string ?? ''

      const { error } = await this.supabase.updateProfile({
        id: user.id,
        username,
        website,
        avatar_url,
      })
      if (error) throw error
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message)
      }
    } finally {
      this.loading = false
    }
  }

  async signOut() {
    await this.supabase.signOut()
  }
}