import * as THREE from 'three';
import { OrbitControls } from './node_modules/three/examples/jsm/controls/OrbitControls.js';
import { VRButton } from './node_modules/three/examples/jsm/webxr/VRButton.js';
import {
  COMMODITIES,
  PLANETS,
  createInitialState,
  cycleCommodity,
  cyclePlanet,
  getCargoFree,
  getCargoUsed,
  getCurrentMarket,
  getTravelCost,
  refuel,
  selectCommodity,
  selectPlanet,
  travelToSelectedPlanet,
  buySelectedCommodity,
  sellSelectedCommodity
} from './game-state.js';

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="hud">
    <header>
      <div>
        <p class="eyebrow">PlayKoop</p>
        <h1>3D Space Trader</h1>
      </div>
      <p class="tagline">Trade between worlds on mobile, desktop, or in a VR headset.</p>
    </header>
    <div class="hud-grid">
      <section class="panel status-panel">
        <h2>Commander</h2>
        <dl id="status"></dl>
        <p id="message" class="message"></p>
      </section>
      <section class="panel controls-panel">
        <h2>Flight Deck</h2>
        <label>
          Destination
          <select id="planet-select"></select>
        </label>
        <div class="button-row">
          <button type="button" data-action="travel">Travel</button>
          <button type="button" data-action="refuel">Refuel</button>
        </div>
        <label>
          Commodity
          <select id="commodity-select"></select>
        </label>
        <div class="button-row">
          <button type="button" data-action="buy">Buy</button>
          <button type="button" data-action="sell">Sell</button>
        </div>
      </section>
      <section class="panel market-panel">
        <div class="market-header">
          <div>
            <h2>Current Market</h2>
            <p id="current-planet-label"></p>
          </div>
          <div>
            <h2>Target Route</h2>
            <p id="route-label"></p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Commodity</th><th>Price</th><th>Stock</th><th>In Hold</th></tr>
            </thead>
            <tbody id="market-body"></tbody>
          </table>
        </div>
      </section>
    </div>
    <p class="hint">Tap planets or use VR controllers to select a world. In XR, the floating cockpit panel mirrors the controls.</p>
  </div>
  <canvas id="scene"></canvas>
`;

const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(VRButton.createButton(renderer));

const scene = new THREE.Scene();
scene.background = new THREE.Color('#020611');
scene.fog = new THREE.Fog('#020611', 12, 40);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 4.8, 11);
scene.add(camera);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.5, 0);
controls.minDistance = 6;
controls.maxDistance = 18;
controls.maxPolarAngle = Math.PI / 2.05;

const ambientLight = new THREE.HemisphereLight('#d7edff', '#09101f', 1.4);
scene.add(ambientLight);

const sunLight = new THREE.PointLight('#ffffff', 2.8, 40);
sunLight.position.set(0, 4, 0);
scene.add(sunLight);

const starGeometry = new THREE.BufferGeometry();
const starVertices = [];
for (let i = 0; i < 1200; i += 1) {
  starVertices.push((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60);
}
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
const starField = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: '#c7dcff', size: 0.06 }));
scene.add(starField);

const sun = new THREE.Mesh(
  new THREE.SphereGeometry(1.3, 32, 32),
  new THREE.MeshBasicMaterial({ color: '#ffcc66' })
);
sun.position.y = 1;
scene.add(sun);

const planetGroup = new THREE.Group();
scene.add(planetGroup);

const planetMeshes = new Map();
const selectionRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.82, 0.04, 16, 60),
  new THREE.MeshBasicMaterial({ color: '#7dd3fc' })
);
selectionRing.rotation.x = Math.PI / 2;
selectionRing.visible = false;
scene.add(selectionRing);

const currentWorldGlow = new THREE.Mesh(
  new THREE.TorusGeometry(1.05, 0.06, 16, 60),
  new THREE.MeshBasicMaterial({ color: '#facc15' })
);
currentWorldGlow.rotation.x = Math.PI / 2;
scene.add(currentWorldGlow);

PLANETS.forEach((planet, index) => {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.55 + index * 0.04, 32, 32),
    new THREE.MeshStandardMaterial({ color: planet.color, emissive: planet.color, emissiveIntensity: 0.18, metalness: 0.1, roughness: 0.85 })
  );
  mesh.position.set(...planet.position);
  mesh.userData = { type: 'planet', name: planet.name };
  planetGroup.add(mesh);
  planetMeshes.set(planet.name, mesh);

  const label = createTextSprite(planet.name);
  label.position.set(planet.position[0], planet.position[1] + 1, planet.position[2]);
  planetGroup.add(label);
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const interactiveObjects = [];

const cockpit = new THREE.Group();
cockpit.position.set(0, -0.55, -1.7);
camera.add(cockpit);

const cockpitPanel = new THREE.Mesh(
  new THREE.PlaneGeometry(1.7, 1.9),
  new THREE.MeshBasicMaterial({ color: '#07111f', transparent: true, opacity: 0.8 })
);
cockpitPanel.position.set(0, 0, -0.02);
cockpit.add(cockpitPanel);

const cockpitStatus = createCanvasPlane(512, 300, 1.45, 0.9);
cockpitStatus.mesh.position.set(0, 0.45, 0);
cockpit.add(cockpitStatus.mesh);

const buttonSpecs = [
  { label: 'Prev World', position: [-0.42, -0.18, 0], action: () => applyState((state) => cyclePlanet(state, -1)) },
  { label: 'Next World', position: [0.42, -0.18, 0], action: () => applyState((state) => cyclePlanet(state, 1)) },
  { label: 'Travel', position: [0, -0.52, 0], action: () => applyState(travelToSelectedPlanet), accent: '#0f766e' },
  { label: 'Prev Cargo', position: [-0.42, -0.88, 0], action: () => applyState((state) => cycleCommodity(state, -1)) },
  { label: 'Next Cargo', position: [0.42, -0.88, 0], action: () => applyState((state) => cycleCommodity(state, 1)) },
  { label: 'Buy', position: [-0.42, -1.22, 0], action: () => applyState(buySelectedCommodity), accent: '#1d4ed8' },
  { label: 'Sell', position: [0.42, -1.22, 0], action: () => applyState(sellSelectedCommodity), accent: '#b45309' },
  { label: 'Refuel', position: [0, -1.56, 0], action: () => applyState(refuel), accent: '#7c3aed' }
];

buttonSpecs.forEach((spec) => {
  const button = createButtonPlane(spec.label, spec.accent);
  button.position.set(...spec.position);
  button.userData = { type: 'button', action: spec.action };
  cockpit.add(button);
  interactiveObjects.push(button);
});

const statusNode = document.querySelector('#status');
const messageNode = document.querySelector('#message');
const planetSelect = document.querySelector('#planet-select');
const commoditySelect = document.querySelector('#commodity-select');
const currentPlanetLabel = document.querySelector('#current-planet-label');
const routeLabel = document.querySelector('#route-label');
const marketBody = document.querySelector('#market-body');

PLANETS.forEach((planet) => {
  const option = document.createElement('option');
  option.value = planet.name;
  option.textContent = planet.name;
  planetSelect.append(option);
});

COMMODITIES.forEach((commodity) => {
  const option = document.createElement('option');
  option.value = commodity.name;
  option.textContent = commodity.name;
  commoditySelect.append(option);
});

let state = createInitialState();

planetSelect.addEventListener('change', (event) => {
  applyState((currentState) => selectPlanet(currentState, event.target.value));
});

commoditySelect.addEventListener('change', (event) => {
  applyState((currentState) => selectCommodity(currentState, event.target.value));
});

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action === 'travel') {
      applyState(travelToSelectedPlanet);
    } else if (action === 'refuel') {
      applyState(refuel);
    } else if (action === 'buy') {
      applyState(buySelectedCommodity);
    } else if (action === 'sell') {
      applyState(sellSelectedCommodity);
    }
  });
});

renderer.domElement.addEventListener('pointerdown', (event) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects([...planetMeshes.values(), ...interactiveObjects], false)[0];
  handleIntersection(hit);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

setupControllers();
renderUi();
renderer.setAnimationLoop(() => {
  controls.update();
  sun.rotation.y += 0.0015;
  starField.rotation.y += 0.00018;
  planetGroup.children.forEach((child, index) => {
    if (child.isMesh && child.userData.type === 'planet') {
      child.rotation.y += 0.004 + index * 0.0005;
    }
  });
  renderer.render(scene, camera);
});

function applyState(updater) {
  state = updater(state);
  renderUi();
}

function renderUi() {
  planetSelect.value = state.selectedPlanet;
  commoditySelect.value = state.selectedCommodity;
  const routeFuel = getTravelCost(state.currentPlanet, state.selectedPlanet);
  const cargoUsed = getCargoUsed(state);
  const cargoFree = getCargoFree(state);

  statusNode.innerHTML = [
    ['Credits', `${state.cash} cr`],
    ['Fuel', `${state.fuel}/${state.maxFuel}`],
    ['Cargo', `${cargoUsed}/${state.cargoCapacity}`],
    ['Free Hold', `${cargoFree}`],
    ['Current World', state.currentPlanet],
    ['Selected Trade', state.selectedCommodity]
  ].map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join('');

  messageNode.textContent = state.message;
  currentPlanetLabel.textContent = `${state.currentPlanet} market overview`;
  routeLabel.textContent = state.selectedPlanet === state.currentPlanet
    ? 'Already in orbit'
    : `${state.selectedPlanet} · ${routeFuel} fuel jump`;

  const currentMarket = getCurrentMarket(state);
  marketBody.innerHTML = COMMODITIES.map((commodity) => {
    const item = currentMarket[commodity.name];
    return `<tr class="${commodity.name === state.selectedCommodity ? 'selected' : ''}">
      <td>${commodity.name}</td>
      <td>${item.price} cr</td>
      <td>${item.stock}</td>
      <td>${state.cargo[commodity.name] ?? 0}</td>
    </tr>`;
  }).join('');

  const selectedMesh = planetMeshes.get(state.selectedPlanet);
  const currentMesh = planetMeshes.get(state.currentPlanet);
  if (selectedMesh) {
    selectionRing.visible = true;
    selectionRing.position.set(selectedMesh.position.x, selectedMesh.position.y - 0.72, selectedMesh.position.z);
  }
  if (currentMesh) {
    currentWorldGlow.position.set(currentMesh.position.x, currentMesh.position.y - 0.92, currentMesh.position.z);
  }

  drawCockpitStatus(routeFuel);
}

function drawCockpitStatus(routeFuel) {
  const { context, texture } = cockpitStatus;
  context.clearRect(0, 0, 512, 300);
  context.fillStyle = '#07111f';
  context.fillRect(0, 0, 512, 300);
  context.fillStyle = '#8ec5ff';
  context.font = 'bold 28px system-ui';
  context.fillText('PlayKoop Trade Console', 24, 40);
  context.fillStyle = '#dbeafe';
  context.font = '22px system-ui';
  context.fillText(`World: ${state.currentPlanet}`, 24, 88);
  context.fillText(`Target: ${state.selectedPlanet} (${routeFuel} fuel)`, 24, 122);
  context.fillText(`Cargo: ${state.selectedCommodity}`, 24, 156);
  context.fillText(`Credits: ${state.cash}   Fuel: ${state.fuel}/${state.maxFuel}`, 24, 190);
  context.fillStyle = '#fde68a';
  context.fillText(state.message, 24, 246, 460);
  texture.needsUpdate = true;
}

function handleIntersection(hit) {
  if (!hit) {
    return;
  }

  const target = hit.object;
  if (target.userData.type === 'planet') {
    applyState((currentState) => selectPlanet(currentState, target.userData.name));
  } else if (target.userData.type === 'button') {
    target.userData.action();
  }
}

function setupControllers() {
  for (let index = 0; index < 2; index += 1) {
    const controller = renderer.xr.getController(index);
    controller.userData.raycaster = new THREE.Raycaster();
    controller.addEventListener('selectstart', () => {
      const tempMatrix = new THREE.Matrix4();
      tempMatrix.identity().extractRotation(controller.matrixWorld);
      controller.userData.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      controller.userData.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
      const hit = controller.userData.raycaster.intersectObjects([...planetMeshes.values(), ...interactiveObjects], false)[0];
      handleIntersection(hit);
    });

    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -2)]),
      new THREE.LineBasicMaterial({ color: '#ffffff' })
    );
    controller.add(line);
    scene.add(controller);
  }
}

function createTextSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  context.fillStyle = 'rgba(2, 6, 17, 0.75)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#ffffff';
  context.font = '600 30px system-ui';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.9, 0.72, 1);
  return sprite;
}

function createCanvasPlane(width, height, scaleX, scaleY) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(scaleX, scaleY),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true })
  );
  return { canvas, context, texture, mesh };
}

function createButtonPlane(label, accent = '#1f2937') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  context.fillStyle = accent;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#dbeafe';
  context.lineWidth = 6;
  context.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
  context.fillStyle = '#ffffff';
  context.font = 'bold 30px system-ui';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  return new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.22),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true })
  );
}
