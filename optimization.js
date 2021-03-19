const R = require('ramda');
const { getBettingAnalysis } = require('./analysis');

const MAX_NUM_CONSECUTIVE_LOSSES = 3;
const MAX_NUM_SAVE_ATTEMPTS = 3;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const byHitRatioDescending = R.descend(
  R.propOr(0, 'hitRatio')
);

const byMoneyMadeRatioDescending = R.descend(
  bet => R.propOr(0, 'totalMoney +/-', bet) / R.propOr(0, 'totalMoneyBet', bet)
);

const byGamesBetOnDescending = R.descend(
  R.propOr(0, 'gamesBetOn')
);

const sortAnalyses = R.sortWith([
  byMoneyMadeRatioDescending,
  byGamesBetOnDescending,
  byHitRatioDescending,
]);

const optimize = async ({
  numTopResults,
  numBetsMinimum,
  minNumTeams,
  maxNumTeams,
  amountPerBet,
  numSeasons
}) => {
  const results = [];
  for (let i = minNumTeams; i <= maxNumTeams; i++) {
    console.log(`getting analyses for ${i} teams...`);
    for (let j = 1; j <= MAX_NUM_CONSECUTIVE_LOSSES; j++) {
      for (let k = 0; k <= MAX_NUM_SAVE_ATTEMPTS; k++) {
        const analysis = await getBettingAnalysis({
          numTopTeams: i,
          numConsecutiveLosses: j,
          numSaveAttempts: k,
          amountPerBet,
          numSeasons,
        });
        results.push({ ...analysis, numTeams: i, numGames: j, numSaveAttempts: k });
        await sleep(500);
      }
    }
  }
  const sortedAnalyses = sortAnalyses(results);
  const relevantAnalyses = numBetsMinimum
    ? R.filter(R.compose(
      x => R.gte(x, numBetsMinimum),
      R.prop('gamesBetOn')
    ), sortedAnalyses)
    : sortedAnalyses;
  return R.slice(0, numTopResults, relevantAnalyses);
};

const NUM_TOP_RESULTS = 7;
const MIN_BETS_PLACED = 25;
const MIN_NUM_TEAMS = 1;
const MAX_NUM_TEAMS = 31;
const AMOUNT_PER_BET = 25;
const NUMBER_OF_SEASONS = 3;
optimize({
  numTopResults: NUM_TOP_RESULTS,
  numBetsMinimum: MIN_BETS_PLACED,
  minNumTeams: MIN_NUM_TEAMS,
  maxNumTeams: MAX_NUM_TEAMS,
  amountPerBet: AMOUNT_PER_BET,
  numSeasons: NUMBER_OF_SEASONS,
}).then(console.log);