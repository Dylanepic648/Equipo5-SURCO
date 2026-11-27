import { supabase } from './supabase.js'
import { abrirDB, guardarUno } from './db.js'

const LoginForm = document.getElementById('loginForm')
const Correo = document.getElementById('email')
const Contraseña = document.getElementById('password')
const errorEl = document.getElementById('login-error')

function mostrarError(msg) {
  if (!errorEl) { alert(msg); return }
  errorEl.textContent = msg
  errorEl.classList.remove('oculto')
  Correo.parentElement.classList.add('campo--error')
  Contraseña.parentElement.classList.add('campo--error')
}

function ocultarError() {
  if (errorEl) errorEl.classList.add('oculto')
  Correo.parentElement.classList.remove('campo--error')
  Contraseña.parentElement.classList.remove('campo--error')
}

async function hashPassword(email, password) {
  const data = new TextEncoder().encode(`${email.toLowerCase()}:${password}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

LoginForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  ocultarError()
  const email = Correo.value.trim()
  const password = Contraseña.value

  if (!navigator.onLine) {
    try {
      const db = await abrirDB()
      const cache = await new Promise((resolve, reject) => {
        const req = db.transaction('auth_cache').objectStore('auth_cache').get(email.toLowerCase())
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      if (!cache) {
        return mostrarError('Sin conexión y no hay sesión guardada para este correo. Inicia sesión con conexión al menos una vez.')
      }
      const h = await hashPassword(email, password)
      if (h !== cache.password_hash) {
        return mostrarError('Correo o contraseña incorrectos.')
      }
      localStorage.setItem('surco_usuario', cache.user_id)
      sessionStorage.setItem('rol', JSON.stringify({ uid: cache.user_id, rol: cache.rol }))
      window.location.href = './pages/index.html'
      return
    } catch (err) {
      console.error(err)
      return mostrarError('No se pudo iniciar sesión sin conexión.')
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) {
    const msg = (error.message || '').toLowerCase()
    let texto = 'No se pudo iniciar sesión.'
    if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) texto = 'Correo o contraseña incorrectos.'
    else if (msg.includes('email not confirmed')) texto = 'El correo no ha sido confirmado.'
    else if (msg.includes('user not found')) texto = 'Usuario no encontrado.'
    else if (msg.includes('too many requests')) texto = 'Demasiados intentos. Intenta más tarde.'
    else if (msg.includes('network')) texto = 'Sin conexión. Verifica tu internet.'
    else texto = 'Correo o contraseña incorrectos.'
    return mostrarError(texto)
  }

  const { data: u, error: errU } = await supabase
    .from('usuarios').select('rol, activo').eq('id', data.user.id).single()

  if (errU || !u?.activo) {
    await supabase.auth.signOut()
    sessionStorage.removeItem('rol')
    return mostrarError('Usuario inactivo o sin perfil.')
  }

  try {
    const h = await hashPassword(email, password)
    await guardarUno('auth_cache', {
      email: email.toLowerCase(),
      user_id: data.user.id,
      rol: u.rol,
      password_hash: h,
      guardado: new Date().toISOString(),
    })
  } catch (err) {
    console.error('No se pudo guardar la caché de login:', err)
  }

  sessionStorage.setItem('rol', JSON.stringify({ uid: data.user.id, rol: u.rol }))
  window.location.href = './pages/index.html'
})