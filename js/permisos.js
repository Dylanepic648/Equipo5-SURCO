import { supabase } from './supabase.js'

const PERMITIDO_OPERADOR = ['index.html', 'operaciones.html']
const BLOQUEADO_OPERADOR = ['modulo1', 'modulo3', 'reportes']

const RUTA_LOGIN = '/index.html'
const RUTA_INICIO = '/pages/index.html'

async function obtenerRol() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    sessionStorage.removeItem('rol')
    return null
  }

  const uid = session.user.id
  const cache = JSON.parse(sessionStorage.getItem('rol') || 'null')
  if (cache?.uid === uid) return cache.rol

  const { data, error } = await supabase
    .from('usuarios').select('rol').eq('id', uid).single()

  if (error) console.error('[permisos] error consultando rol:', error)

  if (data?.rol) {
    sessionStorage.setItem('rol', JSON.stringify({ uid, rol: data.rol }))
  }
  return data?.rol ?? null
}

function aplicarPermisosOperador() {
  document.querySelectorAll('.sidebar a').forEach(a => {
    const href = a.getAttribute('href') || ''
    const vista = a.dataset.view || ''
    if (BLOQUEADO_OPERADOR.some(b => href.includes(b) || vista === b)) {
      a.closest('li')?.remove()
    }
  })

  document.querySelectorAll('[data-rol]').forEach(el => {
    if (!el.dataset.rol.split(' ').includes('operador')) el.remove()
  })

  const pagina = location.pathname.split('/').pop() || 'index.html'
  if (!PERMITIDO_OPERADOR.includes(pagina)) location.replace(RUTA_INICIO)
}

try {
  const rol = await obtenerRol()
  console.log('[permisos] rol:', rol)

  if (!rol) location.replace(RUTA_LOGIN)
  else if (rol === 'operador') aplicarPermisosOperador()
} catch (e) {
  console.error('[permisos] error:', e)
}

document.getElementById('btnSalir')?.addEventListener('click', async () => {
  sessionStorage.removeItem('rol')
  await supabase.auth.signOut()
  location.replace(RUTA_LOGIN)
})