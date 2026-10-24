import { supabase } from './supabase.js'

const { data: { session } } = await supabase.auth.getSession()
if (!session) {
  location.href = '../../login.html'
  throw new Error('Sin sesión')
}

const $ = id => document.getElementById(id)
const cuerpo = $('cuerpo')
const zonaEstado = $('zona-estado')
const tablaBox = $('tabla-box')
const filtros = $('filtros')
const modal = $('modal-operacion')
const toast = $('toast')
const campos = [...document.querySelectorAll('#cabeza th')].map(th => th.dataset.campo)

const esc = s => String(s || '—').replace(/[&<>"']/g, m => `&#${m.charCodeAt()};`)
const kg = n => n == null ? '—' : Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 })
const tag = (texto, clase) => `<span class="etiqueta etiqueta--${clase}">${texto}</span>`
const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

const ESTADOS = {
  registrada: ['Registrada', 'pendiente'],
  programada: ['Programada', 'proceso'],
  en_proceso: ['En proceso', 'proceso'],
  completada: ['Completada', 'completado'],
  cancelada: ['Cancelada', 'cancelado'],
}

const ERRORES_DB = {
  42501: 'Tu cuenta no tiene permiso para registrar operaciones.',
  23503: 'El cliente, el responsable o el producto seleccionado ya no existe.',
  23502: 'Falta un dato obligatorio. Revisa el formulario.',
  23514: 'Algún valor no es válido (por ejemplo, la cantidad o el estado).',
}

const abreviar = unidad => {
  const u = (unidad ?? '').toLowerCase()
  if (u.startsWith('kg') || u.startsWith('kilo')) return 'kg'
  if (u.startsWith('ton')) return 't'
  if (u === 'g' || u.startsWith('gramo')) return 'g'
  return unidad ?? ''
}

const aKg = (unidad, cantidad) => {
  const u = (unidad ?? '').toLowerCase()
  if (u.startsWith('kg') || u.startsWith('kilo')) return cantidad
  if (u.startsWith('ton')) return cantidad * 1000
  if (u === 'g' || u.startsWith('gramo')) return cantidad / 1000
  return 0
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

/* ───────── Nueva operación (diálogo en el HTML) ───────── */

const form = $('formulario-operacion')
const f = form.elements
const partidasBox = $('partidas')
const botonGuardar = $('guardar')
const zonaOp = $('estado-operacion')
const productos = new Map()

const opcionesProductos = () =>
  [new Option('Selecciona un producto', ''), ...[...productos.values()].map(p => new Option(p.nombre, p.id))]

const aviso = (clase, titulo, texto) => {
  zonaOp.innerHTML = `<div class="aviso aviso--${clase} mb-3"><div><strong>${titulo}</strong>${texto}</div></div>`
}

function mostrarToast(texto) {
  toast.textContent = texto
  toast.classList.remove('oculto')
  setTimeout(() => toast.classList.add('oculto'), 3000)
}

const leerPartidas = () => [...partidasBox.querySelectorAll('[data-partida]')].map(nodo => ({
  nodo,
  producto: productos.get(Number(nodo.querySelector('[name="producto_id"]').value)),
  cantidad: Number(nodo.querySelector('[name="cantidad"]').value),
}))

function actualizarResumen() {
  let peso = 0
  let importe = 0
  for (const { nodo, producto, cantidad } of leerPartidas()) {
    importe += (producto ? Number(producto.precio_unitario) : 0) * (cantidad || 0)
    peso += aKg(producto?.unidad, cantidad || 0)
    nodo.querySelector('[data-unidad]').textContent = producto ? `(${abreviar(producto.unidad)})` : ''
  }
  $('resumen').textContent = `Total: ${moneda.format(importe)} · Peso: ${peso.toLocaleString('es-MX', { maximumFractionDigits: 3 })} kg`
}

function agregarPartida() {
  const nodo = $('plantilla-partida').content.firstElementChild.cloneNode(true)
  nodo.querySelector('[name="producto_id"]').replaceChildren(...opcionesProductos())
  nodo.querySelector('[data-quitar]').onclick = () => {
    nodo.remove()
    actualizarResumen()
  }
  partidasBox.append(nodo)
  actualizarResumen()
}

function limpiarErrores() {
  zonaOp.innerHTML = ''
  form.querySelectorAll('.campo__error').forEach(m => {
    m.textContent = ''
    m.classList.add('oculto')
  })
  form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'))
}

function actualizarTipo() {
  form.querySelectorAll('[data-solo]').forEach(el => el.classList.toggle('oculto', el.dataset.solo !== f.tipo.value))
  if (f.tipo.value === 'venta' && !partidasBox.children.length) agregarPartida()
  limpiarErrores()
}

function validar(servicio, descripcion, partidas) {
  const errores = {}
  if (!f.fecha.value) errores.fecha = 'Indica la fecha de la operación.'
  if (!f.cliente_id.value) errores.cliente_id = 'Selecciona un cliente.'

  if (servicio) {
    if (!f.usuario_id.value) errores.usuario_id = 'Selecciona un responsable.'
    if (descripcion.length < 5) errores.descripcion_servicio = 'Describe el servicio con al menos 5 caracteres.'
  } else if (!partidas.length) {
    errores.partidas = 'Agrega al menos un producto.'
  } else {
    const ids = new Set()
    for (const { nodo, producto, cantidad } of partidas) {
      const select = nodo.querySelector('[name="producto_id"]')
      const input = nodo.querySelector('[name="cantidad"]')
      if (!producto) {
        select.setAttribute('aria-invalid', 'true')
        errores.partidas ||= 'Selecciona un producto en cada partida.'
      } else if (ids.has(producto.id)) {
        select.setAttribute('aria-invalid', 'true')
        errores.partidas ||= 'Un producto no puede repetirse en la misma venta.'
      } else {
        ids.add(producto.id)
      }
      if (!(cantidad > 0)) {
        input.setAttribute('aria-invalid', 'true')
        errores.partidas ||= 'La cantidad de cada partida debe ser mayor que cero.'
      }
    }
  }

  for (const [nombre, mensaje] of Object.entries(errores)) {
    const msg = $(`error-${nombre}`)
    msg.textContent = mensaje
    msg.classList.remove('oculto')
    f[nombre]?.setAttribute('aria-invalid', 'true')
  }
  return errores
}

const fallo = (titulo, error) => {
  aviso('error', titulo, ERRORES_DB[error.code] ?? 'Revisa la conexión y la configuración de Supabase.')
  botonGuardar.disabled = false
  botonGuardar.textContent = 'Guardar operación'
}

const terminar = texto => {
  modal.close()
  mostrarToast(texto)
  cargar()
}

async function guardarServicio(descripcion) {
  const { error } = await supabase.from('operaciones').insert({
    tipo: 'servicio',
    cliente_id: Number(f.cliente_id.value),
    usuario_id: f.usuario_id.value,
    descripcion_servicio: descripcion,
    fecha: new Date(`${f.fecha.value}T12:00:00`).toISOString(),
    estado: 'registrada',
  })
  if (error) return fallo('No se pudo registrar el servicio', error)
  terminar('Servicio registrado')
}

async function guardarVenta(partidas) {
  const { data: operacion, error } = await supabase.from('operaciones').insert({
    tipo: 'venta',
    cliente_id: Number(f.cliente_id.value),
    usuario_id: session.user.id,
    destino: f.destino.value.trim() || null,
    descripcion_servicio: partidas.map(({ producto, cantidad }) => `${producto.nombre} × ${cantidad} ${abreviar(producto.unidad)}`.trim()).join(', '),
    fecha: new Date(`${f.fecha.value}T12:00:00`).toISOString(),
    estado: 'registrada',
  }).select('id').single()
  if (error) return fallo('No se pudo registrar la venta', error)

  const { error: errorPartidas } = await supabase.from('operacion_producto').insert(
    partidas.map(({ producto, cantidad }) => ({
      operacion_id: operacion.id,
      producto_id: producto.id,
      cantidad,
      precio_unitario: producto.precio_unitario,
    }))
  )
  if (errorPartidas) {
    await supabase.from('operaciones').delete().eq('id', operacion.id)
    return fallo('No se pudo registrar la venta', errorPartidas)
  }
  terminar('Venta registrada')
}

async function cargarCatalogos() {
  const [clientes, usuarios, prods] = await Promise.all([
    supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('usuarios').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('productos_operador').select('id, nombre, unidad, precio_unitario').order('nombre'),
  ])

  if (clientes.error || usuarios.error || prods.error) {
    zonaOp.innerHTML = `<div class="estado-error mb-3">
      <p class="estado-error__titulo">No se pudieron cargar los catálogos</p>
      <button type="button" class="btn" id="btn-reintentar-cat">Reintentar</button>
    </div>`
    $('btn-reintentar-cat').onclick = () => {
      zonaOp.innerHTML = ''
      cargarCatalogos()
    }
    return
  }

  productos.clear()
  prods.data.forEach(p => productos.set(p.id, p))

  const llenar = (select, filas, texto) =>
    select.replaceChildren(new Option(texto, ''), ...filas.map(r => new Option(r.nombre, r.id)))
  llenar(f.cliente_id, clientes.data, 'Selecciona un cliente')
  llenar(f.usuario_id, usuarios.data, 'Selecciona un responsable')
  if (usuarios.data.some(u => u.id === session.user.id)) f.usuario_id.value = session.user.id

  partidasBox.querySelectorAll('[name="producto_id"]').forEach(select => {
    const actual = select.value
    select.replaceChildren(...opcionesProductos())
    select.value = actual
  })

  if (!clientes.data.length) {
    aviso('info', 'No hay clientes activos', 'Pide al administrador que registre un cliente antes de crear operaciones.')
  }
}

function mostrarPaso(paso) {
  $('paso-tipo').classList.toggle('oculto', paso !== 'tipo')
  form.classList.toggle('oculto', paso !== 'form')
}

function elegirTipo(tipo) {
  f.tipo.value = tipo
  $('titulo-modal-operacion').textContent = tipo === 'venta' ? 'Nueva venta' : 'Nuevo servicio'
  actualizarTipo()
  mostrarPaso('form')
}

function abrirModal() {
  form.reset()
  partidasBox.replaceChildren()
  botonGuardar.disabled = false
  botonGuardar.textContent = 'Guardar operación'
  f.fecha.value = new Date().toLocaleDateString('en-CA')
  mostrarPaso('tipo')
  modal.showModal()
  cargarCatalogos()
}

form.addEventListener('submit', async e => {
  e.preventDefault()
  limpiarErrores()

  const servicio = f.tipo.value === 'servicio'
  const descripcion = f.descripcion_servicio.value.trim()
  const partidas = servicio ? [] : leerPartidas()

  if (Object.keys(validar(servicio, descripcion, partidas)).length) {
    return form.querySelector('[aria-invalid="true"]')?.focus()
  }

  botonGuardar.disabled = true
  botonGuardar.textContent = 'Guardando…'
  return servicio ? guardarServicio(descripcion) : guardarVenta(partidas)
})

form.addEventListener('change', e => {
  if (e.target.name === 'producto_id') actualizarResumen()
})

form.addEventListener('input', e => {
  if (e.target.name === 'cantidad') actualizarResumen()
  e.target.removeAttribute('aria-invalid')
  $(`error-${e.target.name}`)?.classList.add('oculto')
  if (e.target.closest('[data-partida]')) $('error-partidas').classList.add('oculto')
})

$('agregar-partida').addEventListener('click', () => {
  $('error-partidas').classList.add('oculto')
  agregarPartida()
})
modal.querySelectorAll('[data-cerrar-dialogo]').forEach(b => b.addEventListener('click', () => modal.close()))
modal.querySelectorAll('[data-tipo]').forEach(b => b.addEventListener('click', () => elegirTipo(b.dataset.tipo)))
$('cambiar-tipo').addEventListener('click', () => mostrarPaso('tipo'))
$('btn-nueva').addEventListener('click', abrirModal)

cargar()