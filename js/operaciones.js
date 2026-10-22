import { supabase } from './supabase.js'

const { data: { session } } = await supabase.auth.getSession()
if (!session) location.href = '../../login.html'

const $ = id => document.getElementById(id)
const cuerpo = $('cuerpo')
const zonaEstado = $('zona-estado')
const tablaBox = $('tabla-box')
const filtros = $('filtros')
const campos = [...document.querySelectorAll('#cabeza th')].map(th => th.dataset.campo)

const esc = s => String(s || '—').replace(/[&<>"']/g, m => `&#${m.charCodeAt()};`)
const kg = n => n == null ? '—' : Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 })
const tag = (texto, clase) => `<span class="etiqueta etiqueta--${clase}">${texto}</span>`

const ESTADOS = {
  registrada: ['Registrada', 'pendiente'],
  programada: ['Programada', 'proceso'],
  en_proceso: ['En proceso', 'proceso'],
  completada: ['Completada', 'completado'],
  cancelada: ['Cancelada', 'cancelado'],
}

const abreviar = unidad => {
  const u = (unidad ?? '').toLowerCase()
  if (u.startsWith('kg') || u.startsWith('kilo')) return 'kg'
  if (u.startsWith('ton')) return 't'
  if (u === 'g' || u.startsWith('gramo')) return 'g'
  return unidad ?? ''
}

const partidasTexto = o => (o.operacion_producto ?? [])
  .map(p => `${p.productos?.nombre ?? 'Producto'} × ${kg(p.cantidad)} ${abreviar(p.productos?.unidad)}`.trim())
  .join(', ')

const celdas = {
  folio: o => esc(o.folio),
  fecha: o => new Date(o.fecha).toLocaleDateString('es-MX'),
  tipo: o => o.tipo === 'servicio' ? 'Servicio' : 'Venta',
  cliente: o => esc(o.clientes?.nombre),
  detalle: o => esc(o.descripcion_servicio || partidasTexto(o)),
  destino: o => esc(o.tipo === 'venta' ? o.destino : ''),
  vehiculo: o => esc(o.vehiculos?.placas),
  estado: o => tag(...(ESTADOS[o.estado] ?? [o.estado, ''])),
  peso_cargado: o => kg(o.peso_cargado),
  peso_entregado: o => kg(o.peso_entregado),
  acciones: () => '—',
}

let operaciones = []

async function cargar() {
  tablaBox.hidden = true
  zonaEstado.innerHTML = '<p class="tenue">Cargando operaciones…</p>'

  const { data, error } = await supabase
    .from('operaciones')
    .select('*, clientes(nombre), vehiculos(placas), operacion_producto(cantidad, productos(nombre, unidad))')
    .order('fecha', { ascending: false })

  if (error) {
    zonaEstado.innerHTML = `<div class="estado-error">
      <p class="estado-error__titulo">No pudimos cargar las operaciones</p>
      <p class="estado-error__texto">Revisa tu conexión e inténtalo de nuevo.</p>
      <button type="button" class="btn" id="btn-reintentar">Reintentar</button>
    </div>`
    $('btn-reintentar').onclick = cargar
    return
  }

  operaciones = data
  zonaEstado.innerHTML = ''
  tablaBox.hidden = false
  pintar()
}

function pintar() {
  const q = filtros.buscar.value.trim().toLowerCase()
  const { estado, desde, hasta } = filtros

  const lista = operaciones.filter(o => {
    const dia = o.fecha.slice(0, 10)
    return (!estado.value || o.estado === estado.value)
      && (!desde.value || dia >= desde.value)
      && (!hasta.value || dia <= hasta.value)
      && (!q || [o.destino, o.descripcion_servicio, partidasTexto(o), o.clientes?.nombre, o.tipo].join(' ').toLowerCase().includes(q))
  })

  cuerpo.innerHTML = lista.length
    ? lista.map(o => `<tr>${campos.map(c => `<td${c.startsWith('peso') ? ' class="num"' : ''}>${celdas[c]?.(o) ?? ''}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${campos.length}" class="tenue">${operaciones.length ? 'Sin resultados para los filtros aplicados.' : 'Aún no hay operaciones registradas.'}</td></tr>`
}

filtros.addEventListener('input', pintar)
filtros.addEventListener('submit', e => e.preventDefault())
filtros.addEventListener('reset', () => setTimeout(pintar))

cargar()