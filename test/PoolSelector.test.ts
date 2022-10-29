import "@polkadot/api-augment";
const { expect } = require("chai");
import { ApiPromise, WsProvider } from "@polkadot/api";
import PoolSelector from "../src/PoolSelector";
const ValidatorSelector = require("dot-validator-selector/util/ValidatorSelector.js");
import { BN } from "@polkadot/util";
import { Pool, defaultOptions } from "../src/Types";

describe("ValidatorSelector functionality", () => {
  let poolSelector: PoolSelector;
  let api: ApiPromise;
  let era = 4352;
  let pools: Pool[];
  let validatorSelector: any;
  const minStake = new BN(0);
  const minValidators = 2;

  before(async () => {
    api = await ApiPromise.create({
      provider: new WsProvider(
        "wss://kusama.api.onfinality.io/ws?apikey=09f0165a-7632-408b-ba81-08f964b607f7"
      ),
    });
    validatorSelector = new ValidatorSelector(
      api,
      undefined,
      undefined,
      minStake,
      era
    );
    const options = defaultOptions;
    options.era = era;
    options.checkValidators = true;
    poolSelector = new PoolSelector(validatorSelector, api, options);
    pools = await poolSelector.getPoolsMeetingCriteria();
  });

  it("should get two pools as requested", async () => {
    const options = defaultOptions;
    options.numberOfPools = 2;
    const ps = new PoolSelector(validatorSelector, api, options);
    const p = await ps.getPoolsMeetingCriteria();
    expect(p.length).to.equal(
      2,
      "should have got two pools with the set criteria"
    );
  });

  it("should only get pools where the root is verified", async () => {
    const identity = await api.query.identity.identityOf(
      pools[0]!.root.unwrap()
    );
    expect(!identity.isEmpty, "Identity should not be empty");
  });

  it("should only get pools where the root has skin in the game meeting the requirement set", async () => {
    const erasStakers = await api.query.staking.erasStakers(
      era,
      pools[0]!.root.unwrap()
    );
    const { own } = JSON.parse(erasStakers.toString());
    expect(own >= minStake, "Root should meet staking requirements");
  });

  it("should exclude a pool with validators that don't meet the requirements", async () => {
    const nominatorData = await api.query.staking.nominators(
      pools[0]!.poolStashAccountId
    );
    const { targets } = JSON.parse(nominatorData.toString());
    for (let n of targets) {
      const meetsCriteria = await validatorSelector.getMeetsCriteriaByAccountId(
        n
      );
      expect(meetsCriteria, "Validator does not meet the criteria");
    }
  });

  it("should only get pools that are in an open state", async () => {
    const poolId = pools[0]!.poolId;
    const bondedPoolsData = await api.query.nominationPools.bondedPools(poolId);
    const { state } = JSON.parse(bondedPoolsData.toString());
    expect(state == "Open", "Selector should only get open pools");
  });

  it("should only get pools with a minimum of the specified validators", async () => {
    const data = await api.query.staking.nominators(
      pools[0]!.poolStashAccountId
    );
    const { targets } = JSON.parse(data.toString());
    expect(
      targets.length >= minValidators,
      `Should have at least ${minValidators} validators`
    );
  });

  it("should be able to skip validator checking", async () => {
    const p = new PoolSelector(validatorSelector, api);
    const pools = await p.getPoolsMeetingCriteria();
    expect(
      pools.length == 1,
      "should be able to get a pool without validator check"
    );
  });

  it("should be able to find a pool with a verified root in the specified era", async () => {
    const options = defaultOptions;
    options.checkRootVerified = true;
    options.numberOfPools = 1;
    const p = new PoolSelector(validatorSelector, api, options);
    const pools = await p.getPoolsMeetingCriteria();
    expect(pools.length).to.equal(
      1,
      `should find a pool with a verified root in era ${era}`
    );
  });

  it("should not be able to find a pool in the specified era meeting the criteria below", async () => {
    const options = defaultOptions;
    options.checkRootVerified = true;
    options.checkForDuplicateValidators = true;
    options.checkValidators = true;
    options.rootMinStake = new BN("10000000000000");
    const p = new PoolSelector(validatorSelector, api, options);
    const pools = await p.getPoolsMeetingCriteria();
    expect(pools.length).to.equal(
      0,
      `should not be able to find a pool in ${era} with the above criteria`
    );
  });

  it("should not be able to find any pools with a stake of 1 ksm in the specified era", async () => {
    const options = defaultOptions;
    options.rootMinStake = new BN("1");
    const p = new PoolSelector(validatorSelector, api, options);
    const pools = await p.getPoolsMeetingCriteria();
    expect(pools.length).to.equal(
      0,
      `should not find any pools with a root that has staked 1ksm or more in era ${era}`
    );
  });

  it("should not accept a pool with duplicate validators", async () => {
    const options = defaultOptions;
    options.checkForDuplicateValidators = true;
    const p = new PoolSelector(validatorSelector, api, options);
    const match = await p.getPoolInfoAndMatchById(1);
    expect(match.pass).to.equal(
      false,
      `pool 1 in era ${era} has duplicate validators and should fail`
    );
  });
});
