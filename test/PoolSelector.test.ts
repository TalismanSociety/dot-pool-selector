const { chai, expect } = require('chai');
import { ApiPromise, WsProvider } from "@polkadot/api";
import PoolSelector from "../src/PoolSelector";

describe("ValidatorSelector functionality", () => {

    let poolSelector: PoolSelector;
    let api: ApiPromise;
    const minStake = 100000;
    const minSpots = 100;
    const numberOfPools = 2;
    let pools;

    before(async() => {
        api = await ApiPromise.create({ provider: new WsProvider("wss://kusama.api.onfinality.io/ws?apikey=09f0165a-7632-408b-ba81-08f964b607f7") });
        poolSelector = new PoolSelector(minStake, minSpots, numberOfPools, api);
        pools = await poolSelector.getPoolsMeetingCriteria();
    });

    it("should only get pools where the root is verified", async() => {

    });

    it("should only get pools where the max member count has not been reached", async() => {

    });

    it("should only get pools where the root has skin in the game", async() => {

    });

    it("should exclude a pool with validators that don't meet the requirements", async() => {

    });

    it("should only get pools that are in an open state", async() => {

    });

    it("should only get pools with an optimal amount of validators", async() => {

    });

    it("should be able to check a current selection", async() => {

    });

});