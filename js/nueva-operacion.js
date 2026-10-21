import { supabase } from './supabase.js'

const $ = s => document.querySelector(s)
const formulario = $('#form-operacion')
const campos = formulario.elements
const zonaEstado = $('#zona-estado')
const zonaErrores = $('#errores')
const botonGuardar = $('#guardar')
const contenedorPartidas = $('#partidas')
const plantillaPartida = $('#plantilla-partida')
const productos = new Map()

const ERRORES_DB = {
  42501: 'Tu cuenta no tiene permiso para registrar operaciones.',
  23503: 'El cliente, el responsable o el producto seleccionado ya no existe.',
  23502: 'Falta un dato obligatorio. Revisa el formulario.',
  23514: 'Algún valor no es válido (por ejemplo, la cantidad o el estado).',
}

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

const aviso = (zona, clase, titulo, texto) => {
  zona.innerHTML = `<div class="aviso aviso--${clase}"><div><strong>${titulo}</strong>${texto}</div></div>`
}

const llenar = (select, filas, texto) =>
  select.replaceChildren(new Option(texto, ''), ...filas.map(f => new Option(f.nombre, f.id)))

function marcarError(nombre, mensaje) {
  const msg = $(`#error-${nombre}`)
  msg.textContent = mensaje
  msg.classList.remove('oculto')
  campos[nombre]?.setAttribute('aria-invalid', 'true')
  campos[nombre]?.closest('.campo')?.classList.add('campo--error')
}

function limpiarError(nombre) {
  const msg = $(`#error-${nombre}`)
  if (!msg) return
  msg.textContent = ''
  msg.classList.add('oculto')
  campos[nombre]?.removeAttribute('aria-invalid')
  campos[nombre]?.closest('.campo')?.classList.remove('campo--error')
}

function limpiarErrores() {
  zonaErrores.innerHTML = ''
  document.querySelectorAll('[id^="error-"]').forEach(m => limpiarError(m.id.slice(6)))
  contenedorPartidas.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'))
}

function leerPartidas() {
  return [...contenedorPartidas.querySelectorAll('[data-partida]')].map(nodo => {
    const producto = productos.get(Number(nodo.querySelector('[name="producto_id"]').value))
    const cantidad = Number(nodo.querySelector('[name="cantidad"]').value)
    return { nodo, producto, cantidad }
  })
}

const abreviar = unidad => {
  const u = (unidad ?? '').toLowerCase()
  if (u.startsWith('kg') || u.startsWith('kilo')) return 'kg'
  if (u.startsWith('ton')) return 't'
  if (u === 'g' || u.startsWith('gramo')) return 'g'
  return unidad ?? ''
}

function aKg(unidad, cantidad) {
  const u = (unidad ?? '').toLowerCase()
  if (u.startsWith('kg') || u.startsWith('kilo')) return cantidad
  if (u.startsWith('ton')) return cantidad * 1000
  if (u === 'g' || u.startsWith('gramo')) return cantidad / 1000
  return 0
}

function actualizarResumen() {
  const partidas = leerPartidas()
  let peso = 0
  let importe = 0

  for (const { nodo, producto, cantidad } of partidas) {
    const precio = producto ? Number(producto.precio_unitario) : 0
    const subtotal = precio * (cantidad || 0)
    nodo.querySelector('[data-unidad]').textContent = abreviar(producto?.unidad) || '—'
    nodo.querySelector('[data-precio]').textContent = moneda.format(precio)
    nodo.querySelector('[data-subtotal]').textContent = moneda.format(subtotal)
    importe += subtotal
    peso += aKg(producto?.unidad, cantidad || 0)
  }

  $('#partidas-vacio').classList.toggle('oculto', partidas.length > 0)
  $('#res-partidas').textContent = partidas.length
  $('#res-peso').textContent = `${peso.toLocaleString('es-MX', { maximumFractionDigits: 3 })} kg`
  $('#res-importe').textContent = moneda.format(importe)
}

function agregarPartida() {
  const nodo = plantillaPartida.content.firstElementChild.cloneNode(true)
  const select = nodo.querySelector('[name="producto_id"]')
  select.replaceChildren(new Option('Selecciona un producto', ''), ...[...productos.values()].map(p => new Option(p.nombre, p.id)))
  nodo.querySelector('[data-quitar]').onclick = () => {
    nodo.remove()
    actualizarResumen()
  }
  contenedorPartidas.append(nodo)
  actualizarResumen()
}

function actualizarTipo() {
  const servicio = campos.tipo.value === 'servicio'
  const visibles = {
    '#bloque-servicio': servicio,
    '#aviso-servicio': servicio,
    '#bloque-venta': !servicio,
    '#res-venta': !servicio,
    '#aviso-venta': !servicio,
  }
  for (const [id, visible] of Object.entries(visibles)) $(id).classList.toggle('oculto', !visible)
  $('#res-tipo').textContent = servicio ? 'Servicio' : 'Venta'
  limpiarErrores()
}

async function cargarCatalogos(usuario) {
  zonaEstado.innerHTML = '<div class="esqueleto esqueleto--titulo"></div>'

  const [clientes, usuarios, prods] = await Promise.all([
    supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('usuarios').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('productos_operador').select('id, nombre, unidad, precio_unitario').order('nombre'),
  ])

  if (clientes.error || usuarios.error || prods.error) {
    zonaEstado.innerHTML = `<div class="estado-error mb-3">
      <p class="estado-error__titulo">No se pudieron cargar los catálogos</p>
      <p class="estado-error__texto">Revisa tu conexión e inténtalo de nuevo.</p>
      <button type="button" class="btn" id="btn-reintentar">Reintentar</button>
    </div>`
    $('#btn-reintentar').onclick = () => cargarCatalogos(usuario)
    return
  }

  productos.clear()
  prods.data.forEach(p => productos.set(p.id, p))

  llenar(campos.cliente_id, clientes.data, 'Selecciona un cliente')
  llenar(campos.usuario_id, usuarios.data, 'Selecciona un responsable')
  if (usuarios.data.some(u => u.id === usuario.id)) campos.usuario_id.value = usuario.id

  contenedorPartidas.querySelectorAll('[name="producto_id"]').forEach(select => {
    const actual = select.value
    select.replaceChildren(new Option('Selecciona un producto', ''), ...prods.data.map(p => new Option(p.nombre, p.id)))
    select.value = actual
  })

  if (!clientes.data.length) {
    return aviso(zonaEstado, 'info', 'No hay clientes activos', 'Pide al administrador que registre un cliente antes de crear operaciones.')
  }
  zonaEstado.innerHTML = ''
}

function validarComun() {
  const reglas = {
    fecha: ['Indica la fecha de la operación.', campos.fecha.value],
    cliente_id: ['Selecciona un cliente.', campos.cliente_id.value],
  }
  for (const [nombre, [mensaje, ok]] of Object.entries(reglas)) if (!ok) marcarError(nombre, mensaje)
}

function validarServicio(descripcion) {
  const reglas = {
    usuario_id: ['Selecciona un responsable.', campos.usuario_id.value],
    descripcion_servicio: ['Describe el servicio con al menos 5 caracteres.', descripcion.length >= 5],
  }
  for (const [nombre, [mensaje, ok]] of Object.entries(reglas)) if (!ok) marcarError(nombre, mensaje)
}

function validarVenta(partidas) {
  const msg = $('#error-partidas')
  let texto = ''
  if (!partidas.length) {
    texto = 'Agrega al menos una partida.'
  } else {
    const ids = new Set()
    for (const { nodo, producto, cantidad } of partidas) {
      const select = nodo.querySelector('[name="producto_id"]')
      const input = nodo.querySelector('[name="cantidad"]')
      if (!producto) {
        select.setAttribute('aria-invalid', 'true')
        texto ||= 'Selecciona un producto en cada partida.'
      } else if (ids.has(producto.id)) {
        select.setAttribute('aria-invalid', 'true')
        texto ||= 'Un producto no puede repetirse en la misma venta.'
      } else {
        ids.add(producto.id)
      }
      if (!(cantidad > 0)) {
        input.setAttribute('aria-invalid', 'true')
        texto ||= 'La cantidad de cada partida debe ser mayor que cero.'
      }
    }
  }
  if (texto) {
    msg.textContent = texto
    msg.classList.remove('oculto')
  }
}

function restaurarBoton() {
  botonGuardar.disabled = false
  botonGuardar.textContent = 'Guardar operación'
}

function fallo(titulo, error) {
  aviso(zonaErrores, 'error', titulo, ERRORES_DB[error.code] ?? 'Revisa la conexión y la configuración de Supabase.')
  restaurarBoton()
}

async function guardarServicio(descripcion) {
  const { error } = await supabase.from('operaciones').insert({
    tipo: 'servicio',
    cliente_id: Number(campos.cliente_id.value),
    usuario_id: campos.usuario_id.value,
    descripcion_servicio: descripcion,
    fecha: new Date(`${campos.fecha.value}T12:00:00`).toISOString(),
    estado: 'registrada',
  })
  if (error) return fallo('No se pudo registrar el servicio', error)
  aviso(zonaErrores, 'exito', 'Servicio registrado', 'Quedó en estado registrada. Volviendo al listado…')
  setTimeout(() => location.href = 'operaciones.html', 1200)
}

async function guardarVenta(partidas, usuario) {
  const destino = campos.destino.value.trim()

  const { data: operacion, error } = await supabase.from('operaciones').insert({
    tipo: 'venta',
    cliente_id: Number(campos.cliente_id.value),
    usuario_id: usuario.id,
    destino: destino || null,
    descripcion_servicio: partidas.map(({ producto, cantidad }) => `${producto.nombre} × ${cantidad} ${abreviar(producto.unidad)}`.trim()).join(', '),
    fecha: new Date(`${campos.fecha.value}T12:00:00`).toISOString(),
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

  aviso(zonaErrores, 'exito', 'Venta registrada', 'Quedó en estado registrada. Volviendo al listado…')
  setTimeout(() => location.href = 'operaciones.html', 1200)
}

formulario.addEventListener('submit', async e => {
  e.preventDefault()
  limpiarErrores()

  const servicio = campos.tipo.value === 'servicio'
  const descripcion = campos.descripcion_servicio.value.trim()
  const partidas = leerPartidas()

  validarComun()
  if (servicio) validarServicio(descripcion)
  else validarVenta(partidas)

  const invalido = formulario.querySelector('[aria-invalid="true"]')
  if (invalido) return invalido.focus()

  botonGuardar.disabled = true
  botonGuardar.textContent = 'Guardando…'

  if (servicio) return guardarServicio(descripcion)
  return guardarVenta(partidas, session.user)
})

formulario.addEventListener('change', e => {
  if (e.target.name === 'tipo') actualizarTipo()
  else if (e.target.name === 'producto_id') actualizarResumen()
})

formulario.addEventListener('input', e => {
  if (!e.target.name) return
  limpiarError(e.target.name)
  if (e.target.name === 'cantidad') actualizarResumen()
  if (e.target.closest('[data-partida]')) {
    e.target.removeAttribute('aria-invalid')
    $('#error-partidas').classList.add('oculto')
  }
})

$('#agregar-partida').addEventListener('click', () => {
  $('#error-partidas').classList.add('oculto')
  agregarPartida()
})

const { data: { session } } = await supabase.auth.getSession()
if (!session) {
  location.href = '../../login.html'
  throw new Error('Sin sesión')
}

campos.fecha.value = new Date().toLocaleDateString('en-CA')
const tipo = new URLSearchParams(location.search).get('tipo')
if (['servicio', 'venta'].includes(tipo)) campos.tipo.value = tipo
actualizarTipo()
await cargarCatalogos(session.user)
agregarPartida()