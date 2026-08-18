import { requireSession } from '../core/route-guard.js';
if (!requireSession()) throw new Error('Authentication required');

import { clearSession, saveUser, createSession } from '../core/auth-storage.js';
import {
  KEYS,
  readJson,
  writeJson,
  getUser,
  getActiveVehicle,
  getWallet,
  saveWallet,
  syncCommonUi
} from '../core/app-state.js';
import { initSidebar } from '../layout/sidebar.js';

initSidebar();
syncCommonUi();

const $ = selector => document.querySelector(selector);
const DEMO_CHARGER_KEY = 'voltdrive_demo_charger_status';
const PARKING_KEY = 'voltdrive_parking_session';

const baseReservation = status => ({
  id: 'RSV-DEMO-2026',
  number: 'RSV-DEMO-2026',
  locationId: 'yerevan-mall',
  location: 'Yerevan Mall EV Station',
  address: '34 Arshakunyats Avenue, Yerevan',
  arrival: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
  date: new Date(Date.now() + 45 * 60 * 1000).toISOString().slice(0, 10),
  time: new Date(Date.now() + 45 * 60 * 1000).toTimeString().slice(0, 5),
  duration: 60,
  target: 80,
  type: 'Any available charger',
  vehicle: vehicleName(),
  charger: status === 'active' ? 'C-101' : 'Assigned on arrival',
  bay: status === 'active' ? 'Bay 04' : '—',
  accessCode: '742918',
  fee: 500,
  estimate: 5300,
  status,
  createdAt: new Date().toISOString()
});

const baseSession = (status, paymentStatus = 'paid') => ({
  id: `CS-DEMO-${status.toUpperCase()}`,
  location: 'Yerevan Mall EV Station',
  address: '34 Arshakunyats Avenue, Yerevan',
  charger: 'C-101',
  connector: 'CCS2',
  power: status === 'active' ? 118 : 0,
  energy: status === 'active' ? 12.8 : 42.5,
  cost: status === 'active' ? 1536 : 5100,
  duration: status === 'active' ? 930 : 2520,
  battery: status === 'active' ? 58 : 80,
  startBattery: 42,
  endBattery: status === 'active' ? 58 : 80,
  status,
  paymentStatus,
  completedAt: new Date().toISOString()
});

function vehicleName() {
  const vehicle = getActiveVehicle();
  return `${vehicle?.manufacturer || 'Tesla'} ${vehicle?.model || 'Model Y'}`;
}

function setVehicleBattery(level) {
  const user = getUser();
  const vehicles = Array.isArray(user.vehicles) && user.vehicles.length
    ? user.vehicles.map(vehicle => ({ ...vehicle }))
    : [{ ...(user.vehicle || getActiveVehicle()) }];
  const activeId = user.activeVehicleId || vehicles[0]?.id;
  const updated = vehicles.map((vehicle, index) => {
    if ((activeId && vehicle.id === activeId) || (!activeId && index === 0)) {
      return { ...vehicle, batteryLevel: Number(level) };
    }
    return vehicle;
  });
  const active = updated.find(vehicle => vehicle.id === activeId) || updated[0];
  saveUser({ ...user, vehicles: updated, activeVehicleId: active?.id, vehicle: active });
}

function setReservation(status) {
  if (status === 'none') {
    writeJson(KEYS.reservations, []);
    localStorage.removeItem(KEYS.activeReservation);
    return;
  }
  const reservation = baseReservation(status);
  writeJson(KEYS.reservations, [reservation]);
  if (['confirmed', 'active'].includes(status)) writeJson(KEYS.activeReservation, reservation);
  else localStorage.removeItem(KEYS.activeReservation);
}

function setCharging(status) {
  if (status === 'none') {
    writeJson(KEYS.sessions, []);
    localStorage.removeItem(KEYS.lastSession);
    return;
  }
  let session;
  if (status === 'active') session = baseSession('active', 'preauthorized');
  else if (status === 'interrupted') session = baseSession('interrupted', 'pending');
  else if (status === 'pending') session = baseSession('completed', 'pending');
  else session = baseSession('completed', 'paid');
  writeJson(KEYS.sessions, [session]);
  writeJson(KEYS.lastSession, session);
}

function setParking(status) {
  if (status === 'none') {
    localStorage.removeItem(PARKING_KEY);
    return;
  }
  const isIdle = status === 'idle';
  writeJson(PARKING_KEY, {
    id: 'PK-DEMO-2026',
    location: 'Yerevan Mall EV Station',
    bay: 'Bay 04',
    charger: 'C-101',
    energy: 42.5,
    chargingCost: 5100,
    idleRate: 50,
    graceSeconds: isIdle ? 0 : 299,
    idleSeconds: isIdle ? 185 : 0,
    idleCost: isIdle ? 200 : 0,
    status,
    startedAt: new Date().toISOString()
  });
}

function setNotificationSet(kind) {
  const common = {
    timestamp: Date.now(),
    time: 'Just now',
    read: false,
    action: { label: 'Open details', href: './demo-controls.html' }
  };
  const map = {
    normal: [{ id: 'NT-DEMO-1', type: 'reservation', title: 'Reservation confirmed', message: 'Your demo reservation is ready.', priority: 'normal', ...common }],
    payment: [{ id: 'NT-DEMO-2', type: 'payment', title: 'Payment failed', message: 'The demo payment could not be completed.', priority: 'critical', ...common }],
    charger: [{ id: 'NT-DEMO-3', type: 'station', title: 'Charger unavailable', message: 'C-101 is offline in the current demo scenario.', priority: 'critical', ...common }]
  };
  writeJson(KEYS.notifications, map[kind] || map.normal);
}

function applySelections() {
  setVehicleBattery($('#demo-battery').value);
  const wallet = getWallet();
  wallet.personal = Number($('#demo-wallet').value);
  saveWallet(wallet);
  setReservation($('#demo-reservation').value);
  setCharging($('#demo-charging').value);
  setParking($('#demo-parking').value);
  localStorage.setItem(DEMO_CHARGER_KEY, $('#demo-charger').value);
  syncCommonUi();
  renderCurrentState();
  toast('Demo state applied.');
}

function applyScenario(name) {
  const scenarios = {
    fresh: { battery: 68, wallet: 14500, reservation: 'none', charging: 'none', parking: 'none', charger: 'available', notice: 'normal' },
    arrival: { battery: 42, wallet: 14500, reservation: 'active', charging: 'none', parking: 'none', charger: 'available', notice: 'normal' },
    charging: { battery: 42, wallet: 14500, reservation: 'active', charging: 'active', parking: 'none', charger: 'available', notice: 'normal' },
    parking: { battery: 80, wallet: 9400, reservation: 'none', charging: 'completed', parking: 'idle', charger: 'available', notice: 'normal' },
    'payment-failed': { battery: 80, wallet: 0, reservation: 'none', charging: 'pending', parking: 'grace', charger: 'available', notice: 'payment' },
    'charger-fault': { battery: 47, wallet: 14500, reservation: 'active', charging: 'interrupted', parking: 'none', charger: 'offline', notice: 'charger' }
  };
  const scenario = scenarios[name];
  if (!scenario) return;
  $('#demo-battery').value = String(scenario.battery);
  $('#demo-wallet').value = String(scenario.wallet);
  $('#demo-reservation').value = scenario.reservation;
  $('#demo-charging').value = scenario.charging;
  $('#demo-parking').value = scenario.parking;
  $('#demo-charger').value = scenario.charger;
  applySelections();
  setNotificationSet(scenario.notice);
  syncCommonUi();
  renderCurrentState();
  toast(`${eventLabel(name)} scenario loaded.`);
}

function eventLabel(value) {
  return value.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function renderCurrentState() {
  const vehicle = getActiveVehicle();
  const wallet = getWallet();
  const reservations = readJson(KEYS.reservations, []);
  const session = readJson(KEYS.lastSession, null);
  const parking = readJson(PARKING_KEY, null);
  const charger = localStorage.getItem(DEMO_CHARGER_KEY) || 'available';
  const notifications = readJson(KEYS.notifications, []);
  const rows = [
    ['Vehicle', `${vehicleName()} · ${Number(vehicle?.batteryLevel ?? 68)}%`],
    ['Wallet', `${Number(wallet.personal || 0).toLocaleString()} AMD`],
    ['Reservation', reservations[0]?.status || 'none'],
    ['Charging', session ? `${session.status} · ${session.paymentStatus || '—'}` : 'none'],
    ['Parking', parking?.status || 'none'],
    ['Charger', charger],
    ['Unread notifications', String(notifications.filter(item => !item.read).length)]
  ];
  $('#current-state-list').innerHTML = rows.map(([label, value]) => `<div class="state-row"><span>${label}</span><strong>${value}</strong></div>`).join('');
}

function resetDemoData() {
  Object.keys(localStorage).filter(key => key.startsWith('voltdrive_')).forEach(key => localStorage.removeItem(key));
  const user = {
    name: 'VoltDrive Driver',
    email: 'driver@voltdrive.am',
    currency: 'AMD',
    country: 'Armenia',
    language: 'English',
    activeVehicleId: 'vehicle-primary',
    vehicles: [{
      id: 'vehicle-primary',
      manufacturer: 'Tesla',
      model: 'Model Y',
      registration: '35 EV 777',
      batteryCapacity: 75,
      batteryLevel: 68,
      connector: 'CCS2',
      chargingLimit: 80,
      plugAndCharge: true,
      ownership: 'personal',
      isActive: true
    }]
  };
  user.vehicle = user.vehicles[0];
  saveUser(user);
  createSession(user);
  saveWallet({ personal: 14500, corporate: 25000, promo: 2000, autoTopup: true, threshold: 5000, topupAmount: 10000 });
  setReservation('confirmed');
  setCharging('completed');
  setParking('grace');
  localStorage.setItem(DEMO_CHARGER_KEY, 'available');
  setNotificationSet('normal');
  syncCommonUi();
  renderCurrentState();
  toast('Prototype data reset.');
}

function toast(message) {
  const node = $('#demo-toast');
  node.textContent = message;
  node.classList.add('is-visible');
  clearTimeout(window.demoToastTimer);
  window.demoToastTimer = setTimeout(() => node.classList.remove('is-visible'), 2300);
}

$('#apply-demo-state').addEventListener('click', applySelections);
$('#apply-and-dashboard').addEventListener('click', () => { applySelections(); location.href = './dashboard.html'; });
$('#refresh-state').addEventListener('click', renderCurrentState);
$('#reset-demo-data').addEventListener('click', resetDemoData);
document.querySelectorAll('[data-scenario]').forEach(button => button.addEventListener('click', () => applyScenario(button.dataset.scenario)));
$('#logout-button')?.addEventListener('click', () => { clearSession(); location.href = './login.html'; });

renderCurrentState();
