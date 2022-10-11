import { ApiPromise } from "@polkadot/api";

type MatchingPool = {
    poolAccountId: String,
    rootAccountId: String,
    poolNumber: Number
}

export default class PoolSelector {

    minStake: Number;
    minSpots: Number;
    numberOfPools: Number;
    api: ApiPromise;
    maxMembers: Number;
    era: Number;

    /*
    * @param minStake - the desired minimum amount of stake that the root account should hold
    * @param minSpots - the desired minimum amount of free spaces available in a pool
    * @param numberOfPools - the desired number of pools to retrieve meeting the criteria
    * @param minNumberOfValidators - the minimum number of validators the pool should have selected
    * @param api - the initialised polkadot.js instance
    * */
    constructor(
        minStake: Number,
        minSpots: Number,
        numberOfPools: Number,
        minNumberOfValidators: Number,
        era: Number,
        api: ApiPromise
    ) {
        this.minStake = minStake;
        this.minSpots = minSpots;
        this.numberOfPools = numberOfPools;
        this.era = era;
        this.api = api;
    }

    async init() {
        // TODO set era if set to zero else use the era inputted via the constructor
        if (this.maxMembers == undefined) {
            this.maxMembers = await this.api.query.nominationPools.maxPoolMembersPerPool();
        }
    }

    /*
    * @dev - checks whether a specific pool matches the criteria set
    * @param - the id of the specified pool
    * @returns - true if it meets the criteria else false
    * */
    async getSpecificPoolMeetsCriteria(poolId: Number): Promise<boolean> {
        await this.init();

        return false;
    }

    /*
    * @dev - get pools meeting the criteria
    * @returns - an array of MatchingPool objects (Pools that match the criteria set)
    * */
    async getPoolsMeetingCriteria(): Promise<MatchingPool[]> {
        await this.init();
        const pools = await this.api.query.nominationPools.poolMembers.entries();

        pools.forEach(([k, v]) =>
            console.log(
                /* AccountId */
                k.args[0].toString(),
                /* Pool info */
                JSON.stringify(v.toHuman())
            )
        );

        return [];
    }

    /*
    * @dev - check if the root user has a verified identity
    * @returns - true if it does, else false
    * */
    private getIsRootVerified(root: String): boolean {
        return false;
    }

    /*
    * @dev - checks if the pool has reached it's max count or not
    * @returns - true if it has, else false
    * */
    private async getIsPoolAtMaxCount(account: String): Promise<boolean> {
        const members = await this.api.query.nominationPools.poolMembers(account);

        return members.length >= this.maxMembers;
    }

    /*
    * @dev - checks if the root user has put up enough stake
    * @returns - true if it has, else false
    * */
    private getRootMeetsStakeRequirement(): boolean {
        return false;
    }

}