const { chai, expect } = require('chai');
import { ApiPromise, WsProvider } from "@polkadot/api";
import PoolSelector from "../src/PoolSelector";
const ValidatorSelector = require("dot-validator-selector/util/ValidatorSelector.js");

describe("ValidatorSelector functionality", () => {

    let poolSelector: PoolSelector;
    let api: ApiPromise;
    let era: Number;
    let pools;
    let validatorSelector;
    const minStake = 100000;
    const minSpots = 100;
    const minValidators = 12;
    const numberOfPools = 2;

    before(async() => {
        api = await ApiPromise.create({ provider: new WsProvider("wss://kusama.api.onfinality.io/ws?apikey=09f0165a-7632-408b-ba81-08f964b607f7") });
        poolSelector = new PoolSelector(minStake, minSpots, minValidators, numberOfPools, 0, api);
        pools = await poolSelector.getPoolsMeetingCriteria();
        era = await this.api.query.staking.activeEra();
        validatorSelector = new ValidatorSelector(api);
    });

    it("should only get pools where the root is verified", async() => {
        const firstPool = pools[0];
        const identity = await api.query.identity.identityOf(firstPool.rootAccountId);
        expect(!identity.isEmpty(), "Identity should not be empty");
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
        expect(exposure?.own.toNumber() >= minStake, "Root should meet staking requirements");
    });

    it("should exclude a pool with validators that don't meet the requirements", async() => {
        const nominatorsSelectedByPool = await api.query.staking.nominators(pools[0].accountId);
        for(let n of nominatorsSelectedByPool) {
            const meetsCriteria = await validatorSelector.getMeetsCriteriaByAccountId(n);
            expect(meetsCriteria, "Validator does not meet the criteria");
        }
    });

    it("should only get pools that are in an open state", async() => {
        const poolId = pools[0].poolNumber;
        const state = await api.query.nominationPools.bondedPools(poolId).state;
        expect(state == "Open", "Selector should only get open pools");
    });

    it("should only get pools with a minimum of the specified validators", async() => {
        const validatorsSelected = await api.query.staking.nominators(pools[0].poolAccountId);
        expect(validatorsSelected >= minValidators, `Should have at least ${minValidators} validators`);
    });

    it("should be able to check a current selection", async() => {
        // TODO specify an era where a specific pool meets the criteria perfectly and one where it doesn't
        const selector = new PoolSelector(minStake, minSpots, 1, 5, 900, api);
        expect(await selector.getSpecificPoolMeetsCriteria(10), "Pool 10 should meet the criteria");
        expect(!(await selector.getSpecificPoolMeetsCriteria(11)), "Pool 11 should not meet the criteria");
    });

});