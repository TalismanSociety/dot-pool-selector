import { ApiPromise } from "@polkadot/api";

export default class PoolSelector {

    minStake: Number;
    minSpots: Number;
    numberOfPools: Number;
    api: ApiPromise;

    /*
    * @param minStake - the desired minimum amount of stake that the root account should hold
    * @param minSpots - the desired minimum amount of free spaces available in a pool
    * @param numberOfPools - the desired number of pools to retrieve meeting the criteria
    * @param api - the initialised polkadot.js instance
    * */
    constructor(
        minStake: Number,
        minSpots: Number,
        numberOfPools: Number,
        api: ApiPromise
    ) {
        this.minStake = minStake;
        this.minSpots = minSpots;
        this.numberOfPools = numberOfPools;
        this.api = api;
    }

    /*
    * @dev - get pools meeting the criteria
    * @returns - the pool ids
    * */
    async getPoolsMeetingCriteria(): Promise<Number[]> {
        return [];
    }

    /*
    * @dev - check if the root user has a verified identity
    * @returns - true if it does, else false
    * */
    private getIsRootVerified(): boolean {
        return false;
    }

    /*
    * @dev - checks if the pool has reached it's max count or not
    * @returns - true if it has, else false
    * */
    private getIsPoolAtMaxCount(): boolean {
        return false;
    }

    /*
    * @dev - checks if the root user has put up enough stake 
    * @returns - true if it has, else false
    * */
    private getRootMeetsStakeRequirement(): boolean {
        return false;
    }

}