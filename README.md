# Supabase Angular - Football Predictions

Уеб приложение за футболни прогнози с класиране на участниците, базирано на Angular + Supabase.

## Какво прави приложението

- Показва всички мачове по фази и групи.
- Позволява добавяне/редакция на прогнози за всеки мач.
- Изчислява точки на база реален резултат и прогноза.
- Показва общо класиране на участниците.
- Поддържа BG/EN език.
- Поддържа realtime обновяване на мачове и прогнози.
- Има отделна страница с официални правила.

Основни страници:

- `/` - всички прогнози
- `/add-prediction` - добавяне/редакция на прогнози
- `/all-matches` - всички мачове и точки
- `/rules` - правила на играта

## Линк към сайта

- Production: [http://dworld.onrender.com/](http://dworld.onrender.com/)
- Local: [http://localhost:4200](http://localhost:4200)

## Правила на играта

Кратко резюме на правилата (според страницата Rules в приложението):

- Прогнозите се подават най-късно 5 минути преди началото на мача.
- При изпуснат срок, за съответния мач не може да се подаде прогноза.
- Прогнозите могат да се подават:
	- директно в таба All Predictions
	- по email: ramsess90@gmail.com
- Промени по прогноза са позволени до 5 минути преди началото на мача.

Точкуване:

- 3 точки за точен резултат
- 1 точка за познат знак (краен изход)

Коефициенти по фази:

- Групова фаза: x1
- Шестнайсетинафинали: x1.5
- Осминафинали: x1.5
- Четвъртфинали: x2
- Полуфинали + мач за 3-то място: x2.5
- Финал: x3

## Локално пускане

### Изисквания

- Node.js: 20.19+ (или 22.12+ / 24+)
- npm

### Инсталация

```bash
npm install
```

### Стартиране (dev)

```bash
npm start
```

След стартиране отвори:

- http://localhost:4200

### Build

```bash
npm run build
```

### Тестове

```bash
npm test
```

## Environment променливи

Проектът използва Angular environment конфигурация в `environments/environment.ts`.

Нужни са минимум следните стойности:

```ts
export const environment = {
	production: false,
	supabaseUrl: 'https://<your-project>.supabase.co',
	supabaseKey: '<your-anon-key>'
};
```

Обяснение:

- `supabaseUrl` - URL на Supabase проекта
- `supabaseKey` - Supabase anon public key

Важно:

- Не комитвай secret ключове в публично repo.
- За production използвай отделен environment файл (напр. `environment.prod.ts`) и различни ключове/проекти при нужда.

## Технологии

- Angular 21
- Supabase (Database + Realtime + Auth)
- PrimeNG
- Tailwind CSS
- ngx-translate
- Socket.IO (за външен realtime feed)

## Данни и SQL

В папка `supabase-migrations/` са SQL скриптовете за таблици/изгледи и помощни миграции.

## Полезни npm скриптове

- `npm start` - стартира dev сървър
- `npm run build` - production build
- `npm test` - unit тестове
- `npm run lint` - lint
