export const isEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export function passwordScore(value){let score=0;if(value.length>=8)score++;if(/[A-Z]/.test(value)&&/[a-z]/.test(value))score++;if(/\d/.test(value))score++;if(/[^A-Za-z0-9]/.test(value))score++;return score}
export function setFieldError(input,message='This field is required.'){const field=input.closest('.field');if(!field)return;field.classList.add('is-invalid');const error=field.querySelector('.field__error');if(error)error.textContent=message}
export function clearFieldError(input){input.closest('.field')?.classList.remove('is-invalid')}
export function setupPasswordToggles(){document.querySelectorAll('[data-password-toggle]').forEach(button=>button.addEventListener('click',()=>{const input=document.getElementById(button.dataset.passwordToggle);if(!input)return;input.type=input.type==='password'?'text':'password';button.setAttribute('aria-label',input.type==='password'?'Show password':'Hide password')}))}
