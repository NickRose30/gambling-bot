const axios = require('axios');
const R = require('ramda');
const fs = require('fs');
const dateFns = require('date-fns');

/**
 * ---------------------------------------
 * CONSTANTS
 * ---------------------------------------
 */
const DATE_FORMAT = 'MMM d, yyyy';
const SEASONS = [
  '20202021',
  '20192020',
  '20182019',
  '20172018',
  '20162017',
  '20152016',
  '20142015',
  '20132014',
];
// estimated average spreads for teams based on ranking
const SPREADS = [
  -200,
  -200,
  -180,
  -180,
  -165,
  -165,
  -135,
  -135,
  -135,
  -135,
  -125,
  -125,
  -115,
  -105,
  -105,
  'even',
  +105,
  +105,
  +115,
  +125,
  +125,
  +135,
  +135,
  +135,
  +135,
  +165,
  +165,
  +180,
  +180,
  +200,
  +200
];

/**
 * ---------------------------------------
 * FETCH HELPERS
 * ---------------------------------------
 */
const fetchTeamSchedule = async (teamId, season) => {
  try {
    const { data } = await axios.get(`https://statsapi.web.nhl.com/api/v1/schedule?teamId=${teamId}&season=${season}`);
    return data;
  } catch (e) {
    console.log(e);
  }
};

const fetchLeagueStandings = async _ => {
  try {
    const { data } = await axios.get('https://statsapi.web.nhl.com/api/v1/standings/byLeague');
    return data;
  } catch (e) {
    console.log(e);
  }
};

/**
 * ---------------------------------------
 * FUNCTIONS
 * ---------------------------------------
 */
const outputToFile = jsObject =>
  fs.writeFile('output.json', JSON.stringify(jsObject), err => {
    if (err) return console.error(err);
  });

const isCompleted = R.pathEq(['status', 'detailedState'], 'Final');

const getWinningBetRatio = ranking => {
  const spread = SPREADS[ranking - 1];
  if (spread === 'even') return 1;
  if (spread < 0) return -100 / spread;
  return spread / 100;
};

const findBets = ({ numConsecutiveLosses, gameResults, amountPerBet, numSaveAttempts = 0 }) => {
  const games = [];
  let lossCount = 0;
  gameResults.forEach(gameResult => {
    const meetsLossRequirement = lossCount === numConsecutiveLosses;
    const firstSaveAttempt = lossCount === numConsecutiveLosses + 1;
    const secondSaveAttempt = lossCount === numConsecutiveLosses + 2;
    const thirdSaveAttempt = lossCount === numConsecutiveLosses + 3;
    if (meetsLossRequirement) games.push({ ...gameResult, moneyBet: amountPerBet });
    if (numSaveAttempts > 0 && firstSaveAttempt) {
      games.push({ ...gameResult, moneyBet: amountPerBet * 2 });
      // only reset count if this is your last save attempt, otherwise keep it going
      if (numSaveAttempts === 1) lossCount = 0;
    }
    if (numSaveAttempts > 1 && secondSaveAttempt) {
      games.push({ ...gameResult, moneyBet: amountPerBet * 4 });
      // only reset count if this is your last save attempt, otherwise keep it going
      if (numSaveAttempts === 2) lossCount = 0;
    }
    if (numSaveAttempts > 2 && thirdSaveAttempt) {
      games.push({ ...gameResult, moneyBet: amountPerBet * 8 });
      // reset no matter what, we don't support higher numbers of save attempts
      lossCount = 0;
    }
    if (!gameResult.isWin) {
      lossCount++;
    } else {
      lossCount = 0;
    }
  });
  return games;
};

const getGameResults = ({ teamId, game }) => {
  const { teams, gameDate } = game;
  const { home, away } = teams;
  const homeTeamId = R.path(['team', 'id'], home);
  const homeTeamScore = R.prop('score', home);
  const awayTeamScore = R.prop('score', away);
  const isHomeTeam = homeTeamId === teamId;
  const homeTeamWon = homeTeamScore > awayTeamScore;
  const isWin = isHomeTeam ? homeTeamWon : !homeTeamWon;
  const date = dateFns.format(new Date(gameDate), DATE_FORMAT);
  return { date, isWin };
};

const getTeamGameResults = async (teamId, season) => {
  try {
    const { dates } = await fetchTeamSchedule(teamId, season);
    const gamesByDate = R.map(R.prop('games'), dates);
    const allGames = R.flatten(gamesByDate);
    const completedGames = R.filter(isCompleted, allGames);
    return R.map(game => getGameResults({ teamId, game }), completedGames);
  } catch (e) {
    console.log('error fetching team schedule');
    return [];
  }
};

const getBetResults = ({ betsPlaced, ranking }) =>
  betsPlaced.map(bet => ({
    ...bet,
    moneyWon: bet.isWin ? bet.moneyBet * getWinningBetRatio(ranking) : 0,
  }));

const findTeamGamesToBetOn = async ({
  teamId,
  numConsecutiveLosses,
  amountPerBet,
  season,
  ranking,
  numSaveAttempts
}) => {
  const gameResults = await getTeamGameResults(teamId, season);
  const betsPlaced = findBets({ numConsecutiveLosses, gameResults, amountPerBet, numSaveAttempts });
  return getBetResults({ betsPlaced, ranking });
};

const findSeasonGamesToBetOn = async ({
  numTopTeams,
  numConsecutiveLosses,
  amountPerBet,
  season,
  numSaveAttempts
}) => {
  try {
    const standings = await fetchLeagueStandings();
    const teams = R.path(['records', 0, 'teamRecords'], standings);
    const topTeams = R.slice(0, numTopTeams, teams);
    const prunedTeams = R.map(({ team: { id, name }, leagueRank }) => ({ id, name, ranking: +leagueRank }), topTeams);
    const findGamesToBetPromises = R.map(async ({ id, name, ranking }) => {
      const results = await findTeamGamesToBetOn({
        teamId: id,
        numConsecutiveLosses,
        amountPerBet,
        season,
        ranking,
        numSaveAttempts
      });
      return { name, ranking, results };
    }, prunedTeams);
    return await Promise.all(findGamesToBetPromises);
  } catch (e) {
    console.log('error fetching league standings');
    return [];
  }
};

const getAllWinnings = R.reduce((accum, { moneyWon }) => accum + moneyWon, 0);
const getTotalBet = R.reduce((accum, { moneyBet }) => accum + moneyBet, 0);
const getInitialMoneyRecievedBack = R.reduce((accum, { win, moneyBet }) => win ? accum + moneyBet : accum, 0);

const getAllGamesToBetOn = async ({
  numTopTeams,
  numConsecutiveLosses,
  amountPerBet,
  numSeasons,
  numSaveAttempts
}) => {
  const seasons = R.slice(0, numSeasons, SEASONS);
  const gamesToBetOn = [];
  for (let i = 0; i < seasons.length; i++) {
    const season = SEASONS[i];
    const games = await findSeasonGamesToBetOn({
      numTopTeams,
      numConsecutiveLosses,
      amountPerBet,
      season,
      numSaveAttempts
    });
    gamesToBetOn.push(...games);
  }
  return gamesToBetOn;
};

const getBettingAnalysis = async ({
  numTopTeams,
  numConsecutiveLosses,
  amountPerBet,
  numSeasons,
  numSaveAttempts
}) => {
  if (numSaveAttempts && (numSaveAttempts > 3 || numSaveAttempts < 0)) {
    return console.log('save attempts must be between 0 and 3');
  }
  const gamesToBetOn = await getAllGamesToBetOn({
    numTopTeams,
    numConsecutiveLosses,
    amountPerBet,
    numSeasons,
    numSaveAttempts
  });
  const gamesDetailed = gamesToBetOn.map(({ name, results, ranking }) => {
    return results.map(result => ({
      team: name,
      ranking,
      gameDate: result.date,
      win: result.isWin,
      moneyBet: result.moneyBet,
      moneyWon: result.moneyWon,
    }));
  });
  const bettingList = R.flatten(gamesDetailed);
  const gamesBetOn = R.length(bettingList);
  const betsWon = R.filter(R.propEq('win', true), bettingList).length;
  const betsLost = R.filter(R.propEq('win', false), bettingList).length;
  const hitRatio = betsWon / gamesBetOn;
  const totalMoneyBet = getTotalBet(bettingList);
  const moneyFromWinnings = getAllWinnings(bettingList);
  const initialMoneyRecievedBack = getInitialMoneyRecievedBack(bettingList);
  const totalMoneyDifference = moneyFromWinnings + initialMoneyRecievedBack - totalMoneyBet;
  const bettingResults = {
    gamesBetOn,
    betsWon,
    betsLost,
    hitRatio: +hitRatio.toFixed(2),
    totalMoneyBet,
    'totalMoney +/-': +totalMoneyDifference.toFixed(2),
  };
  return bettingResults;
};

// getBettingAnalysis({
//   numTopTeams: 14,
//   numConsecutiveLosses: 2,
//   amountPerBet: 25,
//   numSeasons: 3,
//   numSaveAttempts: 0,
// }).then(console.log);

module.exports = { getBettingAnalysis };