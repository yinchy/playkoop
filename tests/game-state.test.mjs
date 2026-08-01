import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  buySelectedCommodity,
  sellSelectedCommodity,
  selectPlanet,
  travelToSelectedPlanet,
  refuel,
  getTravelCost
} from '../game-state.js';

test('buying and selling updates credits, cargo, and stock', () => {
  const initial = createInitialState();
  const bought = buySelectedCommodity(initial);
  assert.equal(bought.cargo.Water, 1);
  assert.ok(bought.cash < initial.cash);
  assert.equal(bought.markets[bought.currentPlanet].Water.stock, initial.markets[initial.currentPlanet].Water.stock - 1);

  const sold = sellSelectedCommodity(bought);
  assert.equal(sold.cargo.Water, undefined);
  assert.equal(sold.cash, initial.cash);
  assert.equal(sold.markets[sold.currentPlanet].Water.stock, initial.markets[initial.currentPlanet].Water.stock);
});

test('travel consumes fuel when destination differs', () => {
  const initial = createInitialState();
  const targeted = selectPlanet(initial, 'Zaonce');
  const travelCost = getTravelCost(initial.currentPlanet, 'Zaonce');
  const traveled = travelToSelectedPlanet(targeted);

  assert.equal(traveled.currentPlanet, 'Zaonce');
  assert.equal(traveled.fuel, initial.fuel - travelCost);
});

test('refuel stops at max fuel and costs credits when fuel is missing', () => {
  const initial = { ...createInitialState(), fuel: 12 };
  const refueled = refuel(initial);
  assert.equal(refueled.fuel, 13);
  assert.equal(refueled.cash, initial.cash - 12);

  const toppedOff = refuel({ ...refueled, fuel: refueled.maxFuel });
  assert.equal(toppedOff.fuel, refueled.maxFuel);
  assert.equal(toppedOff.cash, refueled.cash);
});
