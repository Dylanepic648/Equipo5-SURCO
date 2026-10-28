import { supabase } from './supabase.js'

const { data: { session } } = await supabase.auth.getSession()
if (!session) {
  location.href = '../../login.html'
  throw new Error('Sin sesión')
}

const { data: perfil } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
const esAdmin = perfil?.rol === 'administrador'

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
  42501: 'Tu cuenta no tiene permiso para esta acción.',
  23503: 'El cliente, el responsable, el vehículo o el producto seleccionado ya no existe.',
  23502: 'Falta un dato obligatorio. Revisa el formulario.',
  23514: 'Algún valor no es válido (por ejemplo, la cantidad o el estado).',
}
const msgDB = error => ERRORES_DB[error.code] ?? 'Revisa la conexión y la configuración de Supabase.'

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

const pesoDe = o => (o.operacion_producto ?? []).reduce((s, p) => s + aKg(p.productos?.unidad, Number(p.cantidad)), 0)

function botones(o) {
  const b = (a, t) => `<button type="button" class="btn btn--secundario btn--pequeno" data-accion="${a}" data-id="${o.id}">${t}</button>`
  const lista = []
  if (o.estado === 'registrada') {
    lista.push(b('editar', 'Editar'), b('programar', 'Programar'))
    if (esAdmin) lista.push(b('cancelar', 'Cancelar'))
  } else if (o.estado === 'programada') {
    lista.push(b('iniciar', o.tipo === 'venta' ? 'Iniciar tránsito' : 'Iniciar'))
    if (esAdmin) lista.push(b('cancelar', 'Cancelar'))
  } else if (o.estado === 'en_proceso') {
    lista.push(b('entregar', o.tipo === 'venta' ? 'Registrar entrega' : 'Completar'))
  }
  return `<div class="acciones">${lista.join('') || '—'}</div>`
}

const celdas = {
  folio: o => esc(o.folio),
  fecha: o => new Date(o.fecha).toLocaleDateString('es-MX'),
  tipo: o => o.tipo === 'servicio' ? 'Servicio' : 'Venta',
  cliente: o => esc(o.clientes?.nombre),
  detalle: o => {
    const t = o.descripcion_servicio || partidasTexto(o)
    return `<span class="celda-recorte" title="${esc(t)}">${esc(t)}</span>`
  },
  destino: o => esc(o.tipo === 'venta' ? o.destino : ''),
  vehiculo: o => esc(o.vehiculos?.placas),
  estado: o => tag(...(ESTADOS[o.estado] ?? [o.estado, ''])),
  peso_cargado: o => kg(o.peso_cargado),
  peso_entregado: o => kg(o.peso_entregado),
  acciones: botones,
}

let operaciones = []

async function cargar() {
  tablaBox.hidden = true
  zonaEstado.innerHTML = '<p class="tenue">Cargando operaciones…</p>'

  const { data, error } = await supabase
    .from('operaciones')
    .select('*, clientes(nombre), vehiculos(placas), operacion_producto(producto_id, cantidad, precio_unitario, productos(nombre, unidad))')
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

const form = $('formulario-operacion')
const f = form.elements
const partidasBox = $('partidas')
const botonGuardar = $('guardar')
const zonaOp = $('estado-operacion')
const productos = new Map()
let editando = null

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

const resumenPartidas = partidas =>
  partidas.map(({ producto, cantidad }) => `${producto.nombre} × ${cantidad} ${abreviar(producto.unidad)}`.trim()).join(', ')

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

function agregarPartida(valores) {
  const nodo = $('plantilla-partida').content.firstElementChild.cloneNode(true)
  const select = nodo.querySelector('[name="producto_id"]')
  select.replaceChildren(...opcionesProductos())
  if (valores) {
    select.value = valores.producto_id
    nodo.querySelector('[name="cantidad"]').value = valores.cantidad
  }
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
  aviso('error', titulo, msgDB(error))
  botonGuardar.disabled = false
  botonGuardar.textContent = 'Guardar operación'
}

const terminar = texto => {
  modal.close()
  mostrarToast(texto)
  cargar()
}

const filasPartidas = (operacionId, partidas) => partidas.map(({ producto, cantidad }) => ({
  operacion_id: operacionId,
  producto_id: producto.id,
  cantidad,
  precio_unitario: producto.precio_unitario,
}))

async function guardarServicio(descripcion) {
  const datos = {
    cliente_id: Number(f.cliente_id.value),
    usuario_id: f.usuario_id.value,
    descripcion_servicio: descripcion,
    fecha: new Date(`${f.fecha.value}T12:00:00`).toISOString(),
  }
  const consulta = editando
    ? supabase.from('operaciones').update(datos).eq('id', editando.id).eq('estado', 'registrada')
    : supabase.from('operaciones').insert({ ...datos, tipo: 'servicio', estado: 'registrada' })
  const { error } = await consulta
  if (error) return fallo('No se pudo guardar el servicio', error)
  terminar(editando ? 'Servicio actualizado' : 'Servicio registrado')
}

async function guardarVenta(partidas) {
  const datos = {
    cliente_id: Number(f.cliente_id.value),
    destino: f.destino.value.trim() || null,
    descripcion_servicio: resumenPartidas(partidas),
    fecha: new Date(`${f.fecha.value}T12:00:00`).toISOString(),
  }

  if (editando) {
    const { data, error } = await supabase.from('operaciones').update(datos)
      .eq('id', editando.id).eq('estado', 'registrada').select('id')
    if (error) return fallo('No se pudo actualizar la venta', error)
    if (!data.length) return fallo('No se pudo actualizar la venta', { code: '42501' })

    const { error: eDel } = await supabase.from('operacion_producto').delete().eq('operacion_id', editando.id)
    if (eDel) return fallo('No se pudieron actualizar las partidas', eDel)
    const { error: eIns } = await supabase.from('operacion_producto').insert(filasPartidas(editando.id, partidas))
    if (eIns) return fallo('Las partidas no se guardaron; vuelve a editar la venta', eIns)
    return terminar('Venta actualizada')
  }

  const { data: operacion, error } = await supabase.from('operaciones')
    .insert({ ...datos, tipo: 'venta', usuario_id: session.user.id, estado: 'registrada' })
    .select('id').single()
  if (error) return fallo('No se pudo registrar la venta', error)

  const { error: errorPartidas } = await supabase.from('operacion_producto').insert(filasPartidas(operacion.id, partidas))
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
    return false
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
  return true
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
  editando = null
  form.reset()
  partidasBox.replaceChildren()
  botonGuardar.disabled = false
  botonGuardar.textContent = 'Guardar operación'
  $('cambiar-tipo').classList.remove('oculto')
  f.fecha.value = new Date().toLocaleDateString('en-CA')
  mostrarPaso('tipo')
  modal.showModal()
  cargarCatalogos()
}

async function abrirEdicion(op) {
  editando = op
  form.reset()
  partidasBox.replaceChildren()
  botonGuardar.disabled = false
  botonGuardar.textContent = 'Guardar cambios'
  $('cambiar-tipo').classList.add('oculto')
  f.tipo.value = op.tipo
  $('titulo-modal-operacion').textContent = op.tipo === 'venta' ? 'Editar venta' : 'Editar servicio'
  actualizarTipo()
  partidasBox.replaceChildren()
  mostrarPaso('form')
  modal.showModal()

  if (!await cargarCatalogos()) return
  f.fecha.value = op.fecha.slice(0, 10)
  f.cliente_id.value = op.cliente_id
  if (op.tipo === 'servicio') {
    f.usuario_id.value = op.usuario_id ?? ''
    f.descripcion_servicio.value = op.descripcion_servicio ?? ''
  } else {
    f.destino.value = op.destino ?? ''
    op.operacion_producto.forEach(agregarPartida)
    if (!partidasBox.children.length) agregarPartida()
  }
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

const dialogoAccion = $('modal-accion')
const formAccion = $('form-accion')
const accion = { tipo: null, op: null, vehiculos: [] }

const TITULOS = {
  programar: 'Programar',
  iniciar: 'Iniciar',
  entregar: 'Registrar entrega',
  cancelar: 'Cancelar operación',
}
const EXITO = {
  programar: 'Operación programada',
  iniciar: 'Operación en proceso',
  entregar: 'Operación completada',
  cancelar: 'Operación cancelada',
}

const avisoAccion = texto => {
  $('accion-estado').innerHTML = `<div class="aviso aviso--error mb-3"><div><strong>No se puede continuar</strong>${texto}</div></div>`
}

async function transicion(op, cambios) {
  const { data, error } = await supabase.from('operaciones').update(cambios)
    .eq('id', op.id).eq('estado', op.estado).select('id')
  if (error) return msgDB(error)
  if (!data.length) return 'La operación cambió de estado o no tienes permiso. Recarga la lista.'
  return null
}

const revertir = op => supabase.from('operaciones').update({
  estado: op.estado,
  vehiculo_id: op.vehiculo_id,
  destino: op.destino,
  peso_cargado: op.peso_cargado,
}).eq('id', op.id)

async function programar(op) {
  if (op.tipo === 'servicio') {
    if (!op.fecha || !op.usuario_id) return 'Un servicio necesita fecha y responsable para programarse.'
    return transicion(op, { estado: 'programada' })
  }

  const destino = formAccion.elements.destino.value.trim()
  const vehiculo = accion.vehiculos.find(v => v.id === Number(formAccion.elements.vehiculo_id.value))
  const partidas = op.operacion_producto ?? []

  if (!partidas.length) return 'La venta no tiene productos.'
  if (!vehiculo) return 'Selecciona un vehículo.'
  if (!destino) return 'Indica el destino.'

  const peso = pesoDe(op)
  const capacidad = Number(vehiculo.capacidad_kg)
  if (peso > capacidad) {
    return `El peso (${kg(peso)} kg) excede la capacidad del vehículo (${kg(capacidad)} kg) por ${kg(peso - capacidad)} kg.`
  }

  const { data: stock, error: eStock } = await supabase.from('productos_operador')
    .select('id, nombre, existencia').in('id', partidas.map(p => p.producto_id))
  if (eStock) return msgDB(eStock)
  const faltantes = partidas.flatMap(p => {
    const s = stock.find(x => x.id === p.producto_id)
    const hay = Number(s?.existencia ?? 0)
    return hay < Number(p.cantidad)
      ? [`${s?.nombre ?? 'Producto'}: se piden ${kg(p.cantidad)} y hay ${kg(hay)}.`]
      : []
  })
  if (faltantes.length) return `Existencia insuficiente. ${faltantes.join(' ')}`

  const e = await transicion(op, { estado: 'programada', vehiculo_id: vehiculo.id, destino, peso_cargado: peso })
  if (e) return e

  const { error } = await supabase.from('movimientos_inventario').insert(partidas.map(p => ({
    producto_id: p.producto_id,
    tipo: 'salida',
    cantidad: p.cantidad,
    motivo: `Venta ${op.folio}`,
    operacion_id: op.id,
    usuario_id: session.user.id,
  })))
  if (error) {
    await revertir(op)
    return msgDB(error)
  }
  return null
}

const iniciar = op => transicion(op, { estado: 'en_proceso' })

async function entregar(op) {
  const recibio = formAccion.elements.recibido_por.value.trim()
  if (!recibio) return 'Indica quién recibió.'
  const cambios = { estado: 'completada', recibido_por: recibio }

  if (op.tipo === 'venta') {
    const entregado = formAccion.elements.peso_entregado.value
    if (entregado === '' || Number(entregado) < 0) return 'Indica el peso entregado (kg).'
    cambios.peso_entregado = Number(entregado)
  }
  return transicion(op, cambios)
}

async function cancelar(op) {
  if (!esAdmin) return 'Solo el administrador puede cancelar.'
  const motivo = formAccion.elements.motivo.value.trim()
  if (motivo.length < 5) return 'Escribe el motivo de la cancelación (mínimo 5 caracteres).'

  const e = await transicion(op, { estado: 'cancelada', motivo_cancelacion: motivo })
  if (e) return e

  if (op.tipo === 'venta' && op.estado === 'programada') {
    const { error } = await supabase.from('movimientos_inventario').insert((op.operacion_producto ?? []).map(p => ({
      producto_id: p.producto_id,
      tipo: 'entrada',
      cantidad: p.cantidad,
      motivo: `Cancelación ${op.folio}: ${motivo}`,
      operacion_id: op.id,
      usuario_id: session.user.id,
    })))
    if (error) {
      await supabase.from('operaciones').update({ estado: op.estado, motivo_cancelacion: null }).eq('id', op.id)
      return msgDB(error)
    }
  }
  return null
}

const ACCIONES = { programar, iniciar, entregar, cancelar }

async function abrirAccion(tipo, op) {
  accion.tipo = tipo
  accion.op = op
  const venta = op.tipo === 'venta'
  $('accion-estado').innerHTML = ''
  $('accion-titulo').textContent = `${TITULOS[tipo]} · ${op.folio ?? ''}`
  $('accion-ok').disabled = false
  let html = ''

  if (tipo === 'programar' && venta) {
    const { data, error } = await supabase.from('vehiculos')
      .select('id, tipo, placas, capacidad_kg').eq('activo', true).order('placas')
    if (error) return mostrarToast('No se pudieron cargar los vehículos')
    accion.vehiculos = data
    html = `
      <p class="tenue">Peso total de la carga: <strong>${kg(pesoDe(op))} kg</strong></p>
      <label class="campo"><span class="campo__etiqueta">Vehículo</span>
        <select class="campo__control" name="vehiculo_id">
          <option value="">Selecciona un vehículo</option>
          ${data.map(v => `<option value="${v.id}">${esc(v.placas)} · ${esc(v.tipo)} · ${kg(v.capacidad_kg)} kg</option>`).join('')}
        </select></label>
      <label class="campo"><span class="campo__etiqueta">Destino</span>
        <input class="campo__control" type="text" name="destino" maxlength="200" value="${esc(op.destino).replace('—', '')}"></label>`
  } else if (tipo === 'programar') {
    html = '<p class="dialogo__texto">El servicio quedará agendado con su fecha y responsable.</p>'
  } else if (tipo === 'iniciar') {
    html = `<p class="dialogo__texto">${venta ? 'La carga sale hacia el destino.' : 'El servicio comienza en la parcela.'}</p>`
  } else if (tipo === 'entregar') {
    html = `
      ${venta ? `<p class="tenue">Peso cargado: <strong>${kg(op.peso_cargado)} kg</strong></p>
      <label class="campo"><span class="campo__etiqueta">Peso entregado (kg)</span>
        <input class="campo__control" type="number" name="peso_entregado" min="0" step="0.01"></label>
      <p class="tenue" id="merma"></p>` : ''}
      <label class="campo"><span class="campo__etiqueta">Recibió</span>
        <input class="campo__control" type="text" name="recibido_por" maxlength="120"></label>`
  } else if (tipo === 'cancelar') {
    html = `<label class="campo"><span class="campo__etiqueta">Motivo de cancelación</span>
      <textarea class="campo__control" name="motivo" rows="3"></textarea></label>
      ${venta && op.estado === 'programada' ? '<p class="tenue">El inventario se devolverá con un movimiento de entrada.</p>' : ''}`
  }

  $('accion-campos').innerHTML = html
  dialogoAccion.showModal()
}

formAccion.addEventListener('input', e => {
  if (accion.tipo !== 'entregar' || e.target.name !== 'peso_entregado') return
  const merma = Number(accion.op.peso_cargado) - Number(e.target.value)
  $('merma').textContent = e.target.value === '' ? '' : `Merma: ${kg(merma)} kg`
})

formAccion.addEventListener('submit', async e => {
  e.preventDefault()
  const ok = $('accion-ok')
  ok.disabled = true
  $('accion-estado').innerHTML = ''
  const err = await ACCIONES[accion.tipo](accion.op)
  if (err) {
    avisoAccion(err)
    ok.disabled = false
    return
  }
  dialogoAccion.close()
  mostrarToast(EXITO[accion.tipo])
  cargar()
})

dialogoAccion.querySelectorAll('[data-cerrar-accion]').forEach(b => b.addEventListener('click', () => dialogoAccion.close()))

cuerpo.addEventListener('click', e => {
  const btn = e.target.closest('[data-accion]')
  if (!btn) return
  const op = operaciones.find(o => String(o.id) === btn.dataset.id)
  if (!op) return
  if (btn.dataset.accion === 'editar') abrirEdicion(op)
  else abrirAccion(btn.dataset.accion, op)
})

cargar()