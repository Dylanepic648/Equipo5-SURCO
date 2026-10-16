import { supabase } from './supabase.js'

const $ = s => document.querySelector(s)
const formulario = $('#form-operacion')
const campos = formulario.elements
const zonaEstado = $('#zona-estado')
const zonaErrores = $('#errores')
const botonGuardar = $('#guardar')

const ERRORES_DB = {
  42501: 'Tu cuenta no tiene permiso para registrar operaciones.',
  23503: 'El cliente o el responsable seleccionado ya no existe.',
  23502: 'Falta un dato obligatorio. Revisa el formulario.',
  23514: 'Algún valor no es válido (por ejemplo, el estado).',
}

const aviso = (zona, clase, titulo, texto) => {
  zona.innerHTML = `<div class="aviso aviso--${clase}"><div><strong>${titulo}</strong>${texto}</div></div>`
}

const llenar = (select, filas, texto) =>
  select.replaceChildren(new Option(texto, ''), ...filas.map(f => new Option(f.nombre, f.id)))

function marcarError(nombre, mensaje) {
  const msg = $(`#error-${nombre}`)
  msg.textContent = mensaje
  msg.classList.remove('oculto')
  campos[nombre].setAttribute('aria-invalid', 'true')
  campos[nombre].closest('.campo')?.classList.add('campo--error')
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

  const [clientes, usuarios] = await Promise.all(
    ['clientes', 'usuarios'].map(t => supabase.from(t).select('id, nombre').eq('activo', true).order('nombre'))
  )

  if (clientes.error || usuarios.error) {
    zonaEstado.innerHTML = `<div class="estado-error mb-3">
      <p class="estado-error__titulo">No se pudieron cargar los catálogos</p>
      <p class="estado-error__texto">Revisa tu conexión e inténtalo de nuevo.</p>
      <button type="button" class="btn" id="btn-reintentar">Reintentar</button>
    </div>`
    $('#btn-reintentar').onclick = () => cargarCatalogos(usuario)
    return
  }

  llenar(campos.cliente_id, clientes.data, 'Selecciona un cliente')
  llenar(campos.usuario_id, usuarios.data, 'Selecciona un responsable')
  if (usuarios.data.some(u => u.id === usuario.id)) campos.usuario_id.value = usuario.id

  if (!clientes.data.length) {
    return aviso(zonaEstado, 'info', 'No hay clientes activos', 'Pide al administrador que registre un cliente antes de crear operaciones.')
  }
  zonaEstado.innerHTML = ''
}

formulario.addEventListener('submit', async e => {
  e.preventDefault()
  limpiarErrores()

  if (campos.tipo.value === 'venta') {
    return aviso(zonaErrores, 'info', 'Ventas próximamente', 'Por ahora solo se registran servicios. Cambia el tipo a "Servicio en campo".')
  }

  const descripcion = campos.descripcion_servicio.value.trim()
  const reglas = {
    fecha: ['Indica la fecha del servicio.', campos.fecha.value],
    cliente_id: ['Selecciona un cliente.', campos.cliente_id.value],
    usuario_id: ['Selecciona un responsable.', campos.usuario_id.value],
    descripcion_servicio: ['Describe el servicio con al menos 5 caracteres.', descripcion.length >= 5],
  }
  for (const [nombre, [mensaje, ok]] of Object.entries(reglas)) if (!ok) marcarError(nombre, mensaje)
  const invalido = formulario.querySelector('[aria-invalid="true"]')
  if (invalido) return invalido.focus()

  botonGuardar.disabled = true
  botonGuardar.textContent = 'Guardando…'

  const { error } = await supabase.from('operaciones').insert({
    tipo: 'servicio',
    cliente_id: Number(campos.cliente_id.value),
    usuario_id: campos.usuario_id.value,
    descripcion_servicio: descripcion,
    fecha: new Date(`${campos.fecha.value}T12:00:00`).toISOString(),
    estado: 'registrada',
    pendiente_envio: false,
  })

  if (error) {
    aviso(zonaErrores, 'error', 'No se pudo registrar el servicio', ERRORES_DB[error.code] ?? 'Revisa la conexión y la configuración de Supabase.')
    botonGuardar.disabled = false
    botonGuardar.textContent = 'Guardar operación'
    return
  }

  aviso(zonaErrores, 'exito', 'Servicio registrado', 'Quedó en estado registrada. Volviendo al listado…')
  setTimeout(() => location.href = 'operaciones.html', 1200)
})

formulario.addEventListener('change', e => e.target.name === 'tipo' && actualizarTipo())
formulario.addEventListener('input', e => e.target.name && limpiarError(e.target.name))

const { data: { session } } = await supabase.auth.getSession()
if (!session) {
  location.href = '../../login.html'
  throw new Error('Sin sesión')
}

campos.fecha.value = new Date().toLocaleDateString('en-CA')
const tipo = new URLSearchParams(location.search).get('tipo')
if (['servicio', 'venta'].includes(tipo)) campos.tipo.value = tipo
actualizarTipo()
cargarCatalogos(session.user)