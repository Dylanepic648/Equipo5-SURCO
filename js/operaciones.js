import { supabase } from './supabase.js'

const { data: { session } } = await supabase.auth.getSession()
if (!session) {
  window.location.href = '../../login.html'
}

const cuerpo = document.getElementById('cuerpo')
const zonaEstado = document.getElementById('zona-estado')
const tablaBox = document.getElementById('tabla-box')
const filtros = document.getElementById('filtros')
const campos = [...document.querySelectorAll('#cabeza th')].map(th => th.dataset.campo)

const esc = s => String(s ?? '').replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]))

const fmtKg = n => n == null ? '—' : Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 })
const fmtFecha = f => f ? new Date(f).toLocaleDateString('es-MX') : '—'

const ESTADOS = {
  registrada: ['Registrada', 'etiqueta--pendiente'],
  programada: ['Programada', 'etiqueta--proceso'],
  en_proceso: ['En proceso', 'etiqueta--proceso'],
  completada: ['Completada', 'etiqueta--completado'],
  cancelada:  ['Cancelada',  'etiqueta--cancelado'],
}
const etiqueta = (texto, clase = '') => `<span class="etiqueta ${clase}">${esc(texto)}</span>`

let operaciones = []

async function cargar() {
  tablaBox.hidden = true
  zonaEstado.innerHTML = '<p class="tenue">Cargando operaciones…</p>'

  const { data, error } = await supabase
    .from('operaciones')
    .select('*, clientes(nombre), vehiculos(placas)')
    .order('fecha', { ascending: false })

  if (error) {
    console.error(error)
    zonaEstado.innerHTML = `<div class="estado-error">
      <p class="estado-error__titulo">No pudimos cargar las operaciones</p>
      <p class="estado-error__texto">Revisa tu conexión e inténtalo de nuevo.</p>
      <button type="button" class="btn" id="btn-reintentar">Reintentar</button>
    </div>`
    document.getElementById('btn-reintentar').onclick = cargar
    return
  }

  operaciones = data
  zonaEstado.innerHTML = ''
  tablaBox.hidden = false
  pintar()
}

function filtradas() {
  const q = filtros.buscar.value.trim().toLowerCase()
  const estado = filtros.estado.value
  const desde = filtros.desde.value ? new Date(filtros.desde.value + 'T00:00:00') : null
  const hasta = filtros.hasta.value ? new Date(filtros.hasta.value + 'T23:59:59') : null

  return operaciones.filter(o => {
    if (estado && o.estado !== estado) return false
    const f = new Date(o.fecha)
    if (desde && f < desde) return false
    if (hasta && f > hasta) return false
    if (q) {
      const texto = [o.destino, o.descripcion_servicio, o.clientes?.nombre].join(' ').toLowerCase()
      if (!texto.includes(q)) return false
    }
    return true
  })
}

function celda(campo, o) {
  switch (campo) {
    case 'fecha':          return fmtFecha(o.fecha)
    case 'tipo':           return o.tipo === 'servicio' ? 'Servicio' : 'Venta'
    case 'cliente':        return esc(o.clientes?.nombre ?? '—')
    case 'detalle':        return esc((o.tipo === 'servicio' ? o.descripcion_servicio : o.destino) || '—')
    case 'vehiculo':       return esc(o.vehiculos?.placas ?? '—')
    case 'estado': {
      const [txt, clase] = ESTADOS[o.estado] ?? [o.estado, '']
      return etiqueta(txt, clase)
    }
    case 'peso_cargado':   return fmtKg(o.peso_cargado)
    case 'peso_entregado': return fmtKg(o.peso_entregado)
    case 'pendiente_envio':
      return o.pendiente_envio ? etiqueta('Pendiente', 'etiqueta--pendiente') : etiqueta('Enviado', 'etiqueta--completado')
    case 'acciones':       return '—'
    default:               return ''
  }
}

function pintar() {
  const lista = filtradas()

  if (!lista.length) {
    cuerpo.innerHTML = `<tr><td colspan="${campos.length}" class="tenue">${
      operaciones.length ? 'Sin resultados para los filtros aplicados.' : 'Aún no hay operaciones registradas.'
    }</td></tr>`
    return
  }

  cuerpo.innerHTML = lista.map(o => `<tr>${
    campos.map(c => `<td${c.startsWith('peso') ? ' class="num"' : ''}>${celda(c, o)}</td>`).join('')
  }</tr>`).join('')
}

filtros.addEventListener('submit', e => { e.preventDefault(); pintar() })
filtros.addEventListener('reset', () => setTimeout(pintar))   // espera a que el reset vacíe los campos
filtros.estado.addEventListener('change', pintar)

cargar()