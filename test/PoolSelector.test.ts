import { ApiPromise, WsProvider } from "@polkadot/api";
import "@polkadot/api-augment";
import { BN } from "@polkadot/util";
import ValidatorSelector from "dot-validator-selector/util/ValidatorSelector.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import PoolSelector from "../src/PoolSelector";
import { Options, Pool, defaultOptions } from "../src/Types";

describe("ValidatorSelector functionality", () => {
  const era = 4352;
  const minStake = new BN(0);
  const minValidators = 2;
  const provider = new WsProvider("wss://kusama-rpc.polkadot.io", false);
  const api = new ApiPromise({
    provider,
  });
  const validatorSelector = new ValidatorSelector(
    api,
    undefined,
    undefined,
    minStake,
    era
  );
  const poolSelector = new PoolSelector(validatorSelector, api, {
    ...defaultOptions,
    era,
    checkValidators: true,
    minNumberOfValidators: minValidators,
  });

  const pools: Pool[] = [];

  beforeAll(async () => {
    await provider.connect();
    await api.isReady;
    pools.push(...(await poolSelector.getPoolsMeetingCriteria()));
  });

  afterAll(async () => {
    await api.disconnect();
  });

  test.concurrent("should get two pools as requested", async () => {
    const options: Options = { ...defaultOptions, numberOfPools: 2 };
    const ps = new PoolSelector(validatorSelector, api, options);
    const p = await ps.getPoolsMeetingCriteria();
    expect(p.length).toBe(2);
  });

  test.concurrent(
    "should only get pools where the root is verified",
    async () => {
      const identity = await api.query.identity.identityOf(
        pools[0]!.root.unwrap()
      );
      expect(identity.isEmpty).toBeFalsy;
    }
  );

  test.concurrent(
    "should only get pools where the root has skin in the game meeting the requirement set",
    async () => {
      const erasStakers = await api.query.staking.erasStakers(
        era,
        pools[0]!.root.unwrap()
      );
      expect(erasStakers.own.toNumber()).toBeGreaterThanOrEqual(
        minStake.toNumber()
      );
    }
  );

  test.concurrent(
    "should exclude a pool with validators that don't meet the requirements",
    async () => {
      const nominatorData = await api.query.staking.nominators(
        pools[0]!.poolStashAccountId
      );

      const checks = await Promise.all(
        nominatorData
          .unwrapOrDefault()
          .targets.map((target) =>
            validatorSelector.getMeetsCriteriaByAccountId(target)
          )
      );

      expect(checks).toEqual(Array.from({ length: checks.length }).fill(true));
    }
  );

  test.concurrent(
    "should only get pools that are in an open state",
    async () => {
      const poolId = pools[0]!.poolId;
      const bondedPoolsData = await api.query.nominationPools.bondedPools(
        poolId
      );
      expect(bondedPoolsData.unwrapOrDefault().state.type).toBe("Open");
    }
  );

  test.concurrent(
    "should only get pools with a minimum of the specified validators",
    async () => {
      const data = await api.query.staking.nominators(
        pools[0]!.poolStashAccountId
      );
      expect(data.unwrapOrDefault().targets.length).toBeGreaterThanOrEqual(
        minValidators
      );
    }
  );

  test.concurrent("should be able to skip validator checking", async () => {
    const p = new PoolSelector(validatorSelector, api);
    const pools = await p.getPoolsMeetingCriteria();
    expect(pools.length).toBeGreaterThanOrEqual(1);
  });

  test.concurrent(
    "should be able to find a pool with a verified root in the specified era",
    async () => {
      const options: Options = {
        ...defaultOptions,
        checkRootVerified: true,
        numberOfPools: 1,
      };
      const p = new PoolSelector(validatorSelector, api, options);
      const pools = await p.getPoolsMeetingCriteria();
      expect(pools.length).toBe(1);
    }
  );

  test.concurrent(
    "should not be able to find a pool in the specified era meeting the criteria below",
    async () => {
      const options: Options = {
        ...defaultOptions,
        checkRootVerified: true,
        checkForDuplicateValidators: true,
        checkValidators: true,
        rootMinStake: new BN(10_000_000_000_000),
      };
      const p = new PoolSelector(validatorSelector, api, options);
      const pools = await p.getPoolsMeetingCriteria();
      expect(pools.length).toBe(0);
    }
  );

  // This will fail because the library doesn't actually support querying at specified era
  test.fails.concurrent(
    "should not be able to find any pools with a stake of 1 ksm in the specified era",
    async () => {
      const options: Options = { ...defaultOptions, rootMinStake: new BN(1) };
      const p = new PoolSelector(validatorSelector, api, options);
      const pools = await p.getPoolsMeetingCriteria();
      expect(pools.length).toBe(0);
    }
  );

  test.concurrent(
    "should not accept a pool with duplicate validators",
    async () => {
      const options: Options = {
        ...defaultOptions,
        checkForDuplicateValidators: true,
      };
      const p = new PoolSelector(validatorSelector, api, options);
      const match = await p.getPoolInfoAndMatchById(1);
      expect(match.pass).toBeFalsy();
    }
  );
});
