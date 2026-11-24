import { supabase } from './supabase.js'
import { abrirDB, guardarUno, leerTodos } from './db.js'

const LoginForm = document.getElementById('loginForm')
const Correo = document.getElementById('email')
const Contraseña = document.getElementById('password')

async function hashPassword(email, password) {
  const data = new TextEncoder().encode(`${email.toLowerCase()}:${password}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

LoginForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = Correo.value.trim()
  const password = Contraseña.value

  // Sin conexión: intentar login con caché local.
  if (!navigator.onLine) {
    try {
      const db = await abrirDB()
      const cache = await new Promise((resolve, reject) => {
        const req = db.transaction('auth_cache').objectStore('auth_cache').get(email.toLowerCase())
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      if (!cache) {
        return alert('Sin conexión y no hay sesión guardada para este correo. Inicia sesión con conexión al menos una vez.')
      }
      const h = await hashPassword(email, password)
      if (h !== cache.password_hash) {
        return alert('Correo o contraseña incorrectos.')
      }
      localStorage.setItem('surco_usuario', cache.user_id)
      sessionStorage.setItem('rol', JSON.stringify({ uid: cache.user_id, rol: cache.rol }))
      window.location.href = './pages/index.html'
      return
    } catch (err) {
      console.error(err)
      return alert('No se pudo iniciar sesión sin conexión.')
    }
  }

  // Con conexión: login normal con Supabase.
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) return alert(error.message)

  const { data: u, error: errU } = await supabase
    .from('usuarios').select('rol, activo').eq('id', data.user.id).single()

  if (errU || !u?.activo) {
    await supabase.auth.signOut()
    sessionStorage.removeItem('rol')
    return alert('Usuario inactivo o sin perfil')
  }

  // Guardar credenciales en caché para login offline futuro.
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