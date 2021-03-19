const execSh = require('exec-sh');
const R = require('ramda');
require('dotenv').config();

const getCommandLineArgs = _ => {
  const args = R.slice(2, Infinity, process.argv);
  return R.reduce((accum, arg) => {
    const split = arg.split('=');
    return { ...accum, [R.head(split)]: R.last(split) };
  }, {}, args);
};

const execute = cmd =>
  execSh(cmd, { cwd: './' }, err => {
    if (err) {
      console.log('Exit code: ', err.code);
    }
  });

const runCmd = cmd => {
  execute(`echo ${cmd}......`);
  execute(cmd);
};

const run = _ => {
  const { betAmount, numTeams, numLosses, numRetries } = getCommandLineArgs();
  const { USERNAME, PASSWORD } = process.env;
  const teamName = 'Boston Bruins';
  // TODO: do this for any of the top {numTeams} teams that have lost their
  // past {numLosses} games and are playing _TODAY_ (that part is important)
  runCmd(`npx cypress run --env betAmount=${betAmount},teamName="${teamName}",username=${USERNAME},password=${PASSWORD}`);
};

run();