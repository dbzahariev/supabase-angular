import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef } from '@angular/core';
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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
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
  betsToShow: any[] = [];
  loading: boolean = true;
  allUsersNames: any[] = [];
  expandedRows: any = JSON.parse(localStorage.getItem('expandedGroups') || '{"ROUND_2":true,"ROUND_3":true,"ROUND_4":true,"ROUND_5":true}');
  rowIndexes: number[] = [];
  trls: { name: string, translation: string }[] = [];

  private tableRoot: HTMLElement | null = null;
  private scrollHandler: (() => void) | null = null;

  constructor(
    private countryService: CountryTranslateService,
    private translate: TranslateService,
    private elRef: ElementRef
  ) {
    this.socket = io(this.isLocal ? 'http://localhost:3000' : 'https://simple-node-proxy.onrender.com');

    this.translate.get(['TABLE.HOME_TEAM', 'TABLE.AWAY_TEAM', 'TABLE.WINNER', 'TABLE.POINTS', 'TABLE.DRAW']).subscribe(translations => {
      Object.entries(translations).forEach((el: [string, any]) => {
        this.trls.push({ name: el[0], translation: el[1] });
      });
    });

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
    supabase
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
      .subscribe((status) => {
        if (status !== 'CHANNEL_ERROR') {
          console.log('Supabase channel status:', status);
        }
      });
  }


  async ngOnInit() {
    await this.getPredictionFromView();

    this.tableRoot = this.elRef.nativeElement.querySelector('.prediction-table-root');
    this.scrollHandler = () => this.updateRe_home_teamLeft();
    if (this.tableRoot) {
      this.tableRoot.addEventListener('scroll', this.scrollHandler, true);
    }
    window.addEventListener('resize', this.scrollHandler, true);
  }

  ngOnDestroy() {
    if (this.scrollHandler) {
      if (this.tableRoot) {
        this.tableRoot.removeEventListener('scroll', this.scrollHandler, true);
      }
      window.removeEventListener('resize', this.scrollHandler, true);
    }
  }

  private updateRe_home_teamLeft() {
    let numberColumnWidth = this.elRef.nativeElement.querySelector('.col_row_number').offsetWidth;
    let homeTeamOffsetWidth = this.elRef.nativeElement.querySelector('.re_home_team').offsetWidth;
    this.elRef.nativeElement.querySelectorAll('.re_home_team').forEach((el: any) => {
      el.style.left = `${numberColumnWidth - 2}px`;
    });
    this.elRef.nativeElement.querySelectorAll('.re_away_team').forEach((el: any) => {
      el.style.left = `${homeTeamOffsetWidth + 5}px`;
    });
  }

  async getPredictionFromView() {
    this.loading = true;
    try {
      const { data = [] } = await supabase
        .from('predictions_view')
        .select('*');

      this.updateBetsDisplay(data ?? []);
    } catch (error) {
      console.error('Error fetching predictions:', error);
      this.betsToShow = [];
    } finally {
      this.loading = false;
    }
  }

  toggleGroup() {
    localStorage.setItem('expandedGroups', JSON.stringify(this.expandedRows));
  }

  getUserPredictionValue(idx: number, product: any, columnIndex: number) {
    let selectedUserName = this.allUsersNames[idx]?.name;
    let selectedUser = product.all_users.find((user: { name: any; }) => user.name === selectedUserName);

    if (columnIndex === 0) return selectedUser?.home_score;
    if (columnIndex === 1) return selectedUser?.away_score;
    if (columnIndex === 2) return this.returnTranslatedWinner(selectedUser?.winner_predict, 1);
    if (columnIndex === 3) return selectedUser?.points_predict || 0;
    return "";
  }

  returnTranslatedWinner(winner: string, sliceLength?: number): string {
    if (this.trls.length === 0) return ""
    let str = this.trls.find(trl => trl.name === 'TABLE.' + winner)?.translation ?? ""
    if (sliceLength) return str.slice(0, sliceLength)
    return str;
  }

  getProductResultRow(product: any, columnIndex: number): string {
    if (columnIndex === 0) return product.home_team_score
    if (columnIndex === 1) return product.away_team_score
    if (columnIndex === 2) return this.returnTranslatedWinner(product.winner, 1)
    return "";
  }

  getUserTotalPoints(user: string): number {
    return this.betsToShow.reduce((total, match) => {
      const foundUser = match.all_users.find((u: { name: string }) => u.name === user);
      return total + (foundUser?.points_predict || 0);
    }, 0);
  }

  getColName(index: number) {
    return this.trls[index % 3]?.translation.slice(0, 1) || "";
  }

  getRoundByGroup(group: string): string {
    if (group.startsWith('GROUP')) return 'ROUND_1';
    else if (group === 'LAST_16') return 'ROUND_2';
    else if (group === 'QUARTER_FINALS') return 'ROUND_3';
    else if (group === 'SEMI_FINALS') return 'ROUND_4';
    else if (group === 'FINAL') return 'ROUND_5';
    return "";
  }

  updateBetsDisplay(data: any[]): void {
    let lng: "bg" | "en" = localStorage.getItem('lang') === 'bg' ? 'bg' : 'en';

    const grouped = data.reduce<Record<number, any[]>>((acc, item) => {
      const id = +item.match_id;
      (acc[id] ||= []).push(item);
      return acc;
    }, {});

    this.betsToShow = Object.values(grouped).map((group) => {
      const bet = group[0];
      const date = new Date(bet.match_date_utc);
      return {
        winner: bet.winner,
        row_index: +bet.match_id.toString().slice(-2),
        match_day: formatDate(date, 'dd.MM.yyyy', navigator.language),
        match_time: formatDate(date, 'HH:mm', navigator.language),
        group: this.translate.instant('TABLE.' + bet.group),
        home_team: this.countryService.translateCountryNameFromEnToLng(bet.home_team_name, lng),
        home_team_score: bet.home_team_score,
        away_team: this.countryService.translateCountryNameFromEnToLng(bet.away_team_name, lng),
        away_team_score: bet.away_team_score,
        group_row: this.getRoundByGroup(bet.group.toUpperCase()),
        all_users: group.map(b => {
          if (this.allUsersNames.find(u => u.name === b.user_name)) {
            this.allUsersNames.find(u => u.name === b.user_name)!.total_points += b.points_predict;
          } else {
            this.allUsersNames.push({ name: b.user_name, total_points: b.points_predict });
          }

          this.rowIndexes = this.allUsersNames.map((_, i) => i);
          return {
            name: b.user_name,
            home_score: b.home_team_predict_score,
            away_score: b.away_team_predict_score,
            winner_predict: b.winner_predict,
            points_predict: b.points_predict,
          }
        })
      };
    });
  }
}
