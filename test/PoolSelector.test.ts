import '@polkadot/api-augment';
const { chai, expect } = require('chai');
import { ApiPromise, WsProvider } from "@polkadot/api";
import PoolSelector, { Pool } from "../src/PoolSelector";
const ValidatorSelector = require("dot-validator-selector/util/ValidatorSelector.js");

// TODO strengthen
describe("ValidatorSelector functionality", () => {

    let poolSelector: PoolSelector;
    let api: ApiPromise;
    let era: Number;
    let pools: Pool[];
    let validatorSelector: any;
    const minStake = 0;
    const minSpots = 100;
    const minValidators = 5;
    const numberOfPools = 2;

    before(async() => {
        api = await ApiPromise.create({ provider: new WsProvider("wss://kusama.api.onfinality.io/ws?apikey=09f0165a-7632-408b-ba81-08f964b607f7") });
        const activeEra = await api.query.staking.activeEra();
        const { index } = JSON.parse((activeEra).toString());
        era = index;
        validatorSelector = new ValidatorSelector(api, undefined, undefined, minStake, era);
        poolSelector = new PoolSelector(
            minStake,
            minSpots,
            minValidators,
            numberOfPools,
            undefined,
            undefined,
            validatorSelector,
            api,
            false,
            true,
            true
        );
        pools = await poolSelector.getPoolsMeetingCriteria();
    });

    it("should only get pools where the root is verified", async() => {
        const identity = await api.query.identity.identityOf(pools[0].root);
        expect(!identity.isEmpty, "Identity should not be empty");
    });

    it("should only get pools with the min amount of available spots specified", async() => {
        const data = await api.query.nominationPools.bondedPools(pools[0].poolId);
        const poolInfo = JSON.parse(data.toString());
        const meetsMinSpotRequirement = (1024 - poolInfo.memberCounter) >= minSpots;
        expect(poolSelector.maxMembers > poolInfo.memberCounter, "should only find pools below the max member threshold");
        expect(meetsMinSpotRequirement).to.be.equal(true, "should only find pools with the min amount of free spaces");
    });

    it("should only get pools where the root has skin in the game meeting the requirement set", async() => {
        const erasStakers = await api.query.staking.erasStakers(era, pools[0].root);
        const { own } = JSON.parse(erasStakers.toString());
        expect(own >= minStake, "Root should meet staking requirements");
    });

    it("should exclude a pool with validators that don't meet the requirements", async() => {
        const nominatorData = await api.query.staking.nominators(pools[0].poolStashAccountId);
        const { targets } = JSON.parse(nominatorData.toString());
        for(let n of targets) {
            const meetsCriteria = await validatorSelector.getMeetsCriteriaByAccountId(n);
            expect(meetsCriteria, "Validator does not meet the criteria");
        }
    });

    it("should only get pools that are in an open state", async() => {
        const poolId = pools[0].poolId;
        const bondedPoolsData = await api.query.nominationPools.bondedPools(poolId);
        const { state } = JSON.parse(bondedPoolsData.toString());
        expect(state == "Open", "Selector should only get open pools");
    });

    it("should only get pools with a minimum of the specified validators", async() => {
        const data = await api.query.staking.nominators(pools[0].poolStashAccountId);
        const { targets } = JSON.parse(data.toString());
        expect(targets.length >= minValidators, `Should have at least ${minValidators} validators`);
    });

    it("should be able to check a current selection", async() => {
        // TODO specify an era where a specific pool meets the criteria perfectly and one where it doesn't
        poolSelector.era = 900;
        expect(await poolSelector.getPoolInfoAndMatchById(1), "Pool 1 should meet the criteria in this era");
        expect(!(await poolSelector.getPoolInfoAndMatchById(2)), "Pool 2 should not meet the criteria in this era");
    });

    it("should be able to skip validator checking", async() => {
        poolSelector.checkValidators = false;
        const pools = await poolSelector.getPoolsMeetingCriteria();
        expect(pools.length > 0, "should be able to get pools without validator check");
    })

});