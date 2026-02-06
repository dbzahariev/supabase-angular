# Supabase View - Predictions с потребители

## Какво е View?

View (изглед) в PostgreSQL/Supabase е виртуална таблица, която съдържа резултат от SQL заявка. Той не съхранява данни физически, а динамично генерира данни когато го извикаш.

## Стъпки за създаване и използване на View

### 1. Създаване на View в Supabase

Изпълни SQL заявката от файла `create-predictions-view.sql` в Supabase SQL Editor:

```sql
CREATE OR REPLACE VIEW public.predictions_with_users AS
SELECT 
    p.id,
    p.user_id,
    p.match_id,
    p.utc_date,
    p.match_group,
    p.home_ft,
    p.away_ft,
    p.home_pt,
    p.away_pt,
    p.winner,
    u.name_bg,
    u.name_en,
    ht.name_en AS home_team_en,
    ht.name_bg AS home_team_bg,
    at.name_en AS away_team_en,
    at.name_bg AS away_team_bg
FROM 
    public.predictions p
    INNER JOIN public.users u ON p.user_id = u.id
    INNER JOIN public.matches m ON p.match_id = m.id
    INNER JOIN public.teams ht ON m.home_team_id = ht.id
    INNER JOIN public.teams at ON m.away_team_id = at.id;
```

**Обяснение:**
- `CREATE OR REPLACE VIEW` - създава нов view или заменя съществуващ
- `public.predictions_with_users` - името на view-то
- `SELECT ...` - заявката която дефинира какви данни да се покажат
- `INNER JOIN` - свързва predictions с users таблицата по user_id и с matches по match_id
- `INNER JOIN teams` - два пъти JOIN с teams (за домакин и гост) за да извлече имената на отборите на БГ и EN
- Полетата `home_team_en`, `home_team_bg`, `away_team_en`, `away_team_bg` съдържат имената на отборите на двата езика

### 2. Извикване на View в Angular

#### Вариант 1: Всички прогнози с потребители
```typescript
async loadPredictions() {
  const { data, error } = await this.supabase.getPredictionsWithUsers();
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Predictions with users:', data);
    // data съдържа всички predictions с name_bg и name_en
  }
}
```

#### Вариант 2: Прогнози за конкретен мач
```typescript
async loadPredictionsForMatch(matchId: number) {
  const { data, error } = await this.supabase.getPredictionsByMatchId(matchId);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Predictions for match:', data);
  }
}
```

#### Вариант 3: Прогнози на конкретен потребител
```typescript
async loadUserPredictions(userId: number) {
  const { data, error } = await this.supabase.getPredictionsByUserId(userId);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('User predictions:', data);
  }
}
```

### 3. Използване в компонент

```typescript
export class MyComponent implements OnInit {
  predictions: PredictionWithUser[] = [];

  constructor(private supabase: SupabaseService) {}

  ngOnInit() {
    this.loadPredictions();
  }

  async loadPredictions() {
    const { data, error } = await this.supabase.getPredictionsWithUsers();
    
    if (!error && data) {
      this.predictions = data;
      
      // Вече имаш достъп до name_bg за всяка прогноза
      this.predictions.forEach(pred => {
        console.log(\`Прогноза от \${pred.name_bg} за мач \${pred.match_id}\`);
      });
    }
  }
}
```

### 4. Показване в template

```html
<div *ngFor="let prediction of predictions">
  <p>Потребител: {{ prediction.name_bg }}</p>
  <p>Мач: {{ prediction.home_team_bg }} - {{ prediction.away_team_bg }}</p>
  <p>Прогноза: {{ prediction.home_ft }} - {{ prediction.away_ft }}</p>
</div>
```

## Предимства на View

1. **Опростяване** - не е нужно да правиш JOIN в всяка заявка
2. **Повторна употреба** - веднъж дефиниран, може да се използва многократно
3. **Сигурност** - можеш да ограничиш достъпа до определени колони
4. **Производителност** - PostgreSQL може да оптимизира view заявките

## Разлика между View и обикновена таблица

| Аспект | View | Таблица |
|--------|------|---------|
| Съхранява данни | НЕ | ДА |
| Актуализира се | Автоматично | Ръчно |
| Използва памет | Минимална | Според данните |
| Скорост | По-бавно (изчислява се) | По-бързо |

## TypeScript типове

```typescript
// Основен prediction
interface Prediction {
  id: number;
  user_id: number;
  match_id: number;
  home_ft: number;
  away_ft: number;
  winner: string;
  // ...
}

// Prediction от view-то с потребителски данни и отбори
interface PredictionWithUser extends Prediction {
  name_bg: string;        // От users таблицата
  name_en: string;        // От users таблицата
  home_team_en: string;   // От teams таблицата (име на домакин на EN)
  home_team_bg: string;   // От teams таблицата (име на домакин на BG)
  away_team_en: string;   // От teams таблицата (име на гост на EN)
  away_team_bg: string;   // От teams таблицата (име на гост на BG)
}
```

## Забележки

- View-то се обновява автоматично когато данните в predictions или users се променят
- За добавяне/редактиране продължаваш да използваш `predictions` таблицата, не view-то
- View-то е само за четене (read-only)
