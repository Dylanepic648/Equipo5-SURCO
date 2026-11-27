import { supabase } from './supabase.js'
import { reemplazarTodos, leerTodos, guardarUno, borrar } from './db.js'

export async function sincronizarCatalogos() {
  const [clientes, usuarios, productos, vehiculos] = await Promise.all([
    supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('usuarios').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('productos_operador').select('id, nombre, unidad, precio_unitario').order('nombre'),
    supabase.from('vehiculos').select('id, tipo, placas, capacidad_kg').eq('activo', true).order('placas'),
  ])
  const lote = { clientes, usuarios, productos, vehiculos }
  for (const [store, r] of Object.entries(lote)) {
    if (!r.error) await reemplazarTodos(store, r.data)
  }
}

export async function enviarPendientes() {
  const pendientes = await leerTodos('pendientes')
  let enviados = 0
  let fallidos = 0
  let ultimoError = null

  const falla = async (paso, err, p) => {
    console.error('Falló el envío de un pendiente:', paso, err)
    ultimoError = `${paso}: ${err?.message || err?.code || 'error desconocido'}`
    fallidos++
    await guardarUno('pendientes', { ...p, error_envio: ultimoError }).catch(console.error)
  }

  for (const p of pendientes) {
    let { data: op, error } = await supabase.from('operaciones')
      .select('id').eq('uuid_local', p.uuid_local).maybeSingle()
    if (error) { await falla('consultar operación', error, p); continue }

    if (!op) {
      ({ data: op, error } = await supabase.from('operaciones').insert({
        uuid_local: p.uuid_local,
        tipo: p.tipo,
        estado: 'registrada',
        cliente_id: p.cliente_id,
        usuario_id: p.usuario_id,
        destino: p.destino ?? null,
        descripcion_servicio: p.descripcion_servicio,
        cobro: p.cobro ?? 0,
        fecha: p.fecha,
      }).select('id').single())
      if (error) { await falla('guardar operación', error, p); continue }
    }

    if (p.tipo === 'venta') {
      const { count, error: eCount } = await supabase.from('operacion_producto')
        .select('*', { count: 'exact', head: true }).eq('operacion_id', op.id)
      if (eCount) { await falla('consultar productos', eCount, p); continue }
      if (!count) {
        const { error: eIns } = await supabase.from('operacion_producto').insert(
          p.partidas.map(x => ({
            operacion_id: op.id,
            producto_id: x.producto_id,
            cantidad: x.cantidad,
            precio_unitario: x.precio_unitario,
          }))
        )
        if (eIns) { await falla('guardar productos', eIns, p); continue }
      }
    }

    await borrar('pendientes', p.uuid_local)
    enviados++
  }
  return { enviados, fallidos, ultimoError }
}