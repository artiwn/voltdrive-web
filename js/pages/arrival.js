import{requireSession}from'../core/route-guard.js';
if(!requireSession())throw new Error('Authentication required');
import{clearSession}from'../core/auth-storage.js';
import{getActiveReservation,getActiveVehicle,getReservations,writeJson,KEYS,syncCommonUi,addNotification}from'../core/app-state.js';
import{initSidebar}from'../layout/sidebar.js';
initSidebar();syncCommonUi();
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const params=new URLSearchParams(location.search),requestedId=params.get('reservation');
const list=getReservations();
const reservation=list.find(r=>r.id===requestedId)||getActiveReservation()||list.find(r=>['confirmed','active'].includes(r.status));
const vehicle=getActiveVehicle();
const assignments={
'yerevan-mall':{charger:'C-101',connector:'CCS2',power:150,bay:'Bay 04',zone:'P1 · Green zone'},
'republic-square':{charger:'RS-202',connector:'CCS2',power:240,bay:'Bay 02',zone:'B1 · Central zone'},
'dalma':{charger:'DG-301',connector:'CCS2',power:120,bay:'Bay 07',zone:'Zone D'},
'northern-avenue':{charger:'NA-402',connector:'CCS2',power:180,bay:'Bay 03',zone:'B2 · Core B'}
};
const fallback={id:'R-204918',status:'confirmed',locationId:'yerevan-mall',location:'Yerevan Mall EV Station',address:'34 Arshakunyats Avenue, Yerevan',arrival:new Date(Date.now()+30*60000).toISOString(),target:80,accessCode:'742 918',charger:'Assigned on arrival',bay:'Bay 04'};
const current=reservation||fallback,assignment=assignments[current.locationId]||assignments['yerevan-mall'];
const set=(s,v)=>{const n=$(s);if(n)n.textContent=v};
const vehicleName=`${vehicle?.manufacturer||'Tesla'} ${vehicle?.model||'Model Y'}`;
set('#arrival-location',current.location||fallback.location);set('#arrival-address',current.address||fallback.address);set('#arrival-reservation',current.id||fallback.id);set('#arrival-vehicle',current.vehicle||vehicleName);set('#arrival-code',current.accessCode||'742 918');set('#side-access-code',current.accessCode||'742 918');set('#arrival-target',`${Number(current.target)||80}%`);set('#assigned-charger',current.charger&&current.charger!=='Assigned on arrival'?current.charger:assignment.charger);set('#assigned-connector',`${assignment.connector} · Up to ${assignment.power} kW`);set('#assigned-bay',current.bay&&current.bay!=='—'?current.bay:assignment.bay);set('#compatibility-copy',`${vehicle?.connector||assignment.connector} connector supported.`);set('#arrival-time',new Date(current.arrival||Date.now()).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}));
let seconds=15*60-1,timer;
function renderTimer(){const m=Math.max(0,Math.floor(seconds/60)),s=Math.max(0,seconds%60);set('#grace-countdown',`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);if(seconds<=0){clearInterval(timer);set('#arrival-status','Expired');$('#check-in-button').disabled=true;$('#check-in-button').textContent='Grace period expired'}seconds--}
renderTimer();timer=setInterval(renderTimer,1000);
function toast(message){const n=$('#arrival-toast');n.textContent=message;n.classList.add('is-visible');clearTimeout(window.arrivalToast);window.arrivalToast=setTimeout(()=>n.classList.remove('is-visible'),2200)}
$$('.access-method').forEach(button=>button.addEventListener('click',()=>{$$('.access-method').forEach(n=>n.classList.remove('is-selected'));button.classList.add('is-selected');const method=button.dataset.method;if(method==='qr')toast('QR scanner simulated successfully.');if(method==='rfid')toast('RFID card recognized.');if(method==='plug')toast('Plug & Charge certificate verified.')}));
$('#check-in-button').addEventListener('click',()=>{const charger=current.charger&&current.charger!=='Assigned on arrival'?current.charger:assignment.charger;const updated={...current,status:'active',charger,bay:current.bay&&current.bay!=='—'?current.bay:assignment.bay,checkedInAt:new Date().toISOString()};const next=[updated,...list.filter(r=>r.id!==updated.id)];writeJson(KEYS.reservations,next);writeJson(KEYS.activeReservation,updated);addNotification({type:'reservation',title:'Charger assigned',message:`${charger} is ready at ${current.location}. Continue to connect your vehicle.`,action:{label:'Start charging',href:`./charging.html?id=${current.locationId}&charger=${encodeURIComponent(charger)}`}});location.href=`./charging.html?id=${current.locationId||'yerevan-mall'}&charger=${encodeURIComponent(charger)}&arrival=1`});
$('#logout-button')?.addEventListener('click',()=>{clearSession();location.href='./login.html'});
