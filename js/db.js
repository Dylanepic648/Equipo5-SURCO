const DB_NAME = 'surco-db'
const DB_VERSION = 3
const STORES = {
  clientes: 'id',
  usuarios: 'id',
  auth_cache: 'email',
  productos: 'id',
  movimientos: 'id',
  vehiculos: 'id',
  operaciones: 'id',
  pendientes: 'uuid_local',
}

let conexion

export function abrirDB() {
  conexion ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      for (const [nombre, llave] of Object.entries(STORES)) {
        if (!req.result.objectStoreNames.contains(nombre)) {
          req.result.createObjectStore(nombre, { keyPath: llave })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      conexion = null
      reject(req.error)
    }
  })
  return conexion
}

const pedir = req => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result)
  req.onerror = () => reject(req.error)
})

const terminada = tx => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve()
  tx.onerror = tx.onabort = () => reject(tx.error)
})

export async function leerTodos(store) {
  const db = await abrirDB()
  return pedir(db.transaction(store).objectStore(store).getAll())
}

export async function guardarUno(store, fila) {
  const db = await abrirDB()
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).put(fila)
  return terminada(tx)
}

export async function reemplazarTodos(store, filas) {
  const db = await abrirDB()
  const tx = db.transaction(store, 'readwrite')
  const os = tx.objectStore(store)
  os.clear()
  filas.forEach(f => os.put(f))
  return terminada(tx)
}

export async function borrar(store, llave) {
  const db = await abrirDB()
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).delete(llave)
  return terminada(tx)
}

export async function contarPendientes() {
  const db = await abrirDB()
  return pedir(db.transaction('pendientes').objectStore('pendientes').count())
}