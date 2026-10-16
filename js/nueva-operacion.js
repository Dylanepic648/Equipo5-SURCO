import { supabase } from './supabase.js'

const formulario = document.querySelector('#form-operacion')
const zonaEstado = document.querySelector('#zona-estado')
const zonaErrores = document.querySelector('#errores')
const botonGuardar = document.querySelector('#guardar')
const bloqueServicio = document.querySelector('#bloque-servicio')
const bloqueVenta = document.querySelector('#bloque-venta')
const resumenVenta = document.querySelector('#res-venta')
const avisoVenta = document.querySelector('#aviso-venta')
const avisoServicio = document.querySelector('#aviso-servicio')
const resumenTipo = document.querySelector('#res-tipo')

const campos = formulario.elements

function crearAviso(clase, titulo, texto) {
	const aviso = document.createElement('div')
	aviso.className = `aviso aviso--${clase}`
	const cuerpo = document.createElement('div')
	const fuerte = document.createElement('strong')
	fuerte.textContent = titulo
	cuerpo.append(fuerte, texto)
	aviso.append(cuerpo)
	return aviso
}

function mostrarAviso(zona, clase, titulo, texto) {
	zona.replaceChildren(crearAviso(clase, titulo, texto))
}

function marcarError(nombre, mensaje) {
	const control = campos[nombre]
	const mensajeError = document.querySelector(`#error-${nombre}`)
	mensajeError.textContent = mensaje
	mensajeError.classList.remove('oculto')
	control.setAttribute('aria-invalid', 'true')
	control.closest('.campo')?.classList.add('campo--error')
}

function limpiarError(nombre) {
	const mensajeError = document.querySelector(`#error-${nombre}`)
	if (!mensajeError) return
	mensajeError.textContent = ''
	mensajeError.classList.add('oculto')
	campos[nombre]?.removeAttribute('aria-invalid')
	campos[nombre]?.closest('.campo')?.classList.remove('campo--error')
}

function limpiarErrores() {
	zonaErrores.replaceChildren()
	document.querySelectorAll('[id^="error-"]').forEach((mensajeError) => {
		limpiarError(mensajeError.id.replace('error-', ''))
	})
}

function llenarSelect(select, filas, textoInicial) {
	select.replaceChildren(new Option(textoInicial, ''))
	for (const fila of filas) select.append(new Option(fila.nombre, fila.id))
}

function tipoActual() {
	return campos.tipo.value
}

function actualizarTipo() {
	const esServicio = tipoActual() === 'servicio'
	bloqueServicio.classList.toggle('oculto', !esServicio)
	bloqueVenta.classList.toggle('oculto', esServicio)
	resumenVenta.classList.toggle('oculto', esServicio)
	avisoVenta.classList.toggle('oculto', esServicio)
	avisoServicio.classList.toggle('oculto', !esServicio)
	resumenTipo.textContent = esServicio ? 'Servicio' : 'Venta'
	limpiarErrores()
}

function mostrarCargando() {
	const esqueleto = document.createElement('div')
	esqueleto.className = 'esqueleto esqueleto--titulo'
	zonaEstado.replaceChildren(esqueleto)
}

function mostrarErrorCarga(reintentar) {
	const caja = document.createElement('div')
	caja.className = 'estado-error mb-3'

	const titulo = document.createElement('p')
	titulo.className = 'estado-error__titulo'
	titulo.textContent = 'No se pudieron cargar los catálogos'

	const texto = document.createElement('p')
	texto.className = 'estado-error__texto'
	texto.textContent = 'Revisa tu conexión e inténtalo de nuevo.'

	const boton = document.createElement('button')
	boton.type = 'button'
	boton.className = 'btn'
	boton.textContent = 'Reintentar'
	boton.addEventListener('click', reintentar)

	caja.append(titulo, texto, boton)
	zonaEstado.replaceChildren(caja)
}

async function cargarCatalogos(usuarioActual) {
	mostrarCargando()

	const [clientes, usuarios] = await Promise.all([
		supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
		supabase.from('usuarios').select('id, nombre').eq('activo', true).order('nombre')
	])

	if (clientes.error || usuarios.error) {
		console.error('Error al cargar catálogos:', clientes.error ?? usuarios.error)
		mostrarErrorCarga(() => cargarCatalogos(usuarioActual))
		return
	}

	llenarSelect(campos.cliente_id, clientes.data, 'Selecciona un cliente')
	llenarSelect(campos.usuario_id, usuarios.data, 'Selecciona un responsable')

	// Por defecto, el responsable es quien está registrando.
	if (usuarios.data.some((u) => u.id === usuarioActual.id)) {
		campos.usuario_id.value = usuarioActual.id
	}

	if (clientes.data.length === 0) {
		mostrarAviso(zonaEstado, 'aviso', 'No hay clientes activos', 'Pide al administrador que registre un cliente antes de crear operaciones.')
		return
	}

	zonaEstado.replaceChildren()
}

function leerServicio() {
	return {
		fecha: campos.fecha.value,
		cliente_id: campos.cliente_id.value,
		usuario_id: campos.usuario_id.value,
		descripcion: campos.descripcion_servicio.value.trim()
	}
}

function validarServicio(datos) {
	let valido = true

	if (!datos.fecha) {
		marcarError('fecha', 'Indica la fecha del servicio.')
		valido = false
	}
	if (!datos.cliente_id) {
		marcarError('cliente_id', 'Selecciona un cliente.')
		valido = false
	}
	if (!datos.usuario_id) {
		marcarError('usuario_id', 'Selecciona un responsable.')
		valido = false
	}
	if (!datos.descripcion) {
		marcarError('descripcion_servicio', 'La descripción es obligatoria.')
		valido = false
	} else if (datos.descripcion.length < 5) {
		marcarError('descripcion_servicio', 'Describe el servicio con al menos 5 caracteres.')
		valido = false
	}

	if (!valido) formulario.querySelector('[aria-invalid="true"]')?.focus()
	return valido
}

function mensajeDeError(error) {
	switch (error.code) {
		case '42501': return 'Tu cuenta no tiene permiso para registrar operaciones.'
		case '23503': return 'El cliente o el responsable seleccionado ya no existe.'
		case '23502': return 'Falta un dato obligatorio. Revisa el formulario.'
		case '23514': return 'Algún valor no es válido (por ejemplo, el estado).'
		default: return 'Revisa la conexión y la configuración de Supabase.'
	}
}

formulario.addEventListener('submit', async (evento) => {
	evento.preventDefault()
	limpiarErrores()

	if (tipoActual() === 'venta') {
		mostrarAviso(zonaErrores, 'info', 'Ventas próximamente', 'Por ahora solo se registran servicios. Cambia el tipo a "Servicio en campo".')
		return
	}

	const datos = leerServicio()
	if (!validarServicio(datos)) return

	const operacion = {
		tipo: 'servicio',
		cliente_id: Number(datos.cliente_id),
		usuario_id: datos.usuario_id,
		descripcion_servicio: datos.descripcion,
		fecha: new Date(`${datos.fecha}T12:00:00`).toISOString(),
		estado: 'registrada',
		pendiente_envio: false
	}

	botonGuardar.disabled = true
	botonGuardar.textContent = 'Guardando…'

	try {
		const { error } = await supabase.from('operaciones').insert(operacion)
		if (error) throw error

		mostrarAviso(zonaErrores, 'exito', 'Servicio registrado', 'Quedó en estado registrada. Volviendo al listado…')
		setTimeout(() => { window.location.href = 'operaciones.html' }, 1200)
	} catch (error) {
		console.error('Error al registrar el servicio:', error)
		mostrarAviso(zonaErrores, 'error', 'No se pudo registrar el servicio', mensajeDeError(error))
		botonGuardar.disabled = false
		botonGuardar.textContent = 'Guardar operación'
	}
})

formulario.addEventListener('change', (evento) => {
	if (evento.target.name === 'tipo') actualizarTipo()
})

formulario.addEventListener('input', (evento) => {
	if (evento.target.name) limpiarError(evento.target.name)
})

async function iniciar(usuario) {
	campos.fecha.value = new Date().toLocaleDateString('en-CA')

	const tipoUrl = new URLSearchParams(window.location.search).get('tipo')
	if (tipoUrl === 'servicio' || tipoUrl === 'venta') campos.tipo.value = tipoUrl

	actualizarTipo()
	await cargarCatalogos(usuario)
}

const { data: { session } } = await supabase.auth.getSession()
if (!session) {
	window.location.href = '../../login.html'
} else {
	await iniciar(session.user)
}