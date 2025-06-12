import { Component, OnInit } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import backup2016 from '../../../backup_2016.json'
import backup2018 from '../../../backup_2018.json'
import backup2020 from '../../../backup_2020.json'
import backup2022 from '../../../backup_2022.json'
import backup2024 from '../../../backup_2024.json'


const supabaseUrl = environment.supabaseUrl;
const supabaseKey = environment.supabaseKey;
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true } });

@Component({
  selector: 'app-add-prediction',
  standalone: false,
  templateUrl: './add-prediction.html',
  styleUrl: './add-prediction.css'
})
export class AddPrediction implements OnInit {
  private socket: Socket;
  isLocal = false;
  url = this.isLocal ? 'http://localhost:3000' : 'https://simple-node-proxy.onrender.com';
  constructor() {
    this.socket = io(this.url);

    this.socket.on('connect', () => { });

    this.socket.on('matchesUpdate', (data) => {
      console.log('Matches updated', data);
    });
  }

  async ngOnInit() {
    // await this.changeJson()
  }

  checkTeamName(teamName: string) {
    let newName = teamName;
    newName = newName.replace('Швеция', 'Sweden');
    newName = newName.replace('Чехия', 'Czechia');
    newName = newName.replace('Белгия', 'Belgium');
    newName = newName.replace('Еире', 'Ireland');
    newName = newName.replace('Австрия', 'Austria');
    newName = newName.replace('Египет', 'Egypt');
    newName = newName.replace('Колумбия', 'Colombia');
    newName = newName.replace('Перу', 'Peru');
    newName = newName.replace('Сърбия', 'Serbia');
    newName = newName.replace('Мексико', 'Mexico');
    newName = newName.replace('Нигерия', 'Nigeria');
    newName = newName.replace('Япония', 'Japan');
    newName = newName.replace('Тунис', 'Tunisia');

    return newName;
  }

  // private async foo(users: { name: string; bets: { matchId: number; homeTeamScore: number; awayTeamScore: number; winner: string; point: number; date: string; }[]; index: number; finalWinner: string; colorTable: string; totalPoints: number; id: string; }[],
  //   backupYear: string) {

  //   users = users.map((user: any) => {
  //     let newUser = { ...user };
  //     newUser.bets = newUser.bets.map((bet: any, index: number) => {
  //       let newId = Number(`${backupYear}${index < 9 ? `0${index + 1}` : `${index + 1}`}`);
  //       return {
  //         ...bet,
  //         matchId: newId,
  //       };
  //     });
  //     return newUser;
  //   });

  //   let allPredictsBeforeSave: any[] = [];
  //   await Promise.all(users.map(async (user) => {
  //     let savedUser = (((await supabase.from("users").select("*").eq("name", user.name)).data) || [])[0];

  //     let allPredicts: any[] = [];
  //     await user.bets.map(async (bet, index) => {
  //       let newIndex = `${index < 9 ? `0${index + 1}` : `${index + 1}`}`;
  //       let newId = Number(`${backupYear}${newIndex}`);
  //       let user_id = savedUser.id;
  //       let newPredict = {
  //         match_id: newId,
  //         date: bet.date,
  //         user_id: user_id,
  //         point: bet.point || 0,
  //         winner: bet.winner,
  //         home_team_score: bet.homeTeamScore || 0,
  //         away_team_score: bet.awayTeamScore || 0,
  //         backup_year: backupYear,
  //       };
  //       allPredicts.push(newPredict);
  //     });
  //     allPredictsBeforeSave.push(...allPredicts);
  //   }));
  //   return { __return: allPredictsBeforeSave, users };
  // }

  // private async convertBackupForBets() {
  //   let backupYear = "2016";
  //   let users = backup2016.users
  //   users = users.map((user: any) => {
  //     let newUser = { ...user }
  //     newUser.bets = newUser.bets.map((bet: any, index: number) => {
  //       let newId = Number(`${backupYear}${index < 9 ? `0${index + 1}` : `${index + 1}`}`);
  //       return {
  //         ...bet,
  //         matchId: newId,
  //       }
  //     });
  //     return newUser;
  //   });

  //   let allPredictsBeforeSave: any[] = []
  //   let newIndexinRow = 1;
  //   await Promise.all(users.map(async user => {
  //     let savedUser = (((await supabase.from("users").select("*").eq("name", user.name)).data) || [])[0]

  //     let allPredicts: any[] = []
  //     await user.bets.map(async (bet, index) => {
  //       let newIndex = `${index < 9 ? `0${index + 1}` : `${index + 1}`}`;
  //       let newId = Number(`${backupYear}${newIndex}`);
  //       let user_id = savedUser.id
  //       let newPredict = {
  //         id: newIndexinRow++,
  //         match_id: newId,
  //         date: bet.date,
  //         user_id: user_id,
  //         point: bet.point || 0,
  //         winner: bet.winner,
  //         home_team_score: bet.homeTeamScore || 0,
  //         away_team_score: bet.awayTeamScore || 0,
  //         backup_year: backupYear,
  //       };
  //       allPredicts.push(newPredict)
  //     })
  //     allPredictsBeforeSave.push(...allPredicts)
  //   }))
  // }

  private async changeJson() {
    let backupYear = "2024";
    let allSavedTeams = (await supabase.from("teams").select("*")).data || [];
    let allSavedUsers = (await supabase.from("users").select("*")).data || [];
    let matches = backup2024.matches.map((match, index) => {
      let newMatch: any = { ...match, };
      delete (newMatch as any).key;
      delete (newMatch as any).number;
      delete (newMatch as any).status;
      delete (newMatch as any).round;
      delete (newMatch as any).lastUpdated;
      delete (newMatch as any).matchday;

      if (newMatch.group === undefined || newMatch.group === null) {
        newMatch.group = newMatch.stage;
      }
      delete (newMatch as any).stage;

      newMatch.group = newMatch.group.toUpperCase().replace(' ', '_');
      newMatch.winner = newMatch.score.winner

      if (newMatch.score.duration !== undefined) {
        if (newMatch.score.duration === "REGULAR") {
          newMatch.homeTeamScore = newMatch.score.fullTime.home ?? newMatch.score.fullTime.homeTeam ?? 0
          newMatch.awayTeamScore = newMatch.score.fullTime.away ?? newMatch.score.fullTime.awayTeam ?? 0
        } else if (newMatch.score.duration === "EXTRA_TIME") {
          newMatch.homeTeamScore = newMatch.score.extraTime.home ?? newMatch.score.extraTime.homeTeam ?? 0
          newMatch.awayTeamScore = newMatch.score.extraTime.away ?? newMatch.score.extraTime.awayTeam ?? 0
        } else if (newMatch.score.duration === "PENALTY_SHOOTOUT") {
          newMatch.homeTeamPenaltyScore = newMatch.score.penalties.home ?? newMatch.score.penalties.homeTeam ?? 0
          newMatch.awayTeamPenaltyScore = newMatch.score.penalties.away ?? newMatch.score.penalties.awayTeam ?? 0
        } else {
          debugger
        }
      }
      delete (newMatch as any).score

      newMatch.score = {
        homeFT: newMatch.homeTeamScore,
        awayFT: newMatch.awayTeamScore,
        homePT: newMatch.homeTeamPenaltyScore ?? -1,
        awayPT: newMatch.awayTeamPenaltyScore ?? -1,
        winner: newMatch.winner,
      }
      delete (newMatch as any).homeTeamScore;
      delete (newMatch as any).homeTeamPenaltyScore;
      delete (newMatch as any).awayTeamScore;
      delete (newMatch as any).awayTeamPenaltyScore;
      delete (newMatch as any).winner;

      if ((newMatch as any).status && (newMatch as any).status !== 'FINISHED') {
        debugger
      } else {
        delete (newMatch as any).status;
      }

      let findTeamHome = allSavedTeams.find((team) => team.name === this.checkTeamName((newMatch.homeTeam as any).name ?? newMatch.homeTeam));
      if (findTeamHome === undefined) {
        debugger
      }
      if (this.checkTeamName(newMatch.homeTeam.name ?? newMatch.homeTeam) !== findTeamHome.name) {
        debugger
      }
      newMatch.homeTeam = findTeamHome.name

      let findTeamAway = allSavedTeams.find((team) => team.name === this.checkTeamName((newMatch.awayTeam as any).name ?? newMatch.awayTeam));
      if (findTeamAway === undefined) {
        debugger
      }
      if (this.checkTeamName(newMatch.awayTeam.name ?? newMatch.awayTeam) !== findTeamAway.name) {
        debugger
      }
      newMatch.awayTeam = findTeamAway.name;

      let newId = Number(`${backupYear}${index < 9 ? `0${index + 1}` : `${index + 1}`}`);
      newMatch.id = newId;
      if (newMatch.score.homePT !== undefined && newMatch.score.homePT != -1) {
      }
      return newMatch;
    });
    let users = backup2024.users.map((user) => {
      let savedUser = allSavedUsers.find((el) => el.name === user.name);
      let newUser = { ...user, id: 0 };
      delete (newUser as any).totalPoints;
      delete (newUser as any).finalWinner;
      delete (newUser as any).index;
      delete (newUser as any)._id;
      delete (newUser as any).__v;

      newUser.bets = newUser.bets.map((bet, index) => {
        let newId = Number(`${backupYear}${index < 9 ? `0${index + 1}` : `${index + 1}`}`);
        return {
          ...bet,
          matchId: newId,
        }
      });

      newUser.id = savedUser.id || 0;
      newUser.colorTable = savedUser?.color_table || "";

      return newUser;
    })
    let newBackup = {
      matches: matches,
      users: users
    };

    console.log('New backup:', JSON.stringify(newBackup));
  }
}
