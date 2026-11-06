// Read-only audit against the same live sources and methods used by the screen.
// Run: node scripts/verify-backup-2026.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
process.chdir(path.resolve(__dirname, '..'));
const backup = JSON.parse(fs.readFileSync('backup_2026.json', 'utf8'));

function assertFields(actual, expected, location) {
  const differences = [];
  const show = value => value === undefined ? '<липсва>' : JSON.stringify(value);
  function compare(saved, source, field) {
    if (source !== null && typeof source === 'object' && !Array.isArray(source)) {
      for (const key of new Set([...Object.keys(source), ...Object.keys(saved ?? {})])) {
        compare(saved?.[key], source[key], `${field}.${key}`);
      }
    } else if (!Object.is(saved, source)) {
      differences.push(`${field}: в backup = ${show(saved)}; очаквано от източника = ${show(source)}`);
    }
  }
  compare(actual, expected, location);
  assert.equal(differences.length, 0, `Променени данни (${differences.length} полета):\n${differences.join('\n')}`);
}

function loadClass(file, name, members) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name.text === name);
  const body = declaration.members.filter(node => !members || members.includes(node.name?.getText(source))).map(node => node.getText(source)).join('\n');
  const js = ts.transpileModule(`class ${name} { ${body} }; exports.Result = ${name};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = { exports: {}, console };
  vm.runInNewContext(js, context);
  return new context.exports.Result();
}

async function getJson(url, headers) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
  assert.equal(response.status, 200, `Source request failed (${new URL(url).hostname})`);
  return response.json();
}

async function main() {
  const environment = fs.readFileSync('environments/environment.ts', 'utf8');
  const url = environment.match(/SUPABASE_URL\s*:\s*['"]([^'"]+)/)[1];
  const key = environment.match(/SUPABASE_KEY\s*:\s*['"]([^'"]+)/)[1];
  async function rows(table) {
    const result = [];
    for (let offset = 0; ; offset += 1000) {
      const page = await getJson(`${url}/rest/v1/${table}?select=*&order=id&offset=${offset}&limit=1000`, { apikey: key, Authorization: `Bearer ${key}` });
      result.push(...page);
      if (page.length < 1000) return result;
    }
  }
  const [live, fifaResponse, users, predictions] = await Promise.all([
    getJson('https://simple-node-proxy.onrender.com/api/matches/live/full?t=' + Date.now()),
    getJson('https://api.fifa.com/api/v3/calendar/matches?language=en&count=500&idSeason=285023'),
    rows('users'), rows('predictions'),
  ]);
  const fifa = loadClass('src/app/services/fifa-calendar.service.ts', 'FifaCalendarService', ['teamNameReplacements', 'normalizeTeamName', 'findMatchByDate', 'getMatchScore', 'getWinnerSide']);
  const component = loadClass('src/app/all-predictions/all-predictions.component.ts', 'AllPredictionsComponent', ['fixScoreFromFifa', 'fixAllMatches']);
  component.fifaCalendarService = fifa;
  component.fifaMatches = fifaResponse.Results;
  component.mapperService = { getPhase: (stage, group) => `TABLE.${group || stage}` };
  component.fixPredictions = () => {};
  component.insertMissingMatchEntries = () => Promise.resolve(); // Never write to the database.
  live.forEach(match => component.fixScoreFromFifa(match));
  component.fixAllMatches(live);
  const scorer = loadClass('src/app/all-predictions/all-predictions-points.service.ts', 'AllPredictionsPointsService');
  const mapper = loadClass('src/app/all-predictions/all-predictions-mapper.service.ts', 'AllPredictionsMapperService', ['formatTeamFinalScore']);
  const expectedMatches = component.allMatches;
  const matchIds = new Set(expectedMatches.map(match => match.myId));
  const currentPredictions = predictions.filter(prediction => matchIds.has(prediction.match_id));
  const totals = [];

  await test('Complete snapshot: 104 unique matches, every user and every source prediction', () => {
    assert.equal(expectedMatches.length, 104);
    assert.equal(backup.matches.length, expectedMatches.length);
    assert.equal(new Set(backup.matches.map(match => match.id)).size, 104);
    assert.deepEqual(backup.users.map(user => user.id).sort(), users.map(user => user.id).sort());
    assert.equal(backup.users.reduce((count, user) => count + user.bets.length, 0), currentPredictions.length);
    assert.equal(new Set(currentPredictions.map(p => `${p.user_id}/${p.match_id}`)).size, currentPredictions.length);
  });
  for (const match of expectedMatches) {
    await test(`Match ${match.myId} (${match.homeTeam.name} - ${match.awayTeam.name}): teams, date, phase, scores, winner and displayed result`, () => {
      const actual = backup.matches.find(item => item.id === match.myId);
      assert(actual, `Липсва мач id=${match.myId} (${match.homeTeam.name} - ${match.awayTeam.name}) в backup.matches`);
      const score = { winner: match.score.winner };
      for (const side of ['home', 'away']) {
        const display = mapper.formatTeamFinalScore(match.score, side);
        const parts = /^(\d+)(?: \((\d+)\))?$/.exec(display);
        assert(parts, `Неподдържан резултат от източника за мач ${match.myId}, ${side}: ${display}`);
        score[`${side}FT`] = Number(parts[1]);
        score[`${side}PT`] = parts[2] === undefined ? -1 : Number(parts[2]);
      }
      assertFields(actual, {
        id: match.myId, homeTeam: match.homeTeam.name, awayTeam: match.awayTeam.name,
        utcDate: match.utcDate, group: match.group || match.stage, score,
      }, `backup.matches[id=${match.myId}]`);
      for (const side of ['home', 'away']) {
        const ft = actual.score[`${side}FT`];
        const pt = actual.score[`${side}PT`];
        assert(Number.isInteger(ft) && ft >= 0);
        assert(Number.isInteger(pt) && pt >= -1);
        const display = pt === -1 ? String(ft) : `${ft} (${pt})`;
        assert.equal(display, mapper.formatTeamFinalScore(match.score, side));
      }
    });
  }
  for (const user of users) {
    const actualUser = backup.users.find(item => item.id === user.id);
    const expectedBets = currentPredictions.filter(p => p.user_id === user.id);
    await test(`User ${user.id}: name, complete prediction set, unique match references`, () => {
      assert.equal(actualUser.name, user.name_bg);
      assert.deepEqual(actualUser.bets.map(bet => bet.matchId).sort(), expectedBets.map(p => p.match_id).sort());
      assert.equal(new Set(actualUser.bets.map(bet => bet.matchId)).size, actualUser.bets.length);
    });
    let total = 0;
    for (const prediction of expectedBets) {
      const match = expectedMatches.find(item => item.myId === prediction.match_id);
      const points = scorer.calculatePredictionPoints(match, prediction) * scorer.getPhasePointMultiplier(match.myGroup);
      total += Math.max(0, points);
      await test(`Prediction user=${user.id} match=${prediction.match_id}: scores, winner, timestamp, points`, () => {
        const bet = actualUser.bets.find(item => item.matchId === prediction.match_id);
        assertFields(bet, { matchId: prediction.match_id, homeTeamScore: prediction.home_ft, awayTeamScore: prediction.away_ft, winner: prediction.winner, point: points, date: prediction.utc_date }, `backup.users[id=${user.id}, name=${user.name_bg}].bets[matchId=${prediction.match_id}]`);
        // Separate score calculation from the backup alone catches score conversion mistakes.
        const savedMatch = backup.matches.find(item => item.id === prediction.match_id);
        const home = savedMatch.score.homeFT, away = savedMatch.score.awayFT;
        const diff = home - away, predictedDiff = bet.homeTeamScore - bet.awayTeamScore;
        let base = home === bet.homeTeamScore && away === bet.awayTeamScore ? 3
          : diff !== 0 && diff === predictedDiff ? 2 : Math.sign(diff) === Math.sign(predictedDiff) ? 1 : 0;
        if (!savedMatch.group.startsWith('GROUP_')) {
          if (diff === 0 && predictedDiff === 0 && base !== 3) base += 1;
          if (savedMatch.score.winner === bet.winner) base += 1;
        }
        const multipliers = { LAST_32: 1, LAST_16: 1.5, QUARTER_FINALS: 2, SEMI_FINALS: 2.5, THIRD_PLACE: 2.5, FINAL: 3 };
        assert.equal(bet.point, base * (multipliers[savedMatch.group] ?? 1), `Независимо точкуване: играч ${user.id} (${user.name_bg}), мач ${prediction.match_id}; point в backup=${bet.point}, преизчислено=${base * (multipliers[savedMatch.group] ?? 1)}; използван резултат=${home}:${away}, победител=${savedMatch.score.winner}`);
      });
    }
    totals.push({ id: user.id, name: user.name_bg, total });
    await test(`User ${user.id}: total points`, () => {
      assert.equal(actualUser.bets.reduce((sum, bet) => sum + Math.max(0, bet.point), 0), total);
    });
  }
  await test('Ranking agrees with source predictions', () => {
    assert.deepEqual(backup.users.map(user => user.id), totals.sort((a, b) => b.total - a.total).map(user => user.id));
  });
  console.log('Verified ranking:', JSON.stringify(totals));
}
main().catch(error => { console.error('Audit could not complete:', error.message); process.exitCode = 1; });
