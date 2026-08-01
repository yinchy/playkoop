export const COMMODITIES = [
  { name: 'Water', basePrice: 18 },
  { name: 'Food', basePrice: 30 },
  { name: 'Ore', basePrice: 65 },
  { name: 'Medicine', basePrice: 120 },
  { name: 'Tech', basePrice: 220 }
];

export const PLANETS = [
  { name: 'Lave', color: '#5cb85c', position: [-3.8, 0.2, -2.6], profile: { Water: 0.7, Food: 1.1, Ore: 1.25, Medicine: 0.95, Tech: 1.2 } },
  { name: 'Zaonce', color: '#e67e22', position: [4.4, -0.4, -1.2], profile: { Water: 1.25, Food: 1.15, Ore: 0.85, Medicine: 0.9, Tech: 0.75 } },
  { name: 'Tionisla', color: '#3498db', position: [1.6, 1.8, 3.6], profile: { Water: 1.1, Food: 0.85, Ore: 1.1, Medicine: 0.8, Tech: 0.95 } },
  { name: 'Riedquat', color: '#9b59b6', position: [-4.7, -1.1, 2.8], profile: { Water: 1.35, Food: 1.25, Ore: 0.7, Medicine: 1.15, Tech: 1.3 } },
  { name: 'Leesti', color: '#f1c40f', position: [0.1, -2.1, 0.4], profile: { Water: 0.95, Food: 0.9, Ore: 1.05, Medicine: 1.05, Tech: 0.9 } }
];

function createMarket(profile) {
  return COMMODITIES.reduce((market, commodity) => {
    const modifier = profile[commodity.name] ?? 1;
    market[commodity.name] = {
      price: Math.round(commodity.basePrice * modifier),
      stock: Math.max(4, Math.round(14 / modifier))
    };
    return market;
  }, {});
}

export function createInitialState() {
  const currentPlanet = PLANETS[0].name;
  const selectedCommodity = COMMODITIES[0].name;
  return {
    cash: 1000,
    fuel: 14,
    maxFuel: 14,
    cargoCapacity: 18,
    cargo: {},
    currentPlanet,
    selectedPlanet: currentPlanet,
    selectedCommodity,
    message: 'Welcome, commander. Trade smart and stay fueled.',
    markets: PLANETS.reduce((allMarkets, planet) => {
      allMarkets[planet.name] = createMarket(planet.profile);
      return allMarkets;
    }, {})
  };
}

export function getCargoUsed(state) {
  return Object.values(state.cargo).reduce((sum, amount) => sum + amount, 0);
}

export function getCargoFree(state) {
  return state.cargoCapacity - getCargoUsed(state);
}

export function getCurrentMarket(state) {
  return state.markets[state.currentPlanet];
}

export function getSelectedMarket(state) {
  return state.markets[state.selectedPlanet];
}

export function selectPlanet(state, planetName) {
  return PLANETS.some((planet) => planet.name === planetName)
    ? { ...state, selectedPlanet: planetName, message: `Targeting ${planetName}.` }
    : state;
}

export function cyclePlanet(state, direction) {
  const currentIndex = PLANETS.findIndex((planet) => planet.name === state.selectedPlanet);
  const nextIndex = (currentIndex + direction + PLANETS.length) % PLANETS.length;
  return selectPlanet(state, PLANETS[nextIndex].name);
}

export function selectCommodity(state, commodityName) {
  return COMMODITIES.some((commodity) => commodity.name === commodityName)
    ? { ...state, selectedCommodity: commodityName, message: `Tracking ${commodityName.toLowerCase()} prices.` }
    : state;
}

export function cycleCommodity(state, direction) {
  const currentIndex = COMMODITIES.findIndex((commodity) => commodity.name === state.selectedCommodity);
  const nextIndex = (currentIndex + direction + COMMODITIES.length) % COMMODITIES.length;
  return selectCommodity(state, COMMODITIES[nextIndex].name);
}

export function getTravelCost(fromPlanetName, toPlanetName) {
  const from = PLANETS.find((planet) => planet.name === fromPlanetName);
  const to = PLANETS.find((planet) => planet.name === toPlanetName);
  if (!from || !to) {
    return Infinity;
  }

  const dx = from.position[0] - to.position[0];
  const dy = from.position[1] - to.position[1];
  const dz = from.position[2] - to.position[2];
  return Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy + dz * dz) / 2.6));
}

export function travelToSelectedPlanet(state) {
  if (state.selectedPlanet === state.currentPlanet) {
    return { ...state, message: `${state.currentPlanet} is your current world.` };
  }

  const fuelCost = getTravelCost(state.currentPlanet, state.selectedPlanet);
  if (fuelCost > state.fuel) {
    return { ...state, message: `Need ${fuelCost} fuel to reach ${state.selectedPlanet}.` };
  }

  return {
    ...state,
    currentPlanet: state.selectedPlanet,
    fuel: state.fuel - fuelCost,
    message: `Jumped to ${state.selectedPlanet} for ${fuelCost} fuel.`
  };
}

export function buySelectedCommodity(state) {
  const commodityName = state.selectedCommodity;
  const market = getCurrentMarket(state)[commodityName];
  const price = market.price;
  const available = market.stock;
  const freeSpace = getCargoFree(state);

  if (available < 1) {
    return { ...state, message: `${commodityName} is sold out on ${state.currentPlanet}.` };
  }
  if (freeSpace < 1) {
    return { ...state, message: 'Your cargo hold is full.' };
  }
  if (state.cash < price) {
    return { ...state, message: `Not enough credits for ${commodityName}.` };
  }

  return {
    ...state,
    cash: state.cash - price,
    cargo: {
      ...state.cargo,
      [commodityName]: (state.cargo[commodityName] ?? 0) + 1
    },
    markets: {
      ...state.markets,
      [state.currentPlanet]: {
        ...state.markets[state.currentPlanet],
        [commodityName]: {
          ...market,
          stock: market.stock - 1
        }
      }
    },
    message: `Bought 1 ${commodityName} for ${price} cr.`
  };
}

export function sellSelectedCommodity(state) {
  const commodityName = state.selectedCommodity;
  const owned = state.cargo[commodityName] ?? 0;
  const market = getCurrentMarket(state)[commodityName];
  const price = market.price;

  if (owned < 1) {
    return { ...state, message: `No ${commodityName} in your hold.` };
  }

  const updatedCargo = { ...state.cargo, [commodityName]: owned - 1 };
  if (updatedCargo[commodityName] === 0) {
    delete updatedCargo[commodityName];
  }

  return {
    ...state,
    cash: state.cash + price,
    cargo: updatedCargo,
    markets: {
      ...state.markets,
      [state.currentPlanet]: {
        ...state.markets[state.currentPlanet],
        [commodityName]: {
          ...market,
          stock: market.stock + 1
        }
      }
    },
    message: `Sold 1 ${commodityName} for ${price} cr.`
  };
}

export function refuel(state) {
  if (state.fuel >= state.maxFuel) {
    return { ...state, message: 'Fuel tanks are already full.' };
  }
  if (state.cash < 12) {
    return { ...state, message: 'Not enough credits to refuel.' };
  }

  return {
    ...state,
    fuel: Math.min(state.maxFuel, state.fuel + 1),
    cash: state.cash - 12,
    message: 'Purchased 1 fuel for 12 cr.'
  };
}
