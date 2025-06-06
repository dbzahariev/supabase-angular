import { Component } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

const supabaseUrl = environment.supabaseUrl;
const supabaseKey = environment.supabaseKey;
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

@Component({
  selector: 'app-add-prediction',
  standalone: false,
  templateUrl: './add-prediction.html',
  styleUrl: './add-prediction.css'
})
export class AddPrediction {
  constructor() { }
  async ngOnInit() {
    this.fetchMatches();
    // let data = await fetch('/api/v4/matches', {
    //   method: 'GET',
    //   headers: {
    //     'X-Auth-Token': 'c8d23279fec54671a43fcd93068762d1'
    //   }
    // });
    // debugger

    // supabase.from('matches').select().eq('id', 1).then((response) => {
    //   if (response.data?.length === 0) {
    //     supabase.from('matches').insert({ id: 1, home_team: 'Team A', away_team: 'Team B', match_date: '2023-10-01' });
    //   }
    //   debugger
    //   console.log('Match data:', response.data);
    // });


    // const { data, error } = await supabase
    //   .from('predictions')
    //   .insert([
    //     { match_id: 1, user_id: 123, predicted_score_home: 2, predicted_score_away: 1 },
    //   ]);

    // // let foo = await supabase.from('matches').insert({});
    // let foo = await supabase.from('matches').delete({ count: 'exact' }).eq('id', 1);
    // debugger;
  }

  getUsersWithPredictions(matchId: number) {
    return supabase
      .from('predictions')
      .select('user_id, predicted_score_home, predicted_score_away')
      .eq('match_id', matchId)
      .then(response => {
        debugger
        if (response.error) {
          console.error('Error fetching predictions:', response.error);
          return [];
        }
        return response.data;
      });

  }

  fetchMatches() {
    let localMatches = localStorage.getItem('matches');
    let objMatches = localMatches ? JSON.parse(localMatches) : null;
    if (localMatches) {
      objMatches.forEach((match: any) => {
        let foo = this.getUsersWithPredictions(match.id);
      });
      console.log('Matches already fetched and stored in localStorage.');
    }
    else {
      fetch('https://simple-node-proxy.onrender.com/api/matches')
        .then(response => response.json())
        .then(response => response.matches)
        .then(data => {
          localStorage.setItem('matches', JSON.stringify(data));
        })
        .catch(error => {
          console.error('Fetch error:', error);
        });
    }
  }
}
