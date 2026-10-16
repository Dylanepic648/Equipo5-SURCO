import { supabase } from './supabase.js'

const formulario = document.querySelector('#formulario-producto')
const estado = document.querySelector('#estado-registro')
const botonRegistro = formulario.querySelector('button[type="submit"]')

// Cambia este nombre si tu tabla de usuarios se llama distinto.
const TABLA_USUARIOS = 'usuarios'

function normalizarNombre(nombre) {
	return nombre.trim().toLocaleLowerCase('es')
}

function mostrarEstado(mensaje) {
	estado.textContent = mensaje
}

async function habilitarFormularioAdministrador() {
	const { data: { user }, error } = await supabase.auth.getUser()

	if (error || !user) {
		mostrarEstado('Acceso restringido: inicia sesión con una cuenta de administrador.')
		return
	}

	// El rol vive en la tabla de usuarios, no en app_metadata.
	const { data: perfil, error: errorPerfil } = await supabase
		.from(TABLA_USUARIOS)
		.select('rol, activo')
		.eq('id', user.id)
		.single()

	if (errorPerfil) {
		console.error('Error al consultar el perfil:', errorPerfil)
	}

	if (errorPerfil || !perfil || !perfil.activo || perfil.rol !== 'administrador') {
		mostrarEstado('Acceso restringido: inicia sesión con una cuenta de administrador.')
		return
	}

	formulario.hidden = false
	mostrarEstado('')
}

formulario.addEventListener('submit', async (evento) => {
	evento.preventDefault()
	botonRegistro.disabled = true
	mostrarEstado('Verificando el producto...')

	const datosFormulario = new FormData(formulario)
	const producto = {
		nombre: datosFormulario.get('nombre_producto').trim(),
		tipo_mercancia: datosFormulario.get('tipo_mercancia'),
		unidad: datosFormulario.get('unidad'),
		costo_unitario: Number(datosFormulario.get('costo_unitario')),
		precio_unitario: Number(datosFormulario.get('precio_unitario')),
		existencia: Number(datosFormulario.get('existencia_inicial'))
	}

	try {
		// Revisa nombres existentes antes de insertar el nuevo producto.
		const { data: existentes, error: errorConsulta } = await supabase
			.from('productos')
			.select('nombre')

		if (errorConsulta) throw errorConsulta

		const nombreNormalizado = normalizarNombre(producto.nombre)
		const duplicado = existentes.some((fila) =>
			normalizarNombre(fila.nombre) === nombreNormalizado
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
