import { supabase } from './supabase.js'

const { data: { session } } = await supabase.auth.getSession()
if (!session) location.href = '../../login.html'
else console.log('session iniciada')

/* ===== SURCO · Módulos: Clientes, Vehículos y Usuarios (con roles) =====
   Conectado a Supabase: tablas clientes, vehiculos y usuarios.   */
"use strict";

/* ------------------------------ SESIÓN Y ROL ------------------------------ */
const MI_ID = session?.user?.id ?? null;

// El rol sale de la tabla usuarios (su id es el mismo que el del usuario de Auth).
let ROLE = "operador";
if (MI_ID){
  const { data: perfil, error } = await supabase.from('usuarios').select('rol, activo').eq('id', MI_ID).maybeSingle();
  if (error) console.error("No se pudo leer el rol:", error.message);
  if (perfil?.rol === "administrador" && perfil.activo !== false) ROLE = "administrador";
}
const ES_ADMIN = ROLE === "administrador";

// Un operador no ve la opción Usuarios en el menú lateral.
if (!ES_ADMIN){
  const li = document.querySelector('#sidebar a[data-view="usuarios"]')?.closest("li");
  if (li) li.style.display = "none";
}

// Cerrar sesión
const btnSalir = document.getElementById("btnSalir");
if (btnSalir) btnSalir.onclick = async e => {
  e.preventDefault();
  await supabase.auth.signOut();
  location.href = '../../login.html';
};

/* ------------------------------ DATOS ------------------------------ */
const DB = { clients: [], vehicles: [], users: [] };

const TIPO_LABEL = {camion:"Camión", trailer:"Tráiler", camioneta:"Camioneta"};
const TIPO_DB    = {"Camión":"camion", "Tráiler":"trailer", "Camioneta":"camioneta"};

async function cargarClientes(){
  const { data, error } = await supabase.from('clientes').select('*').order('nombre');
  if (error) throw error;
  DB.clients = data.map(c => ({
    id: c.id,
    nombre: c.nombre,
    telefono: c.telefono ?? "",
    localidad: c.localidad ?? "",
    notas: c.notas ?? "",
    estado: c.activo ? "Activo" : "Inactivo",
  }));
}

async function cargarVehiculos(){
  const { data, error } = await supabase.from('vehiculos').select('*').order('placas');
  if (error) throw error;
  DB.vehicles = data.map(v => ({
    id: v.id,
    tipo: TIPO_LABEL[v.tipo] ?? v.tipo,
    placas: v.placas,
    capacidad: Number(v.capacidad_kg),
    estado: v.activo ? "Disponible" : "Inactivo",
  }));
}

async function cargarUsuarios(){
  const { data, error } = await supabase.from('usuarios').select('*').order('nombre');
  if (error) throw error;
  DB.users = data.map(u => ({
    id: u.id,
    nombre: u.nombre,
    correo: u.correo ?? "",
    telefono: u.telefono ?? "",
    rol: u.rol,
    estado: u.activo ? "Activo" : "Inactivo",
  }));
}

const CARGA = { clientes: cargarClientes, vehiculos: cargarVehiculos, usuarios: cargarUsuarios };

/* ------------------------------ UTILIDADES ------------------------------ */
const $ = s => document.querySelector(s);
const content = $("#content");
const dlg = $("#dialogo");

function fmtNum(n){ return Number(n).toLocaleString("es-MX",{maximumFractionDigits:2}); }
function esc(s){ return String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }
const mismoId = (a, b) => String(a) === String(b);

/* Etiquetas de estado: el texto siempre dice el estado, el color solo acompaña */
const ESTADO_CLASE = {
  "Activo":"etiqueta--completado", "Disponible":"etiqueta--completado",
  "En ruta":"etiqueta--proceso",
  "Inactivo":"etiqueta--cancelado", "En mantenimiento":"etiqueta--cancelado",
};
const etiqueta = (texto, clase = ESTADO_CLASE[texto] || "") => `<span class="etiqueta ${clase}">${esc(texto)}</span>`;
const ROL_LABEL = {administrador:"Administrador", operador:"Operador de campo"};
const etiquetaRol = rol => etiqueta(ROL_LABEL[rol] ?? rol, rol === "administrador" ? "etiqueta--proceso" : "");

/* Toast */
function toast(msg, tipo = "exito"){
  const t = $("#toast");
  t.className = `aviso aviso--${tipo}`;
  t.textContent = msg;
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.add("oculto"), 2600);
}

/* Diálogo nativo */
function abrirDialogo(html){
  dlg.innerHTML = `<div class="dialogo__cuerpo">${html}</div>`;
  dlg.querySelectorAll("[data-cerrar]").forEach(b => b.onclick = () => dlg.close());
  dlg.showModal();
  const primero = dlg.querySelector("input:not([readonly]),select,textarea");
  if (primero) primero.focus();
}
dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); }); // clic en el fondo
dlg.addEventListener("close", () => { dlg.innerHTML = ""; });

/* Constructores de campos */
const reqMark = req => req ? ` <span class="requerido" aria-hidden="true">*</span>` : "";
function campoInput(id, label, valor = "", attrs = "", req = false, ayuda = ""){
  return `<div class="campo" id="f-${id}">
    <label class="campo__etiqueta" for="${id}">${label}${reqMark(req)}</label>
    <input class="campo__control" id="${id}" value="${esc(valor)}" ${attrs} ${req ? 'aria-required="true"' : ""}>
    ${ayuda ? `<span class="campo__ayuda">${ayuda}</span>` : ""}
  </div>`;
}
function campoTexto(id, label, valor = "", attrs = "", ayuda = ""){
  return `<div class="campo" id="f-${id}">
    <label class="campo__etiqueta" for="${id}">${label}</label>
    <textarea class="campo__control" id="${id}" rows="3" ${attrs}>${esc(valor)}</textarea>
    ${ayuda ? `<span class="campo__ayuda">${ayuda}</span>` : ""}
  </div>`;
}
function campoSelect(id, label, opciones, sel = ""){
  return `<div class="campo" id="f-${id}">
    <label class="campo__etiqueta" for="${id}">${label}</label>
    <select class="campo__control" id="${id}">
      ${opciones.map(([v, t]) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(t)}</option>`).join("")}
    </select>
  </div>`;
}
const opts = arr => arr.map(x => [x, x]);

function piePie(textoGuardar){
  return `<div class="dialogo__pie">
    <button type="button" class="btn btn--secundario" data-cerrar>Cancelar</button>
    <button type="submit" class="btn">${textoGuardar}</button>
  </div>`;
}

/* Validación con mensaje en texto (no solo color) */
function validar(reglas){
  dlg.querySelectorAll(".campo--error").forEach(c => c.classList.remove("campo--error"));
  dlg.querySelectorAll(".campo__error").forEach(e => e.remove());
  dlg.querySelectorAll("[aria-invalid]").forEach(c => { c.removeAttribute("aria-invalid"); c.removeAttribute("aria-describedby"); });
  let ok = true;
  for (const {id, msg, test} of reglas){
    const ctrl = dlg.querySelector("#" + id);
    if (test(ctrl.value.trim())) continue;
    const wrap = dlg.querySelector("#f-" + id);
    wrap.classList.add("campo--error");
    wrap.insertAdjacentHTML("beforeend", `<span class="campo__error" id="e-${id}">${msg}</span>`);
    ctrl.setAttribute("aria-invalid", "true");
    ctrl.setAttribute("aria-describedby", "e-" + id);
    if (ok) ctrl.focus();
    ok = false;
  }
  return ok;
}
const val = id => dlg.querySelector("#" + id).value.trim();

/* Encabezado de sección */
function encabezado(titulo, sub, accion = ""){
  return `<div class="encabezado">
    <div><h1 class="mb-0">${titulo}</h1>${sub ? `<p class="tenue mb-0">${sub}</p>` : ""}</div>
    ${accion}
  </div>`;
}

/* Estado vacío */
function vacio(icono, titulo, texto, boton = ""){
  return `<div class="estado-vacio">
    <div class="estado-vacio__icono" aria-hidden="true">${icono}</div>
    <p class="estado-vacio__titulo">${titulo}</p>
    <p class="estado-vacio__texto">${texto}</p>
    ${boton}
  </div>`;
}

/* ------------------------------ NAVEGACIÓN POR ROL ------------------------------ */
// administrador: ve los tres módulos. operador: no tiene acceso a Usuarios.
const NAV = [
  {id:"clientes",  ic:"👥", label:"Clientes",  carga:"tabla"},
  {id:"vehiculos", ic:"🚚", label:"Vehículos", carga:"tarjetas"},
  {id:"usuarios",  ic:"🧑‍💼", label:"Usuarios",  carga:"tabla", admin:true},
];
const navItems = () => NAV.filter(i => !i.admin || ES_ADMIN);
const RENDER = {clientes:renderClientes, vehiculos:renderVehiculos, usuarios:renderUsuarios};

// El menú lateral ya existe en el HTML: aquí solo se marca la opción activa.
function marcarSidebar(view){
  document.querySelectorAll("#sidebar a[data-view]").forEach(a => {
    a.classList.toggle("selected", a.dataset.view === view);
  });
}

let currentView = "clientes";
let cargaId = 0;

function esqueleto(tipo){
  if (tipo === "tarjetas")
    return `<div class="rejilla" aria-hidden="true">${'<div class="esqueleto esqueleto--tarjeta"></div>'.repeat(3)}</div>`;
  return `<div class="tarjeta" aria-hidden="true">
    <div class="esqueleto esqueleto--titulo"></div>
    ${'<div class="esqueleto esqueleto--linea"></div>'.repeat(5)}
  </div>`;
}

async function navigate(view){
  if (!RENDER[view] || !navItems().some(i => i.id === view)) view = "clientes";
  currentView = view;
  marcarSidebar(view);

  // Estado 1: cargando
  const item = NAV.find(i => i.id === view);
  content.setAttribute("aria-busy", "true");
  content.innerHTML = `<p class="solo-lectores">Cargando ${item.label}…</p>` + esqueleto(item.carga);
  const id = ++cargaId;
  try {
    await CARGA[view]();
    if (id !== cargaId) return;
    content.removeAttribute("aria-busy");
    RENDER[view]();
  } catch (err) {
    // Estado 3: error
    if (id !== cargaId) return;
    content.removeAttribute("aria-busy");
    console.error(err);
    content.innerHTML = `<div class="estado-error">
      <p class="estado-error__titulo">No pudimos cargar ${item.label.toLowerCase()}</p>
      <p class="estado-error__texto">Revisa tu conexión e inténtalo de nuevo.</p>
      <button type="button" class="btn" id="btn-reintentar">Reintentar</button>
    </div>`;
    $("#btn-reintentar").onclick = () => navigate(view);
  }
}

/* ------------------------------ CLIENTES ------------------------------ */
function renderClientes(){
  content.innerHTML = encabezado("Clientes", `${DB.clients.length} clientes registrados`,
      `<button type="button" class="btn" id="cl-nuevo">＋ Nuevo cliente</button>`) + `
    <div class="campo">
      <label class="solo-lectores" for="cl-search">Buscar cliente</label>
      <input class="campo__control" type="search" id="cl-search" placeholder="🔍 Buscar por nombre, teléfono o localidad">
    </div>
    <div id="cl-lista"></div>`;
  $("#cl-nuevo").onclick = () => modalCliente();
  const s = $("#cl-search");
  s.oninput = () => pintarClientes(s.value);
  pintarClientes("");
}

function pintarClientes(q){
  const box = $("#cl-lista");
  q = q.trim().toLowerCase();
  if (!DB.clients.length){
    box.innerHTML = vacio("👥", "Aún no hay clientes", "Registra tu primer cliente para poder asignarle operaciones.",
      `<button type="button" class="btn" id="cl-vacio">＋ Nuevo cliente</button>`);
    $("#cl-vacio").onclick = () => modalCliente();
    return;
  }
  const lista = DB.clients.filter(c => [c.nombre, c.telefono, c.localidad].join(" ").toLowerCase().includes(q));
  if (!lista.length){
    box.innerHTML = vacio("🔍", "Sin resultados", `No encontramos clientes que coincidan con “${esc(q)}”.`,
      `<button type="button" class="btn btn--secundario" id="cl-limpiar">Limpiar búsqueda</button>`);
    $("#cl-limpiar").onclick = () => { const s = $("#cl-search"); s.value = ""; s.focus(); pintarClientes(""); };
    return;
  }
  box.innerHTML = `<div class="tabla-scroll"><table class="tabla">
    <caption class="solo-lectores">Lista de clientes</caption>
    <thead><tr>
      <th scope="col">Nombre</th><th scope="col">Teléfono</th><th scope="col">Localidad</th>
      <th scope="col">Estado</th><th scope="col"><span class="solo-lectores">Acciones</span></th>
    </tr></thead>
    <tbody>${lista.map(c => `<tr>
      <td><strong>${esc(c.nombre)}</strong>${c.notas ? `<br><span class="pequeno tenue">${esc(c.notas)}</span>` : ""}</td>
      <td>${esc(c.telefono)}</td>
      <td>${esc(c.localidad)}</td>
      <td>${etiqueta(c.estado)}</td>
      <td class="num"><button type="button" class="btn btn--secundario btn--pequeno" data-editar="${c.id}"
            aria-label="Editar ${esc(c.nombre)}">Editar</button></td>
    </tr>`).join("")}</tbody>
  </table></div>`;
  box.querySelectorAll("[data-editar]").forEach(b => b.onclick = () => modalCliente(b.dataset.editar));
}

function modalCliente(id){
  const c = id ? DB.clients.find(x => mismoId(x.id, id)) : null;
  abrirDialogo(`<form id="frm" novalidate>
    <h2 class="dialogo__titulo" id="dialogo-titulo">${c ? "Editar" : "Nuevo"} cliente</h2>
    ${campoInput("cl-nombre", "Nombre", c?.nombre, 'autocomplete="organization"', true)}
    <div class="formulario__fila">
      ${campoInput("cl-tel", "Teléfono", c?.telefono, 'type="tel" inputmode="tel"', true)}
      ${campoInput("cl-local", "Localidad", c?.localidad, "", true)}
    </div>
    ${campoTexto("cl-notas", "Notas", c?.notas, 'placeholder="Ej. Cliente frecuente de productos agrícolas"')}
    ${campoSelect("cl-estado", "Estado", opts(["Activo","Inactivo"]), c?.estado || "Activo")}
    ${piePie("Guardar")}
  </form>`);
  $("#frm").onsubmit = async e => {
    e.preventDefault();
    const ok = validar([
      {id:"cl-nombre", msg:"Escribe el nombre del cliente.", test:v => v.length > 1},
      {id:"cl-tel",    msg:"Escribe un teléfono válido (al menos 7 dígitos).", test:v => /^[\d\s()+-]{7,}$/.test(v)},
      {id:"cl-local",  msg:"Escribe la localidad.", test:v => v.length > 1},
    ]);
    if (!ok) return;

    const datos = {
      nombre: val("cl-nombre"),
      telefono: val("cl-tel"),
      localidad: val("cl-local"),
      notas: val("cl-notas") || null,
      activo: val("cl-estado") === "Activo",
    };
    const { error } = c
      ? await supabase.from('clientes').update(datos).eq('id', c.id)
      : await supabase.from('clientes').insert(datos);
    if (error) return toast("No se pudo guardar: " + error.message, "aviso");

    dlg.close();
    toast(c ? "Cliente actualizado ✅" : "Cliente agregado ✅");
    await cargarClientes();
    renderClientes();
  };
}

/* ------------------------------ VEHÍCULOS ------------------------------ */
function renderVehiculos(){
  content.innerHTML = encabezado("Vehículos", `${DB.vehicles.length} vehículos`,
      `<button type="button" class="btn" id="ve-nuevo">＋ Nuevo vehículo</button>`) +
    (DB.vehicles.length
      ? `<div class="rejilla">${DB.vehicles.map(v => `
        <article class="tarjeta">
          <div class="fila entre mb-3">
            <span aria-hidden="true" style="font-size:1.6rem">🚚</span>
            ${etiqueta(v.estado)}
          </div>
          <h3 class="tarjeta__titulo">${esc(v.tipo)}</h3>
          <p class="tarjeta__texto">Placas <span class="mono">${esc(v.placas)}</span></p>
          <div class="tarjeta__pie">
            <div>
              <span class="pequeno tenue">Capacidad</span><br>
              <strong>${fmtNum(v.capacidad)} kg</strong>
              <span class="pequeno tenue">≈ ${fmtNum(v.capacidad / 1000)} ton</span>
            </div>
            <button type="button" class="btn btn--secundario btn--pequeno empujar" data-editar="${v.id}"
                    aria-label="Editar ${esc(v.tipo)} ${esc(v.placas)}">Editar</button>
          </div>
        </article>`).join("")}</div>`
      : vacio("🚚", "Aún no hay vehículos", "Agrega un vehículo para poder asignarlo a las entregas.",
          `<button type="button" class="btn" id="ve-vacio">＋ Nuevo vehículo</button>`));
  $("#ve-nuevo").onclick = () => modalVehiculo();
  const bv = $("#ve-vacio"); if (bv) bv.onclick = () => modalVehiculo();
  content.querySelectorAll("[data-editar]").forEach(b => b.onclick = () => modalVehiculo(b.dataset.editar));
}

function modalVehiculo(id){
  const v = id ? DB.vehicles.find(x => mismoId(x.id, id)) : null;
  abrirDialogo(`<form id="frm" novalidate>
    <h2 class="dialogo__titulo" id="dialogo-titulo">${v ? "Editar" : "Nuevo"} vehículo</h2>
    <div class="formulario__fila">
      ${campoSelect("vv-tipo", "Tipo", opts(["Camión","Tráiler","Camioneta"]), v?.tipo || "Camión")}
      ${campoInput("vv-placas", "Placas", v?.placas, 'placeholder="Ej. JCS-723-A" autocapitalize="characters"', true)}
    </div>
    <div class="formulario__fila">
      ${campoInput("vv-cap", "Capacidad (kg)", v?.capacidad ?? "", 'type="number" min="1" inputmode="numeric"', true, "Peso máximo de carga")}
      ${campoSelect("vv-est", "Estado", opts(["Disponible","Inactivo"]), v?.estado || "Disponible")}
    </div>
    ${piePie(v ? "Guardar cambios" : "Guardar vehículo")}
  </form>`);
  $("#frm").onsubmit = async e => {
    e.preventDefault();
    const ok = validar([
      {id:"vv-placas", msg:"Escribe las placas del vehículo.", test:p => p.length >= 5},
      {id:"vv-placas", msg:"Ya existe un vehículo con esas placas.",
        test:p => !DB.vehicles.some(x => x.placas.toUpperCase() === p.toUpperCase() && !mismoId(x.id, id))},
      {id:"vv-cap", msg:"La capacidad debe ser mayor a 0 kg.", test:n => Number(n) > 0},
    ]);
    if (!ok) return;

    const datos = {
      tipo: TIPO_DB[val("vv-tipo")],
      placas: val("vv-placas").toUpperCase(),
      capacidad_kg: Number(val("vv-cap")),
      activo: val("vv-est") !== "Inactivo",
    };
    const { error } = v
      ? await supabase.from('vehiculos').update(datos).eq('id', v.id)
      : await supabase.from('vehiculos').insert(datos);
    if (error) return toast("No se pudo guardar: " + error.message, "aviso");

    dlg.close();
    toast(v ? "Vehículo actualizado ✅" : "Vehículo agregado ✅");
    await cargarVehiculos();
    renderVehiculos();
  };
}

/* ------------------------------ USUARIOS (solo administrador) ------------------------------ */
function renderUsuarios(){
  if (!ES_ADMIN){ navigate("clientes"); return; }
  content.innerHTML = encabezado("Usuarios", "Control de acceso y roles",
      `<button type="button" class="btn" id="us-nuevo">＋ Nuevo usuario</button>`) + `
    <div class="aviso aviso--info">
      <span aria-hidden="true">ℹ️</span>
      <div>El operador de campo no tiene acceso a costos, ganancias ni reportes.
      El administrador gestiona todo el módulo financiero.</div>
    </div>
    <div class="tabla-scroll"><table class="tabla">
      <caption class="solo-lectores">Lista de usuarios</caption>
      <thead><tr>
        <th scope="col">Nombre</th><th scope="col">Correo</th><th scope="col">Rol</th>
        <th scope="col">Estado</th><th scope="col"><span class="solo-lectores">Acciones</span></th>
      </tr></thead>
      <tbody>${DB.users.map(u => `<tr>
        <td><strong>${esc(u.nombre)}</strong>${u.telefono ? `<br><span class="pequeno tenue">${esc(u.telefono)}</span>` : ""}</td>
        <td class="mono">${esc(u.correo)}</td>
        <td>${etiquetaRol(u.rol)}</td>
        <td>${etiqueta(u.estado)}</td>
        <td class="num"><button type="button" class="btn btn--secundario btn--pequeno" data-editar="${u.id}"
              aria-label="Editar ${esc(u.nombre)}">Editar</button></td>
      </tr>`).join("")}</tbody>
    </table></div>`;
  $("#us-nuevo").onclick = () => modalUsuario();
  content.querySelectorAll("[data-editar]").forEach(b => b.onclick = () => modalUsuario(b.dataset.editar));
}

// Crea la cuenta en Supabase Auth SIN cambiar la sesión del administrador
// (llamada directa al endpoint de registro, sin guardar sesión).
async function crearCuentaAuth(correo, password){
  const base = supabase.supabaseUrl, key = supabase.supabaseKey;
  if (!base || !key) throw new Error("No se pudo leer la configuración de Supabase.");
  const r = await fetch(`${base}/auth/v1/signup`, {
    method: "POST",
    headers: {"Content-Type":"application/json", apikey: key},
    body: JSON.stringify({email: correo, password}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.msg || j.error_description || j.message || "No se pudo crear la cuenta.");
  const authId = j.user?.id ?? j.id;
  if (!authId) throw new Error("Supabase no devolvió el id del usuario.");
  return authId;
}

function modalUsuario(id){
  const u = id ? DB.users.find(x => mismoId(x.id, id)) : null;
  abrirDialogo(`<form id="frm" novalidate>
    <h2 class="dialogo__titulo" id="dialogo-titulo">${u ? "Editar" : "Nuevo"} usuario</h2>
    ${campoInput("uu-nombre", "Nombre", u?.nombre, 'autocomplete="name"', true)}
    <div class="formulario__fila">
      ${campoInput("uu-correo", "Correo", u?.correo, `type="email" autocomplete="off" autocapitalize="none" ${u ? "readonly" : ""}`, true,
          u ? "El correo de acceso no se puede cambiar aquí" : "Con este correo iniciará sesión")}
      ${campoInput("uu-tel", "Teléfono", u?.telefono, 'type="tel" inputmode="tel"')}
    </div>
    ${u ? "" : campoInput("uu-pass", "Contraseña", "", 'type="password" autocomplete="new-password"', true, "Mínimo 6 caracteres")}
    <div class="formulario__fila">
      ${campoSelect("uu-rol", "Rol", [["administrador","Administrador"],["operador","Operador de campo"]], u?.rol || "operador")}
      ${campoSelect("uu-estado", "Estado", opts(["Activo","Inactivo"]), u?.estado || "Activo")}
    </div>
    ${piePie("Guardar")}
  </form>`);
  $("#frm").onsubmit = async e => {
    e.preventDefault();
    const reglas = [
      {id:"uu-nombre", msg:"Escribe el nombre completo.", test:v => v.length > 1},
      {id:"uu-correo", msg:"Escribe un correo válido.", test:v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)},
      {id:"uu-correo", msg:"Ese correo ya está registrado.",
        test:v => !DB.users.some(x => x.correo.toLowerCase() === v.toLowerCase() && !mismoId(x.id, id))},
      {id:"uu-tel", msg:"Escribe un teléfono válido (al menos 7 dígitos) o déjalo vacío.", test:v => !v || /^[\d\s()+-]{7,}$/.test(v)},
    ];
    if (!u) reglas.push({id:"uu-pass", msg:"La contraseña debe tener al menos 6 caracteres.", test:v => v.length >= 6});
    if (!validar(reglas)) return;

    const rol = val("uu-rol");
    const activo = val("uu-estado") === "Activo";

    // Evita que el administrador se quite el acceso a sí mismo.
    if (u && mismoId(u.id, MI_ID) && (!activo || rol !== "administrador"))
      return toast("No puedes desactivarte ni quitarte el rol de administrador.", "aviso");

    const datos = {nombre: val("uu-nombre"), telefono: val("uu-tel") || null, rol, activo};

    try {
      if (u){
        const { error } = await supabase.from('usuarios').update(datos).eq('id', u.id);
        if (error) throw error;
      } else {
        const correo = val("uu-correo");
        const authId = await crearCuentaAuth(correo, val("uu-pass"));
        const { error } = await supabase.from('usuarios').insert({id: authId, correo, ...datos});
        if (error) throw new Error("La cuenta se creó, pero no se pudo guardar el perfil: " + error.message);
      }
    } catch (err){
      return toast("No se pudo guardar: " + err.message, "aviso");
    }

    dlg.close();
    toast(u ? "Usuario actualizado ✅" : "Usuario creado ✅");
    await cargarUsuarios();
    renderUsuarios();
  };
}

/* ------------------------------ CONECTIVIDAD ------------------------------ */
function actualizarConexion(){
  const offline = navigator.onLine === false;
  document.body.classList.toggle("sin-conexion", offline);
}

function init(){
  window.addEventListener("online", () => { actualizarConexion(); toast("Conexión restablecida ✅"); });
  window.addEventListener("offline", () => { actualizarConexion(); toast("Sin conexión. Los cambios se guardarán en el dispositivo.", "aviso"); });
  actualizarConexion();
  window.addEventListener("hashchange", () => navigate(location.hash.slice(1)));
  navigate(location.hash.slice(1) || "clientes");
}
init();