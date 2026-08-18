import{requireSession}from'../core/route-guard.js';
if(!requireSession())throw new Error('Authentication required');
import{clearSession}from'../core/auth-storage.js';
import{getActiveVehicle,getReservations,writeJson,readJson,KEYS,syncCommonUi,addNotification}from'../core/app-state.js';
import{initSidebar}from'../layout/sidebar.js';
initSidebar();syncCommonUi();
const $=s=>document.querySelector(s);
const params=new URLSearchParams(location.search);
const locationId=params.get('id')||'yerevan-mall';
const stations={
'yerevan-mall':{name:'Yerevan Mall EV Station',address:'34 Arshakunyats Avenue, Yerevan',connector:'CCS2',compatible:3,power:150,charger:'C-101',bay:'Bay 04'},
'republic-square':{name:'Republic Square Charge Hub',address:'Republic Square, Yerevan',connector:'CCS2',compatible:2,power:240,charger:'RS-202',bay:'Bay 02'},
'dalma':{name:'Dalma Garden Station',address:'3 Tsitsernakaberd Highway, Yerevan',connector:'CCS2',compatible:2,power:120,charger:'DG-301',bay:'Bay 07'},
'northern-avenue':{name:'Northern Avenue Charging Point',address:'Northern Avenue, Yerevan',connector:'CCS2',compatible:1,power:180,charger:'NA-402',bay:'Bay 03'}
};
const station=stations[locationId]||stations['yerevan-mall'];
const vehicle=getActiveVehicle();
const waitingKey='voltdrive_waiting_list';
const existing=readJson(waitingKey,null);
let waiting=existing&&existing.locationId===locationId?existing:{id:`WL-${Date.now().toString().slice(-6)}`,locationId,location:station.name,position:2,total:4,status:'waiting',joinedAt:new Date().toISOString(),vehicleId:vehicle?.id,connector:vehicle?.connector||station.connector,target:Number(vehicle?.chargingLimit)||80};
writeJson(waitingKey,waiting);
const set=(selector,value)=>{const node=$(selector);if(node)node.textContent=value};
set('#waiting-location',station.name);set('#waiting-address',station.address);set('#queue-position',waiting.position);set('#queue-total',waiting.total);set('#queue-compatible',`${station.compatible} ${waiting.connector}`);set('#queue-vehicle',`${vehicle?.manufacturer||'Tesla'} ${vehicle?.model||'Model Y'}`);set('#request-connector',waiting.connector);set('#request-power','50 kW');set('#request-target',`${waiting.target}%`);set('#ready-charger',station.charger);set('#ready-connector',station.connector);set('#ready-power',`${station.power} kW`);set('#ready-bay',station.bay);$('#back-location').href=`./location-details.html?id=${locationId}`;
function waitCopy(position){return position<=1?'About 3–6 min':position===2?'12–18 min':`${position*7}–${position*10} min`}
function renderQueue(){set('#queue-position',waiting.position);set('#queue-total',waiting.total);set('#queue-wait',waitCopy(waiting.position));$('#queue-progress').style.width=`${Math.max(10,100-(waiting.position-1)*(100/Math.max(waiting.total,1)))}%`;const rows=[];for(let i=1;i<=waiting.total;i++){const isYou=i===waiting.position;rows.push(`<div class="queue-person ${isYou?'is-you':''}"><span class="queue-person__number">${i}</span><div class="queue-person__copy"><strong>${isYou?'You':`Driver ${String.fromCharCode(64+i)}`}</strong><small>${isYou?`${vehicle?.manufacturer||'Tesla'} ${vehicle?.model||'Model Y'}`:i<waiting.position?'Preparing to charge':'Waiting nearby'}</small></div><span class="queue-person__status">${isYou?'Your position':i<waiting.position?'Up next':'Waiting'}</span></div>`)}$('#queue-list').innerHTML=rows.join('')}
renderQueue();
function toast(message){const node=$('#waiting-toast');node.textContent=message;node.classList.add('is-visible');clearTimeout(window.waitingToast);window.waitingToast=setTimeout(()=>node.classList.remove('is-visible'),2200)}
$('#refresh-queue').addEventListener('click',()=>{if(waiting.position>1){waiting={...waiting,position:waiting.position-1,total:Math.max(waiting.position-1,waiting.total-1),updatedAt:new Date().toISOString()};writeJson(waitingKey,waiting);renderQueue();toast('Queue updated. You moved forward.')}else toast('You are first in line.')});
$('#edit-preference').addEventListener('click',()=>{const target=waiting.target===80?90:80;waiting={...waiting,target};writeJson(waitingKey,waiting);set('#request-target',`${target}%`);toast(`Target battery changed to ${target}%.`)});
let readySeconds=5*60,readyTimer;
function renderReadyTimer(){const m=Math.floor(Math.max(0,readySeconds)/60),s=Math.max(0,readySeconds)%60;set('#ready-countdown',`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);if(readySeconds<=0){clearInterval(readyTimer);$('#charger-ready-modal').hidden=true;waiting={...waiting,status:'waiting',position:1};writeJson(waitingKey,waiting);set('#queue-status','Waiting');toast('Offer expired. You remain first in line.')}readySeconds--}
function showReady(){waiting={...waiting,status:'offered',position:1,total:Math.max(1,waiting.total-1),charger:station.charger,bay:station.bay,offerExpiresAt:Date.now()+5*60000};writeJson(waitingKey,waiting);renderQueue();set('#queue-status','Charger ready');$('#charger-ready-modal').hidden=false;readySeconds=5*60;renderReadyTimer();clearInterval(readyTimer);readyTimer=setInterval(renderReadyTimer,1000);addNotification({type:'station',priority:'high',title:'Charger available',message:`${station.charger} is ready at ${station.name}. Confirm within 5 minutes.`,action:{label:'Open offer',href:`./waiting-list.html?id=${locationId}`}})}
$('#preview-available').addEventListener('click',showReady);
$('#decline-charger').addEventListener('click',()=>{clearInterval(readyTimer);$('#charger-ready-modal').hidden=true;waiting={...waiting,status:'waiting',position:1};writeJson(waitingKey,waiting);set('#queue-status','Waiting');toast('Offer declined. You remain in the queue.')});
$('#accept-charger').addEventListener('click',()=>{clearInterval(readyTimer);const reservation={id:`R-${Date.now().toString().slice(-6)}`,status:'confirmed',locationId,location:station.name,address:station.address,arrival:new Date().toISOString(),duration:60,target:waiting.target,vehicle:`${vehicle?.manufacturer||'Tesla'} ${vehicle?.model||'Model Y'}`,vehicleId:vehicle?.id,charger:station.charger,bay:station.bay,accessCode:String(Math.floor(100000+Math.random()*899999)).replace(/(\d{3})(\d{3})/,'$1 $2'),source:'waiting-list'};const reservations=getReservations();writeJson(KEYS.reservations,[reservation,...reservations.filter(item=>item.id!==reservation.id)]);writeJson(KEYS.activeReservation,reservation);localStorage.removeItem(waitingKey);addNotification({type:'reservation',title:'Charger accepted',message:`${station.charger} is reserved for you at ${station.name}.`,action:{label:'View arrival',href:`./arrival.html?reservation=${reservation.id}`}});location.href=`./arrival.html?reservation=${encodeURIComponent(reservation.id)}`});
$('#leave-queue').addEventListener('click',()=>{if(!confirm('Leave this waiting list?'))return;localStorage.removeItem(waitingKey);addNotification({type:'station',title:'Waiting list cancelled',message:`You left the queue at ${station.name}.`});location.href=`./location-details.html?id=${locationId}`});
$('#logout-button')?.addEventListener('click',()=>{clearSession();location.href='./login.html'});
