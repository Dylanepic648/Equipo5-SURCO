import { supabase } from './supabase.js'

const formulario = document.querySelector('#formulario-entrada')
const modalEntrada = document.querySelector('#modal-entrada')
const selectorProducto = document.querySelector('#producto-entrada')
const estado = document.querySelector('#estado-entrada')
const estadoGeneral = document.querySelector('#estado-registro')
const botonRegistro = formulario.querySelector('button[type="submit"]')

function mostrarEstado(mensaje) {
	estado.textContent = mensaje
}

async function cargarProductos() {
	const { data: { user }, error: errorUsuario } = await supabase.auth.getUser()
	if (errorUsuario || !user) {
		return false
	}

	const { data: perfil, error: errorPerfil } = await supabase
		.from('usuarios')
		.select('rol, activo')
		.eq('id', user.id)
		.single()

	if (errorPerfil || !perfil?.activo || perfil.rol !== 'administrador') {
		return false
	}

	const { data: productos, error } = await supabase
		.from('productos')
		.select('id, nombre, unidad, existencia')
		.order('nombre')

	if (error) throw error

	selectorProducto.replaceChildren(
		new Option('Selecciona un producto', ''),
		...productos.map((producto) => new Option(
			`${producto.nombre} - Existencia: ${producto.existencia} ${producto.unidad}`,
			String(producto.id)
		))
	)

	if (!productos.length) {
		mostrarEstado('Primero registra un producto para poder agregar existencias.')
		return false
	}

	mostrarEstado('')
	return true
}

document.querySelector('#abrir-modal-entrada').addEventListener('click', async () => {
	estado.textContent = ''
	modalEntrada.showModal()
	try {
		await cargarProductos()
	} catch (error) {
		console.error('Error al cargar productos para la entrada:', error)
		mostrarEstado('No se pudieron cargar los productos.')
	}
})

formulario.addEventListener('submit', async (evento) => {
	evento.preventDefault()
	botonRegistro.disabled = true
	mostrarEstado('Registrando entrada...')

	const datos = new FormData(formulario)
	try {
		const { error } = await supabase.rpc('registrar_entrada_inventario', {
			p_producto_id: datos.get('producto_id'),
			p_cantidad: Number(datos.get('cantidad')),
			p_motivo: datos.get('motivo').trim()
		})

		if (error) throw error
	} catch (error) {
		console.error('Error al registrar la entrada:', error)
		mostrarEstado(error.code === '42501'
			? 'Solo un administrador activo puede registrar entradas.'
			: 'No se pudo registrar la entrada. Revisa los datos y la configuración de Supabase.')
		botonRegistro.disabled = false
		return
	}

	formulario.reset()
	modalEntrada.close()
	estadoGeneral.textContent = 'Entrada registrada; la existencia y el movimiento fueron actualizados.'
	window.dispatchEvent(new Event('inventario:actualizar-productos'))
	try {
		await cargarProductos()
	} catch (error) {
		console.error('La entrada se registró, pero no se pudo actualizar el catálogo:', error)
		estadoGeneral.textContent = 'La entrada se registró, pero no se pudo actualizar la tabla.'
	} finally {
		botonRegistro.disabled = false
	}
})

cargarProductos().catch((error) => {
	console.error('Error al cargar productos:', error)
	mostrarEstado('No se pudieron cargar los productos. Revisa la conexión y los permisos de Supabase.')
})