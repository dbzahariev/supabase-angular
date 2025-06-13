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
          console.log('Update received!', payload)
        }
      )
      .subscribe()
  }

  async ngOnInit() {

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
}
