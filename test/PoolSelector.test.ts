const { chai, expect } = require('chai');
import { ApiPromise, WsProvider } from "@polkadot/api";
import PoolSelector from "../src/PoolSelector";
const ValidatorSelector = require("dot-validator-selector/util/ValidatorSelector.js");

describe("ValidatorSelector functionality", () => {

    let poolSelector: PoolSelector;
    let api: ApiPromise;
    let era: Number;
    let pools: any;
    let validatorSelector: any;
    const minStake = 100000;
    const minSpots = 100;
    const minValidators = 5;
    const numberOfPools = 2;

    before(async() => {
        api = await ApiPromise.create({ provider: new WsProvider("wss://kusama.api.onfinality.io/ws?apikey=09f0165a-7632-408b-ba81-08f964b607f7") });
        validatorSelector = new ValidatorSelector(api);
        poolSelector = new PoolSelector(
            minStake,
            minSpots,
            minValidators,
            numberOfPools,
            0,
            validatorSelector,
            api
        );
        pools = await poolSelector.getPoolsMeetingCriteria();
        const activeEra = await api.query.staking.activeEra()
        era = activeEra.toJSON().index;
    });

    it("should only get pools where the root is verified", async() => {
        const firstPool = pools[0];
        const identity = await api.query.identity.identityOf(firstPool.rootAccountId);
        expect(!identity.isEmpty, "Identity should not be empty");
    });

    it("should only get pools where the max member count has not been reached", async() => {
        const max = poolSelector.maxMembers;
        const membersOfFirstPool = await api.query.nominationPools.poolMembers(pools[0].accountId);
        expect(max > membersOfFirstPool, "Pool should not have reached the max member count");
    });

    it("should only get pools with the min amount of available spots specified", async() => {
        const max = poolSelector.maxMembers;
        const membersOfFirstPool = await api.query.nominationPools.poolMembers(pools[0].accountId);
        const spotsAvailable = max - membersOfFirstPool;
        expect(spotsAvailable >= minSpots, `Pool should have at least ${minSpots}`);
    });

    it("should only get pools where the root has skin in the game meeting the requirement set", async() => {
        const exposure = await api.query.staking.erasStakers(era, pools[0].rootAccountId);
        expect(exposure.toJSON().own.toNumber() >= minStake, "Root should meet staking requirements");
    });

    it("should exclude a pool with validators that don't meet the requirements", async() => {
        const n = await api.query.staking.nominators(pools[0].accountId);
        const nominatorsSelectedByPool = n.toJSON().targets;
        for(let n of nominatorsSelectedByPool) {
            const meetsCriteria = await validatorSelector.getMeetsCriteriaByAccountId(n);
            expect(meetsCriteria, "Validator does not meet the criteria");
        }
    });

    it("should only get pools that are in an open state", async() => {
        const poolId = pools[0].poolNumber;
        const state = await api.query.nominationPools.bondedPools(poolId);
        expect(state.toJSON().state == "Open", "Selector should only get open pools");
    });

    it("should only get pools with a minimum of the specified validators", async() => {
        const validatorsSelected = await api.query.staking.nominators(pools[0].poolAccountId);
        expect(validatorsSelected.toJSON().targets.length >= minValidators, `Should have at least ${minValidators} validators`);
    });

    it("should be able to check a current selection", async() => {
        // TODO specify an era where a specific pool meets the criteria perfectly and one where it doesn't
        poolSelector.era = 900;
        expect(await poolSelector.getMeetsCriteriaByPoolAccountId(""), "Pool x should meet the criteria");
        expect(!(await poolSelector.getMeetsCriteriaByPoolAccountId("")), "Pool y should not meet the criteria");
    });

});