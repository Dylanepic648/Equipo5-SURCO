const CACHE = 'surco-v2'
const OFFLINE = './offline.html'

const PRECACHE = [
  './',
  './login.html',
  OFFLINE,
  './manifest.json',
  './pages/index.html',
  './pages/modulo1(inventario)/registro_producto.html',
  './pages/modulo2(operaciones)/operaciones.html',
  './pages/modulo3(cvu)/cvu.html',
  './css/ui.css',
  './js/supabase.js',
  './js/db.js',
  './js/sync.js',
  './js/navbar.js',
  './js/pwa.js',
  './js/permisos.js',
  './js/login.js',
  './js/index.js',
  './js/rproducto.js',
  './js/operaciones.js',
  './js/nueva-operacion.js',
  './js/Entrada-inventario.js',
  './js/registro-cyu.js',
  './assets/icons/box-icon.svg',
  './assets/icons/brand-icon.svg',
  './assets/icons/customer-icon.svg',
  './assets/icons/cycle-icon.svg',
  './assets/icons/graph-icon.svg',
  './assets/icons/home-icon.svg',
  './assets/icons/logout-icon.svg',
  './assets/icons/plant-icon.svg',
  './assets/icons/shop-icon.svg',
  './assets/icons/task-icon.svg',
  './assets/icons/toolbox-icon.svg',
  './assets/icons/user-icon.svg',
  './assets/icons/vehicle-icon.svg',
  'https://esm.sh/@supabase/supabase-js@2'
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(async cache => {
        const resultados = await Promise.allSettled(PRECACHE.map(url => cache.add(url)))
        resultados.forEach((r, i) => {
          if (r.status === 'rejected') console.warn('No se pudo cachear:', PRECACHE[i])
        })
      })
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(nombres => Promise.all(nombres.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.hostname.endsWith('supabase.co')) return

  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(req))
  } else if (url.origin === location.origin) {
    e.respondWith(staleWhileRevalidate(e))
  } else {
    e.respondWith(cacheFirst(req))
  }
})

async function networkFirst(req) {
  const cache = await caches.open(CACHE)
  try {
    const res = await fetch(req)
    if (res.ok) cache.put(req, res.clone())
    return res
  } catch {
    return (await cache.match(req, { ignoreSearch: true }))
      || (await cache.match(OFFLINE))
      || Response.error()
  }
}

async function staleWhileRevalidate(e) {
  const cache = await caches.open(CACHE)
  const guardado = await cache.match(e.request)
  const red = fetch(e.request)
    .then(res => {
      if (res.ok) cache.put(e.request, res.clone())
      return res
    })
    .catch(() => null)
  e.waitUntil(red)
  return guardado || (await red) || Response.error()
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE)
  const guardado = await cache.match(req, { ignoreVary: true })
  if (guardado) return guardado
  const res = await fetch(req)
  if (res.ok) cache.put(req, res.clone())
  return res
}