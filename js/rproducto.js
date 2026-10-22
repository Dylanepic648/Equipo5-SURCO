import { supabase } from './supabase.js'

const formulario = document.querySelector('#formulario-producto')
const inventarioContenido = document.querySelector('#inventario-contenido')
const accionesInventario = document.querySelector('#acciones-inventario')
const columnaPrecio = document.querySelector('#columna-precio')
const modalProducto = document.querySelector('#modal-producto')
const cuerpoProductos = document.querySelector('#cuerpo-productos')
const cuerpoMovimientos = document.querySelector('#cuerpo-movimientos')
const plantillaEsqueleto = document.querySelector('#plantilla-esqueleto-producto')
const estado = document.querySelector('#estado-registro')
const estadoCatalogo = document.querySelector('#estado-catalogo')
const estadoMovimientos = document.querySelector('#estado-movimientos')
const estadoFormulario = document.querySelector('#estado-formulario-producto')
const botonRegistro = formulario.querySelector('button[type="submit"]')
const filtrosProductos = document.querySelector('#filtros-productos')
const busquedaProducto = document.querySelector('#buscar-producto')
const filtroTipo = document.querySelector('#filtro-tipo')
const filtroUnidad = document.querySelector('#filtro-unidad')
const ordenProductos = document.querySelector('#orden-productos')
let productosCatalogo = []
let rolActual = ''

// Cambia este nombre si tu tabla de usuarios se llama distinto.
const TABLA_USUARIOS = 'usuarios'

function normalizarNombre(nombre) {
	return nombre.trim().toLocaleLowerCase('es')
}

function mostrarEstado(mensaje) {
	estado.textContent = mensaje
}

function formatearPrecio(precio) {
	return new Intl.NumberFormat('es-MX', {
		style: 'currency',
		currency: 'MXN'
	}).format(Number(precio))
}

function actualizarOpcionesFiltro(selector, valores, etiquetaTodos, valorAnterior) {
	const opciones = [...new Set(valores.filter(Boolean))]
		.sort((a, b) => a.localeCompare(b, 'es'))

	selector.replaceChildren(
		new Option(etiquetaTodos, ''),
		...opciones.map((valor) => new Option(valor, valor))
	)
	selector.value = opciones.includes(valorAnterior) ? valorAnterior : ''
}

function renderizarProductos() {
	const texto = busquedaProducto.value.trim().toLocaleLowerCase('es')
	const tipo = filtroTipo.value
	const unidad = filtroUnidad.value
	const productos = productosCatalogo
		.filter((producto) => producto.nombre.toLocaleLowerCase('es').includes(texto))
		.filter((producto) => !tipo || producto.tipo_mercancia === tipo)
		.filter((producto) => !unidad || producto.unidad === unidad)
		.sort((a, b) => {
			switch (ordenProductos.value) {
				case 'precio-desc':
					return Number(b.precio_unitario) - Number(a.precio_unitario)
				case 'precio-asc':
					return Number(a.precio_unitario) - Number(b.precio_unitario)
				case 'existencia-desc':
					return Number(b.existencia) - Number(a.existencia)
				case 'existencia-asc':
					return Number(a.existencia) - Number(b.existencia)
				default:
					return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
			}
		})

	if (!productos.length) {
		const fila = document.createElement('tr')
		const celda = document.createElement('td')
		celda.colSpan = rolActual === 'administrador' ? 5 : 4
		celda.textContent = productosCatalogo.length
			? 'No hay productos que coincidan con los filtros.'
			: 'No hay productos visibles. Si esperabas productos, revisa la política de lectura de Supabase para el rol operador.'
		fila.append(celda)
		cuerpoProductos.replaceChildren(fila)
		estadoCatalogo.textContent = ''
		return
	}

	const filas = productos.map((producto) => {
		const fila = document.createElement('tr')
		const valores = [
			producto.nombre,
			producto.tipo_mercancia,
			producto.unidad
		]
		if (rolActual === 'administrador') valores.push(formatearPrecio(producto.precio_unitario))
		valores.push(
			`${Number(producto.existencia).toLocaleString('es-MX', { maximumFractionDigits: 3 })} ${producto.unidad}`
		)

		for (const [indice, valor] of valores.entries()) {
			const celda = document.createElement('td')
			celda.textContent = valor ?? '—'
			if (indice >= 3) celda.className = 'num'
			fila.append(celda)
		}

		return fila
	})

	cuerpoProductos.replaceChildren(...filas)
	estadoCatalogo.textContent = `Mostrando ${productos.length} de ${productosCatalogo.length} productos.`
}

function mostrarEsqueletos() {
	const filas = Array.from({ length: 4 }, () => {
		const fila = plantillaEsqueleto.content.cloneNode(true)
		if (rolActual !== 'administrador') fila.querySelectorAll('td')[3]?.remove()
		return fila
	})
	cuerpoProductos.replaceChildren(...filas)
}

async function cargarProductos() {
	estadoCatalogo.textContent = 'Cargando productos...'
	inventarioContenido.setAttribute('aria-busy', 'true')
	mostrarEsqueletos()

	try {
		const columnas = rolActual === 'administrador'
			? 'id, nombre, tipo_mercancia, unidad, precio_unitario, existencia'
			: 'id, nombre, tipo_mercancia, unidad, existencia'
		const { data: productos, error } = await supabase
			.from('productos')
			.select(columnas)
			.order('nombre')

		if (error) throw error

		productosCatalogo = productos ?? []
		actualizarOpcionesFiltro(
			filtroTipo,
			productosCatalogo.map((producto) => producto.tipo_mercancia),
			'Todos los tipos',
			filtroTipo.value
		)
		actualizarOpcionesFiltro(
			filtroUnidad,
			productosCatalogo.map((producto) => producto.unidad),
			'Todas las unidades',
			filtroUnidad.value
		)
		renderizarProductos()
	} catch (error) {
		cuerpoProductos.replaceChildren()
		throw error
	} finally {
		inventarioContenido.removeAttribute('aria-busy')
	}
}

async function cargarMovimientos() {
	estadoMovimientos.textContent = 'Cargando movimientos...'

	const [movimientosResultado, productosResultado, usuariosResultado] = await Promise.all([
		supabase
			.from('movimientos_inventario')
			.select('id, producto_id, tipo, cantidad, motivo, fecha, usuario_id, pendiente_envio')
			.order('fecha', { ascending: false }),
		supabase.from('productos').select('id, nombre'),
		supabase.from('usuarios').select('id, nombre')
	])

	if (movimientosResultado.error) throw movimientosResultado.error
	if (productosResultado.error) throw productosResultado.error
	if (usuariosResultado.error) throw usuariosResultado.error

	const nombresProductos = new Map(productosResultado.data.map((producto) => [String(producto.id), producto.nombre]))
	const nombresUsuarios = new Map(usuariosResultado.data.map((usuario) => [usuario.id, usuario.nombre]))

	if (!movimientosResultado.data.length) {
		const fila = document.createElement('tr')
		const celda = document.createElement('td')
		celda.colSpan = 7
		celda.textContent = 'No hay movimientos visibles. Revisa que existan movimientos y que Supabase permita su lectura para este rol.'
		fila.append(celda)
		cuerpoMovimientos.replaceChildren(fila)
		estadoMovimientos.textContent = ''
		return
	}

	const tipos = { entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste' }
	const filas = movimientosResultado.data.map((movimiento) => {
		const fila = document.createElement('tr')
		const valores = [
			nombresProductos.get(String(movimiento.producto_id)) ?? `Producto ${movimiento.producto_id}`,
			tipos[movimiento.tipo] ?? movimiento.tipo,
			Number(movimiento.cantidad).toLocaleString('es-MX', { maximumFractionDigits: 3 }),
			movimiento.motivo,
			movimiento.fecha ? new Date(movimiento.fecha).toLocaleString('es-MX') : '—',
			nombresUsuarios.get(movimiento.usuario_id) ?? '—',
			movimiento.pendiente_envio ? 'Pendiente de envío' : 'Registrado'
		]

		for (const [indice, valor] of valores.entries()) {
			const celda = document.createElement('td')
			celda.textContent = valor ?? '—'
			if (indice === 2) celda.className = 'num'
			fila.append(celda)
		}

		return fila
	})

	cuerpoMovimientos.replaceChildren(...filas)
	estadoMovimientos.textContent = `Mostrando ${filas.length} movimientos.`
}

filtrosProductos.addEventListener('input', renderizarProductos)
filtrosProductos.addEventListener('change', renderizarProductos)
filtrosProductos.addEventListener('reset', () => setTimeout(renderizarProductos))

async function habilitarFormularioAdministrador() {
	const { data: { user }, error } = await supabase.auth.getUser()

	if (error || !user) {
		mostrarEstado('Inicia sesión con una cuenta activa para consultar el inventario.')
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

	const rol = String(perfil?.rol ?? '').trim().toLocaleLowerCase('es')
	if (errorPerfil || !perfil || !perfil.activo || !['administrador', 'operador'].includes(rol)) {
		mostrarEstado('Tu usuario no tiene un rol activo con acceso al inventario.')
		return
	}

	rolActual = rol
	const esAdministrador = rolActual === 'administrador'
	columnaPrecio.hidden = !esAdministrador
	accionesInventario.hidden = !esAdministrador
	ordenProductos.querySelectorAll('option[value^="precio-"]').forEach((opcion) => {
		opcion.hidden = !esAdministrador
		opcion.disabled = !esAdministrador
	})
	if (!esAdministrador && ordenProductos.value.startsWith('precio-')) {
		ordenProductos.value = 'nombre-asc'
	}
	inventarioContenido.hidden = false
	mostrarEstado('')

	const [productos, movimientos] = await Promise.allSettled([
		cargarProductos(),
		cargarMovimientos()
	])
	if (productos.status === 'rejected') {
		console.error('Error al cargar productos:', productos.reason)
		estadoCatalogo.textContent = 'No se pudo cargar el inventario. Revisa la conexión y los permisos de Supabase.'
	}
	if (movimientos.status === 'rejected') {
		console.error('Error al cargar movimientos:', movimientos.reason)
		cuerpoMovimientos.replaceChildren()
		estadoMovimientos.textContent = 'No se pudieron cargar los movimientos. Revisa la conexión y los permisos de Supabase.'
	}
}

document.querySelector('#abrir-modal-producto').addEventListener('click', () => {
	if (rolActual !== 'administrador') return
	estadoFormulario.textContent = ''
	modalProducto.showModal()
})

document.querySelectorAll('[data-cerrar-dialogo]').forEach((boton) => {
	boton.addEventListener('click', () => boton.closest('dialog').close())
})

document.querySelectorAll('dialog.dialogo').forEach((dialogo) => {
	dialogo.addEventListener('click', (evento) => {
		if (evento.target === dialogo) dialogo.close()
	})
})

window.addEventListener('inventario:actualizar-productos', () => {
	cargarProductos().catch((error) => {
		console.error('Error al actualizar el inventario:', error)
		estadoCatalogo.textContent = 'No se pudo actualizar el inventario.'
	})
	cargarMovimientos().catch((error) => {
		console.error('Error al actualizar los movimientos:', error)
		estadoMovimientos.textContent = 'No se pudo actualizar la tabla de movimientos.'
	})
})

formulario.addEventListener('submit', async (evento) => {
	evento.preventDefault()
	if (rolActual !== 'administrador') {
		estadoFormulario.textContent = 'Solo un administrador puede registrar productos.'
		return
	}

	botonRegistro.disabled = true
	estadoFormulario.textContent = 'Verificando el producto...'

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
			estadoFormulario.textContent = 'Ya existe un producto con ese nombre.'
			return
		}

		const { error: errorRegistro } = await supabase
			.from('productos')
			.insert(producto)

		if (errorRegistro) {
			if (errorRegistro.code === '23505') {
				estadoFormulario.textContent = 'Ya existe un producto con ese nombre.'
				return
			}
			throw errorRegistro
		}
	} catch (error) {
		console.error('Error al registrar el producto:', error)
		estadoFormulario.textContent = 'No se pudo registrar el producto. Revisa la conexión y la configuración de Supabase.'
		return
	} finally {
		botonRegistro.disabled = false
	}

	formulario.reset()
	modalProducto.close()
	mostrarEstado('Producto registrado correctamente.')
	try {
		await cargarProductos()
	} catch (error) {
		console.error('El producto se registró, pero no se pudo actualizar el catálogo:', error)
		estadoCatalogo.textContent = 'El producto se registró, pero no se pudo actualizar la tabla.'
	}
})

habilitarFormularioAdministrador().catch((error) => {
	console.error('Error al validar el acceso:', error)
	mostrarEstado('No se pudo validar el acceso. Intenta iniciar sesión nuevamente.')
})
