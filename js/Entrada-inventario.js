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

function mensajeError(error) {
    const codigo = error.code ?? 'sin código'
    const detalle = [error.message, error.details, error.hint].filter(Boolean).join(' ')
    return `No se pudo registrar la entrada (código ${codigo}). ${detalle || 'Revisa permisos y columnas de Supabase.'}`
}

async function cargarProductos() {
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

async function actualizarExistencia(productoId, existenciaAnterior, existenciaNueva) {
    let consulta = supabase
        .from('productos')
        .update({ existencia: existenciaNueva })
        .eq('id', productoId)

    consulta = existenciaAnterior === null
        ? consulta.is('existencia', null)
        : consulta.eq('existencia', existenciaAnterior)

    const { data, error } = await consulta.select('id').maybeSingle()
    if (error) throw error
    if (!data) throw new Error('La existencia cambió durante el registro. Actualiza la página e inténtalo de nuevo.')
}

document.querySelector('#abrir-modal-entrada').addEventListener('click', async () => {
    estado.textContent = ''
    modalEntrada.showModal()

    try {
        await cargarProductos()
    } catch (error) {
        console.error('Error al cargar productos para la entrada:', error)
        mostrarEstado(mensajeError(error))
    }
})

formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault()
    botonRegistro.disabled = true
    mostrarEstado('Registrando entrada...')

    const datos = new FormData(formulario)
    const productoId = datos.get('producto_id')
    const cantidad = Number(datos.get('cantidad'))
    const motivo = datos.get('motivo').trim()
    let existenciaAnterior
    let existenciaNueva
    let existenciaActualizada = false

    try {
        const { data: { user }, error: errorUsuario } = await supabase.auth.getUser()
        if (errorUsuario) throw errorUsuario
        if (!user) throw new Error('La sesión expiró. Inicia sesión nuevamente.')

        const { data: producto, error: errorProducto } = await supabase
            .from('productos')
            .select('existencia')
            .eq('id', productoId)
            .single()

        if (errorProducto) throw errorProducto

        existenciaAnterior = producto.existencia == null ? null : Number(producto.existencia)
        existenciaNueva = (existenciaAnterior ?? 0) + cantidad
        await actualizarExistencia(productoId, existenciaAnterior, existenciaNueva)
        existenciaActualizada = true

        const { error: errorMovimiento } = await supabase
            .from('movimientos_inventario')
            .insert({
                producto_id: productoId,
                tipo: 'entrada',
                cantidad,
                motivo,
                operacion_id: null,
                fecha: new Date().toISOString(),
                usuario_id: user.id,
                pendiente_envio: false
            })

        if (errorMovimiento) throw errorMovimiento
    } catch (error) {
        console.error('Error al registrar la entrada:', error)

        if (existenciaActualizada) {
            try {
                await actualizarExistencia(productoId, existenciaNueva, existenciaAnterior)
            } catch (errorReversion) {
                console.error('No se pudo revertir la existencia:', errorReversion)
                mostrarEstado('Falló el registro del movimiento y no se pudo revertir la existencia. Revisa el producto en Supabase.')
                botonRegistro.disabled = false
                return
            }
        }

        mostrarEstado(mensajeError(error))
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
        console.error('La entrada se registró, pero no se pudo actualizar el selector:', error)
        estadoGeneral.textContent = 'La entrada se registró, pero no se pudo actualizar el catálogo.'
    } finally {
        botonRegistro.disabled = false
    }
})
