import type { ApiPromise } from "@polkadot/api";

export * from "./PoolSelector";
export { default } from "./PoolSelector";
export { defaultOptions } from "./Types";

export interface ValidatorSelector {
  new (
    api: ApiPromise,
    maxCommission?: number,
    minCommission?: number,
    minStaking?: number,
    era?: number,
    humanReadable?: boolean
  ): ValidatorSelector;

  getMeetsCriteriaByAccountId: (accountId: string) => Promise<boolean>;
}

export const ValidatorSelector: ValidatorSelector = require("dot-validator-selector/util/ValidatorSelector.js");
