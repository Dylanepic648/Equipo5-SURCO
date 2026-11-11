const CACHE = 'surco-v1'

const PRECACHE = [
  './',
  './login.html',
  './manifest.json',
  './pages/index.html',
  './pages/modulo1(inventario)/registro_producto.html',
  './pages/modulo2(operaciones)/operaciones.html',
  './pages/modulo3(cvu)/cvu.html',
  './css/ui.css',
  './js/supabase.js',
  './js/navbar.js',
  './js/pwa.js',
  './js/login.js',
  './js/index.js',
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
  './assets/icons/task-icon.svg',
  './assets/icons/user-icon.svg',
  './assets/icons/vehicle-icon.svg'
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(PRECACHE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.hostname.endsWith('supabase.co')) return

  const mismoOrigen = url.origin === location.origin
  const esCdn = url.hostname === 'esm.sh'
  if (!mismoOrigen && !esCdn) return

  e.respondWith(esCdn ? cacheFirst(req) : networkFirst(req))
})

async function networkFirst(req) {
  const cache = await caches.open(CACHE)
  try {
    const res = await fetch(req)
    if (res.ok) cache.put(req, res.clone())
    return res
  } catch {
    const guardado = await cache.match(req, { ignoreSearch: true })
    if (guardado) return guardado
    if (req.mode === 'navigate') return cache.match('./login.html')
    return Response.error()
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE)
  const guardado = await cache.match(req)
  if (guardado) return guardado
  const res = await fetch(req)
  if (res.ok) cache.put(req, res.clone())
  return res
}
