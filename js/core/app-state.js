import {getStoredUser, saveUser} from './auth-storage.js';

export const KEYS={
  wallet:'voltdrive_wallet',
  cards:'voltdrive_cards',
  transactions:'voltdrive_wallet_transactions',
  reservations:'voltdrive_reservations',
  activeReservation:'voltdrive_active_reservation',
  sessions:'voltdrive_sessions',
  lastSession:'voltdrive_last_session',
  notifications:'voltdrive_notifications'
};

export function readJson(key,fallback=null){try{const raw=localStorage.getItem(key);return raw===null?fallback:JSON.parse(raw)}catch{return fallback}}
export function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value));window.dispatchEvent(new CustomEvent('voltdrive:state',{detail:{key,value}}));return value}
export function getUser(){return getStoredUser()||{name:'VoltDrive Driver',email:'driver@voltdrive.am',currency:'AMD'}}
export function getVehicles(){const user=getUser();const fallback={id:'vehicle-primary',manufacturer:'Tesla',model:'Model Y',registration:'35 EV 777',batteryCapacity:75,batteryLevel:68,connector:'CCS2',chargingLimit:80,plugAndCharge:true};return Array.isArray(user.vehicles)&&user.vehicles.length?user.vehicles:[user.vehicle||fallback]}
export function getActiveVehicle(){const user=getUser(),list=getVehicles();return list.find(v=>v.id===user.activeVehicleId)||list[0]}
export function saveVehicles(list,activeId){const user=getUser();const active=list.find(v=>v.id===activeId)||list[0];saveUser({...user,vehicles:list,activeVehicleId:active?.id,vehicle:active});window.dispatchEvent(new CustomEvent('voltdrive:state',{detail:{key:'user'}}));return active}
export function getWallet(){return readJson(KEYS.wallet,{personal:14500,corporate:25000,promo:2000,autoTopup:true,threshold:5000,topupAmount:10000})}
export function saveWallet(wallet){return writeJson(KEYS.wallet,wallet)}
export function getReservations(){return readJson(KEYS.reservations,[])}
export function getActiveReservation(){const list=getReservations();return list.find(r=>['confirmed','active'].includes(r.status))||readJson(KEYS.activeReservation,null)}
export function getSessions(){const sessions=readJson(KEYS.sessions,[]);const last=readJson(KEYS.lastSession,null);if(last&&!sessions.some(s=>s.id===last.id||s.completedAt===last.completedAt))return [last,...sessions];return sessions}
export function addSession(session){const normalized={id:session.id||`CS-${Date.now().toString().slice(-7)}`,...session};const list=[normalized,...readJson(KEYS.sessions,[]).filter(x=>x.id!==normalized.id)];writeJson(KEYS.sessions,list);writeJson(KEYS.lastSession,normalized);return normalized}
export function addTransaction(transaction){const item={id:transaction.id||`TX-${Date.now().toString().slice(-6)}`,...transaction};writeJson(KEYS.transactions,[item,...readJson(KEYS.transactions,[])]);return item}
export function addNotification(notification){const item={id:notification.id||`NT-${Date.now().toString().slice(-8)}`,timestamp:Date.now(),time:'Just now',read:false,priority:'normal',...notification};writeJson(KEYS.notifications,[item,...readJson(KEYS.notifications,[])]);return item}
export function unreadNotifications(){return readJson(KEYS.notifications,[]).filter(n=>!n.read).length}
export function syncCommonUi(root=document){const user=getUser(),vehicle=getActiveVehicle(),wallet=getWallet(),unread=unreadNotifications();const text=(selector,value)=>root.querySelectorAll(selector).forEach(n=>n.textContent=value);text('#sidebar-name',user.name||'VoltDrive Driver');text('#sidebar-email',user.email||'driver@voltdrive.am');text('#avatar',(user.name||'VD').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase());text('#vehicle-selector',`${vehicle.manufacturer||'Tesla'} ${vehicle.model||'Model Y'}`);text('#header-wallet-balance',`${Number(wallet.personal||0).toLocaleString()} ${user.currency||'AMD'}`);root.querySelectorAll('#sidebar-notification-count').forEach(n=>{n.textContent=String(unread);n.style.display=unread?'grid':'none'});root.querySelectorAll('#header-notification-dot').forEach(n=>n.style.display=unread?'block':'none')}
