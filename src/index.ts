import type { ApiPromise } from "@polkadot/api";
// @ts-expect-error
import BaseValidatorSelector from "dot-validator-selector/util/ValidatorSelector";
export * from "./PoolSelector.js";
export { default } from "./PoolSelector.js";
export { defaultOptions } from "./Types.js";

export interface IValidatorSelector {
  new (
    api: ApiPromise,
    maxCommission?: number,
    minCommission?: number,
    minStaking?: number,
    era?: number,
    humanReadable?: boolean
  ): IValidatorSelector;

  getMeetsCriteriaByAccountId: (accountId: string) => Promise<boolean>;
}

export const ValidatorSelector: IValidatorSelector = BaseValidatorSelector;
