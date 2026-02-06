import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../supabase';
import { PredictionWithUser } from '../../models/match.model';

@Component({
  selector: 'app-predictions-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="predictions-container">
      <h2>Прогнози с потребители</h2>
      
      <div *ngIf="loading">Зареждане...</div>
      
      <div *ngIf="error" class="error">{{ error }}</div>
      
      <table *ngIf="!loading && predictions.length > 0">
        <thead>
          <tr>
            <th>Потребител</th>
            <th>Мач ID</th>
            <th>Дата</th>
            <th>Група</th>
            <th>Резултат (FT)</th>
            <th>Резултат (PT)</th>
            <th>Победител</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let prediction of predictions">
            <td>{{ prediction.name_bg }}</td>
            <td>{{ prediction.match_id }}</td>
            <td>{{ prediction.utc_date | date:'short' }}</td>
            <td>{{ prediction.match_group }}</td>
            <td>{{ prediction.home_ft }} - {{ prediction.away_ft }}</td>
            <td>{{ prediction.home_pt }} - {{ prediction.away_pt }}</td>
            <td>{{ prediction.winner }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .predictions-container {
      padding: 20px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    
    th, td {
      padding: 10px;
      text-align: left;
      border: 1px solid #ddd;
    }
    
    th {
      background-color: #f4f4f4;
      font-weight: bold;
    }
    
    .error {
      color: red;
      padding: 10px;
      background-color: #ffe6e6;
      border-radius: 4px;
    }
  `]
})
export class PredictionsListComponent implements OnInit {
  predictions: PredictionWithUser[] = [];
  loading = false;
  error = '';

  constructor(private supabase: SupabaseService) {}

  ngOnInit() {
    this.loadPredictionsWithUsers();
  }

  async loadPredictionsWithUsers() {
    try {
      this.loading = true;
      this.error = '';
      
      const { data, error } = await this.supabase.getPredictionsWithUsers();
      
      if (error) {
        this.error = error.message;
        console.error('Error loading predictions:', error);
      } else {
        this.predictions = data || [];
      }
    } catch (err) {
      this.error = 'Грешка при зареждане на прогнозите';
      console.error('Error:', err);
    } finally {
      this.loading = false;
    }
  }

  async loadPredictionsForMatch(matchId: number) {
    try {
      this.loading = true;
      this.error = '';
      
      const { data, error } = await this.supabase.getPredictionsByMatchId(matchId);
      
      if (error) {
        this.error = error.message;
      } else {
        this.predictions = data || [];
      }
    } finally {
      this.loading = false;
    }
  }

  async loadPredictionsForUser(userId: number) {
    try {
      this.loading = true;
      this.error = '';
      
      const { data, error } = await this.supabase.getPredictionsByUserId(userId);
      
      if (error) {
        this.error = error.message;
      } else {
        this.predictions = data || [];
      }
    } finally {
      this.loading = false;
    }
  }
}
