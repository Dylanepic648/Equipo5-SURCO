import { supabase } from './supabase.js'

const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n) || 0)
const num = (n) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: 3 })

const form = document.querySelector('#filtros-reporte')
const estado = document.querySelector('#estado-reporte')
const cuerpoProducto = document.querySelector('#cuerpo-producto')
const cuerpoCliente = document.querySelector('#cuerpo-cliente')
const cuerpoDesglose = document.querySelector('#cuerpo-desglose')

function margen(ganancia, ingreso) {
    if (!ingreso) return '—'
    return `${((ganancia / ingreso) * 100).toFixed(1)}%`
}

async function generarReporte() {
    const fd = new FormData(form)
    const desde = fd.get('desde')
    const hasta = fd.get('hasta')
    estado.textContent = 'Consultando...'
    cuerpoProducto.replaceChildren()
    cuerpoCliente.replaceChildren()
    cuerpoDesglose.replaceChildren()
    try {
        let qOps = supabase.from('operaciones').select('id, cliente_id, tipo, estado, peso_cargado, peso_entregado, cobro, fecha, usuario_id')
        if (desde) qOps = qOps.gte('fecha', desde)
        if (hasta) qOps = qOps.lte('fecha', hasta + 'T23:59:59')
        const [{ data: ops, error: e1 }, { data: productos, error: e2 }, { data: clientes, error: e3 }, { data: partidas, error: e4 }, { data: usuarios, error: e5 }] = await Promise.all([
            qOps,
            supabase.from('productos').select('id, nombre'),
            supabase.from('clientes').select('id, nombre'),
            supabase.from('operacion_producto').select('operacion_id, producto_id, cantidad, precio_unitario, costo_unitario'),
            supabase.from('usuarios').select('id, nombre')
        ])
        if (e1 || e2 || e3 || e4 || e5) throw e1 || e2 || e3 || e4 || e5

        const nombreProducto = new Map((productos ?? []).map((p) => [p.id, p.nombre]))
        const nombreCliente = new Map((clientes ?? []).map((c) => [c.id, c.nombre]))
        const nombreUsuario = new Map((usuarios ?? []).map((u) => [u.id, u.nombre]))
        const partidasPorOp = new Map()
        for (const p of (partidas ?? [])) {
            if (!partidasPorOp.has(p.operacion_id)) partidasPorOp.set(p.operacion_id, [])
            partidasPorOp.get(p.operacion_id).push(p)
        }

        const porProducto = new Map()
        let ingresosVentas = 0, ingresosServicios = 0
        let costoTotal = 0, gananciaTotal = 0
        let pesoCargado = 0, pesoEntregado = 0
        const porCliente = new Map()
        const porResponsable = new Map()

        for (const op of (ops ?? [])) {
            if (op.estado !== 'completada') continue
            if (op.tipo === 'venta') {
                pesoCargado += Number(op.peso_cargado || 0)
                pesoEntregado += Number(op.peso_entregado || 0)
            }
            const ps = partidasPorOp.get(op.id) ?? []
            let ingresoOp = 0, costoOp = 0
            for (const p of ps) {
                const ingreso = Number(p.cantidad) * Number(p.precio_unitario)
                const costo = Number(p.cantidad) * Number(p.costo_unitario)
                ingresoOp += ingreso
                costoOp += costo
                const acc = porProducto.get(p.producto_id) ?? { cantidad: 0, ingreso: 0, costo: 0 }
                acc.cantidad += Number(p.cantidad)
                acc.ingreso += ingreso
                acc.costo += costo
                porProducto.set(p.producto_id, acc)
            }
            if (op.tipo === 'venta') ingresosVentas += ingresoOp
            else ingresosServicios += Number(op.cobro || 0)
            costoTotal += costoOp
            gananciaTotal += (ingresoOp - costoOp)

            const cli = porCliente.get(op.cliente_id) ?? { ingreso: 0, costo: 0 }
            cli.ingreso += ingresoOp
            cli.costo += costoOp
            porCliente.set(op.cliente_id, cli)

            const resp = porResponsable.get(op.usuario_id) ?? { total: 0, completadas: 0, canceladas: 0, ingreso: 0 }
            resp.total++
            if (op.estado === 'completada') { resp.completadas++; if (op.tipo === 'venta') resp.ingreso += ingresoOp }
            if (op.estado === 'cancelada') resp.canceladas++
            porResponsable.set(op.usuario_id, resp)
        }

        const filasProd = [...porProducto.entries()].map(([pid, d]) => {
            const gan = d.ingreso - d.costo
            const tr = document.createElement('tr')
            const vals = [nombreProducto.get(pid) ?? `Producto ${pid}`, num(d.cantidad), fmt(d.ingreso), fmt(d.costo), fmt(gan), margen(gan, d.ingreso)]
            vals.forEach((v, i) => { const c = document.createElement('td'); c.textContent = v; if (i > 0) c.className = 'num'; tr.append(c) })
            return tr
        })
        if (!filasProd.length) {
            const tr = document.createElement('tr'); const c = document.createElement('td'); c.colSpan = 6; c.textContent = 'Sin ventas en el periodo.'; tr.append(c); cuerpoProducto.replaceChildren(tr)
        } else cuerpoProducto.replaceChildren(...filasProd)

        const filasCli = [...porCliente.entries()].map(([cid, d]) => {
            const gan = d.ingreso - d.costo
            const tr = document.createElement('tr')
            const vals = [nombreCliente.get(cid) ?? `Cliente ${cid}`, fmt(d.ingreso), fmt(d.costo), fmt(gan), margen(gan, d.ingreso)]
            vals.forEach((v, i) => { const c = document.createElement('td'); c.textContent = v; if (i > 0) c.className = 'num'; tr.append(c) })
            return tr
        })
        if (!filasCli.length) {
            const tr = document.createElement('tr'); const c = document.createElement('td'); c.colSpan = 5; c.textContent = 'Sin clientes en el periodo.'; tr.append(c); cuerpoCliente.replaceChildren(tr)
        } else cuerpoCliente.replaceChildren(...filasCli)

        const cuerpoResp = document.querySelector('#cuerpo-responsable')
        const filasResp = [...porResponsable.entries()].map(([uid, d]) => {
            const tr = document.createElement('tr')
            const nombre = uid ? (nombreUsuario.get(uid) ?? 'Desconocido') : 'Sin asignar'
            const vals = [nombre, d.total, d.completadas, d.canceladas, fmt(d.ingreso)]
            vals.forEach((v, i) => { const c = document.createElement('td'); c.textContent = v; if (i > 0) c.className = 'num'; tr.append(c) })
            return tr
        })
        if (!filasResp.length) {
            const tr = document.createElement('tr'); const c = document.createElement('td'); c.colSpan = 5; c.textContent = 'Sin responsables en el periodo.'; tr.append(c); cuerpoResp.replaceChildren(tr)
        } else cuerpoResp.replaceChildren(...filasResp)

        const merma = pesoCargado - pesoEntregado
        const desglose = [
            ['Ingresos por ventas', fmt(ingresosVentas)],
            ['Ingresos por servicios', fmt(ingresosServicios)],
            ['Ingreso total', fmt(ingresosVentas + ingresosServicios)],
            ['Costo total', fmt(costoTotal)],
            ['Ganancia total', fmt(gananciaTotal)],
            ['Margen total', margen(gananciaTotal, ingresosVentas + ingresosServicios)],
            ['Merma (kg): cargado', num(pesoCargado)],
            ['Merma (kg): entregado', num(pesoEntregado)],
            ['Merma (kg): diferencia', num(merma)]
        ]
        cuerpoDesglose.replaceChildren(...desglose.map(([k, v]) => {
            const tr = document.createElement('tr')
            const c1 = document.createElement('td'); c1.textContent = k
            const c2 = document.createElement('td'); c2.textContent = v; c2.className = 'num'
            tr.append(c1, c2); return tr
        }))

        estado.textContent = 'Consulta lista.'
    } catch (err) {
        console.error(err)
        estado.textContent = 'No se pudo generar el reporte.'
    }
}

form.addEventListener('submit', (e) => { if (e) e.preventDefault(); generarReporte() })

generarReporte()