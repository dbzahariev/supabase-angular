import { Component, OnInit, OnDestroy, ElementRef } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { ButtonModule } from 'primeng/button';
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
import { SupabaseService } from '../supabase';
import { SupabaseChatService } from '../supabase-chat.service';
import { BetsToShow } from '../models/match.model';

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

interface User {
  id: number;
  name_bg: string;
  name_en: string;
  total_points: number;
}

@Component({
  selector: 'app-add-prediction',
  standalone: true,
  templateUrl: './add-prediction.html',
  styleUrls: ['./add-prediction.css'],
  imports: [ButtonModule, FormsModule, CommonModule, TranslateModule, TableModule, IconFieldModule, InputTextModule, InputIconModule, TagModule, SelectModule, MultiSelectModule, HttpClientModule]
})
export class AddPrediction implements OnInit, OnDestroy {
  private socket: Socket;
  isLocal = false;
  betsToShow: BetsToShow[] = [];
  loading: boolean = true;
  allUsers: User[] = [];
  allMatches: any[] = [];
  expandedRows: any = JSON.parse(localStorage.getItem('expandedGroups') || '{"ROUND_2":true,"ROUND_3":true,"ROUND_4":true,"ROUND_5":true}');
  selectedUser: User | null = null;
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
    private translate: TranslateService,
    private elRef: ElementRef,
    private supabaseService: SupabaseService,
    private chatService: SupabaseChatService
  ) {
    this.socket = io(this.isLocal ? 'http://localhost:3000' : 'https://simple-node-proxy.onrender.com');


    if (!this.socket.hasListeners('matchesUpdate')) {
      this.socket.on('matchesUpdate', (data) => {
        this.allMatches = data.matches.map((match: any, index: number) => {
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

          const myId = Number("2026" + (index + 1 < 10 ? "0" + (index + 1) : (index + 1).toString()));
          return {
            ...match, myId: myId,
          }
        })

        this.updateBetsDisplay();
      });
    }




    if (!this.socket.hasListeners('connect')) {
      this.socket.on('connect', () => { });
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

  onInput(event: any, product: any, columnIndex: number = -1) {
    let editColumn = columnIndex === 0 ? 'home_ft' : columnIndex === 1 ? 'away_ft' : columnIndex === 2 ? 'winner' : '';
    let newWinner = null;
    if (editColumn === 'winner') {
      newWinner = event.target.value;
      if (newWinner.toLowerCase() === 'h' || newWinner === '1') newWinner = 'HOME_TEAM';
      else if (newWinner.toLowerCase() === 'a' || newWinner === '2') newWinner = 'AWAY_TEAM';
      else if (newWinner.toLowerCase() === 'd' || newWinner === '0') newWinner = 'DRAW';
    }
    if (columnIndex === -1) return;
    let foo = this.testPredictions.find((p: any) => p.user_id === this.selectedUser?.id && p.match_id === product.id)?.id;
    if (foo) {
      this.supabaseService.updatePrediction(foo, { [editColumn]: newWinner || Number(event.target.value) }).then(({ data, error }) => {
        this.loadTestPredictions();
      });
    }
    else {
      let newPrediction: any = {
        user_id: this.selectedUser?.id || 0,
        match_id: product.id,
        home_ft: -1,
        away_ft: -1,
        home_pt: -1,
        away_pt: -1,
        winner: newWinner || '',
        utc_date: new Date().toISOString(),
      }

      newPrediction[editColumn] = event.target.value;
      this.supabaseService.addPrediction(newPrediction).then(({ data, error }) => {
        this.loadTestPredictions();
      });
    };
  }

  toggleGroup() {
    localStorage.setItem('expandedGroups', JSON.stringify(this.expandedRows));
  }

  onUserSelectionChange(user: User | null) {
    this.selectedUser = user;
    this.updateBetsDisplay();
  }

  getUserPredictionValue(user: User | undefined | null, product: any, columnIndex: number) {
    if (!user) return "";
    let selectedUser = this.testPredictions.find((p: any) => p.user_id === user.id && p.match_id === product.id);
    if (!selectedUser) return "";
    if (columnIndex === 0) return selectedUser.home_ft;
    if (columnIndex === 1) return selectedUser.away_ft;
    if (columnIndex === 2) return this.returnTranslatedWinner(selectedUser);
    let points = this.getpoints(selectedUser);
    if (this.selectedUser !== null) {
      if (this.selectedUser.total_points === undefined) {
        this.selectedUser.total_points = 0;
      }
      this.selectedUser.total_points += points;
    }
    if (columnIndex === 3) return points || 0;
    return "";
  }

  returnTranslatedWinner(bet: any): string {
    let result = this.translate.instant("TABLE." + bet.winner).slice(0, 1);
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

  getLng(): "bg-BG" | "en-US" {
    return (localStorage.getItem('lang') ?? 'bg') === 'bg' ? 'bg-BG' : 'en-US';
  }

  getLngMini(): "bg" | "en" {
    return this.getLng().slice(0, 2) as "bg" | "en";
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
    let lng = this.getLng();
    let lngMini = this.getLngMini();

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
      }

      const myId = Number("2026" + (index + 1 < 10 ? "0" + (index + 1) : (index + 1).toString()));

      return {
        id: myId,
        row_index: index + 1,
        match_day: formatDate(new Date(match.utcDate), 'dd.MM.yyyy', lng),
        match_time: formatDate(new Date(match.utcDate), 'HH:mm', lng),
        group: this.translate.instant('TABLE.' + (match.group || match.stage)),
        home_team: homeTeamName,
        away_team: awayTeamName,
        home_team_score: match.score.fullTime.home ?? match.score.halfTime.home ?? -1,
        away_team_score: match.score.fullTime.away ?? match.score.halfTime.away ?? -1,
        winner: match.score.winner,
      };
    });
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

  getpoints(prediction: any): number {
    let kk = this.allMatches.find((m: any) => m.myId === prediction.match_id);
    let result = 0;
    if (kk) {
      result = this.chatService.getPointFromMatch(kk, prediction);
    }
    return result
  }

  getTotalPoints(): number {
    let result = 0;
    if (this.allMatches.length === 0) return result;
    this.testPredictions.filter(p => p.user_id === this.selectedUser?.id).forEach(prediction => {
      let points = this.getpoints(prediction);
      result += points;
    });
    return result;
  }

  subscribeToTestPredictions() {
    console.log('👂 Започвам да слушам за промени в predictions...');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.predictionsChannel = this.supabaseService.subscribeToTable('predictions', (payload: any) => {
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
