import { ApiPromise } from "@polkadot/api";
import "@polkadot/api-augment";
import { BN, bnToU8a, stringToU8a, u8aConcat } from "@polkadot/util";
import PromiseExtra from "./PromiseExtra";
import { defaultOptions, emptyPoolObj, Options, Pool } from "./Types";

export default class PoolSelector {
  readonly minStake: BN;
  readonly desiredNumberOfPools: number;
  readonly api: ApiPromise;
  private era: number;
  readonly minNumberOfValidators: number;
  readonly checkRootVerified: boolean;
  readonly checkForDuplicateValidators: boolean;
  readonly checkValidators: boolean;

  /*
   * @param validatorSelector - the initialised validator selector module
   * @param api - the initialised polkadot.js instance
   * @param options - the custom options (see Options type)
   */
  constructor(
    readonly validatorSelector: {
      getMeetsCriteriaByAccountId: (accountId: string) => Promise<boolean>;
    },
    api: ApiPromise,
    options: Options = defaultOptions
  ) {
    this.minStake = options.rootMinStake
      .mul(new BN(10))
      .pow(new BN(api.registry.chainDecimals[0].toString()));
    this.desiredNumberOfPools = options.numberOfPools;
    this.era = options.era;
    this.minNumberOfValidators = options.minNumberOfValidators;
    this.api = api;
    this.checkRootVerified = options.checkRootVerified;
    this.checkForDuplicateValidators = options.checkForDuplicateValidators;
    this.checkValidators = options.checkValidators;
  }

  private async init() {
    if (this.era === 0) {
      const { index } = JSON.parse(
        (await this.api.query.staking.activeEra()).toString()
      );
      this.era = index;
    }
  }

  /*
   * @dev - gets the pool's information and checks if it meets the criteria
   * @param - the pool id for a specific pool
   * @returns - a pool object containing info about the pool and whether it matches the criteria or not
   * */
  async getPoolInfoAndMatchById(poolId: number): Promise<Pool> {
    const [data] = await Promise.all([
      this.api.query.nominationPools.bondedPools(poolId),
      this.init(),
    ]);
    if (data.isNone) return emptyPoolObj; // this can happen if a pool was removed as the index remains
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
    };

    return this.getCheckedPool(pool, poolInfo);
  }

  /*
   * @dev - run the pool by the criteria set
   * @param pool - the unchecked pool object
   * @param poolInfo - the pool information returned from the bondedPools call
   * @returns - a pool object containing info about the pool and whether it matches the criteria or not
   * */
  private async getCheckedPool(pool: Pool, poolInfo: any): Promise<Pool> {
    if (poolInfo.state != "Open") {
      return pool;
    }

    return (await PromiseExtra.every(
      [
        this.getIsRootVerified(poolInfo.roles.root),
        this.getRootMeetsStakeRequirement(poolInfo.roles.root),
        this.checkValidators
          ? this.getValidatorsMeetCriteriaByPoolId(pool.poolStashAccountId)
          : Promise.resolve(true),
      ],
      (checkPass) => checkPass
    ))
      ? { ...pool, pass: true }
      : pool;
  }

  /*
   * @dev see https://github.com/polkadot-js/apps/blob/v0.121.1/packages/page-staking/src/usePoolAccounts.ts#L17
   * */
  private getPoolAccount(poolId: BN, index: number): string {
    const palletId = this.api.consts.nominationPools.palletId.toU8a();
    const EMPTY_H256 = new Uint8Array(32);
    const MOD_PREFIX = stringToU8a("modl");
    const U32_OPTS = { bitLength: 32, isLe: true };
    return this.api.registry
      .createType(
        "AccountId32",
        u8aConcat(
          MOD_PREFIX,
          palletId,
          new Uint8Array([index]),
          bnToU8a(poolId, U32_OPTS),
          EMPTY_H256
        )
      )
      .toString();
  }

  /*
   * @dev - checks whether a specific pool's validator set meets the criteria set
   * @param - the account id of the specified pool
   * @returns - true if it meets the criteria else false
   * */
  private async getValidatorsMeetCriteriaByPoolId(
    poolAccountId: string
  ): Promise<boolean> {
    const validatorsSelected = await this.api.query.staking.nominators(
      poolAccountId
    );

    if (validatorsSelected.isNone) {
      return false;
    }

    const { targets } = JSON.parse(validatorsSelected.toString());

    if (targets.length < this.minNumberOfValidators) {
      return false;
    }

    return await PromiseExtra.every(
      [
        this.getHasDuplicateValidators(targets).then((x) => !x),
        this.getValidatorsMeetCriteria(targets),
      ],
      (pass) => pass
    );
  }

  /*
   * @dev check validators meet the criteria
   * @param targets - the validator addresses
   * @returns - true if meets criteria else false
   * */
  private getValidatorsMeetCriteria(targets: string[]): Promise<boolean> {
    return PromiseExtra.every(
      targets.map((target) =>
        this.validatorSelector.getMeetsCriteriaByAccountId(target)
      ),
      (meetsCriteria) => meetsCriteria
    );
  }

  /*
   * @dev check if duplicate validators are present in a pool
   * @dev ignore if user has not enabled the check
   * @param targets - the validator addresses
   * @returns - true if duplicates are present, else false
   * */
  private getHasDuplicateValidators(targets: string[]): Promise<boolean> {
    if (!this.checkForDuplicateValidators) return Promise.resolve(false);

    const entities: { [key: string]: boolean } = {};

    return PromiseExtra.some(
      targets.map((target) => this.api.query.identity.identityOf(target)),
      (target) => {
        if (target.isNone) return true;
        if (entities[target.unwrap().info.display.toString()]) return true;

        entities[target.unwrap().info.display.toString()] = true;
      }
    );
  }

  /*
   * @dev - get pools meeting the criteria
   * @returns - an array of matching pool objects
   * */
  async getPoolsMeetingCriteria(): Promise<Pool[]> {
    const [numberOfPools] = await Promise.all([
      this.api.query.nominationPools.counterForRewardPools(),
      this.init(),
    ]);

    return await PromiseExtra.filter(
      Array.from({ length: numberOfPools.toNumber() }, (_, index) => index + 1)
        .sort(() => Math.random() - 0.5)
        .map((poolId) => this.getPoolInfoAndMatchById(poolId)),
      (pool) => pool.pass,
      this.desiredNumberOfPools
    );
  }

  /*
   * @dev - check if the root user has a verified identity
   * @returns - true if it does, else false
   * */
  private async getIsRootVerified(root: string): Promise<boolean> {
    const identity = await this.api.query.identity.identityOf(root);

    return !identity.isNone;
  }

  /*
   * @dev - checks if the root user has put up enough stake
   * @param - the root address
   * @returns - true if it has, else false
   * */
  private async getRootMeetsStakeRequirement(root: string): Promise<boolean> {
    const erasStakers = await this.api.query.staking.erasStakers(
      this.era,
      root
    );
    const { own } = JSON.parse(erasStakers.toString());

    return own >= this.minStake;
  }
}
