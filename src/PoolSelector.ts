import '@polkadot/api-augment';
import { ApiPromise } from "@polkadot/api";
import { bnToU8a, stringToU8a, u8aConcat } from '@polkadot/util';
import { BN } from '@polkadot/util';

export type Pool = {
    pass: boolean;
    poolId: number;
    poolStashAccountId: string;
    poolRewardAccountId: string;
    depositor: string;
    root: string;
    nominator: string;
    stateToggler: string;
    state: string;
    memberCount: number;
}

export default class PoolSelector {

    minStake: number;
    minSpots: number;
    desiredNumberOfPools: number;
    api: ApiPromise;
    maxMembers: number;
    era: number;
    minNumberOfValidators: number;
    validatorSelector;
    emptyPoolObj: Pool = {
        depositor: "",
        memberCount: 0,
        nominator: "",
        pass: false,
        poolStashAccountId: "",
        poolRewardAccountId: "",
        poolId: 0,
        root: "",
        state: "",
        stateToggler: ""
    };

    /*
    * @param minStake - the desired minimum amount of stake that the root account should hold
    * @param minSpots - the desired minimum amount of free spaces available in a pool
    * @param numberOfPools - the desired number of pools to retrieve meeting the criteria
    * @param minNumberOfValidators - the minimum number of validators the pool should have selected
    * @param era - the era to check for, if set to zero this module will get the latest in the init function
    * @param maxMembers - the maximum number of members in a pool
    * @param validatorSelector - the initialised validator selector module
    * @param api - the initialised polkadot.js instance
    * */
    constructor(
        minStake: number,
        minSpots: number,
        numberOfPools: number,
        minNumberOfValidators: number,
        era: number = 0,
        maxMembers: number = 1024, // TODO place polkadot default here (currently kusama)
        validatorSelector: any,
        api: ApiPromise
    ) {
        this.minStake = minStake;
        this.minSpots = minSpots;
        this.desiredNumberOfPools = numberOfPools;
        this.era = era;
        this.minNumberOfValidators = minNumberOfValidators;
        this.api = api;
        this.validatorSelector = validatorSelector;
        this.maxMembers = maxMembers;
    }

    private async init() {
        if(this.era == 0) {
            const { index } = JSON.parse((await this.api.query.staking.activeEra()).toString());
            this.era = index;
        }
    }

    /*
    * @dev - gets the pool's information and checks if it meets the criteria
    * @param - the pool id for a specific pool
    * @returns - a pool object containing info about the pool and whether it matches the criteria or not
    * */
    async getPoolInfoAndMatchById(poolId: number): Promise<Pool> {
        await this.init();
        const data = await this.api.query.nominationPools.bondedPools(poolId);
        if(data.isEmpty) return this.emptyPoolObj;
        const poolInfo = JSON.parse(data.toString());
        const { root, depositor, nominator, stateToggler } = poolInfo.roles;
        const pool: Pool = {
            pass: false,
            poolId: poolId,
            poolStashAccountId: this.getPoolAccount(new BN(poolId), 0),
            poolRewardAccountId: this.getPoolAccount(new BN(poolId), 1),
            depositor: depositor,
            root: root,
            nominator: nominator,
            stateToggler: stateToggler,
            state: poolInfo.state,
            memberCount: poolInfo.memberCounter,
        }
        const isOpen = poolInfo.state == "Open";
        if(!isOpen) return pool;
        const verified = await this.getIsRootVerified(root);
        if(!verified) return pool;
        const meetsStakingRequirement = await this.getRootMeetsStakeRequirement(root);
        if(!meetsStakingRequirement) return pool;
        const meetsMinSpotRequirement = this.maxMembers - poolInfo.memberCounter >= this.minSpots;
        if(!meetsMinSpotRequirement) return pool;
        pool.pass = await this.getValidatorsMeetCriteria(pool.poolStashAccountId);

        return pool;
    }

    /*
    * @dev see https://github.com/polkadot-js/apps/blob/v0.121.1/packages/page-staking/src/usePoolAccounts.ts#L17
    * */
    private getPoolAccount(poolId: BN, index: number): string {
        const palletId = this.api.consts.nominationPools.palletId.toU8a();
        const EMPTY_H256 = new Uint8Array(32);
        const MOD_PREFIX = stringToU8a('modl');
        const U32_OPTS = { bitLength: 32, isLe: true };
        return this.api.registry.createType('AccountId32', u8aConcat(
            MOD_PREFIX,
            palletId,
            new Uint8Array([index]),
            bnToU8a(poolId, U32_OPTS),
            EMPTY_H256
        )).toString();
    }

    /*
    * @dev - checks whether a specific pool's validator set meets the criteria set
    * @param - the account id of the specified pool
    * @returns - true if it meets the criteria else false
    * */
    private async getValidatorsMeetCriteria(poolAccountId: string): Promise<boolean> {
        const validatorsSelected = await this.api.query.staking.nominators(poolAccountId);
        if(validatorsSelected.isEmpty) return false;
        const { targets } = JSON.parse(validatorsSelected.toString());
        const duplicate = new Set(targets).size !== targets.length;
        if(duplicate) return false; // validators should be unique
        if(targets.length < this.minNumberOfValidators) return false;
        for(let t of targets) {
            const meetsCriteria = await this.validatorSelector.getMeetsCriteriaByAccountId(t);
            if(!meetsCriteria) return false;
        }

        return true;
    }

    /*
    * @dev - get pools meeting the criteria
    * @returns - an array of matching pool objects
    * */
    async getPoolsMeetingCriteria(): Promise<Pool[]> {
        await this.init();
        const matchingPools = [];
        const numberOfPools = await this.api.query.nominationPools.counterForRewardPools();
        for(let i = 1; i <= numberOfPools.toNumber(); i++) {
            const pool = await this.getPoolInfoAndMatchById(i);
            if(pool.pass) matchingPools.push(pool);
            if(matchingPools.length == this.desiredNumberOfPools) break;
        }

        return matchingPools;
    }

    /*
    * @dev - check if the root user has a verified identity
    * @returns - true if it does, else false
    * */
    private async getIsRootVerified(root: string): Promise<boolean> {
        const identity = await this.api.query.identity.identityOf(root);

        return !identity.isEmpty;
    }

    /*
    * @dev - checks if the root user has put up enough stake
    * @param - the root address
    * @returns - true if it has, else false
    * */
    private async getRootMeetsStakeRequirement(root: string): Promise<boolean> {
        const erasStakers = await this.api.query.staking.erasStakers(this.era, root);
        const { own } = JSON.parse(erasStakers.toString());

        return own >= this.minStake;
    }

}