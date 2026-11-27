import { supabase } from './supabase.js'
import { sincronizarCatalogos } from './sync.js'
import { leerTodos, reemplazarTodos } from './db.js'

const formulario = document.querySelector('#formulario-producto')
const inventarioContenido = document.querySelector('#inventario-contenido')
const accionesInventario = document.querySelector('#acciones-inventario')
const columnaPrecio = document.querySelector('#columna-precio')
const columnaCosto = document.querySelector('#columna-costo')
const columnaAcciones = document.querySelector('#columna-acciones')
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

const TABLA_USUARIOS = 'usuarios'

function normalizarNombre(nombre) {
	return nombre.trim().toLocaleLowerCase('es')
}

const FACTOR_KG = { Kilogramo: 1, Tonelada: 1000 }
function aKg(cantidad, unidad) {
	return Number(cantidad) * (FACTOR_KG[unidad] ?? 1)
}
function deKg(cantidad, unidad) {
	return Number(cantidad) / (FACTOR_KG[unidad] ?? 1)
}
function formatearCantidad(cantidad, unidad) {
	return `${Number(cantidad).toLocaleString('es-MX', { maximumFractionDigits: 3 })} ${unidad}`
}

function mostrarEstado(mensaje) {
	estado.textContent = mensaje
}

function mostrarErrorConexion() {
	inventarioContenido.hidden = true
	accionesInventario.hidden = true
	document.querySelector('#encabezado-inventario')?.classList.add('oculto')
	document.querySelector('#filtros-productos')?.classList.add('oculto')
	estado.className = ''
	estado.innerHTML = `<div class="estado-error">
		<p class="estado-error__titulo">No pudimos cargar el inventario</p>
		<p class="estado-error__texto">Revisa tu conexión e inténtalo de nuevo.</p>
		<button type="button" class="btn" id="btn-reintentar-inventario">Reintentar</button>
	</div>`
	document.querySelector('#btn-reintentar-inventario').onclick = () => location.reload()
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
		celda.colSpan = rolActual === 'administrador' ? 7 : 4
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
		if (rolActual === 'administrador') {
			valores.push(formatearPrecio(producto.costo_unitario))
			valores.push(formatearPrecio(producto.precio_unitario))
		}
		valores.push(
			`${deKg(producto.existencia, producto.unidad).toLocaleString('es-MX', { maximumFractionDigits: 3 })} ${producto.unidad}`
		)

		for (const [indice, valor] of valores.entries()) {
			const celda = document.createElement('td')
			celda.textContent = valor ?? '—'
			if (indice >= 3) celda.className = 'num'
			fila.append(celda)
		}

		if (rolActual === 'administrador') {
			const celdaAcciones = document.createElement('td')
			celdaAcciones.className = 'num'
			const grupo = document.createElement('div')
			grupo.className = 'acciones acciones--pegadas'
			const btnKardex = document.createElement('button')
			btnKardex.className = 'btn btn--secundario btn--pequeno'
			btnKardex.textContent = 'Kardex'
			btnKardex.addEventListener('click', () => abrirKardex(producto))
			const btnEditar = document.createElement('button')
			btnEditar.className = 'btn btn--secundario btn--pequeno'
			btnEditar.textContent = 'Editar'
			btnEditar.addEventListener('click', () => abrirEditar(producto))
			grupo.append(btnKardex, btnEditar)
			celdaAcciones.append(grupo)
			fila.append(celdaAcciones)
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
		let productos = []
		try {
			const columnas = 'id, nombre, tipo_mercancia, unidad, costo_unitario, precio_unitario, existencia, activo'
			let consulta = supabase.from('productos').select(columnas).order('nombre')
			if (rolActual !== 'administrador') consulta = consulta.eq('activo', true)
			const resultado = await consulta
			if (resultado.error) throw resultado.error
			productos = resultado.data ?? []
			await reemplazarTodos('productos', productos).catch(() => {})
		} catch (error) {
			if (!navigator.onLine) {
				mostrarErrorConexion()
				productos = []
			} else {
				throw error
			}
		}

		productosCatalogo = productos
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

let movimientosData = []
let nombresProductosMap = new Map()
let nombresUsuariosMap = new Map()

function renderMovimientos() {
	const filtro = document.querySelector('#filtro-mov-producto')?.value || ''
	const filtrados = filtro
		? movimientosData.filter((m) => String(m.producto_id) === filtro)
		: movimientosData

	if (!filtrados.length) {
		const fila = document.createElement('tr')
		const celda = document.createElement('td')
		celda.colSpan = 7
		celda.textContent = movimientosData.length
			? 'No hay movimientos para ese producto.'
			: 'No hay movimientos visibles. Revisa que existan movimientos y que Supabase permita su lectura para este rol.'
		fila.append(celda)
		cuerpoMovimientos.replaceChildren(fila)
		estadoMovimientos.textContent = ''
		return
	}

	const tipos = { entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste' }
	const filas = filtrados.map((movimiento) => {
		const fila = document.createElement('tr')
		const valores = [
			nombresProductosMap.get(String(movimiento.producto_id)) ?? `Producto ${movimiento.producto_id}`,
			tipos[movimiento.tipo] ?? movimiento.tipo,
			`${Number(movimiento.cantidad).toLocaleString('es-MX', { maximumFractionDigits: 3 })} kg`,
			movimiento.motivo,
			movimiento.fecha ? new Date(movimiento.fecha).toLocaleString('es-MX') : '—',
			nombresUsuariosMap.get(movimiento.usuario_id) ?? '—',
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
	estadoMovimientos.textContent = `Mostrando ${filas.length} de ${movimientosData.length} movimientos.`
}

async function cargarMovimientos() {
	estadoMovimientos.textContent = 'Cargando movimientos...'

	let movimientos = []
	let productos = []
	let usuarios = []
	try {
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
		movimientos = movimientosResultado.data ?? []
		productos = productosResultado.data ?? []
		usuarios = usuariosResultado.data ?? []
		await reemplazarTodos('movimientos', movimientos).catch(() => {})
		await reemplazarTodos('usuarios', usuarios).catch(() => {})
	} catch (error) {
		if (!navigator.onLine) {
			movimientos = []
			productos = []
			usuarios = []
			mostrarErrorConexion()
		} else {
			throw error
		}
	}

	nombresProductosMap = new Map(productos.map((producto) => [String(producto.id), producto.nombre]))
	nombresUsuariosMap = new Map(usuarios.map((usuario) => [usuario.id, usuario.nombre]))
	movimientosData = movimientos

	const selector = document.querySelector('#filtro-mov-producto')
	if (selector) {
		const ids = [...new Set(movimientosData.map((m) => String(m.producto_id)))]
		selector.replaceChildren(
			new Option('Todos los productos', ''),
			...ids.map((id) => new Option(nombresProductosMap.get(id) ?? `Producto ${id}`, id))
		)
		selector.onchange = renderMovimientos
	}

	renderMovimientos()
}

filtrosProductos.addEventListener('input', renderizarProductos)

const modalKardex = document.querySelector('#modal-kardex')
const cuerpoKardex = document.querySelector('#cuerpo-kardex')
const estadoKardex = document.querySelector('#estado-kardex')

async function abrirKardex(producto) {
	estadoKardex.textContent = 'Cargando movimientos...'
	cuerpoKardex.replaceChildren()
	modalKardex.showModal()
	try {
		const [{ data: movs, error: e1 }, { data: usuarios, error: e2 }] = await Promise.all([
			supabase.from('movimientos_inventario').select('id, tipo, cantidad, motivo, fecha, usuario_id, operacion_id').eq('producto_id', producto.id).order('fecha', { ascending: true }),
			supabase.from('usuarios').select('id, nombre')
		])
		if (e1) throw e1
		if (e2) throw e2
		const nombresUsuarios = new Map((usuarios ?? []).map((u) => [u.id, u.nombre]))
		const tipos = { entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste' }
		let saldo = 0
		const filas = (movs ?? []).map((m) => {
			const signo = m.tipo === 'salida' ? -1 : 1
			saldo += signo * Number(m.cantidad)
			const fila = document.createElement('tr')
			const valores = [
				m.fecha ? new Date(m.fecha).toLocaleString('es-MX') : '—',
				tipos[m.tipo] ?? m.tipo,
				`${deKg(m.cantidad, producto.unidad).toLocaleString('es-MX', { maximumFractionDigits: 3 })} ${producto.unidad}`,
				m.motivo ?? '—',
				nombresUsuarios.get(m.usuario_id) ?? '—',
				`${deKg(saldo, producto.unidad).toLocaleString('es-MX', { maximumFractionDigits: 3 })} ${producto.unidad}`
			]
			for (const [i, v] of valores.entries()) {
				const c = document.createElement('td')
				c.textContent = v ?? '—'
				if (i === 2 || i === 5) c.className = 'num'
				fila.append(c)
			}
			return fila
		})
		if (!filas.length) {
			const fila = document.createElement('tr')
			const c = document.createElement('td')
			c.colSpan = 6
			c.textContent = 'Sin movimientos para este producto.'
			fila.append(c)
			cuerpoKardex.replaceChildren(fila)
		} else {
			cuerpoKardex.replaceChildren(...filas)
		}
		estadoKardex.textContent = `Saldo actual: ${deKg(producto.existencia, producto.unidad).toLocaleString('es-MX', { maximumFractionDigits: 3 })} ${producto.unidad}`
	} catch (error) {
		console.error(error)
		estadoKardex.textContent = 'No se pudo cargar el kardex.'
	}
}

const modalEditar = document.querySelector('#modal-editar')
const formularioEditar = document.querySelector('#formulario-editar')
const estadoEditar = document.querySelector('#estado-editar')

function abrirEditar(producto) {
	estadoEditar.textContent = ''
	formularioEditar.reset()
	formularioEditar.elements.id.value = producto.id
	formularioEditar.elements.nombre_producto.value = producto.nombre
	formularioEditar.elements.tipo_mercancia.value = producto.tipo_mercancia
	formularioEditar.elements.unidad.value = producto.unidad
	formularioEditar.elements.costo_unitario.value = producto.costo_unitario
	formularioEditar.elements.precio_unitario.value = producto.precio_unitario
	formularioEditar.elements.activo.checked = !!producto.activo
	modalEditar.showModal()
}

formularioEditar.addEventListener('submit', async (e) => {
	e.preventDefault()
	if (rolActual !== 'administrador') return
	const fd = new FormData(formularioEditar)
	const id = fd.get('id')
	const datos = {
		nombre: fd.get('nombre_producto').trim(),
		tipo_mercancia: fd.get('tipo_mercancia'),
		unidad: fd.get('unidad'),
		costo_unitario: Number(fd.get('costo_unitario')),
		precio_unitario: Number(fd.get('precio_unitario')),
		activo: fd.get('activo') === 'on'
	}
	try {
		const { error } = await supabase.from('productos').update(datos).eq('id', id)
		if (error) throw error
		modalEditar.close()
		mostrarEstado('Producto actualizado.')
		await cargarProductos()
	} catch (err) {
		console.error(err)
		estadoEditar.textContent = 'No se pudo actualizar el producto.'
	}
})

const modalAjuste = document.querySelector('#modal-ajuste')
const formularioAjuste = document.querySelector('#formulario-ajuste')
const selectorAjuste = document.querySelector('#producto-ajuste')
const estadoAjuste = document.querySelector('#estado-ajuste')

document.querySelector('#abrir-modal-ajuste').addEventListener('click', async () => {
	if (rolActual !== 'administrador') return
	estadoAjuste.textContent = ''
	try {
		const { data, error } = await supabase.from('productos').select('id, nombre, unidad, existencia').eq('activo', true).order('nombre')
		if (error) throw error
		selectorAjuste.replaceChildren(new Option('Selecciona un producto', ''), ...(data ?? []).map((p) => new Option(p.nombre, String(p.id))))
	} catch (err) {
		console.error(err)
	}
	modalAjuste.showModal()
})

formularioAjuste.addEventListener('submit', async (e) => {
	e.preventDefault()
	if (rolActual !== 'administrador') return
	const fd = new FormData(formularioAjuste)
	const productoId = fd.get('producto_id')
	const cantidadCapturada = Number(fd.get('cantidad'))
	const motivo = fd.get('motivo').trim()
	const { data: { user } } = await supabase.auth.getUser()
	try {
		const { data: producto, error: ep } = await supabase.from('productos').select('unidad').eq('id', productoId).single()
		if (ep) throw ep
		const cantidadKg = aKg(cantidadCapturada, producto.unidad)
		const { data: prod, error: ep2 } = await supabase.from('productos').select('existencia').eq('id', productoId).single()
		if (ep2) throw ep2
		const nueva = Number(prod.existencia) + cantidadKg
		const { error: eu } = await supabase.from('productos').update({ existencia: nueva }).eq('id', productoId)
		if (eu) throw eu
		const { error: em } = await supabase.from('movimientos_inventario').insert({
			producto_id: productoId,
			tipo: 'ajuste',
			cantidad: cantidadKg,
			motivo,
			operacion_id: null,
			fecha: new Date().toISOString(),
			usuario_id: user.id,
			pendiente_envio: false
		})
		if (em) throw em
		modalAjuste.close()
		formularioAjuste.reset()
		mostrarEstado('Ajuste registrado.')
		window.dispatchEvent(new Event('inventario:actualizar-productos'))
	} catch (err) {
		console.error(err)
		estadoAjuste.textContent = 'No se pudo registrar el ajuste.'
	}
})
filtrosProductos.addEventListener('change', renderizarProductos)
filtrosProductos.addEventListener('reset', () => setTimeout(renderizarProductos))

function actualizarConexion() {
	document.body.classList.toggle('sin-conexion', !navigator.onLine)
}
actualizarConexion()
window.addEventListener('online', () => { actualizarConexion(); mostrarToast('Conexión restablecida.') })
window.addEventListener('offline', () => { actualizarConexion(); mostrarToast('Sin conexión. El inventario requiere internet.') })

function mostrarToast(texto) {
	const t = document.querySelector('#toast')
	if (!t) return
	t.textContent = texto
	t.classList.remove('oculto')
	setTimeout(() => t.classList.add('oculto'), 3000)
}

async function habilitarFormularioAdministrador() {
	if (!navigator.onLine) {
		mostrarErrorConexion()
		return
	}

	let user = null
	try {
		const { data: { session } } = await supabase.auth.getSession()
		if (session?.user) user = session.user
	} catch (e) {
		console.error(e)
	}
	if (!user) {
		mostrarEstado('Inicia sesión con una cuenta activa para consultar el inventario.')
		return
	}

	let perfil = null
	let errorPerfil = null
	try {
		const r = await supabase
			.from(TABLA_USUARIOS)
			.select('rol, activo')
			.eq('id', user.id)
			.single()
		perfil = r.data
		errorPerfil = r.error
	} catch (e) {
		errorPerfil = e
	}

	if (errorPerfil && !navigator.onLine) {
		const rolCache = localStorage.getItem(`surco_rol_${user.id}`)
		if (rolCache) {
			perfil = { rol: rolCache, activo: true }
			errorPerfil = null
		}
	}

	if (errorPerfil) {
		console.error('Error al consultar el perfil:', errorPerfil)
	}

	const rol = String(perfil?.rol ?? '').trim().toLocaleLowerCase('es')
	if (errorPerfil || !perfil || !perfil.activo || !['administrador', 'operador'].includes(rol)) {
		mostrarEstado('Tu usuario no tiene un rol activo con acceso al inventario.')
		return
	}
	localStorage.setItem(`surco_rol_${user.id}`, rol)

	rolActual = rol
	const esAdministrador = rolActual === 'administrador'
	columnaPrecio.hidden = !esAdministrador
	columnaCosto.hidden = !esAdministrador
	columnaAcciones.hidden = !esAdministrador
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
	const unidad = datosFormulario.get('unidad')
	const existenciaInicial = Number(datosFormulario.get('existencia_inicial'))
	const producto = {
		nombre: datosFormulario.get('nombre_producto').trim(),
		tipo_mercancia: datosFormulario.get('tipo_mercancia'),
		unidad,
		costo_unitario: Number(datosFormulario.get('costo_unitario')),
		precio_unitario: Number(datosFormulario.get('precio_unitario')),
		existencia: aKg(existenciaInicial, unidad),
		activo: true
	}

	try {
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

		const { data: insertado, error: errorRegistro } = await supabase
			.from('productos')
			.insert(producto)
			.select('id')
			.single()

		if (errorRegistro) {
			if (errorRegistro.code === '23505') {
				estadoFormulario.textContent = 'Ya existe un producto con ese nombre.'
				return
			}
			throw errorRegistro
		}

		const { data: { user } } = await supabase.auth.getUser()
		if (existenciaInicial > 0 && insertado?.id) {
			await supabase.from('movimientos_inventario').insert({
				producto_id: insertado.id,
				tipo: 'entrada',
				cantidad: aKg(existenciaInicial, unidad),
				motivo: 'Existencia inicial',
				operacion_id: null,
				fecha: new Date().toISOString(),
				usuario_id: user.id,
				pendiente_envio: false
			})
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

if (navigator.onLine) sincronizarCatalogos().catch(console.error)

habilitarFormularioAdministrador().catch((error) => {
	console.error('Error al validar el acceso:', error)
	mostrarEstado('No se pudo validar el acceso. Intenta iniciar sesión nuevamente.')
})
