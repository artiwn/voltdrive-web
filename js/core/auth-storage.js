export const AUTH_USER_KEY='voltdrive_demo_user';
export const AUTH_SESSION_KEY='voltdrive_demo_session';
export function getStoredUser(){try{return JSON.parse(localStorage.getItem(AUTH_USER_KEY)||'null')}catch{return null}}
export function saveUser(user){localStorage.setItem(AUTH_USER_KEY,JSON.stringify(user))}
export function createSession(user){localStorage.setItem(AUTH_SESSION_KEY,JSON.stringify({userId:user.email,createdAt:new Date().toISOString()}))}

export function getSession(){try{return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY)||'null')}catch{return null}}
export function clearSession(){localStorage.removeItem(AUTH_SESSION_KEY)}
