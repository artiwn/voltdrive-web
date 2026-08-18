import { requireSession } from '../core/route-guard.js';
if (!requireSession()) throw new Error('Authentication required');

import { clearSession, getStoredUser } from '../core/auth-storage.js';
import {
  addSession,
  addTransaction,
  addNotification,
  getWallet,
  saveWallet,
  syncCommonUi,
  writeJson
} from '../core/app-state.js';
import { initSidebar } from '../layout/sidebar.js';

initSidebar();
syncCommonUi();

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const user = getStoredUser() || {
  name: 'VoltDrive Driver',
  email: 'driver@voltdrive.am',
  vehicle: { manufacturer: 'Tesla', model: 'Model Y', connector: 'CCS2' }
};
const vehicleName = `${user.vehicle?.manufacturer || 'Tesla'} ${user.vehicle?.model || 'Model Y'}`;

const locations = {
  'yerevan-mall': {
    name: 'Yerevan Mall EV Station',
    address: '34 Arshakunyats Avenue',
    price: 120,
    chargers: [
      { id: 'C-101', type: 'CCS2', power: 150 },
      { id: 'C-102', type: 'CCS2', power: 150 },
      { id: 'C-104', type: 'Type 2', power: 22 }
    ]
  },
  'republic-square': {
    name: 'Republic Square Charge Hub',
    address: '1 Republic Square',
    price: 135,
    chargers: [
      { id: 'RS-202', type: 'CCS2', power: 240 },
      { id: 'RS-204', type: 'CCS2', power: 180 }
    ]
  },
  dalma: {
    name: 'Dalma Garden Station',
    address: '3 Tsitsernakaberd Highway',
    price: 115,
    chargers: [
      { id: 'DG-301', type: 'CCS2', power: 120 },
      { id: 'DG-305', type: 'Type 2', power: 22 }
    ]
  }
};

let step = 1;
let selectedConnector = null;
let sessionTimer = null;
let elapsed = 0;
let energy = 0;
let battery = 42;
let activeErrorKey = null;

const errorScenarios = {
  offline: {
    icon: '×',
    status: 'Offline',
    title: 'Charger is currently offline',
    message: 'This charger stopped responding before authorization. No payment was taken.',
    details: [['Charger', 'C-101'], ['Last response', '2 min ago'], ['Payment', 'Not charged']],
    retry: 'Check again'
  },
  incompatible: {
    icon: '◇',
    status: 'Incompatible',
    title: 'Connector is not compatible',
    message: 'The selected connector does not match the active vehicle. Choose a CCS2 connector or another charger.',
    details: [['Vehicle', vehicleName], ['Vehicle connector', user.vehicle?.connector || 'CCS2'], ['Selected connector', 'CHAdeMO']],
    retry: 'Choose connector'
  },
  payment: {
    icon: '!',
    status: 'Payment failed',
    title: 'Preauthorization was declined',
    message: 'The 3,000 AMD preauthorization could not be completed. Update the payment method or use wallet balance.',
    details: [['Amount', '3,000 AMD'], ['Card', 'Visa •••• 4242'], ['Session', 'Not started']],
    retry: 'Try payment again'
  },
  connection: {
    icon: '⌁',
    status: 'Connection lost',
    title: 'Communication with charger was lost',
    message: 'The session is paused while VoltDrive reconnects. The charger has stopped delivering energy safely.',
    details: () => [['Last power', '86 kW'], ['Energy delivered', `${energy.toFixed(1)} kWh`], ['Safety state', 'Power stopped']],
    retry: 'Reconnect'
  },
  cable: {
    icon: '⌗',
    status: 'Cable locked',
    title: 'The charging cable is still locked',
    message: 'Charging has stopped, but the connector lock has not released. Keep the cable connected and try remote release.',
    details: () => [['Charger', selectedConnector?.id || 'C-101'], ['Connector', selectedConnector?.type || 'CCS2'], ['Power', '0 kW']],
    retry: 'Release cable'
  },
  interrupted: {
    icon: 'ϟ',
    status: 'Interrupted',
    title: 'Charging session was interrupted',
    message: 'Energy delivery stopped unexpectedly. You can retry this charger or save the incomplete session and choose another one.',
    details: () => [['Energy delivered', `${energy.toFixed(1)} kWh`], ['Current cost', `${Math.round(energy * currentLocation().price).toLocaleString()} AMD`], ['Payment', 'Pending final meter']],
    retry: 'Resume charging'
  },
  meter: {
    icon: '…',
    status: 'Settlement pending',
    title: 'Waiting for the final meter value',
    message: 'Charging has ended safely. The receipt and final payment will appear after the charger sends its closing meter value.',
    details: [['Session', 'Completed locally'], ['Payment', 'Pending'], ['Receipt', 'Preparing']],
    retry: 'Check status'
  }
};

const params = new URLSearchParams(location.search);
if (params.get('id') && locations[params.get('id')]) $('#location-select').value = params.get('id');
if (params.get('charger')) $('#charger-code').value = params.get('charger');

function set(selector, value) {
  const node = $(selector);
  if (node) node.textContent = value;
}

set('#sidebar-name', user.name || 'VoltDrive Driver');
set('#sidebar-email', user.email || 'driver@voltdrive.am');
set('#avatar', (user.name || 'VD').split(/\s+/).map(value => value[0]).join('').slice(0, 2).toUpperCase());
set('#summary-vehicle', vehicleName);

function currentLocation() {
  return locations[$('#location-select').value];
}

function toast(message) {
  const toastNode = $('#charging-toast');
  toastNode.textContent = message;
  toastNode.classList.add('is-visible');
  clearTimeout(window.chargeToast);
  window.chargeToast = setTimeout(() => toastNode.classList.remove('is-visible'), 2300);
}

function renderConnectors() {
  const locationData = currentLocation();
  $('#connector-grid').innerHTML = locationData.chargers.map((connector, index) => `
    <button type="button" class="connector-card ${index === 0 ? 'is-selected' : ''}" data-index="${index}">
      <span class="connector-card__top"><strong>${connector.id}</strong><span class="connector-status">Available</span></span>
      <small>${connector.type} · Up to ${connector.power} kW</small>
    </button>
  `).join('');
  selectedConnector = locationData.chargers[0];
  $$('.connector-card').forEach(card => card.addEventListener('click', () => {
    $$('.connector-card').forEach(node => node.classList.remove('is-selected'));
    card.classList.add('is-selected');
    selectedConnector = locationData.chargers[Number(card.dataset.index)];
    updateSummary();
  }));
  updateSummary();
}

function updateSummary() {
  const locationData = currentLocation();
  set('#summary-location', locationData.name);
  set('#summary-address', locationData.address);
  set('#summary-price', `${locationData.price} AMD/kWh`);
  set('#summary-connector', selectedConnector
    ? `${selectedConnector.type} · ${selectedConnector.power} kW`
    : (user.vehicle?.connector || 'CCS2'));
  set('#summary-target', `${$('#charge-limit')?.value || 80}%`);
}

function showStep(nextStep) {
  step = nextStep;
  $$('.charging-step').forEach(node => node.classList.toggle('is-active', Number(node.dataset.step) === step));
  $$('.charging-progress span').forEach((node, index) => node.classList.toggle('is-active', index < step));
  $('#previous-button').hidden = step === 1 || step === 4;
  $('#next-button').hidden = step === 4;
  $('#form-error').textContent = '';
  if (step === 2) renderConnectors();
  if (step === 3) {
    const locationData = currentLocation();
    set('#review-location', locationData.name);
    set('#review-charger', selectedConnector?.id || $('#charger-code').value);
    set('#review-connector', `${selectedConnector?.type || 'CCS2'} · ${selectedConnector?.power || 150} kW`);
    set('#review-price', `${locationData.price} AMD/kWh`);
  }
  if (step === 4) startConnecting();
}

function validate() {
  if (step === 1 && !$('#charger-code').value.trim()) {
    set('#form-error', 'Enter a charger code.');
    return false;
  }
  if (step === 3 && !$('#authorization-check').checked) {
    set('#form-error', 'Authorize the payment preauthorization to continue.');
    return false;
  }
  return true;
}

function startConnecting() {
  set('#charging-status-pill', 'Connecting');
  $('#charging-actions').hidden = true;
  setTimeout(() => {
    if (step !== 4 || activeErrorKey) return;
    $('#connecting-state').hidden = true;
    $('#active-session').hidden = false;
    set('#charging-status-pill', 'Charging');
    set('#charging-title', 'Active charging session');
    set('#charging-subtitle', 'Monitor energy, cost and estimated completion in real time.');
    set('#session-location', currentLocation().name);
    sessionTimer = setInterval(updateSession, 1000);
  }, 1800);
}

function updateSession() {
  elapsed += 1;
  const speed = Number($('#charging-speed').value);
  const power = Math.round((selectedConnector?.power || 150) * (0.58 + 0.08 * Math.sin(elapsed / 4)) * speed);
  energy += power / 3600;
  battery = Math.min(Number($('#charge-limit').value), 42 + energy / 0.78);
  const cost = Math.round(energy * currentLocation().price);
  set('#power-value', `${Math.max(8, power)} kW`);
  set('#energy-value', `${energy.toFixed(1)} kWh`);
  set('#cost-value', `${cost.toLocaleString()} AMD`);
  set('#duration-value', `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`);
  set('#battery-value', `${Math.floor(battery)}%`);
  $('#battery-track').style.width = `${battery}%`;
  const minutesLeft = Math.max(0, Math.round((Number($('#charge-limit').value) - battery) * 1.15));
  set('#completion-value', `${minutesLeft} min`);
  updateSummary();
}

function completeSession() {
  clearInterval(sessionTimer);
  const cost = Math.round(energy * currentLocation().price);
  $('#charging-progress').hidden = true;
  $('.charging-shell').hidden = true;
  $('.charging-intro').hidden = true;
  $('#charging-error-state').hidden = true;
  $('#charging-complete').hidden = false;
  set('#complete-energy', `${energy.toFixed(1)} kWh`);
  set('#complete-duration', `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`);
  set('#complete-battery', `${Math.floor(battery)}%`);
  set('#complete-cost', `${cost.toLocaleString()} AMD`);

  const session = addSession({
    location: currentLocation().name,
    address: 'Yerevan, Armenia',
    charger: selectedConnector?.id || $('#charger-code').value,
    connector: selectedConnector?.type || 'CCS2',
    energy: Number(energy.toFixed(1)),
    cost,
    duration: elapsed,
    battery: Math.floor(battery),
    startBattery: 42,
    endBattery: Math.floor(battery),
    status: 'completed',
    paymentStatus: 'paid',
    completedAt: new Date().toISOString()
  });

  writeJson('voltdrive_parking_session', {
    id: `PK-${Date.now().toString().slice(-7)}`,
    location: session.location,
    charger: session.charger,
    bay: 'Bay 04',
    energy: session.energy,
    chargingCost: session.cost,
    idleRate: 50,
    graceSeconds: 299,
    idleSeconds: 0,
    idleCost: 0,
    status: 'grace',
    startedAt: new Date().toISOString()
  });

  const wallet = getWallet();
  wallet.personal = Math.max(0, Number(wallet.personal || 0) - cost);
  saveWallet(wallet);
  addTransaction({
    type: 'payment',
    title: 'Charging payment',
    meta: `${session.location} · Just now`,
    amount: -cost,
    sessionId: session.id
  });
  addNotification({
    type: 'charging',
    title: 'Charging completed',
    message: `${session.energy.toFixed(1)} kWh delivered at ${session.location}. ${cost.toLocaleString()} AMD was paid.`,
    action: { label: 'View session', href: './activity.html' }
  });
  syncCommonUi();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function saveInterruptedSession() {
  const cost = Math.round(energy * currentLocation().price);
  addSession({
    location: currentLocation().name,
    address: 'Yerevan, Armenia',
    charger: selectedConnector?.id || $('#charger-code').value,
    connector: selectedConnector?.type || 'CCS2',
    energy: Number(energy.toFixed(1)),
    cost,
    duration: elapsed,
    battery: Math.floor(battery),
    startBattery: 42,
    endBattery: Math.floor(battery),
    status: 'interrupted',
    paymentStatus: 'pending',
    completedAt: new Date().toISOString()
  });
  addNotification({
    type: 'charging',
    title: 'Charging interrupted',
    message: `The session at ${currentLocation().name} stopped unexpectedly. Payment is pending final settlement.`,
    action: { label: 'View Activity', href: './activity.html' }
  });
  syncCommonUi();
}

function showErrorState(key) {
  const scenario = errorScenarios[key];
  if (!scenario) return;
  activeErrorKey = key;
  clearInterval(sessionTimer);
  $('#charging-demo-modal').hidden = true;
  $('.charging-shell').hidden = true;
  $('#charging-progress').hidden = true;
  $('#charging-complete').hidden = true;
  $('#charging-error-state').hidden = false;
  set('#charging-status-pill', scenario.status);
  set('#error-state-icon', scenario.icon);
  set('#error-state-title', scenario.title);
  set('#error-state-message', scenario.message);
  set('#error-retry-button', scenario.retry);
  const scenarioDetails = typeof scenario.details === 'function' ? scenario.details() : scenario.details;
  $('#error-state-details').innerHTML = scenarioDetails.map(([label, value]) => `
    <div><span>${label}</span><strong>${value}</strong></div>
  `).join('');
  $('#error-alternative-button').hidden = key === 'meter';
  if (key === 'interrupted') saveInterruptedSession();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeErrorState() {
  activeErrorKey = null;
  $('#charging-error-state').hidden = true;
  $('.charging-shell').hidden = false;
  $('#charging-progress').hidden = false;
  set('#charging-status-pill', step === 4 && !$('#active-session').hidden ? 'Charging' : 'Ready');
  if (step === 4 && !$('#active-session').hidden && !sessionTimer) sessionTimer = setInterval(updateSession, 1000);
}

function retryErrorState() {
  const key = activeErrorKey;
  closeErrorState();
  if (key === 'incompatible') showStep(2);
  else if (key === 'payment') showStep(3);
  else if (key === 'offline') showStep(1);
  else if (key === 'meter') toast('Final meter received. Receipt is now available.');
  else toast('Recovery command completed successfully.');
}

function openDemoModal() {
  $('#charging-demo-modal').hidden = false;
}
function closeDemoModal() {
  $('#charging-demo-modal').hidden = true;
}

$('#next-button').addEventListener('click', () => {
  if (validate()) showStep(Math.min(4, step + 1));
});
$('#previous-button').addEventListener('click', () => showStep(Math.max(1, step - 1)));
$('#location-select').addEventListener('change', () => {
  renderConnectors();
  updateSummary();
});
$('#scan-button').addEventListener('click', () => {
  toast('QR code recognized: C-101');
  $('#charger-code').value = 'C-101';
});
$('#charge-limit').addEventListener('change', updateSummary);
$('#stop-button').addEventListener('click', completeSession);
$('#simulate-interruption-button').addEventListener('click', () => showErrorState('interrupted'));
$('#support-button').addEventListener('click', () => { location.href = './support.html'; });
$('#receipt-button').addEventListener('click', () => { location.href = './receipt.html'; });
$('#new-session-button').addEventListener('click', () => location.reload());
$('#demo-errors-button').addEventListener('click', openDemoModal);
$$('[data-close-demo]').forEach(node => node.addEventListener('click', closeDemoModal));
$$('[data-error-scenario]').forEach(node => node.addEventListener('click', () => showErrorState(node.dataset.errorScenario)));
$('#error-retry-button').addEventListener('click', retryErrorState);
$('#error-close-button').addEventListener('click', closeErrorState);
$('#logout-button')?.addEventListener('click', () => {
  clearSession();
  location.href = './login.html';
});

renderConnectors();
showStep(1);
const demoChargerState = localStorage.getItem('voltdrive_demo_charger_status');
if (demoChargerState === 'offline') setTimeout(() => showErrorState('offline'), 0);
if (demoChargerState === 'faulty') setTimeout(() => showErrorState('connection'), 0);
