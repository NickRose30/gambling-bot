To run a single analysis:
- change any variables at bottom of analysis.js then run `node analysis.js`

To run an optimization:
- change any variables at bottom of optimization.js then run `node optimization.js`

To run the bot that automatically places bets (not finished yet):
- run `node bot.js betAmount=25 numTeams=14 numLosses=2 numRetries=2` with whatever variables you want

To run bot with Cron on AWS Ubuntu box:

1. ssh to the box
2. switch to the root user `sudo su -`
3. start Cron `service cron start`
4. check that it's running `service cron status`
5. finish this later...