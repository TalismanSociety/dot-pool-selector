import '@polkadot/api-augment';
import { ApiPromise } from "@polkadot/api";

type MatchingPool = {
    poolAccountId: String,
    rootAccountId: String,
    poolId: Number
}

export default class PoolSelector {

    minStake: Number;
    minSpots: Number;
    numberOfPools: Number;
    api: ApiPromise;
    maxMembers: Number = 0;
    era: Number;
    minNumberOfValidators: Number;
    validatorSelector;

    /*
    * @param minStake - the desired minimum amount of stake that the root account should hold
    * @param minSpots - the desired minimum amount of free spaces available in a pool
    * @param numberOfPools - the desired number of pools to retrieve meeting the criteria
    * @param minNumberOfValidators - the minimum number of validators the pool should have selected
    * @param era - the era to check for, if set to zero this module will get the latest in the init function
    * @param validatorSelector - the initialised validator selector module
    * @param api - the initialised polkadot.js instance
    * */
    constructor(
        minStake: Number,
        minSpots: Number,
        numberOfPools: Number,
        minNumberOfValidators: Number,
        era: Number = 0,
        validatorSelector: any,
        api: ApiPromise
    ) {
        this.minStake = minStake;
        this.minSpots = minSpots;
        this.numberOfPools = numberOfPools;
        this.era = era;
        this.minNumberOfValidators = minNumberOfValidators;
        this.api = api;
        this.validatorSelector = validatorSelector;
    }

    private async init() {
        if (this.maxMembers == 0) {
            const max = await this.api.query.nominationPools.maxPoolMembersPerPool();
            this.maxMembers = parseInt(max.toString());
        }
        if(this.era == 0) {
            const { index } = JSON.parse((await this.api.query.staking.activeEra()).toString());
            this.era = index;
        }
    }

    /*
    * @dev - checks whether a specific pool matches the criteria set
    * @param - the account id of the specified pool
    * @returns - true if it meets the criteria else false
    * */
    async getMeetsCriteriaByPoolAccountId(poolAccountId: String): Promise<boolean> {
        await this.init();
        const poolInfo = await this.api.query.nominationPools.poolMembers(poolAccountId);
        const { poolId } = JSON.parse(poolInfo.toString());
        const root = (await this.api.query.nominationPools.metadata(poolId)).toString();
        const verified = await this.getIsRootVerified(root);
        const meetsStakingRequirement = await this.getRootMeetsStakeRequirement(root);
        const meetsMinSpotRequirement = await this.getMeetsMinSpotRequirement(root);
        const validatorsMeetCriteria = await this.getValidatorsMeetCriteria(poolAccountId);

        return verified && meetsStakingRequirement && meetsMinSpotRequirement && validatorsMeetCriteria;
    }

    /*
    * @dev - checks whether a specific pool's validator set meets the criteria set
    * @param - the account id of the specified pool
    * @returns - true if it meets the criteria else false
    * */
    private async getValidatorsMeetCriteria(poolAccountId: String): Promise<boolean> {
        const validatorsSelected = await this.api.query.staking.nominators(poolAccountId);
        const { targets } = JSON.parse(validatorsSelected.toString());
        if(this.minNumberOfValidators < targets.length) return false;
        for(let t of targets) {
            const meetsCriteria = await this.validatorSelector.getMeetsCriteriaByAccountId(t.address);
            if(!meetsCriteria) return false;
        }

        return true;
    }

    /*
    * @dev - get pools meeting the criteria
    * @returns - an array of MatchingPool objects (Pools that match the criteria set)
    * */
    async getPoolsMeetingCriteria(): Promise<MatchingPool[]> {
        await this.init();
        const matchingPools: MatchingPool[] = [];
        const pools = await this.api.query.nominationPools.poolMembers.entries();
        for (const [k, v] of pools) {
           const poolAccountId = k.args[0].toString();
           const meetsCriteria = await this.getMeetsCriteriaByPoolAccountId(poolAccountId);
           if(meetsCriteria) {
               matchingPools.push({
                   poolAccountId: poolAccountId,
                   rootAccountId: "", // TODO must get from somewhere else
                   poolId: JSON.parse(v.toString()).poolId
               });
           }
           if(matchingPools.length == this.numberOfPools) break;
        }

        return matchingPools;
    }

    /*
    * @dev - check if the root user has a verified identity
    * @returns - true if it does, else false
    * */
    private async getIsRootVerified(root: String): Promise<boolean> {
        const identity = await this.api.query.identity.identityOf(root);

        return !identity.isEmpty;
    }

    /*
    * @dev - checks if the pool has the desired amount of free spots or not and whether it has reached or exceeded the max member count
    * @param account - the account id of the pool
    * @returns - true if it has, else false
    * */
    private async getMeetsMinSpotRequirement(account: String): Promise<boolean> {
        // TODO this is the wrong call
        // const data = await this.api.query.nominationPools.poolMembers(account);
        // const members = JSON.parse(data.toString());
        // console.log(members)
        // const freeSpots: Number = this.maxMembers - members;
        //
        // return members.length < this.maxMembers && freeSpots >= this.minSpots;
        return false;
    }

    /*
    * @dev - checks if the root user has put up enough stake
    * @param - the root address
    * @returns - true if it has, else false
    * */
    private async getRootMeetsStakeRequirement(root: String): Promise<boolean> {
        const erasStakers = await this.api.query.staking.erasStakers(this.era, root);
        const { own } = JSON.parse(erasStakers.toString());

        return own >= this.minStake;
    }

}