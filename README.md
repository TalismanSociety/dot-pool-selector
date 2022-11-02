# dot-pool-selector
Select the best nomination pools algorithmically

## Criteria
The algorithm selects pools based on the following:

- The root user is verified
- The root user has skin in the game 
- The pool's validators meet general standards, see more [here](https://github.com/James-Sangalli/dot-validator-selector#criteria)
- The pool is in an open state 
- The pool has selected an optimal number of validators

## Getting started 
Install the modules with `npm i` & run the tests with `npm run test`. 

## Usage 
```ts
// Initialise the polkadot api object 
const { ApiPromise, WsProvider} = require("@polkadot/api");
const api = await ApiPromise.create({ provider: new WsProvider("YOUR_PROVIDER") });

// Initialise the ValidatorSelector
const selector = new ValidatorSelector(api, MAX_COMMISSION, MIN_STAKING, ERA); // set ERA to 0 or undefined if you want to use the current era

// Initialise the PoolSelector
const poolSelector = new PoolSelector(
    validatorSelector, // the initialised ValidatorSelector
    api, // the initialised polkadot.js api object
    options, // see ./src/Types.ts (uses a default object if unset) 
);

// get validator pools meeting the criteria
poolSelector.getPoolsMeetingCriteria();
// sample output
> [{ "pass": true, "poolId": 10, "poolStashAccountId": "F3opxRbN5ZavB4LTn2G7pUpU9FV2tzasBzFYncxp1HdYEdy", "poolRewardAccountId": "F3opxRbN5ZavB4LTn2Xrr2QadvgVT6Tbrvm6jJoGqAMorEE", "depositor": "H1bSKJxoxzxYRCdGQutVqFGeW7xU3AcN6vyEdZBU7Qb1rsZ", "root": "H1bSKJxoxzxYRCdGQutVqFGeW7xU3AcN6vyEdZBU7Qb1rsZ", "nominator": "H1bSKJxoxzxYRCdGQutVqFGeW7xU3AcN6vyEdZBU7Qb1rsZ", "stateToggler": "H1bSKJxoxzxYRCdGQutVqFGeW7xU3AcN6vyEdZBU7Qb1rsZ", "state": "Open", "memberCount": 3 }, ...]
```
