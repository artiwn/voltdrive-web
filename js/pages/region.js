import{getStoredUser,saveUser}from'../core/auth-storage.js';
const form=document.querySelector('#region-form');const country=form.elements.country;const currency=document.querySelector('#region-currency');const tax=document.querySelector('#region-tax');
const regions={AM:{currency:'AMD',tax:'Armenia'},GE:{currency:'GEL',tax:'Georgia'},DE:{currency:'EUR',tax:'Germany'},FR:{currency:'EUR',tax:'France'},US:{currency:'USD',tax:'United States'}};
function update(){const region=regions[country.value];currency.textContent=region.currency;tax.textContent=region.tax}country.addEventListener('change',update);update();
form.addEventListener('submit',e=>{e.preventDefault();const user=getStoredUser()||{};saveUser({...user,country:country.value,language:form.elements.language.value,currency:regions[country.value].currency});window.location.href='./add-vehicle.html'});
