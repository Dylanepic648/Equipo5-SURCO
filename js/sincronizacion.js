import { supabase } from './supabase.js'
import { leerTodos, borrar } from './db.js'
import { enviarPendientes } from './sync.js'

let { data: { session } } = await supabase.auth.getSession()
if (session) {
  localStorage.setItem('surco_usuario', session.user.id)
} else if (!navigator.onLine && localStorage.getItem('surco_usuario')) {
  session = { user: { id: localStorage.getItem('surco_usuario') } }
}
if (!session) {
  location.href = '../login.html'
  throw new Error('Sin sesión')
}

const $ = id => document.getElementById(id)
const esc = s => String(s || '—').replace(/[&<>"']/g, m => `&#${m.charCodeAt()};`)
const num = n => Number(n).toLocaleString('es-MX', { maximumFractionDigits: 3 })
const fecha = iso => new Date(iso).toLocaleDateString('es-MX')
const fechaHora = iso => new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })

const abreviar = unidad => {
  const u = (unidad ?? '').toLowerCase()
  if (u.startsWith('kg') || u.startsWith('kilo')) return 'kg'
  if (u.startsWith('ton')) return 't'
  if (u === 'g' || u.startsWith('gramo')) return 'g'
  return unidad ?? ''
}

const detalle = p => p.tipo === 'servicio'
  ? p.descripcion_servicio
  : p.partidas.map(x => `${x.nombre} × ${num(x.cantidad)} ${abreviar(x.unidad)}`.trim()).join(', ')

function mostrarToast(texto) {
  const t = $('toast')
  t.textContent = texto
  t.classList.remove('oculto')
  setTimeout(() => t.classList.add('oculto'), 3000)
}

const estadoDe = p => p.error_envio
  ? `<span class="etiqueta etiqueta--cancelado">Error al enviar</span><br><span class="tenue pequeno">${esc(p.error_envio)}</span>`
  : '<span class="etiqueta etiqueta--pendiente">Pendiente</span>'

async function pintar() {
  const pendientes = (await leerTodos('pendientes'))
    .sort((a, b) => String(a.creado).localeCompare(String(b.creado)))

  $('contador').textContent = pendientes.length
    ? `${pendientes.length} ${pendientes.length === 1 ? 'registro por enviar' : 'registros por enviar'}.`
    : ''
  $('btn-enviar').disabled = !pendientes.length
  $('tabla-box').hidden = !pendientes.length
  $('zona-estado').innerHTML = pendientes.length ? '' : `<div class="estado-vacio">
      <p class="estado-vacio__titulo">No hay nada por enviar</p>
      <p class="estado-vacio__texto">Lo que captures sin conexión aparecerá aquí hasta que lo envíes.</p>
    </div>`

  $('cuerpo').innerHTML = pendientes.map(p => `<tr>
    <td class="col-fija">${fechaHora(p.creado)}</td>
    <td class="col-fija">${p.tipo === 'servicio' ? 'Servicio' : 'Venta'}</td>
    <td class="col-texto">${esc(p.cliente_nombre)}</td>
    <td class="col-fija">${fecha(p.fecha)}</td>
    <td class="col-texto">${esc(detalle(p))}</td>
    <td class="col-texto">${esc(p.tipo === 'venta' ? p.destino : '')}</td>
    <td class="col-texto">${esc(p.responsable_nombre)}</td>
    <td>${estadoDe(p)}</td>
    <td><div class="acciones"><button type="button" class="btn btn--secundario btn--pequeno" data-descartar="${p.uuid_local}">Descartar</button></div></td>
  </tr>`).join('')

  $('cuerpo').querySelectorAll('.col-texto').forEach(td => { td.title = td.textContent })
}

function actualizarRed() {
  const en = navigator.onLine
  const t = $('estado-red')
  t.textContent = en ? 'En línea' : 'Sin conexión'
  t.className = `etiqueta etiqueta--${en ? 'completado' : 'cancelado'}`
}

$('btn-enviar').addEventListener('click', async () => {
  if (!navigator.onLine) return mostrarToast('Sin conexión. Inténtalo cuando tengas señal.')
  const boton = $('btn-enviar')
  boton.disabled = true
  $('zona-avisos').innerHTML = ''
  const { enviados, fallidos, ultimoError } = await enviarPendientes()
  await pintar()
  if (fallidos) {
    $('zona-avisos').innerHTML = `<div class="aviso aviso--error mb-3"><div><strong>${fallidos} siguen pendientes</strong>${esc(ultimoError)}</div></div>`
  } else {
    mostrarToast(`Se enviaron ${enviados} registros`)
  }
})

$('cuerpo').addEventListener('click', async e => {
  const btn = e.target.closest('[data-descartar]')
  if (!btn) return
  if (!confirm('¿Descartar este registro? No se enviará y no se puede recuperar.')) return
  await borrar('pendientes', btn.dataset.descartar)
  pintar()
})

window.addEventListener('online', actualizarRed)
window.addEventListener('offline', actualizarRed)

actualizarRed()
pintar()
