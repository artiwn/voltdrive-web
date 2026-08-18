import {getStoredUser, saveUser} from '../core/auth-storage.js';

const select = document.querySelector('#vehicle-selector');

if (select instanceof HTMLSelectElement) {
  const user = getStoredUser() || {};
  const fallback = user.vehicle ? [user.vehicle] : [];
  const vehicles = Array.isArray(user.vehicles) && user.vehicles.length
    ? user.vehicles
    : fallback;

  const getVehicleId = (vehicle, index) =>
    vehicle.id || `vehicle-${index + 1}`;

  if (!vehicles.length) {
    select.innerHTML = '<option value="">Add vehicle</option>';
    select.addEventListener('change', () => {
      window.location.href = './vehicles.html';
    });
  } else {
    select.innerHTML = vehicles.map((vehicle, index) => {
      const id = getVehicleId(vehicle, index);
      const label = `${vehicle.manufacturer || 'Vehicle'} ${vehicle.model || ''}`.trim();
      return `<option value="${id}">${label}</option>`;
    }).join('');

    const activeId = user.activeVehicleId
      || getVehicleId(vehicles.find(vehicle => vehicle.isActive) || vehicles[0], 0);
    select.value = activeId;

    select.addEventListener('change', () => {
      const selectedIndex = vehicles.findIndex((vehicle, index) =>
        getVehicleId(vehicle, index) === select.value);
      if (selectedIndex < 0) return;

      const updatedVehicles = vehicles.map((vehicle, index) => ({
        ...vehicle,
        id: getVehicleId(vehicle, index),
        isActive: index === selectedIndex
      }));
      const activeVehicle = updatedVehicles[selectedIndex];

      saveUser({
        ...user,
        vehicles: updatedVehicles,
        activeVehicleId: activeVehicle.id,
        vehicle: activeVehicle
      });

      window.dispatchEvent(new CustomEvent('voltdrive:state', {
        detail: {key: 'activeVehicle', value: activeVehicle}
      }));
      window.location.reload();
    });
  }
}
