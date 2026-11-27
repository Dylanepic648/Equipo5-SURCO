import { supabase, LOGIN } from './supabase.js'

const ESTADO_EN_PROCESO = 'en_proceso'
const ESTADO_COMPLETADA = 'completada'

const $ = id => document.getElementById(id)
const esc = s => String(s || '—').replace(/[&<>"']/g, m => `&#${m.charCodeAt()};`)

const { data: { session } } = await supabase.auth.getSession()
if (!session) location.replace(LOGIN)
else await iniciar(session)

async function iniciar(session) {
  marcarConexion()
  addEventListener('online', marcarConexion)
  addEventListener('offline', marcarConexion)

  await Promise.all([cargarUsuario(session.user.id), cargarIndicadores()])
}

function marcarConexion() {
  document.body.classList.toggle('sin-conexion', !navigator.onLine)
}

function mostrarAviso(tipo, texto) {
  const zona = $('zona-estado')
  zona.replaceChildren()
  if (!texto) return
  const div = document.createElement('div')
  div.className = `aviso aviso--${tipo}`
  div.textContent = texto
  zona.append(div)
}

async function cargarUsuario(id) {
  const KEY = 'surco_usuario'
  let usuario = null

  try {
    const { data, error } = await supabase
      .from('usuarios').select('nombre, rol').eq('id', id).single()
    if (error) throw error
    usuario = { id, ...data }
    localStorage.setItem(KEY, JSON.stringify(usuario))
  } catch (e) {
    const guardado = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (guardado?.id === id) usuario = guardado
    else console.error('No se pudo cargar el usuario', e)
  }

  if (!usuario) return
  $('nombre-usuario').textContent = usuario.nombre

  document.querySelectorAll('[data-rol]').forEach(el => {
    const permitido = el.dataset.rol.split(' ').includes(usuario.rol)
    el.classList.toggle('oculto', !permitido)
  })
}

async function contar(tabla, filtros = {}) {
  let q = supabase.from(tabla).select('*', { count: 'exact', head: true })
  for (const [col, val] of Object.entries(filtros)) q = q.eq(col, val)
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

async function cargarUltimasOperaciones() {
  const tbody = $('ultimas-operaciones')
  if (!tbody) return
  try {
    const { data, error } = await supabase
      .from('operaciones')
      .select('folio, fecha, tipo, estado, clientes(nombre)')
      .order('fecha', { ascending: false })
      .limit(5)
    if (error) throw error
    if (!data?.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="tenue">Aún no hay operaciones.</td></tr>'
      return
    }
    tbody.innerHTML = data.map(o => `<tr>
      <td>${esc(o.folio)}</td>
      <td>${new Date(o.fecha).toLocaleDateString('es-MX')}</td>
      <td>${o.tipo === 'servicio' ? 'Servicio' : 'Venta'}</td>
      <td>${esc(o.clientes?.nombre)}</td>
      <td>${o.estado}</td>
    </tr>`).join('')
  } catch (e) {
    console.error(e)
    tbody.innerHTML = '<tr><td colspan="5" class="tenue">No se pudieron cargar.</td></tr>'
  }
}

async function cargarIndicadores() {
  try {
    const [total, enProceso, completadas, opPend, movPend, productos, clientes] = await Promise.all([
      contar('operaciones'),
      contar('operaciones', { estado: ESTADO_EN_PROCESO }),
      contar('operaciones', { estado: ESTADO_COMPLETADA }),
      contar('operaciones', { pendiente_envio: true }),
      contar('movimientos_inventario', { pendiente_envio: true }),
      contar('productos', { activo: true }),
      contar('clientes', { activo: true })
    ])
    const pendientes = opPend + movPend

    $('total-registradas').textContent = total
    $('total-en-proceso').textContent = enProceso
    $('total-completadas').textContent = completadas
    $('total-pendientes').textContent = pendientes
    $('total-productos').textContent = productos
    $('total-clientes').textContent = clientes
    $('texto-pendientes').textContent = pendientes
    $('aviso-pendientes').classList.toggle('oculto', pendientes === 0)
    mostrarAviso('', '')
    await cargarUltimasOperaciones()
  } catch (e) {
    console.error('No se pudieron cargar los indicadores', e)
    mostrarAviso('error', navigator.onLine
      ? 'No se pudieron cargar los indicadores.'
      : 'Sin conexión: no se pueden actualizar los indicadores.')
  }
}