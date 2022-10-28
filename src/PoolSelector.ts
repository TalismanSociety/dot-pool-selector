import '@polkadot/api-augment';
import { ApiPromise } from "@polkadot/api";
import { bnToU8a, stringToU8a, u8aConcat } from '@polkadot/util';
import { BN } from '@polkadot/util';
import { Pool, Options, defaultOptions, emptyPoolObj } from "./Types";

export default class PoolSelector {

    readonly minStake: BN;
    readonly minSpots: number;
    readonly desiredNumberOfPools: number;
    readonly api: ApiPromise;
    readonly maxMembers: number;
    private era: number;
    readonly minNumberOfValidators: number;
    readonly validatorSelector;
    readonly checkRootVerified: boolean;
    readonly checkForDuplicateValidators: boolean;
    readonly checkValidators: boolean;

    /*
     * @param validatorSelector - the initialised validator selector module
     * @param api - the initialised polkadot.js instance
     * @param options - the custom options (see Options type)
     */
    constructor(
        validatorSelector: any,
        api: ApiPromise,
        options: Options = defaultOptions
    ) {
        this.minStake = options.rootMinStake.mul(new BN(10)).pow(new BN(api.registry.chainDecimals[0].toString()));
        this.minSpots = options.minSpots;
        this.desiredNumberOfPools = options.numberOfPools;
        this.era = options.era;
        this.minNumberOfValidators = options.minNumberOfValidators;
        this.api = api;
        this.validatorSelector = validatorSelector;
        this.maxMembers = options.maxMembers;
        this.checkRootVerified = options.checkRootVerified;
        this.checkForDuplicateValidators = options.checkForDuplicateValidators;
        this.checkValidators = options.checkValidators;
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
        if(data.isEmpty) return emptyPoolObj; // this can happen if a pool was removed as the index remains
        const poolInfo = JSON.parse(data.toString());
        const { root, depositor, nominator, stateToggler } = poolInfo.roles;
        const pool: Pool = {
            pass: false,
            era: this.era,
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

        return this.getCheckedPool(pool, poolInfo);
    }

    /*
    * @dev - run the pool by the criteria set
    * @param pool - the unchecked pool object
    * @param poolInfo - the pool information returned from the bondedPools call
    * @returns - a pool object containing info about the pool and whether it matches the criteria or not
    * */
    private async getCheckedPool(pool: Pool, poolInfo: any): Promise<Pool> {
        if(poolInfo.state != "Open") {
            return pool;
        }

        if(this.checkRootVerified) {
            const verified = await this.getIsRootVerified(poolInfo.roles.root);
            if(!verified) {
                return pool;
            }
        }

        const meetsStakingRequirement = await this.getRootMeetsStakeRequirement(poolInfo.roles.root);
        if(!meetsStakingRequirement) {
            return pool;
        }

        // check not needed, since maxMembers == noop on Polkadot relaychain
        // const meetsMinSpotRequirement = this.maxMembers - poolInfo.memberCounter >= this.minSpots;
        // if(!meetsMinSpotRequirement) {
        //     return pool;
        // }

        if(this.checkValidators) {
            pool.pass = await this.getValidatorsMeetCriteriaByPoolId(pool.poolStashAccountId);
        } else {
            pool.pass = true;
        }

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
    private async getValidatorsMeetCriteriaByPoolId(poolAccountId: string): Promise<boolean> {
        const validatorsSelected = await this.api.query.staking.nominators(poolAccountId);
        if(validatorsSelected.isEmpty) {
            return false;
        }
        const { targets } = JSON.parse(validatorsSelected.toString());
        if(targets.length < this.minNumberOfValidators){
            return false;
        }
        const duplicatesOrNotChecked = await this.getHasDuplicateValidators(targets);
        if(duplicatesOrNotChecked) {
            return false;
        }

        return this.getValidatorsMeetCriteria(targets);
    }

    /*
    * @dev check validators meet the criteria
    * @param targets - the validator addresses
    * @returns - true if meets criteria else false
    * */
    private async getValidatorsMeetCriteria(targets: string[]): Promise<boolean> {
        for(let t of targets) {
            const meetsCriteria = await this.validatorSelector.getMeetsCriteriaByAccountId(t);
            if(!meetsCriteria) {
                return false;
            }
        }

        return true;
    }

    /*
    * @dev check if duplicate validators are present in a pool
    * @dev ignore if user has not enabled the check
    * @param targets - the validator addresses
    * @returns - true if duplicates are present, else false
    * */
    private async getHasDuplicateValidators(targets: string[]): Promise<boolean> {
        if(this.checkForDuplicateValidators) {
            const entities: { [key: string]: boolean } = {};
            for(let t of targets) {
                const identity = await this.api.query.identity.identityOf(t);
                if(!identity.isEmpty) {
                    const { info } = JSON.parse(identity.toString());
                    if(entities[info.display.raw]) {
                        return true;
                    }
                    entities[info.display.raw] = true;
                } else {
                    return true; // can't verify if duplicate or not so we assume they are
                }
            }
        }

        return false;
    }

    /*
    * @dev - get pools meeting the criteria
    * @returns - an array of matching pool objects
    * */
    async getPoolsMeetingCriteria(): Promise<Pool[]> {
        await this.init();
        const matchingPools = [];
        const numberOfPools = await this.api.query.nominationPools.counterForRewardPools();
        const randomisedOrder = PoolSelector.randomiseOrder(numberOfPools.toNumber());
        for(let i = 0; i < randomisedOrder.length; i++) {
            const pool = await this.getPoolInfoAndMatchById(randomisedOrder[i]);
            if(pool.pass) matchingPools.push(pool);
            if(matchingPools.length == this.desiredNumberOfPools) break;
        }

        return matchingPools;
    }

    /*
    * @dev - randomise the pool ids so that we check them randomly rather than sequentially (this would give an advantage to earlier pools)
    * @param count - the number of pools created
    * @returns - an array of randomised values based on the pool count
    * */
    private static randomiseOrder(count: number): number[] {
        const order = [];
        while(order.length < count) {
            const r = Math.floor(Math.random() * count) + 1;
            if(order.indexOf(r) === -1) order.push(r);
        }

        return order;
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