import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef } from '@angular/core';
import { io, Socket } from 'socket.io-client';
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
import { SupabaseService } from '../supabase';
import { SupabaseChatService } from '../supabase-chat.service';
import { MatchDetail, BetsToShow, PredictionWithUser } from '../models/match.model';

registerLocaleData(localeBg, 'bg-BG');
registerLocaleData(localeEn, 'en-US');

// interface PredictionType {
//   away_team_score: number;
//   backup_year: string;
//   date: string;
//   home_team_score: number;
//   id: number;
//   match_id: number;
//   points: number;
//   user_id: number;
//   winner: string;
// }
// interface Product {
//   id: string;
//   code: string;
//   name: string;
//   description: string;
//   price: number;
//   category: string;
//   quantity: number;
//   inventoryStatus: string;
//   rating: number;
// }

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
  betsToShow: BetsToShow[] = [];
  loading: boolean = true;
  allUsers: {
    id: number;
    name_bg: string;
    name_en: string;
  }[] = [];
  allMatches: any[] = [];
  expandedRows: any = JSON.parse(localStorage.getItem('expandedGroups') || '{"ROUND_2":true,"ROUND_3":true,"ROUND_4":true,"ROUND_5":true}');
  rowIndexes: number[] = [];
  selectedUser: typeof this.allUsers[0] | null = null;
  trls: { name: string, translation: string }[] = [];
  private tableRoot: HTMLElement | null = null;
  private scrollHandler: (() => void) | null = null;
  private predictionsChannel: any;
  private pollingInterval: any;
  testPredictions: any[] = [];
  private countryTranslationCache: {
    id: number,
    name_en: string,
    name_bg: string
  }[] = [];
  constructor(
    private countryService: CountryTranslateService,
    private translate: TranslateService,
    private elRef: ElementRef,
    private supabaseService: SupabaseService,
    private chatService: SupabaseChatService
  ) {
    this.socket = io(this.isLocal ? 'http://localhost:3000' : 'https://simple-node-proxy.onrender.com');


    if (!this.socket.hasListeners('matchesUpdate')) {
      this.socket.on('matchesUpdate', (data) => {
        this.allMatches = data.matches;

        this.updateBetsDisplay();
      });
    }


    if (!this.socket.hasListeners('connect')) {
      this.socket.on('connect', () => { });
    }

    // Avoid duplicate event listeners
    if (!this.socket.hasListeners('matchesUpdate')) {
      this.socket.on('matchesUpdate', (data) => {
        console.log('Matches updated', data);
      });
    }
    this.initializeCountryCache();
  }


  ngOnInit() {
    this.tableRoot = this.elRef.nativeElement.querySelector('.prediction-table-root');
    this.scrollHandler = () => this.updateRe_home_teamLeft();
    if (this.tableRoot) {
      this.tableRoot.addEventListener('scroll', this.scrollHandler, true);
    }
    window.addEventListener('resize', this.scrollHandler, true);

    // Зареди predictions
    this.loadTestPredictions();
    this.subscribeToTestPredictions();
    this.fixUsernames();
  }

  fixUsernames() {
    this.supabaseService.getUsers().then(({ data, error }) => {
      //TDDO: Remove that
      this.allUsers = data || [];
      this.selectedUser = this.allUsers[1] || null;
    });
  }

  ngOnDestroy() {
    if (this.scrollHandler) {
      if (this.tableRoot) {
        this.tableRoot.removeEventListener('scroll', this.scrollHandler, true);
      }
      window.removeEventListener('resize', this.scrollHandler, true);
    }

    // Unsubscribe от predictions канала
    if (this.predictionsChannel) {
      this.predictionsChannel.unsubscribe();
    }

    // Спри polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
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

  toggleGroup() {
    localStorage.setItem('expandedGroups', JSON.stringify(this.expandedRows));
  }

  onUserSelectionChange(event: any) {
    this.selectedUser = event.value;
    this.updateBetsDisplay();
  }

  getUserPredictionValue(idx: number, product: any, columnIndex: number) {
    debugger
    let selectedUserName = this.allUsers[idx]?.name_bg;
    let selectedUser = product.all_users.find((user: { name: any; }) => user.name === selectedUserName);

    if (columnIndex === 0) return selectedUser?.home_score;
    if (columnIndex === 1) return selectedUser?.away_score;
    if (columnIndex === 2) return this.returnTranslatedWinner(selectedUser?.winner_predict, 1);
    if (columnIndex === 3) return selectedUser?.points_predict || 0;
    return "";
  }

  returnTranslatedWinner(product: any, foo2?: number): string {
    debugger
    let lng = this.getLng();
    let foo = product.winner.toLowerCase() + '_' + lng;
    let result = product[foo];
    return result;
  }

  getProductResultRow(product: any, columnIndex: number): string {
    if (columnIndex === 0) return product.home_team_score
    if (columnIndex === 1) return product.away_team_score
    if (columnIndex === 2) return this.returnTranslatedWinner(product)
    return "";
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

  getLng(full = false) {
    let lng: "bg-BG" | "en-US" = (localStorage.getItem('lang') ?? 'bg') === 'bg' ? 'bg-BG' : 'en-US';
    if (full === false) return lng.slice(0, 2) as "bg" | "en";
    return lng as "bg-BG" | "en-US";
  }


  private async initializeCountryCache() {
    this.supabaseService.getAllTeams().then(({ data: teams, error }) => {
      this.countryTranslationCache = teams?.map(team => ({
        id: team.id,
        name_en: team.name_en,
        name_bg: team.name_bg
      })) ?? [];
    });
  }


  private findTeamByName(name: string) {
    return this.countryTranslationCache.find(team => team.name_en === name) || { name_en: '', name_bg: '' };
  }

  async updateBetsDisplay() {
    if (this.selectedUser === null || this.allMatches === null) return;
    // let userId = this.selectedUser?.id || 1;
    let lng = this.getLng(true);
    let lngMini = this.getLng(false);

    // const { data, error } = await this.supabaseService.getPredictionsByUserId(userId);
    this.betsToShow = this.allMatches.map((match: any, index: number) => {
      let points: {
        away: number;
        home: number;
      } = { home: match.home_ft || match.home_ht || -1, away: match.away_ft || match.away_ht || -1 };
      let winner = this.chatService.getWinner(points);

      let homeTeamName = (lngMini === 'bg' ? this.findTeamByName(match.homeTeam?.name)?.name_bg : this.findTeamByName(match.homeTeam?.name)?.name_en) || '';
      let awayTeamName = (lngMini === 'bg' ? this.findTeamByName(match.awayTeam?.name)?.name_bg : this.findTeamByName(match.awayTeam?.name)?.name_en) || '';

      if (match.group !== "GROUP_A" && match.group !== "GROUP_B" && match.group !== "GROUP_C" && match.group !== "GROUP_D" && match.group !== "GROUP_E" && match.group !== "GROUP_F" && match.group !== "GROUP_G" && match.group !== "GROUP_H" && match.group !== "GROUP_I" && match.group !== "GROUP_J" && match.group !== "GROUP_K" && match.group !== "GROUP_L" && match.group !== "GROUP_M" && match.group !== "GROUP_N" && match.group !== "GROUP_O" && match.group !== "GROUP_P") {
        // debugger
      }

      if (match.id === 537327) {
        match.score.duration = "FULL_TIME";
        match.score.fullTime = { home: 3, away: 4 };
        match.score.halfTime = { home: 1, away: 2 };
        match.score.winner = "AWAY_TEAM";
      } else if (match.id === 537328) {
        match.score.duration = "FULL_TIME";
        match.score.fullTime = { home: 4, away: 3 };
        match.score.halfTime = { home: 2, away: 1 };
        match.score.winner = "HOME_TEAM";
      } else if (match.id === 537333) {
        match.score.duration = "FULL_TIME";
        match.score.fullTime = { home: 2, away: 2 };
        match.score.halfTime = { home: 1, away: 1 };
        match.score.winner = "DRAW";
      }


      return {
        row_index: index + 1,
        match_day: formatDate(new Date(match.utcDate), 'dd.MM.yyyy', lng),
        match_time: formatDate(new Date(match.utcDate), 'HH:mm', lng),
        group: this.translate.instant('TABLE.' + (match.group || match.stage)),
        home_team: homeTeamName,
        away_team: awayTeamName,
        home_team_score: match.home_ft ?? match.home_ht ?? -1,
        away_team_score: match.away_ft ?? match.away_ht ?? -1,
        winner: winner,
      }
    });
    // this.betsToShow = (data as unknown as MatchDetail[]).map((bet, index) => {
    //   let points: {
    //     away: number;
    //     home: number;
    //   } = { home: bet.home_ft || bet.home_ht || -1, away: bet.away_ft || bet.away_ht || -1 };
    //   let winner = this.chatService.getWinner(points);
    //   return {
    //     row_index: index + 1,
    //     match_day: formatDate(new Date(bet.utc_date), 'dd.MM.yyyy', lng),
    //     match_time: formatDate(new Date(bet.utc_date), 'HH:mm', lng),
    //     group: this.translate.instant('TABLE.' + bet.matches.group_name),
    //     home_team: lngMini === 'bg' ? bet.teams.home_team.name_bg : bet.teams.home_team.name_en,
    //     away_team: lngMini === 'bg' ? bet.teams.away_team.name_bg : bet.teams.away_team.name_en,
    //     home_team_score: bet.home_ft ?? bet.home_ht ?? -1,
    //     away_team_score: bet.away_ft ?? bet.away_ht ?? -1,
    //     winner: winner,
    //   }
    // });
    this.loading = false;
  }

  // ТЕСТ МЕТОДИ за predictions таблицата
  async loadTestPredictions() {
    console.log('🔄 Зареждам predictions...');
    const { data, error } = await this.supabaseService.getPredictions();
    if (error) {
      console.error('❌ Грешка при зареждане:', error);
    } else {
      this.testPredictions = data || [];
      console.log('✅ Заредени predictions:', this.testPredictions);
    }
  }

  subscribeToTestPredictions() {
    console.log('👂 Започвам да слушам за промени в predictions...');
    this.predictionsChannel = this.supabaseService.subscribeToTable('predictions', (payload) => {
      console.log('🔔 REALTIME ПРОМЯНА:', payload.eventType, payload);

      // При всяка промяна, презареди данните и обнови визуализацията
      this.updateBetsDisplay();
    });
  }

  async testAddPrediction() {
    const newPrediction = {
      title: 'Тест ' + new Date().toLocaleTimeString('bg-BG'),
      description: 'Тестова prediction от Angular'
    };

    console.log('➕ Добавям prediction:', newPrediction);
    const { data, error } = await this.supabaseService.addPrediction(newPrediction);

    if (error) {
      console.error('❌ Грешка при добавяне:', error);
    } else {
      console.log('✅ Успешно добавен:', data[0]);
      // Презареди данните след успешно добавяне
      await this.loadTestPredictions();
    }
  }
}
