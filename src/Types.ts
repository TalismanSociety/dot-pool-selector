import { BN } from "@polkadot/util";

export type Pool = {
    pass: boolean; // whether the pool meets the selected criteria or not
    era: number;
    poolId: number; // the id number of the pool (incremental order of creation)
    poolStashAccountId: string; // the pool's stashing account
    poolRewardAccountId: string; // the pool's reward account
    depositor: string; // the pool's depositor account
    root: string; // the pool's root account
    nominator: string; // the pool's nominator account
    stateToggler: string; // the pool's state toggler account
    state: string; // the pool's state e.g. open
    memberCount: number; // the number of accounts in the pool
}

export type Options = {
    rootMinStake: BN, // the desired minimum amount of stake that the root account should hold
    minSpots: number, // the desired minimum amount of free spaces available in a pool
    numberOfPools: number, // the desired number of pools to retrieve meeting the criteria
    minNumberOfValidators: number, // the minimum number of validators the pool should have selected
    era: number, // the era to check for, if set to zero this module will get the latest in the init function
    maxMembers: number, // the maximum number of members in a pool
    checkRootVerified: boolean, // check if the root is verified (ignore if false)
    checkForDuplicateValidators: boolean, // check if the pool has duplicate validators (ignore if false)
    checkValidators: boolean // check that validators meet the criteria set by the ValidatorSelector (ignore if false)
}

export const emptyPoolObj: Pool = {
    depositor: "",
    memberCount: 0,
    nominator: "",
    pass: false,
    era: 0,
    poolStashAccountId: "",
    poolRewardAccountId: "",
    poolId: 0,
    root: "",
    state: "",
    stateToggler: ""
};

export const defaultOptions: Options = {
    checkForDuplicateValidators: false,
    checkRootVerified: false,
    checkValidators: false,
    era: 0,
    maxMembers: 1024, // TODO place polkadot default here on launch (currently kusama)
    minNumberOfValidators: 1,
    minSpots: 1,
    rootMinStake: new BN(0),
    numberOfPools: 1,
}