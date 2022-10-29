import type { Struct } from "@polkadot/types-codec";
import type { AccountId32 } from "@polkadot/types/interfaces";
import type {
  PalletNominationPoolsBondedPoolInner,
  PalletNominationPoolsPoolRoles,
} from "@polkadot/types/lookup";
import { BN } from "@polkadot/util";

export type Pool = Omit<PalletNominationPoolsPoolRoles, keyof Struct> &
  Pick<PalletNominationPoolsBondedPoolInner, "state" | "memberCounter"> & {
    era: number;
    pass: boolean; // whether the pool meets the selected criteria or not
    poolId: number; // the id number of the pool (incremental order of creation)
    poolStashAccountId: AccountId32; // the pool's stashing account
    poolRewardAccountId: AccountId32; // the pool's reward account
  };

export type Options = {
  rootMinStake: BN; // the desired minimum amount of stake that the root account should hold
  numberOfPools: number; // the desired number of pools to retrieve meeting the criteria
  minNumberOfValidators: number; // the minimum number of validators the pool should have selected
  era: number; // the era to check for, if set to zero this module will get the latest in the init function
  checkRootVerified: boolean; // check if the root is verified (ignore if false)
  checkForDuplicateValidators: boolean; // check if the pool has duplicate validators (ignore if false)
  checkValidators: boolean; // check that validators meet the criteria set by the ValidatorSelector (ignore if false)
};

export const defaultOptions: Options = {
  checkForDuplicateValidators: false,
  checkRootVerified: false,
  checkValidators: false,
  era: 0,
  minNumberOfValidators: 1,
  rootMinStake: new BN(0),
  numberOfPools: 1,
};
