import { supabase } from './supabase.js'

const formulario = document.querySelector('#formulario-producto')
const estado = document.querySelector('#estado-registro')
const botonRegistro = formulario.querySelector('button[type="submit"]')

function normalizarNombre(nombre) {
	return nombre.trim().toLocaleLowerCase('es')
}

function mostrarEstado(mensaje) {
	estado.textContent = mensaje
}

async function habilitarFormularioAdministrador() {
	const { data: { user }, error } = await supabase.auth.getUser()

	// Solo las cuentas con rol de administrador pueden ver y usar el formulario.
	if (error || !user || user.app_metadata?.rol !== 'administrador') {
		mostrarEstado('Acceso restringido: inicia sesión con una cuenta de administrador.')
		return
	}

	formulario.hidden = false
}

formulario.addEventListener('submit', async (evento) => {
	evento.preventDefault()
	botonRegistro.disabled = true
	mostrarEstado('Verificando el producto...')

	const datosFormulario = new FormData(formulario)
	const producto = {
		nombre_producto: datosFormulario.get('nombre_producto').trim(),
		tipo_mercancia: datosFormulario.get('tipo_mercancia'),
		unidad: datosFormulario.get('unidad'),
		costo_unitario: Number(datosFormulario.get('costo_unitario')),
		precio_unitario: Number(datosFormulario.get('precio_unitario')),
		existencia_inicial: Number(datosFormulario.get('existencia_inicial'))
	}

	try {
		// Revisa nombres existentes antes de insertar el nuevo producto.
		const { data: existentes, error: errorConsulta } = await supabase
			.from('productos')
			.select('nombre_producto')

		if (errorConsulta) throw errorConsulta

		const nombreNormalizado = normalizarNombre(producto.nombre_producto)
		const duplicado = existentes.some((fila) =>
			normalizarNombre(fila.nombre_producto) === nombreNormalizado
		)

		if (duplicado) {
			mostrarEstado('Ya existe un producto con ese nombre.')
			return
		}

		const { error: errorRegistro } = await supabase
			.from('productos')
			.insert(producto)

		if (errorRegistro) {
			if (errorRegistro.code === '23505') {
				mostrarEstado('Ya existe un producto con ese nombre.')
				return
			}
			throw errorRegistro
		}

		formulario.reset()
		mostrarEstado('Producto registrado correctamente.')
	} catch (error) {
		console.error('Error al registrar el producto:', error)
		mostrarEstado('No se pudo registrar el producto. Revisa la conexión y la configuración de Supabase.')
	} finally {
		botonRegistro.disabled = false
	}
})

habilitarFormularioAdministrador().catch((error) => {
	console.error('Error al validar el acceso:', error)
	mostrarEstado('No se pudo validar el acceso. Intenta iniciar sesión nuevamente.')
})
