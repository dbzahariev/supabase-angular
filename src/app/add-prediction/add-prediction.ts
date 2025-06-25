import { Component, OnInit, OnDestroy } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import backup2016 from '../../../backup_2016.json'
import backup2018 from '../../../backup_2018.json'
import backup2020 from '../../../backup_2020.json'
import backup2022 from '../../../backup_2022.json'
import backup2024 from '../../../backup_2024.json'
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { TableModule } from 'primeng/table';
import { FormsModule } from '@angular/forms';
import { CommonModule, formatDate } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { IconFieldModule } from 'primeng/iconfield';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { HttpClientModule } from '@angular/common/http';
import localeBg from '@angular/common/locales/bg';
import localeEn from '@angular/common/locales/en';
import { registerLocaleData } from '@angular/common';
import { CountryTranslateService } from '../services/country-translate.service';

registerLocaleData(localeBg, 'bg-BG');
registerLocaleData(localeEn, 'en-US');

const supabaseUrl = environment.supabaseUrl;
const supabaseKey = environment.supabaseKey;
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true } });

interface PredictionType {
  away_team_score: number;
  backup_year: string;
  date: string;
  home_team_score: number;
  id: number;
  match_id: number;
  points: number;
  user_id: number;
  winner: string;
}

interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  category: string;
  quantity: number;
  inventoryStatus: string;
  rating: number;
}

@Component({
  selector: 'app-add-prediction',
  standalone: true,
  templateUrl: './add-prediction.html',
  styleUrls: ['./add-prediction.css'],
  imports: [ButtonModule, DropdownModule, FormsModule, CommonModule, TranslateModule, TableModule, IconFieldModule, InputTextModule, InputIconModule, TagModule, SelectModule, MultiSelectModule, TableModule, TagModule, IconFieldModule, InputTextModule, InputIconModule, MultiSelectModule, SelectModule, HttpClientModule, CommonModule]
})
export class AddPrediction implements OnInit, OnDestroy {
  private socket: Socket;
  isLocal = false;
  predictionChannel: any;
  bets: any[] = [];
  betsToShow: any[] = [];
  onlyMatches: any[] = [];
  oldBets: string = "";
  loading: boolean = true;
  allUsersNames: any[] = [];
  expandedRows: any = JSON.parse(localStorage.getItem('expandedGroups') || '{"ROUND_2":true,"ROUND_3":true,"ROUND_4":true,"ROUND_5":true}');
  rowIndexes: number[] = [];

  constructor(private countryService: CountryTranslateService) {
    this.socket = io(this.isLocal ? 'http://localhost:3000' : 'https://simple-node-proxy.onrender.com');

    if (!this.socket.hasListeners('connect')) {
      this.socket.on('connect', () => { });
    }

    // Avoid duplicate event listeners
    if (!this.socket.hasListeners('matchesUpdate')) {
      this.socket.on('matchesUpdate', (data) => {
        console.log('Matches updated', data);
      });
    }

    // Съхраняваме канала като член-променлива
    this.predictionChannel = supabase
      .channel('custom-update-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: '*',
        },
        (payload) => {
          this.getPredictionFromView();
          console.log('Update received!', payload)
        }
      )
      .subscribe()
  }

  async ngOnInit() {
    await this.getPredictionFromView();
  }

  async getPredictionFromView() {
    this.loading = true;
    try {
      const { data = [] } = await supabase
        .from('predictions_view')
        .select('*');

      this.bets = (data ?? []).map(item => {
        let newItem = { ...item, row_index: Number(item.match_id.toString().slice(-2)), group_row: "" };
        let groupStringUppercase = item.group.toString().toUpperCase();
        if (groupStringUppercase.startsWith('GROUP')) {
          newItem.group_row = "ROUND_1";
        } else if (groupStringUppercase === 'LAST_16') {
          newItem.group_row = 'ROUND_2';
        } else if (groupStringUppercase === 'QUARTER_FINALS') {
          newItem.group_row = 'ROUND_3';
        } else if (groupStringUppercase === 'SEMI_FINALS') {
          newItem.group_row = 'ROUND_4';
        } else if (groupStringUppercase === 'FINAL') {
          newItem.group_row = 'ROUND_5';
        }
        return newItem;
      });

      this.oldBets = JSON.stringify(this.bets);

      this.bets.forEach(bet => {
        if (!this.onlyMatches.some(match => match.row_index === bet.row_index)) {
          this.getRowFromDbByMatchNumber(bet.match_id);
        }
      });

      this.betsToShow = this.onlyMatches.map(match => {
        const filteredBets = this.bets.filter(bet => bet.row_index === match.row_index);

        const allUsers = filteredBets.map(bet => ({
          name: bet.user_name,
          home_score: bet.home_team_predict_score,
          away_score: bet.away_team_predict_score,
          winner_predict: bet.winner_predict,
          points_predict: bet.points_predict
        }));

        return { ...match, all_users: allUsers };
      });
      this.allUsersNames = this.betsToShow.flatMap(match => match.all_users.map((user: { name: any; }) => { return { name: user.name, total_points: this.getUserTotalPoints(user.name) } }))
        .filter((val, i, self) => self.findIndex(v => v.name === val.name) === i);

      this.rowIndexes = new Array(this.allUsersNames.length).fill(0).map((_, i) => i);
    } catch (error) {
      console.error('Error fetching predictions:', error);
      this.bets = [];
      this.betsToShow = [];
    } finally {
      this.loading = false;
    };
  }

  toggleGroup() {
    localStorage.setItem('expandedGroups', JSON.stringify(this.expandedRows));
  }

  getUserPredictionValue(idx: number, product: any, columnIndex: number) {
    let selectedUserName = this.allUsersNames[idx]?.name;
    let selectedUser = product.all_users.find((user: { name: any; }) => user.name === selectedUserName);

    if (columnIndex === 0) return selectedUser?.home_score;
    if (columnIndex === 1) return selectedUser?.away_score;
    if (columnIndex === 2) return selectedUser?.winner_predict.slice(0, 1);
    if (columnIndex === 3) return selectedUser?.points_predict || 0;
    return "";
  }

  getUserTotalPoints(user: string): number {
    return this.betsToShow.reduce((total, match) => {
      const foundUser = match.all_users.find((u: { name: string }) => u.name === user);
      return total + (foundUser?.points_predict || 0);
    }, 0);
  }

  getColName(index: number) {
    const colNames = ['H', 'A', 'W', 'P'];
    return colNames[index % colNames.length];
  }

  getRowFromDbByMatchNumber(matchId: number) {
    let lng: "en" | "bg" = navigator.language === 'bg-BG' ? 'bg' : 'en';
    let row = this.bets.filter(bet => bet.match_id === matchId)[0];
    let dateTime = new Date(row.match_date_utc);
    let formattedDate = formatDate(dateTime, 'dd.MM.yyyy', navigator.language);
    let formattedTime = formatDate(dateTime, 'HH:mm', navigator.language);
    let oneMatch = {
      row_index: row.row_index, match_day: formattedDate, match_time: formattedTime, group: row.group,
      home_team: this.countryService.translateCountryNameFromEnToBg(row.home_team_name, lng),
      home_team_score: row.home_team_score,
      away_team: this.countryService.translateCountryNameFromEnToBg(row.away_team_name, lng),
      away_team_score: row.away_team_score,
      group_row: row.group_row
    };

    this.onlyMatches.push(oneMatch);
    return row;
  }

  ngOnDestroy() {
    if (this.predictionChannel) {
      this.predictionChannel.unsubscribe();
    }
  }
}
