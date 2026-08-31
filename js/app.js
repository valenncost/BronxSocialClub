
/* ============================================================
   CONFIGURACIÓN — Pegá acá las credenciales del proyecto de
   Bronx Social Club (Supabase → Project Settings → API) y el
   mail del admin (dueño de Bronx).
   ============================================================ */
const SUPABASE_URL = "https://wxoxonthagjwhhzwlahz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4b3hvbnRoYWdqd2hoendsYWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMjk5MTAsImV4cCI6MjEwMzYwNTkxMH0.N1EC-xhYt3laM8KHgp2CusxYUPaKH67GfP_NYj5fb24";
// El login del Admin ahora usa Supabase Auth (email + contraseña). Ya no hay contraseña en el código.
let ADMIN_TOKEN = null;   // se completa solo al iniciar sesión
const ADMIN_EMAIL = "costanzovalentino09@gmail.com";  // el único que administra todo
const SERVICIO_PCT = 0.08;  // costo por servicio: 8% del valor de la entrada
let ROL = null;  // "admin" | "staff" (equipo de escáner)

/* ============================================================ */
const DEMO = !SUPABASE_URL;   // sin credenciales cargadas, la app corre en memoria
if(DEMO){ const db=document.getElementById("demo-banner"); if(db) db.classList.add("show"); }

const fmt = n => "$" + Number(n).toLocaleString("es-AR");
// Escapa también las comillas: mucho de esto se interpola dentro de value="..."
const esc = s => (s||"").toString()
  .replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#39;");

// Los headers usan el token del admin si hay sesión iniciada; si no, la clave pública.
function authHeaders(extra={}){
  return {
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + (ADMIN_TOKEN || SUPABASE_KEY),
    "Content-Type": "application/json",
    ...extra
  };
}

async function dbGet(table, query=""){
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {headers:authHeaders()});
  if(!r.ok) throw new Error("Error leyendo " + table);
  return r.json();
}
async function dbInsert(table, row){
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method:"POST", headers:authHeaders({"Prefer":"return=representation"}),
    body: JSON.stringify(row)
  });
  if(!r.ok){
    let msg = "Error guardando en " + table;
    try{ const d = await r.json(); if(d.message) msg += ": " + d.message; }catch(e){}
    throw new Error(msg);
  }
  return r.json();
}
async function dbUpdate(table, id, row){
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method:"PATCH", headers:authHeaders({"Prefer":"return=representation"}),
    body: JSON.stringify(row)
  });
  if(!r.ok) throw new Error("Error actualizando " + table);
  return r.json();
}
async function dbDelete(table, id){
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {method:"DELETE", headers:authHeaders()});
  if(!r.ok) throw new Error("Error borrando de " + table);
}
async function uploadFoto(file){
  const nombre = Date.now() + "-" + file.name.replace(/[^a-zA-Z0-9.]/g,"_");
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/fotos/${nombre}`, {
    method:"POST",
    headers:{ "apikey":SUPABASE_KEY, "Authorization":"Bearer "+(ADMIN_TOKEN || SUPABASE_KEY) },
    body: file
  });
  if(!r.ok) throw new Error("Error subiendo la foto");
  return `${SUPABASE_URL}/storage/v1/object/public/fotos/${nombre}`;
}

/* --- Datos demo --- */
const DEMO_EVENTS = [
  {id:1, nombre:"Cachengue es de Bronx", fecha_texto:"Sáb 5 Sep 2026", lugar:"Bronx Social Club", puertas:"Cena 22hs · Previa 00hs · Cachengue 01:30", arte:"red", agotado:false, ubicacion_secreta:false, descripcion:"El sábado clásico de Bronx. Cena, previa y cachengue hasta las 6. +18 con documento.", foto_url:null, direccion:"Casanova 888, Bahía Blanca"},
];
const DEMO_TIPOS = [
  {id:101, evento_id:1, nombre:"LA TERRAZA - PREVIA DE AMIGOS", descripcion:"Acceso exclusivo terrazas. Barra libre.", precio:17000, cantidad:40, orden:0, categoria:"ticket", accesos:1, activo:true, oculto:false, valido_desde:"00:30", valido_hasta:"02:30"},
  {id:102, evento_id:1, nombre:"GENERAL 1", descripcion:"Desde las 23:30, sin límite de horario.", precio:8000, cantidad:null, orden:1, categoria:"ticket", accesos:1, activo:true, oculto:false, valido_desde:"23:30", valido_hasta:null},
  {id:103, evento_id:1, nombre:"GENERAL 2", descripcion:"Desde las 23:30, sin límite de horario.", precio:10000, cantidad:null, orden:2, categoria:"ticket", accesos:1, activo:true, oculto:false, valido_desde:"23:30", valido_hasta:null},
  {id:104, evento_id:1, nombre:"5 ACCESOS + BOTELLA DE FERNET", descripcion:"Branca 1L con Coca.", precio:115000, cantidad:10, orden:3, categoria:"combo", accesos:5, activo:true, oculto:false, valido_desde:null, valido_hasta:null},
];
let DEMO_PURCHASES = [];

let EVENTS = [];
let PURCHASES = [];
let MY_TICKETS = [];

/* ================== NAVEGACIÓN ================== */
// Mapa de "páginas" a archivos reales
const PAGINAS = {
  eventos: "/",
  entradas: "/entradas",
  admin: "/admin",
  escaner: "/escaner",
  cuenta: "/cuenta"
};
function go(p){
  // Si la sección existe en ESTE documento (ej: detalle dentro de index), mostrarla sin navegar
  const enDoc = document.getElementById("page-"+p);
  if(enDoc){
    if(p==="eventos" && /[?&](evento|pasado)=/.test(location.search)){
      try{ history.pushState(null, "", location.pathname); }catch(e){}
    }
    document.querySelectorAll(".page").forEach(x=>x.classList.remove("show"));
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    enDoc.classList.add("show");
    const tab = document.getElementById("tab-"+p);
    if(tab) tab.classList.add("active");
    window.scrollTo({top:0});
    if(p==="entradas"){ if(MY_TICKETS.length===0) recuperarEmailGuardado(); renderMine(); }
    if(p==="admin" && logged){
      abrirPanel();
    }
    if(p==="escaner") cargarIngresos();
    return;
  }
  // Si no está en este documento, navegar al archivo real
  if(PAGINAS[p]) window.location.href = PAGINAS[p];
}


/* ================== TIPOS DE TICKET ==================
   Bronx vende VARIOS tipos a la vez (GENERAL 1, LA TERRAZA, combos con
   botella...), no lotes que se abren de a uno. Cada evento tiene sus filas en
   la tabla tipos_ticket y todas están a la venta al mismo tiempo. */
const CATEGORIAS = [
  { clave:"ticket", titulo:"Tickets" },
  { clave:"combo",  titulo:"Combos" }
];
const MAX_POR_TIPO = 10;   // tope de unidades del mismo tipo en una compra

let TIPOS = {};        // { evento_id: [tipo, ...] } ya ordenados
let VENTAS_TIPO = {};  // { tipo_ticket_id: entradas aprobadas }
let VENTAS_VISTA_OK = false;

function agruparTipos(filas){
  TIPOS = {};
  (Array.isArray(filas) ? filas : []).forEach(t=>{
    (TIPOS[t.evento_id] = TIPOS[t.evento_id] || []).push(t);
  });
  Object.values(TIPOS).forEach(a => a.sort((x,y)=> (x.orden - y.orden) || (x.id - y.id)));
}
/* En la página pública se piden solo los que se venden; en el admin se piden
   todos, porque el panel también edita los pausados. */
async function cargarTipos(todos=false){
  if(DEMO){ agruparTipos(DEMO_TIPOS); return; }
  const q = todos
    ? "order=orden.asc,id.asc"
    : "activo=eq.true&oculto=eq.false&order=orden.asc,id.asc";
  try{ agruparTipos(await dbGet("tipos_ticket", q)); }
  catch(e){ TIPOS = {}; console.warn("No se pudieron leer los tipos de ticket:", e.message); }
}

/* Cuántas se vendieron de cada tipo. El público lo lee de la vista
   ventas_por_tipo (solo totales: la tabla compras tiene los códigos de la
   puerta y no la puede leer). El admin lo recalcula desde PURCHASES. */
async function cargarVentasTipo(){
  VENTAS_TIPO = {}; VENTAS_VISTA_OK = false;
  if(DEMO) return;
  try{
    const filas = await dbGet("ventas_por_tipo", "select=tipo_ticket_id,vendidas");
    if(!Array.isArray(filas)) return;
    filas.forEach(f=>{ VENTAS_TIPO[f.tipo_ticket_id] = Number(f.vendidas) || 0; });
    VENTAS_VISTA_OK = true;
  }catch(e){
    // Sin la vista no hay conteos: los cupos no se cierran solos.
    console.warn("No se pudo leer ventas_por_tipo:", e.message);
  }
}
function ventasTipoDesdePurchases(){
  const m = {};
  PURCHASES.forEach(c=>{
    if((c.estado||"").toLowerCase() !== "aprobado" || !c.tipo_ticket_id) return;
    m[c.tipo_ticket_id] = (m[c.tipo_ticket_id] || 0) + 1;
  });
  return m;
}

function tiposDeEvento(evId){ return TIPOS[evId] || []; }
// Los que ve el comprador: activos y no ocultos
function tiposALaVenta(ev){ return tiposDeEvento(ev.id).filter(t => t.activo && !t.oculto); }
function vendidasTipo(t){ return Number(VENTAS_TIPO[t.id]) || 0; }
// cantidad null = sin cupo, nunca se agota
function restantesTipo(t){ return t.cantidad == null ? Infinity : Math.max(0, t.cantidad - vendidasTipo(t)); }
function tipoAgotado(t){ return restantesTipo(t) <= 0; }
function tipoDisponible(t){ return !tipoAgotado(t); }

// El "Desde $X" de la tarjeta: el más barato de los que todavía tienen cupo
function precioDesde(ev){
  const disp = tiposALaVenta(ev).filter(tipoDisponible);
  return disp.length ? Math.min(...disp.map(t => Number(t.precio) || 0)) : null;
}
// Sin ningún tipo cargado el evento está anunciado pero todavía no se vende
function sinVenta(ev){ return tiposALaVenta(ev).length === 0; }
// Agotado a mano desde el panel, o porque se acabó el cupo de todos los tipos
function eventoAgotado(ev){
  if(ev.agotado) return true;
  const ts = tiposALaVenta(ev);
  return ts.length > 0 && ts.every(tipoAgotado);
}

// Texto de validez horaria, ej: "Válido de 23:30 a 02:00"
function textoValidez(t){
  if(t.valido_desde && t.valido_hasta) return `Válido de ${t.valido_desde} a ${t.valido_hasta}`;
  if(t.valido_desde) return `Válido desde ${t.valido_desde}`;
  if(t.valido_hasta) return `Válido hasta ${t.valido_hasta}`;
  return "";
}
const servicioDe = precio => Math.round((Number(precio) || 0) * SERVICIO_PCT);

/* ================== EVENTOS (tarjetas) ================== */
async function loadEvents(){
  const grid = document.getElementById("grid");
  if(!grid) return;   // el panel de admin no tiene la grilla pública
  try{
    EVENTS = DEMO ? DEMO_EVENTS : (await dbGet("eventos", "activo=eq.true&order=id.asc")).filter(e=>!e.pasado);
  }catch(e){
    grid.innerHTML = `<div class="loading">No se pudieron cargar los eventos.<br>Revisá la configuración de Supabase.</div>`;
    return;
  }
  if(EVENTS.length===0){ grid.innerHTML = `<div class="loading">No hay eventos cargados todavía.</div>`; return; }
  grid.innerHTML = "";
  EVENTS.forEach(ev=>{
    const agotado = eventoAgotado(ev);
    const desde = precioDesde(ev);
    const el = document.createElement("article");
    el.className = "ticket" + (agotado ? " soldout" : "");
    const artClass = ev.foto_url ? "photo" : ev.arte;
    const artStyle = ev.foto_url ? `style="background-image:url('${ev.foto_url}')"` : "";
    el.innerHTML = `
      <div class="art ${artClass}" ${artStyle} onclick="openDetail(${ev.id})">
        <span class="art-name">${esc(ev.nombre)}</span>
      </div>
      <div class="body"><div class="meta">
        <span><b>${esc(ev.fecha_texto)}</b></span>
        <span><b>${esc(ev.lugar)}</b></span>
        <span><b>${esc(ev.puertas)}</b></span>
      </div></div>
      <div class="stub">
        <div class="price">${desde != null ? `<small>Desde</small>${fmt(desde)}` : `<small>Entradas</small>Próximamente`}</div>
        ${agotado ? '<span class="tag-soldout">Agotado</span>'
          : `<div class="actions">
               <button class="btn ghost" onclick="openDetail(${ev.id})">Ver más</button>
               ${sinVenta(ev) ? "" : `<button class="btn buy" onclick="openDetail(${ev.id})">Comprar</button>`}
             </div>`}
      </div>`;
    grid.appendChild(el);
  });
}
// [loadEvents(); -> ahora se llama desde initPage()]

/* Fondo del hero: la foto del "evento destacado" — acá, sin un campo propio
   para eso, el primer próximo evento con foto en EVENTS (ya viene ordenado
   por id.asc desde loadEvents). Sin ninguno con foto, se queda el logo
   atenuado que trae el markup por defecto. */
function pintarFondoHero(){
  const bg = document.getElementById("hero-bg");
  if(!bg) return;
  const destacado = EVENTS.find(ev => ev.foto_url);
  if(destacado){
    bg.classList.remove("sin-foto");
    bg.style.backgroundImage = `url('${destacado.foto_url}')`;
  } else {
    bg.classList.add("sin-foto");
    bg.style.backgroundImage = "";
  }
}

/* ================== DETALLE ================== */
let cur = null;       // el evento abierto en el detalle
let SELECCION = {};   // { tipo_ticket_id: cantidad elegida }

const EDAD_MINIMA_DEFECTO = 18;

/* Cabecera del detalle: lugar, cuándo y edad mínima.
   `cuando` sale de juntar fecha_texto y puertas, que son texto libre cargado
   desde el panel — acá sólo se muestran en mayúscula, no se reformatean. */
function pintarCabeceraDetalle(ev, {cuando, edad}={}){
  const lugar = document.getElementById("d-lugar");
  if(lugar) lugar.textContent = ev.lugar || "";

  const partes = cuando !== undefined ? cuando : [ev.fecha_texto, ev.puertas].filter(Boolean);
  const cuandoEl = document.getElementById("d-cuando");
  if(cuandoEl) cuandoEl.textContent = partes.join(" | ");

  const edadEl = document.getElementById("d-edad");
  if(edadEl){
    // `edad_minima` todavía no existe en la tabla eventos (BRONX-SPEC §4);
    // hasta que exista, cae en el default y se muestra igual.
    const n = edad !== undefined ? edad : (ev.edad_minima || EDAD_MINIMA_DEFECTO);
    edadEl.textContent = n ? `Edad mínima: ${n} años` : "";
    edadEl.style.display = n ? "" : "none";
  }
}

/* Descripción larga: se recorta y se abre con "Ver más". */
function pintarDescripcion(texto){
  const bloque = document.getElementById("d-desc-bloque");
  const desc = document.getElementById("d-desc");
  const btn = document.getElementById("d-vermas");
  if(!bloque || !desc) return;
  const hay = !!(texto || "").trim();
  bloque.style.display = hay ? "" : "none";
  desc.textContent = texto || "";
  desc.classList.add("colapsada");
  desc.classList.remove("recortada");
  if(btn){ btn.textContent = "Ver más"; btn.style.display = "none"; }
}
/* El botón y el desvanecido sólo aparecen si el texto no entra en el recorte.
   Hay que llamarlo con el detalle ya visible: escondido, las alturas dan 0. */
function medirDesc(){
  const desc = document.getElementById("d-desc");
  const btn = document.getElementById("d-vermas");
  if(!desc || !btn) return;
  const desborda = !!desc.textContent.trim() && desc.scrollHeight > desc.clientHeight + 4;
  desc.classList.toggle("recortada", desborda);
  btn.style.display = desborda ? "" : "none";
}
function toggleDesc(){
  const desc = document.getElementById("d-desc");
  const btn = document.getElementById("d-vermas");
  if(!desc || !btn) return;
  const abierta = desc.classList.toggle("colapsada") === false;
  desc.classList.toggle("recortada", !abierta);
  btn.textContent = abierta ? "Ver menos" : "Ver más";
}

function openDetail(id, empujarURL=true){
  if(empujarURL){ try{ history.pushState(null, "", "?evento="+id); }catch(e){} }
  const ev = EVENTS.find(e=>e.id===id);
  if(!ev) return;
  document.getElementById("d-name").textContent = ev.nombre;
  pintarCabeceraDetalle(ev);

  // Fondo blurreado + flyer con la foto del evento
  const bg = document.getElementById("d-bg");
  const flyer = document.getElementById("d-flyer");
  if(ev.foto_url){
    bg.style.backgroundImage = `url('${ev.foto_url}')`;
    flyer.classList.remove("nofoto");
    flyer.style.backgroundImage = `url('${ev.foto_url}')`;
  } else {
    bg.style.backgroundImage = "";
    flyer.classList.add("nofoto");
    flyer.style.backgroundImage = "";
  }

  pintarDescripcion(ev.descripcion || "Pronto más información sobre este evento.");

  const loc = document.getElementById("d-location");
  if(ev.ubicacion_secreta){
    loc.innerHTML = `<div class="secret-box"><b>Ubicación secreta.</b> Vamos a publicar el lugar cerca de la fecha del evento.</div>`;
  } else if(ev.direccion){
    const q = encodeURIComponent(ev.direccion);
    loc.innerHTML = `<p style="color:var(--text-dim);margin-bottom:12px;font-size:13px">${esc(ev.direccion)}</p>
      <div class="map-wrap"><iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${q}&output=embed"></iframe></div>
      <a class="back" style="margin-top:14px;display:inline-block;text-decoration:none" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">Abrir en Google Maps</a>`;
  } else {
    loc.innerHTML = `<p style="color:var(--text-dim)">Ubicación a confirmar.</p>`;
  }

  const buyCardDet = document.querySelector(".d-buy-card");
  if(buyCardDet) buyCardDet.style.display = "";
  const galSec = document.getElementById("d-galeria-sec");
  if(galSec) galSec.style.display = "none";

  cur = ev;
  SELECCION = {};
  renderTiposDetalle(ev);

  go('detalle');
  medirDesc();
}

/* ================== LISTA DE TIPOS EN EL DETALLE ==================
   Todos los tipos activos, agrupados en TICKETS y COMBOS, cada uno con su
   propio selector de cantidad. La selección vive en SELECCION y se lleva tal
   cual al modal de compra. */
function renderTiposDetalle(ev){
  const box = document.getElementById("d-tipos");
  if(!box) return;
  const agotado = eventoAgotado(ev);
  const tipos = tiposALaVenta(ev);

  if(!tipos.length){
    box.innerHTML = `<p class="tipos-vacio">Todavía no hay entradas a la venta para este evento.</p>`;
  } else {
    box.innerHTML = CATEGORIAS.map(cat=>{
      const delGrupo = tipos.filter(t => (t.categoria || "ticket") === cat.clave);
      if(!delGrupo.length) return "";
      return `<div class="tipos-grupo">
        <h4 class="tipos-titulo">${cat.titulo}</h4>
        ${delGrupo.map(t => filaTipoHTML(t, agotado)).join("")}
      </div>`;
    }).join("");
  }
  actualizarResumenDetalle();
}
function filaTipoHTML(t, eventoAgotadoYa){
  const sinCupo = eventoAgotadoYa || tipoAgotado(t);
  const restan = restantesTipo(t);
  const validez = textoValidez(t);
  const detalles = [];
  if(t.descripcion) detalles.push(`<div class="tipo-desc">${esc(t.descripcion)}</div>`);
  if(validez) detalles.push(`<div class="tipo-validez">${esc(validez)}</div>`);
  if(Number(t.accesos) > 1) detalles.push(`<div class="tipo-accesos">Entran ${Number(t.accesos)} personas</div>`);
  if(!sinCupo && restan !== Infinity && restan <= 10) detalles.push(`<div class="tipo-quedan">Quedan ${restan}</div>`);

  const elegidas = Number(SELECCION[t.id]) || 0;
  const control = sinCupo
    ? `<span class="tipo-tag">Agotado</span>`
    : `<div class="tipo-qty">
         <button class="menos" onclick="chTipo(${t.id},-1)" aria-label="Menos">−</button>
         <span id="qty-${t.id}">${elegidas}</span>
         <button class="mas" onclick="chTipo(${t.id},1)" aria-label="Más">+</button>
       </div>`;

  // El tope por compra es el mismo que aplica chTipo, así el cartel no miente
  const tope = Math.min(MAX_POR_TIPO, restan);
  const pie = (!sinCupo && t.cantidad != null)
    ? `<div class="tipo-maximo">Máximo ${tope} por compra</div>` : "";

  return `<div class="tipo-card${sinCupo ? " agotado" : ""}${elegidas > 0 ? " elegida" : ""}">
    <div class="tipo-card-top">
      <div class="tipo-nombre">${esc(t.nombre)}</div>
      ${detalles.join("")}
    </div>
    <div class="tipo-card-pie">
      <div class="tipo-precio">${fmt(t.precio)}</div>
      ${control}
    </div>
    ${pie}
  </div>`;
}
function chTipo(tipoId, delta){
  const t = (cur ? tiposALaVenta(cur) : []).find(x => x.id === tipoId);
  if(!t) return;
  const tope = Math.min(MAX_POR_TIPO, restantesTipo(t));
  const nueva = Math.min(tope, Math.max(0, (Number(SELECCION[tipoId]) || 0) + delta));
  SELECCION[tipoId] = nueva;
  const el = document.getElementById("qty-" + tipoId);
  if(el){
    el.textContent = nueva;
    // La tarjeta queda marcada mientras tenga cantidad. Se toca la clase acá
    // en vez de re-renderizar: redibujar la lista en cada clic perdería el
    // foco del botón que acabás de apretar.
    const card = el.closest(".tipo-card");
    if(card) card.classList.toggle("elegida", nueva > 0);
  }
  actualizarResumenDetalle();
}
// Los tipos elegidos, con su cantidad, en el orden en que se muestran
function itemsSeleccionados(){
  if(!cur) return [];
  return tiposALaVenta(cur)
    .map(t => ({ tipo:t, cantidad: Number(SELECCION[t.id]) || 0 }))
    .filter(x => x.cantidad > 0);
}
// Una entrada de la lista por cada QR que se va a generar
function unidadesSeleccionadas(){
  const out = [];
  itemsSeleccionados().forEach(({tipo, cantidad})=>{
    for(let i = 0; i < cantidad; i++) out.push(tipo);
  });
  return out;
}
function totalesSeleccion(){
  let entradas = 0, subtotal = 0, servicio = 0;
  itemsSeleccionados().forEach(({tipo, cantidad})=>{
    entradas += cantidad;
    subtotal += (Number(tipo.precio) || 0) * cantidad;
    servicio += servicioDe(tipo.precio) * cantidad;
  });
  return { entradas, subtotal, servicio, total: subtotal + servicio };
}
function actualizarResumenDetalle(){
  const s = totalesSeleccion();
  const resumen = document.getElementById("d-resumen");
  if(resumen) resumen.style.display = s.entradas ? "block" : "none";
  const sub = document.getElementById("d-subtotal");
  if(sub) sub.textContent = fmt(s.subtotal);
  const svcLabel = document.getElementById("d-serv-label");
  // El porcentaje sale de la constante para que no se desincronice del cálculo
  if(svcLabel) svcLabel.textContent = `Costo de servicio (${+(SERVICIO_PCT*100).toFixed(2)}%)`;
  const svc = document.getElementById("d-serv");
  if(svc) svc.textContent = fmt(s.servicio);
  const tot = document.getElementById("d-total");
  if(tot) tot.textContent = fmt(s.total);

  const btn = document.getElementById("d-buy-btn");
  if(!btn || !cur) return;
  if(eventoAgotado(cur)){ btn.textContent = "Agotado"; btn.disabled = true; return; }
  if(sinVenta(cur)){ btn.textContent = "Entradas próximamente"; btn.disabled = true; return; }
  if(!s.entradas){ btn.textContent = "Elegí tus entradas"; btn.disabled = true; return; }
  btn.disabled = false;
  btn.textContent = (USER || DEMO)
    ? `Comprar ${s.entradas} ${s.entradas === 1 ? "entrada" : "entradas"} · ${fmt(s.total)}`
    : "Ingresá para comprar";
  btn.onclick = ()=>openBuy(cur.id);
}

/* ================== COMPRA ================== */
function openBuy(id){
  // Comprar requiere sesión: guardar el evento y mandar a ingresar
  if(!USER && !DEMO){
    try{ localStorage.setItem("tp_volver", "/?evento="+id); }catch(e){}
    go('cuenta');
    return;
  }
  cur = EVENTS.find(e=>e.id===id);
  if(!cur || !totalesSeleccion().entradas) return;
  document.getElementById("m-title").textContent = cur.nombre;
  document.getElementById("m-date").textContent = cur.fecha_texto + " · " + cur.lugar;
  document.getElementById("buy-err").style.display="none";
  renderResumenCompra(); renderAttendees(); updTotal();
  // Autocompletar con los datos del usuario logueado
  if(USER){
    const fila1 = document.querySelector("#attendees .attendee-row");
    if(fila1){
      const n = fila1.querySelector(".a-nombre"), a = fila1.querySelector(".a-apellido");
      if(n && !n.value) n.value = USER.nombre || "";
      if(a && !a.value) a.value = USER.apellido || "";
    }
    const em = document.getElementById("f-email");
    if(em && !em.value) em.value = USER.email || "";
  }
  document.getElementById("modal-buy").style.display="block";
  document.getElementById("modal-done").style.display="none";
  document.getElementById("overlay").classList.add("open");
}
// Qué se está comprando: "2x GENERAL 1"
function renderResumenCompra(){
  const box = document.getElementById("m-resumen");
  if(!box) return;
  box.innerHTML = itemsSeleccionados().map(({tipo, cantidad})=>`
    <div class="compra-item">
      <span>${cantidad}× ${esc(tipo.nombre)}</span>
      <b>${fmt((Number(tipo.precio)||0) * cantidad)}</b>
    </div>`).join("");
}
/* Una fila por QR. Cada fila recuerda de qué tipo es, porque una misma compra
   puede mezclar tipos distintos y cada entrada se emite con el suyo. */
function renderAttendees(){
  const box = document.getElementById("attendees");
  const prev = [...box.querySelectorAll(".attendee-row")].map(r=>({n:r.querySelector(".a-nombre").value,a:r.querySelector(".a-apellido").value}));
  box.innerHTML = "";
  unidadesSeleccionadas().forEach((tipo, i)=>{
    const row = document.createElement("div");
    row.className = "attendee-row";
    row.dataset.tipo = tipo.id;
    row.innerHTML = `<span class="num">${i+1}</span>
      <div class="attendee-campos">
        <span class="attendee-tipo">${esc(tipo.nombre)}</span>
        <div class="attendee-inputs">
          <input class="a-nombre" placeholder="Nombre" value="${prev[i]?esc(prev[i].n):''}">
          <input class="a-apellido" placeholder="Apellido" value="${prev[i]?esc(prev[i].a):''}">
        </div>
      </div>`;
    box.appendChild(row);
  });
}
function updTotal(){
  const s = totalesSeleccion();
  document.getElementById("sub-label").textContent = `Entradas (${s.entradas})`;
  document.getElementById("subtotal").textContent = fmt(s.subtotal);
  // El porcentaje sale de la constante para que no se desincronice del cálculo
  const svcLabel = document.getElementById("serv-label");
  if(svcLabel) svcLabel.textContent = `Costo de servicio (${+(SERVICIO_PCT*100).toFixed(2)}%)`;
  document.getElementById("serv-total").textContent = fmt(s.servicio);
  document.getElementById("total-label").textContent = "Total";
  document.getElementById("total").textContent = fmt(s.total);
}
async function confirmBuy(){
  const errEl = document.getElementById("buy-err");
  const unidades = unidadesSeleccionadas();
  const rows = [...document.querySelectorAll("#attendees .attendee-row")];
  const asistentes = rows.map((r,i)=>{
    const tipo = unidades[i];
    return {
      nombre: r.querySelector(".a-nombre").value.trim(),
      apellido: r.querySelector(".a-apellido").value.trim(),
      tipo_ticket_id: tipo.id,
      tipo: tipo.nombre,
      accesos: Number(tipo.accesos) || 1,
      precio: Number(tipo.precio) || 0,
      servicio: servicioDe(tipo.precio)
    };
  });
  const email = document.getElementById("f-email").value.trim();
  if(!asistentes.length){
    errEl.textContent="Elegí al menos una entrada"; errEl.style.display="block"; return;
  }
  if(asistentes.some(a=>!a.nombre || !a.apellido)){
    errEl.textContent="Completá nombre y apellido de cada entrada"; errEl.style.display="block"; return;
  }
  if(!email || !email.includes("@")){
    errEl.textContent="Completá un email válido para recibir las entradas"; errEl.style.display="block"; return;
  }
  errEl.style.display="none";

  const btn = document.getElementById("btn-confirm");
  btn.disabled=true; btn.textContent="Redirigiendo al pago...";
  const s = totalesSeleccion();

  // MODO DEMO: sin Supabase, simula la compra sin pago real
  if(DEMO){
    const grupo = "BX-" + Math.random().toString(36).slice(2,8).toUpperCase();
    const entradas = asistentes.map((a,i)=>({
      nombre:a.nombre, apellido:a.apellido, email, evento:cur.nombre, evento_id:cur.id,
      fecha_texto:cur.fecha_texto, lugar:cur.lugar,
      tipo:a.tipo, tipo_ticket_id:a.tipo_ticket_id, accesos:a.accesos,
      grupo, total:a.precio + a.servicio, codigo:grupo+"-"+(i+1), estado:"aprobado"
    }));
    entradas.forEach(e=>{DEMO_PURCHASES.push(e); MY_TICKETS.push(e);});
    updBadge();
    document.getElementById("done-ticket").innerHTML = entradas.map(ticketHTML).join("");
    setTimeout(pintarQRs, 50);
    document.getElementById("modal-buy").style.display="none";
    document.getElementById("modal-done").style.display="block";
    btn.disabled=false; btn.textContent="Pagar con Mercado Pago";
    return;
  }

  /* REAL: la Edge Function crear-pago arma la preferencia de Mercado Pago y
     crea una fila en compras por asistente (con service_role, por eso el
     navegador no inserta nada). Contrato que espera recibir:
       { evento, evento_id, fecha_texto, lugar, email,
         items: [{tipo_ticket_id, nombre, precio, servicio, cantidad}],
         asistentes: [{nombre, apellido, tipo_ticket_id, tipo, accesos, precio, servicio}],
         total }
     El precio de cada entrada es precio + servicio. */
  try{
    const r = await fetch(`${SUPABASE_URL}/functions/v1/crear-pago`, {
      method:"POST",
      headers:{ "apikey":SUPABASE_KEY, "Authorization":"Bearer "+SUPABASE_KEY, "Content-Type":"application/json" },
      body: JSON.stringify({
        evento: cur.nombre,
        evento_id: cur.id,
        fecha_texto: cur.fecha_texto,
        lugar: cur.lugar,
        email: email,
        items: itemsSeleccionados().map(({tipo, cantidad})=>({
          tipo_ticket_id: tipo.id,
          nombre: tipo.nombre,
          precio: Number(tipo.precio) || 0,
          servicio: servicioDe(tipo.precio),
          cantidad
        })),
        asistentes: asistentes,
        total: s.total
      })
    });
    const data = await r.json();
    if(!r.ok || !data.init_point){
      errEl.textContent = "No se pudo iniciar el pago. Probá de nuevo."; errEl.style.display="block";
      btn.disabled=false; btn.textContent="Pagar con Mercado Pago"; return;
    }
    // Guardar el grupo para recuperar la entrada al volver del pago
    // Ir a Mercado Pago
    window.location.href = data.init_point;
  }catch(e){
    errEl.textContent = "Error de conexión con el pago. Probá de nuevo."; errEl.style.display="block";
    btn.disabled=false; btn.textContent="Pagar con Mercado Pago";
  }
}
function closeModal(){ const o=document.getElementById("overlay"); if(o) o.classList.remove("open"); }
const _overlay = document.getElementById("overlay");
if(_overlay) _overlay.addEventListener("click", e=>{ if(e.target.id==="overlay") closeModal(); });
document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeModal(); });

/* ================== MIS ENTRADAS ================== */
function ticketHTML(c){
  const qrId = "qr-" + c.codigo.replace(/[^a-zA-Z0-9]/g,"");
  return `<div class="paper-ticket" data-ticket="${qrId}">
    <h4>${esc(c.evento)}</h4>
    <div class="row"><span>Nombre</span><span>${esc(c.nombre)} ${esc(c.apellido)}</span></div>
    <div class="row"><span>Fecha</span><span>${esc(c.fecha_texto||"")}</span></div>
    <div class="row"><span>Entrada</span><span>${esc(c.tipo)}</span></div>
    <div class="row"><span>Código</span><span>${esc(c.codigo)}</span></div>
    <div class="qr-real" id="${qrId}" data-code="${esc(c.codigo)}"></div>
    <p class="confirm-note">Mostrá este QR en la puerta · Bronx Social Club</p>
    <button class="btn ancho" style="margin-top:14px" onclick="descargarQR('${qrId}','${esc(c.codigo)}')">Descargar QR</button>
  </div>`;
}
// Generar los QR reales como imagen (API confiable)
function pintarQRs(){
  document.querySelectorAll(".qr-real").forEach(el=>{
    if(el.dataset.done) return;
    el.dataset.done = "1";
    const code = el.dataset.code;
    const url = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=" + encodeURIComponent(code);
    el.innerHTML = `<img src="${url}" alt="QR ${esc(code)}">`;   // el tamaño lo pone .qr-real img
  });
}
// Descargar la entrada COMPLETA como imagen (estilo ticket, con QR incluido)
async function descargarQR(qrId, codigo){
  const c = MY_TICKETS.find(t=>t.codigo===codigo);
  if(!c){ alert("No se encontró la entrada."); return; }

  const W = 720, H = 1000;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Fondo
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0,0,W,H);
  // Banda superior negra
  ctx.fillStyle = "#000000"; ctx.fillRect(0,0,W,140);
  ctx.fillStyle = "#F58C29"; ctx.fillRect(0,140,W,8);
  // Título
  ctx.fillStyle = "#ffffff"; ctx.textAlign = "center";
  ctx.font = "bold 34px Arial";
  ctx.fillText("BRONX SOCIAL CLUB", W/2, 85);

  // Datos
  ctx.fillStyle = "#000000"; ctx.textAlign = "left";
  ctx.font = "bold 40px Arial";
  ctx.fillText(c.evento, 50, 230);
  ctx.font = "20px Arial"; ctx.fillStyle = "#555";
  let y = 290;
  const linea = (lbl,val)=>{ ctx.fillStyle="#999"; ctx.font="16px Arial"; ctx.fillText(lbl.toUpperCase(), 50, y);
    ctx.fillStyle="#111"; ctx.font="22px Arial"; ctx.fillText(val||"-", 50, y+28); y+=72; };
  linea("Nombre", `${c.nombre} ${c.apellido}`);
  linea("Fecha", c.fecha_texto||"");
  linea("Código", c.codigo);

  // QR (lo cargamos como imagen primero)
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=340x340&margin=0&data=" + encodeURIComponent(codigo);
  const qrImg = new Image();
  qrImg.crossOrigin = "anonymous";
  qrImg.onload = ()=>{
    const qs = 300;
    ctx.drawImage(qrImg, (W-qs)/2, 640, qs, qs);
    ctx.fillStyle = "#777"; ctx.textAlign="center"; ctx.font="16px Arial";
    ctx.fillText("Mostrá este QR en la puerta · Bronx Social Club", W/2, 980);
    // Descargar
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "entrada-" + codigo + ".png";
    a.click();
  };
  qrImg.onerror = ()=>alert("No se pudo generar la imagen. Probá de nuevo con internet estable.");
  qrImg.src = qrUrl;
}
function renderMine(){
  const box = document.getElementById("my-tickets");
  if(MY_TICKETS.length===0){
    box.innerHTML = `<div class="empty"><p>Ingresá tu email arriba para ver tus entradas.</p></div>`;
    return;
  }
  box.innerHTML = MY_TICKETS.map(ticketHTML).join("");
  setTimeout(pintarQRs, 50);
}

// Buscar entradas aprobadas por email
async function cargarEntradasUsuario(){
  const box = document.getElementById("my-tickets");
  if(!USER){ box.innerHTML=""; return; }
  box.innerHTML = `<div class="loading">Cargando tus entradas...</div>`;

  if(DEMO){
    MY_TICKETS = DEMO_PURCHASES.filter(c=>(c.email||"").toLowerCase()===USER.email.toLowerCase() && (c.estado||"aprobado")==="aprobado");
    renderMine(); updBadge(); return;
  }
  try{
    // Se piden con el token del usuario: la base solo le da SUS entradas
    const r = await fetch(`${SUPABASE_URL}/rest/v1/compras?email=eq.${encodeURIComponent(USER.email)}&estado=eq.aprobado&select=*&order=creado_en.desc`, {
      headers:{ "apikey":SUPABASE_KEY, "Authorization":"Bearer "+USER.token }
    });
    const filas = await r.json();
    if(!Array.isArray(filas) || filas.length===0){
      box.innerHTML = `<div class="empty"><p>Todavía no tenés entradas asociadas a ${esc(USER.email)}.</p>
        <button class="btn" onclick="go('eventos')">Ver eventos</button></div>`;
      MY_TICKETS = []; updBadge(); return;
    }
    MY_TICKETS = filas; renderMine(); updBadge();
  }catch(e){
    box.innerHTML = `<div class="empty"><p>Hubo un error al cargar. Probá de nuevo.</p></div>`;
  }
}
function updBadge(){
  const b = document.getElementById("badge");
  if(!b) return;
  b.textContent = MY_TICKETS.length;
  b.style.display = MY_TICKETS.length ? "inline-block" : "none";
}

/* Cuando el usuario vuelve de Mercado Pago, revisar si el pago se aprobó */
async function checkReturnFromPayment(){
  const params = new URLSearchParams(window.location.search);
  const pago = params.get("pago");
  if(!pago || DEMO) return;
  window.history.replaceState({}, "", window.location.pathname);

  if(pago === "ok"){
    if(USER){
      alert("¡Pago confirmado! Tus entradas ya están en Mis Entradas y también te llegan por email.");
      go('entradas');
    } else {
      alert("¡Pago confirmado! Te enviamos las entradas por email. Iniciá sesión con ese mismo email para verlas acá.");
      go('cuenta');
    }
  } else if(pago === "error"){
    alert("El pago no se completó. Podés intentar de nuevo.");
  } else if(pago === "pendiente"){
    alert("Tu pago quedó pendiente. Cuando se acredite vas a recibir las entradas por email.");
  }
}
// [checkReturnFromPayment(); -> ahora se llama desde initPage()]

/* ================== ADMIN: LOGIN (Supabase Auth) ================== */
let logged = false;
// Determina si el email es admin, staff (equipo) o nada
async function determinarRol(email, token){
  if((email||"").toLowerCase() === ADMIN_EMAIL.toLowerCase()) return "admin";
  try{
    const r = await fetch(`${SUPABASE_URL}/rest/v1/staff?email=eq.${encodeURIComponent(email)}&select=email`, {
      headers:{ "apikey":SUPABASE_KEY, "Authorization":"Bearer "+token }
    });
    const filas = await r.json();
    if(Array.isArray(filas) && filas.length) return "staff";
  }catch(e){}
  return null;
}
// Muestra u oculta secciones del panel según el rol
/* Secciones del panel: cada una es una pestaña del sidebar.
   "Eventos pasados" vive adentro de Eventos y el escáner es una página
   aparte, así que ninguno de los dos tiene entrada propia acá. */
const SECCIONES_ADMIN = [
  { clave:"resumen",     titulo:"Resumen" },
  { clave:"eventos",     titulo:"Eventos" },
  { clave:"compradores", titulo:"Compradores" },
  { clave:"usuarios",    titulo:"Usuarios" },
  { clave:"equipo",      titulo:"Equipo" }
];
let SECCION_ADMIN = "resumen";

function aplicarRol(){
  const esAdmin = ROL === "admin";
  // Ojo: además de la sección hay que esconder su botón del sidebar, si no
  // el staff ve pestañas que lo llevan a un panel vacío.
  const soloAdmin = [
    "sec-eventos","sec-pasados","sec-usuarios","sec-equipo","btn-borrar-pend",
    "nav-eventos","nav-usuarios","nav-equipo","btn-crear-evento"
  ];
  soloAdmin.forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.style.display = esAdmin ? "" : "none";
  });
  // El staff entra por Compradores: Resumen y el resto no son suyos
  if(!esAdmin && !["resumen","compradores"].includes(SECCION_ADMIN)) SECCION_ADMIN = "compradores";
}

/* Cambia de pestaña: muestra una sola sección y actualiza el breadcrumb.
   No recarga nada — los datos ya los cargó abrirPanel(). */
function mostrarSeccionAdmin(clave){
  const sec = SECCIONES_ADMIN.find(s => s.clave === clave);
  if(!sec) return;
  SECCION_ADMIN = clave;
  // Quién puede ver qué lo decide aplicarRol() con un display inline; acá sólo
  // se marca cuál es la activa, y el inline le gana a la clase si está vedada.
  SECCIONES_ADMIN.forEach(s=>{
    const panel = document.getElementById("sec-" + s.clave);
    if(panel) panel.classList.toggle("activa", s.clave === clave);
    const boton = document.getElementById("nav-" + s.clave);
    if(boton) boton.classList.toggle("activo", s.clave === clave);
  });
  const titulo = document.getElementById("dash-titulo");
  if(titulo) titulo.textContent = sec.titulo;
  cerrarSidebar();
  window.scrollTo({top:0});
}

/* Sidebar en móvil */
function abrirSidebar(){ marcarSidebar(true); }
function cerrarSidebar(){ marcarSidebar(false); }
function marcarSidebar(abierto){
  const side = document.getElementById("dash-side");
  const telon = document.getElementById("dash-backdrop");
  if(side) side.classList.toggle("abierto", abierto);
  if(telon) telon.classList.toggle("visible", abierto);
}

/* "Crear evento" del header: abre Eventos con el formulario en blanco */
function nuevoEvento(){
  mostrarSeccionAdmin("eventos");
  resetEventoForm();
  const form = document.getElementById("ev-form");
  if(form) form.scrollIntoView({behavior:"smooth", block:"start"});
  const nombre = document.getElementById("ev-nombre");
  if(nombre) nombre.focus({preventScroll:true});
}
// Carga todo el panel según el rol
async function abrirPanel(){
  document.getElementById("admin-login").style.display="none";
  // Sin valor: el display lo pone .dash (flex), no un inline
  document.getElementById("admin-panel").style.display="";
  aplicarRol();
  mostrarSeccionAdmin(SECCION_ADMIN);   // aplicarRol ya lo corrigió si es staff
  // Esperamos las compras: renderEventAdmin necesita los conteos por tipo
  await loadPurchases();
  if(ROL==="admin"){
    await cargarTipos(true);   // el panel también edita los tipos pausados
    renderTiposForm();
    renderEventAdmin(); loadUsuarios(); loadPasadosAdmin(); loadStaff();
  }
}

async function login(){
  const email = document.getElementById("email").value.trim();
  const pass = document.getElementById("pass").value;
  const err = document.getElementById("err");
  const btn = document.getElementById("login-btn");
  err.style.display="none";

  if(!email || !pass){ err.textContent="Completá email y contraseña"; err.style.display="block"; return; }

  // En modo demo (sin Supabase) no hay login real: se entra directo para poder probar el panel.
  if(DEMO){
    logged=true; ROL="admin";
    abrirPanel();
    return;
  }

  btn.disabled=true; btn.textContent="Entrando...";
  try{
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method:"POST",
      headers:{ "apikey":SUPABASE_KEY, "Content-Type":"application/json" },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await r.json();
    if(!r.ok || !data.access_token){
      err.textContent = "Email o contraseña incorrectos";
      err.style.display="block";
      btn.disabled=false; btn.textContent="Entrar"; return;
    }
    // Verificar que sea admin o parte del equipo
    ROL = await determinarRol(data.user.email, data.access_token);
    if(!ROL){
      err.textContent = "Esta cuenta no tiene acceso al panel.";
      err.style.display="block";
      btn.disabled=false; btn.textContent="Entrar"; return;
    }
    ADMIN_TOKEN = data.access_token;   // token de sesión válido
    // Sesión unificada: este login también te loguea en toda la página
    guardarSesionUser(data.access_token, data.refresh_token);
    await restoreUserSession();
    updateNavUser();
    logged = true;
    document.getElementById("pass").value="";
    abrirPanel();
  }catch(e){
    err.textContent = "No se pudo conectar. Probá de nuevo.";
    err.style.display="block";
  }
  btn.disabled=false; btn.textContent="Entrar";
}
function logout(){
  logged=false; ADMIN_TOKEN=null; ROL=null;
  USER=null; borrarSesionUser(); updateNavUser();
  document.getElementById("email").value="";
  document.getElementById("pass").value="";
  document.getElementById("admin-login").style.display="block";
  document.getElementById("admin-panel").style.display="none";
}
// Al cargar la página, si hay sesión guardada, verificarla y reentrar solo
async function restoreAdminSession(){
  if(DEMO) return;
  // El panel usa LA MISMA sesión que la página: si no estás logueado
  // como usuario, no hay panel. Una sola sesión, un solo lugar.
  try{ localStorage.removeItem("tp_admin_token"); }catch(e){} // limpiar tokens viejos
  if(!USER || !USER.token){ logged=false; ROL=null; ADMIN_TOKEN=null; return; }
  ROL = await determinarRol(USER.email, USER.token);
  if(ROL){
    ADMIN_TOKEN = USER.token;
    logged = true;
  } else {
    logged = false; ADMIN_TOKEN = null;
  }
}
// [restoreAdminSession(); -> ahora se llama desde initPage()]

/* ================== ADMIN: EVENTOS ================== */
function renderEventAdmin(){
  const list = document.getElementById("ev-admin-list");
  const aviso = (!DEMO && !VENTAS_VISTA_OK)
    ? `<p class="err" style="display:block;margin-bottom:14px">Falta crear la vista <b>ventas_por_tipo</b> en Supabase (sql/03-vistas.sql). Los números de acá abajo son correctos, pero en la página pública los cupos no se van a cerrar solos hasta que la crees.</p>`
    : "";
  if(EVENTS.length===0){ list.innerHTML = aviso + `<p style="color:var(--text-dim);font-size:14px">No hay eventos. Creá el primero abajo.</p>`; return; }
  list.innerHTML = aviso + EVENTS.map(ev=>{
    const tipos = tiposDeEvento(ev.id);
    const desde = precioDesde(ev);
    // Vendidas sobre el cupo de cada tipo, ej: "GENERAL 1 38/50"
    const detalleVentas = tipos.length
      ? tipos.map(t=>{
          const v = vendidasTipo(t);
          return `${esc(t.nombre)} ${v}${t.cantidad != null ? "/" + t.cantidad : ""}${t.activo ? "" : " (pausado)"}`;
        }).join(" · ")
      : "sin tipos de entrada cargados";
    return `
    <div class="ev-admin-item">
      <div class="info">
        <b>${esc(ev.nombre)}</b> ${ev.pasado?'<span class="pill" style="border-color:var(--text-dim);color:var(--text-dim)">PASADO</span>':''}
        <span>${esc(ev.fecha_texto)} · ${tipos.length} tipo(s) ${desde != null ? `· desde <b style="color:var(--accent)">${fmt(desde)}</b>` : ""} ${eventoAgotado(ev)?'· AGOTADO':''} ${ev.ubicacion_secreta?'· secreta':''}</span>
        <span class="tipo-counts">Vendidas → ${detalleVentas}</span>
      </div>
      <div class="row-actions">
        <button class="btn ghost" onclick="editEvento(${ev.id})">Editar</button>
        <button class="btn ghost" onclick="deleteEvento(${ev.id})">Borrar</button>
      </div>
    </div>`;}).join("");
}

/* ---------- Gestor de tipos de entrada ----------
   Los tipos se editan en memoria mientras se completa el formulario y recién
   se guardan cuando se guarda el evento. Así un evento nuevo (que todavía no
   tiene id) puede nacer con sus entradas ya cargadas. */
let TIPOS_FORM = [];      // los tipos del evento que se está editando
let TIPOS_BORRADOS = [];  // ids que hay que borrar al guardar

function tipoVacio(categoria){
  return { id:null, nombre:"", descripcion:"", precio:"", cantidad:"",
           categoria: categoria || "ticket", accesos:1, activo:true,
           valido_desde:"", valido_hasta:"" };
}
function agregarTipo(categoria){
  TIPOS_FORM.push(tipoVacio(categoria));
  renderTiposForm();
  // El que se acaba de agregar es el que se va a completar
  const inputs = document.querySelectorAll("#tipos-list .tipo-form-nombre");
  const ultimo = inputs[inputs.length-1];
  if(ultimo) ultimo.focus();
}
// Los inputs escriben directo en el array: si re-renderizáramos en cada tecla
// se perdería el foco a mitad de palabra.
function setTipoCampo(i, campo, valor){
  if(TIPOS_FORM[i]) TIPOS_FORM[i][campo] = valor;
}
function moverTipo(i, d){
  const j = i + d;
  if(j < 0 || j >= TIPOS_FORM.length) return;
  [TIPOS_FORM[i], TIPOS_FORM[j]] = [TIPOS_FORM[j], TIPOS_FORM[i]];
  renderTiposForm();
}
function borrarTipo(i){
  const t = TIPOS_FORM[i];
  if(!t) return;
  const vendidas = t.id ? (Number(VENTAS_TIPO[t.id]) || 0) : 0;
  const aviso = vendidas
    ? `Ya se vendieron ${vendidas} entrada(s) de "${t.nombre}". Si lo borrás, esas entradas siguen siendo válidas pero se quedan sin tipo asociado.\n\n¿Borrar igual?`
    : `¿Borrar el tipo "${t.nombre || "sin nombre"}"?`;
  if(!confirm(aviso)) return;
  if(t.id) TIPOS_BORRADOS.push(t.id);
  TIPOS_FORM.splice(i, 1);
  renderTiposForm();
}
function renderTiposForm(){
  const box = document.getElementById("tipos-list");
  if(!box) return;
  if(!TIPOS_FORM.length){
    box.innerHTML = `<p style="color:var(--text-dim);font-size:13px;margin-bottom:12px">Todavía no cargaste ningún tipo de entrada. Sin al menos uno, el evento se anuncia pero no se puede comprar.</p>`;
    return;
  }
  box.innerHTML = TIPOS_FORM.map((t,i)=>{
    const vendidas = t.id ? (Number(VENTAS_TIPO[t.id]) || 0) : 0;
    const cupo = (t.cantidad === "" || t.cantidad == null) ? null : Number(t.cantidad);
    return `
    <div class="tipo-form${t.activo === false ? " pausado" : ""}">
      <div class="tipo-form-head">
        <span class="tipo-form-num">${i+1}</span>
        <input class="tipo-form-nombre" placeholder="Nombre (ej: GENERAL 1)" value="${esc(t.nombre)}"
               oninput="setTipoCampo(${i},'nombre',this.value)">
        <div class="tipo-form-acciones">
          <button class="btn ghost btn-mini" onclick="moverTipo(${i},-1)" title="Subir" ${i===0?"disabled":""}>↑</button>
          <button class="btn ghost btn-mini" onclick="moverTipo(${i},1)" title="Bajar" ${i===TIPOS_FORM.length-1?"disabled":""}>↓</button>
          <button class="btn ghost btn-mini" onclick="borrarTipo(${i})" title="Borrar">✕</button>
        </div>
      </div>
      <input class="tipo-form-desc" placeholder="Descripción (ej: Acceso exclusivo terrazas. Barra libre.)" value="${esc(t.descripcion)}"
             oninput="setTipoCampo(${i},'descripcion',this.value)">
      <div class="tipo-form-grid">
        <label>Precio $
          <input type="number" min="1" placeholder="8000" value="${t.precio === "" || t.precio == null ? "" : t.precio}"
                 oninput="setTipoCampo(${i},'precio',this.value)">
        </label>
        <label>Cupo (vacío = sin límite)
          <input type="number" min="0" placeholder="sin límite" value="${cupo == null ? "" : cupo}"
                 oninput="setTipoCampo(${i},'cantidad',this.value)">
        </label>
        <label>Sección
          <select onchange="setTipoCampo(${i},'categoria',this.value)">
            <option value="ticket"${t.categoria!=="combo"?" selected":""}>Tickets</option>
            <option value="combo"${t.categoria==="combo"?" selected":""}>Combos</option>
          </select>
        </label>
        <label>Accesos (personas)
          <input type="number" min="1" value="${Number(t.accesos)||1}"
                 oninput="setTipoCampo(${i},'accesos',this.value)">
        </label>
        <label>Válido desde
          <input placeholder="23:30" value="${esc(t.valido_desde)}"
                 oninput="setTipoCampo(${i},'valido_desde',this.value)">
        </label>
        <label>Válido hasta
          <input placeholder="02:00" value="${esc(t.valido_hasta)}"
                 oninput="setTipoCampo(${i},'valido_hasta',this.value)">
        </label>
      </div>
      <div class="tipo-form-pie">
        <label class="tipo-form-check">
          <input type="checkbox" ${t.activo === false ? "" : "checked"} onchange="setTipoCampo(${i},'activo',this.checked)">
          A la venta
        </label>
        ${t.id ? `<span class="tipo-form-vendidas">Vendidas: ${vendidas}${cupo != null ? "/" + cupo : ""}</span>` : `<span class="tipo-form-vendidas">Nuevo</span>`}
      </div>
    </div>`;
  }).join("");
}
// Convierte una fila del formulario en la fila que espera la base
function tipoDesdeForm(t, eventoId, orden){
  return {
    evento_id: Number(eventoId),
    nombre: t.nombre.trim(),
    descripcion: (t.descripcion || "").trim() || null,
    precio: parseInt(t.precio,10) || 0,
    cantidad: (t.cantidad === "" || t.cantidad == null) ? null : (parseInt(t.cantidad,10) || 0),
    orden,
    categoria: t.categoria === "combo" ? "combo" : "ticket",
    accesos: Math.max(1, parseInt(t.accesos,10) || 1),
    activo: t.activo !== false,
    valido_desde: (t.valido_desde || "").trim() || null,
    valido_hasta: (t.valido_hasta || "").trim() || null
  };
}
/* Guarda los tipos del evento: borra los que se sacaron, actualiza los que ya
   existían y da de alta los nuevos. El orden en pantalla es el campo "orden". */
async function sincronizarTipos(eventoId){
  for(const id of TIPOS_BORRADOS){ await dbDelete("tipos_ticket", id); }
  TIPOS_BORRADOS = [];
  for(let i = 0; i < TIPOS_FORM.length; i++){
    const t = TIPOS_FORM[i];
    const fila = tipoDesdeForm(t, eventoId, i);
    if(t.id) await dbUpdate("tipos_ticket", t.id, fila);
    else {
      const creado = await dbInsert("tipos_ticket", fila);
      if(creado && creado[0]) t.id = creado[0].id;
    }
  }
}
// Lo mismo pero en memoria, para poder probar el panel sin Supabase
function sincronizarTiposDemo(eventoId){
  const otros = DEMO_TIPOS.filter(t => t.evento_id != eventoId);
  DEMO_TIPOS.length = 0;
  DEMO_TIPOS.push(...otros);
  TIPOS_FORM.forEach((t,i)=>{
    if(!t.id) t.id = Date.now() + i;
    DEMO_TIPOS.push({ ...tipoDesdeForm(t, eventoId, i), id: t.id, oculto: false });
  });
  TIPOS_BORRADOS = [];
  agruparTipos(DEMO_TIPOS);
}
// Devuelve el primer problema encontrado, o "" si está todo bien
function validarTipos(){
  for(const t of TIPOS_FORM){
    if(!t.nombre.trim()) return "Todos los tipos de entrada necesitan un nombre.";
    const precio = parseInt(t.precio,10) || 0;
    // Las entradas gratis todavía no saltean Mercado Pago: si dejamos pasar un
    // $0, el comprador llega al pago con un total inválido.
    if(precio <= 0) return `Poné un precio mayor a 0 en "${t.nombre.trim()}". Las entradas gratis todavía no están implementadas.`;
  }
  return "";
}
function toggleSecreta(){
  document.getElementById("dir-fields").style.display = document.getElementById("ev-secreta").checked ? "none" : "block";
}
function previewFoto(){
  const f = document.getElementById("ev-foto").files[0];
  const img = document.getElementById("ev-thumb");
  if(f){ img.src = URL.createObjectURL(f); img.style.display="block"; }
}
function resetEventoForm(){
  ["ev-id","ev-nombre","ev-fecha","ev-puertas","ev-lugar","ev-desc","ev-direccion","ev-foto-url"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("ev-secreta").checked=false;
  document.getElementById("ev-agotado").checked=false;
  TIPOS_FORM = []; TIPOS_BORRADOS = [];
  renderTiposForm();
  document.getElementById("ev-foto").value="";
  document.getElementById("ev-thumb").style.display="none";
  document.getElementById("form-title").textContent="Nuevo evento";
  document.getElementById("ev-save-btn").textContent="Guardar evento";
  document.getElementById("ev-err").style.display="none";
  document.getElementById("ev-ok").style.display="none";
  toggleSecreta();
}
function editEvento(id){
  const ev = EVENTS.find(e=>e.id===id); if(!ev) return;
  document.getElementById("ev-id").value = ev.id;
  document.getElementById("ev-nombre").value = ev.nombre||"";
  document.getElementById("ev-fecha").value = ev.fecha_texto||"";
  document.getElementById("ev-puertas").value = ev.puertas||"";
  document.getElementById("ev-lugar").value = ev.lugar||"";
  document.getElementById("ev-desc").value = ev.descripcion||"";
  document.getElementById("ev-direccion").value = ev.direccion||"";
  document.getElementById("ev-foto-url").value = ev.foto_url||"";
  document.getElementById("ev-secreta").checked = !!ev.ubicacion_secreta;
  document.getElementById("ev-agotado").checked = !!ev.agotado;
  // Copia editable de los tipos: hasta que no se guarda, no se toca la base
  TIPOS_FORM = tiposDeEvento(ev.id).map(t=>({
    id: t.id,
    nombre: t.nombre || "",
    descripcion: t.descripcion || "",
    precio: t.precio,
    cantidad: t.cantidad == null ? "" : t.cantidad,
    categoria: t.categoria || "ticket",
    accesos: Number(t.accesos) || 1,
    activo: t.activo !== false,
    valido_desde: t.valido_desde || "",
    valido_hasta: t.valido_hasta || ""
  }));
  TIPOS_BORRADOS = [];
  renderTiposForm();
  const img = document.getElementById("ev-thumb");
  if(ev.foto_url){ img.src=ev.foto_url; img.style.display="block"; } else img.style.display="none";
  document.getElementById("form-title").textContent = "Editar: " + ev.nombre;
  document.getElementById("ev-save-btn").textContent = "Guardar cambios";
  toggleSecreta();
  document.getElementById("form-title").scrollIntoView({behavior:"smooth"});
}
async function saveEvento(){
  const err = document.getElementById("ev-err");
  const ok = document.getElementById("ev-ok");
  err.style.display="none"; ok.style.display="none";
  const nombre = document.getElementById("ev-nombre").value.trim();
  if(!nombre){ err.textContent="Completá al menos el nombre del evento."; err.style.display="block"; return; }
  const problema = validarTipos();
  if(problema){ err.textContent = problema; err.style.display="block"; return; }

  const btn = document.getElementById("ev-save-btn");
  btn.disabled=true; const prevTxt=btn.textContent; btn.textContent="Guardando...";
  try{
    let fotoUrl = document.getElementById("ev-foto-url").value || null;
    const file = document.getElementById("ev-foto").files[0];
    if(file){ fotoUrl = DEMO ? URL.createObjectURL(file) : await uploadFoto(file); }
    const secreta = document.getElementById("ev-secreta").checked;
    const data = {
      nombre,
      fecha_texto: document.getElementById("ev-fecha").value.trim(),
      puertas: document.getElementById("ev-puertas").value.trim(),
      lugar: document.getElementById("ev-lugar").value.trim(),
      descripcion: document.getElementById("ev-desc").value.trim(),
      direccion: secreta ? null : document.getElementById("ev-direccion").value.trim(),
      ubicacion_secreta: secreta,
      agotado: document.getElementById("ev-agotado").checked,
      foto_url: fotoUrl,
      arte: "red"
    };
    const id = document.getElementById("ev-id").value;
    const nombreViejo = id ? (EVENTS.find(e=>e.id==id)||{}).nombre : null;
    if(DEMO){
      let eventoId = id;
      if(id){ Object.assign(EVENTS.find(e=>e.id==id), data); }
      else { data.id = Date.now(); data.activo=true; EVENTS.push(data); eventoId = data.id; }
      sincronizarTiposDemo(eventoId);
    } else {
      // Los tipos necesitan el id del evento, así que el evento se guarda primero
      let eventoId = id;
      if(id){ await dbUpdate("eventos", id, data); }
      else {
        const creado = await dbInsert("eventos", data);
        eventoId = creado && creado[0] ? creado[0].id : null;
      }
      if(eventoId) await sincronizarTipos(eventoId);
      if(nombreViejo && nombreViejo !== nombre) await renombrarCompras(nombreViejo, nombre);
      EVENTS = (await dbGet("eventos", "activo=eq.true&order=id.asc")).filter(e=>!e.pasado);
      await cargarTipos(true);
    }
    ok.textContent = id ? "Evento actualizado." : "Evento creado."; ok.style.display="block";
    resetEventoForm(); renderEventAdmin(); loadEvents();
  }catch(e){
    err.textContent = "Error al guardar: " + e.message; err.style.display="block";
  }
  btn.disabled=false; btn.textContent=prevTxt;
}
/* compras.evento guarda el NOMBRE del evento además del id. Si le cambiás el
   nombre, las compras viejas siguen mostrando el anterior en el panel, en el
   CSV y en el filtro por evento. Los conteos de cupo no se rompen (van por
   tipo_ticket_id), pero la lista queda partida en dos. */
async function renombrarCompras(viejo, nuevo){
  const afectadas = PURCHASES.filter(c => c.evento === viejo).length;
  if(!afectadas) return;
  if(!confirm(`Le cambiaste el nombre al evento: "${viejo}" → "${nuevo}".\n\nHay ${afectadas} compra(s) guardadas con el nombre viejo, y en el panel van a figurar como si fueran de otro evento.\n\n¿Actualizarlas al nombre nuevo? (recomendado)`)) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/compras?evento=eq.${encodeURIComponent(viejo)}`, {
    method:"PATCH", headers: authHeaders({"Prefer":"return=minimal"}),
    body: JSON.stringify({ evento: nuevo })
  });
  if(!r.ok){
    let msg = "El evento se guardó, pero no se pudieron actualizar las compras viejas";
    try{ const d = await r.json(); if(d.message) msg += ": " + d.message; }catch(e){}
    throw new Error(msg);
  }
  await loadPurchases();
}
async function deleteEvento(id){
  const ev = EVENTS.find(e=>e.id===id);
  if(!confirm(`¿Borrar el evento "${ev.nombre}"? Esta acción no se puede deshacer.`)) return;
  try{
    if(DEMO){ EVENTS = EVENTS.filter(e=>e.id!==id); }
    else {
      await dbDelete("eventos", id);   // los tipos_ticket se van con él (FK on delete cascade)
      EVENTS = (await dbGet("eventos", "activo=eq.true&order=id.asc")).filter(e=>!e.pasado);
      await cargarTipos(true);
    }
    renderEventAdmin(); loadEvents();
  }catch(e){ alert("No se pudo borrar: " + e.message); }
}

/* ================== ADMIN: COMPRADORES ================== */
async function loadPurchases(){
  try{
    PURCHASES = DEMO ? DEMO_PURCHASES : await dbGet("compras", "order=creado_en.desc");
  }catch(e){
    document.getElementById("tbody").innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--accent);padding:28px">Error cargando compras. Revisá Supabase.</td></tr>`;
    return;
  }
  // En el admin tenemos las compras completas: los conteos por tipo salen de acá
  // y no de la vista, así los números son exactos aunque la vista no exista.
  VENTAS_TIPO = ventasTipoDesdePurchases();
  // Poblar los filtros con lo que realmente existe en las compras
  const sel = document.getElementById("f-evento");
  if(sel){
    const actual = sel.value;
    const evs = [...new Set(PURCHASES.map(c=>c.evento).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
    sel.innerHTML = `<option value="">Todos los eventos</option>` + evs.map(e=>`<option value="${esc(e)}"${e===actual?" selected":""}>${esc(e)}</option>`).join("");
  }
  const selTipo = document.getElementById("f-tipo");
  if(selTipo){
    const actual = selTipo.value;
    const tipos = [...new Set(PURCHASES.map(nombreTipo))].sort((a,b)=> a.localeCompare(b,"es"));
    selTipo.innerHTML = `<option value="">Todos los tipos</option>` + tipos.map(t=>`<option value="${esc(t)}"${t===actual?" selected":""}>${esc(t)}</option>`).join("");
  }
  drawAdmin();
}
function estadoPill(estado){
  const e = (estado||"pendiente").toLowerCase();
  if(e==="aprobado") return '<span class="pill" style="border-color:#22c55e;color:#22c55e">Aprobado</span>';
  if(e==="rechazado") return '<span class="pill" style="border-color:#ef4444;color:#ef4444">Rechazado</span>';
  return '<span class="pill" style="border-color:#eab308;color:#eab308">Pendiente</span>';
}
const esAprobada = c => (c.estado||"").toLowerCase() === "aprobado";
// El tipo de ticket con el que se emitió la entrada; las viejas sin tipo caen acá
const nombreTipo = c => c.tipo || "Sin tipo";

function filasFiltradas(){
  const q = (document.getElementById("filtro")?.value||"").trim().toLowerCase();
  const fEv  = (document.getElementById("f-evento")?.value)||"";
  const fTip = (document.getElementById("f-tipo")?.value)||"";
  const fEst = (document.getElementById("f-estado")?.value)||"";
  const fIng = (document.getElementById("f-ingreso")?.value)||"";
  const fOrd = (document.getElementById("f-orden")?.value)||"recientes";

  let rows = PURCHASES.slice();
  if(q) rows = rows.filter(c =>
    `${c.nombre||""} ${c.apellido||""} ${c.email||""} ${c.codigo||""}`.toLowerCase().includes(q));
  if(fEv)  rows = rows.filter(c => c.evento === fEv);
  if(fTip) rows = rows.filter(c => nombreTipo(c) === fTip);
  if(fEst) rows = rows.filter(c => (c.estado||"pendiente").toLowerCase() === fEst);
  if(fIng) rows = rows.filter(c => fIng === "si" ? !!c.usada : !c.usada);

  if(fOrd==="antiguos")  rows.sort((a,b)=> new Date(a.creado_en||0) - new Date(b.creado_en||0));
  if(fOrd==="recientes") rows.sort((a,b)=> new Date(b.creado_en||0) - new Date(a.creado_en||0));
  if(fOrd==="nombre")    rows.sort((a,b)=> (a.nombre+" "+a.apellido).localeCompare(b.nombre+" "+b.apellido, "es"));
  if(fOrd==="total")     rows.sort((a,b)=> Number(b.total||0) - Number(a.total||0));
  if(fOrd==="evento")    rows.sort((a,b)=> (a.evento||"").localeCompare(b.evento||"", "es"));
  if(fOrd==="tipo")      rows.sort((a,b)=> nombreTipo(a).localeCompare(nombreTipo(b), "es"));
  return rows;
}
function limpiarFiltros(){
  ["filtro","f-evento","f-tipo","f-estado","f-ingreso"].forEach(id=>{
    const el = document.getElementById(id); if(el) el.value = "";
  });
  const o = document.getElementById("f-orden"); if(o) o.value = "recientes";
  drawAdmin();
}
/* Entradas, compradores únicos y plata, contando SOLO las aprobadas.
   Se calcula sobre las filas que se estén viendo, así los filtros mandan. */
function totales(rows){
  const ap = rows.filter(esAprobada);
  const emails = new Set(ap.map(c => (c.email||"").toLowerCase()).filter(Boolean));
  return {
    entradas: ap.length,
    compradores: emails.size || ap.length,   // sin email, una compra = un comprador
    recaudado: ap.reduce((a,c)=> a + (Number(c.total)||0), 0),
    ingresados: ap.filter(c => c.usada).length
  };
}
// Desglose por tipo de entrada de las filas visibles
function dibujarResumenTipos(rows){
  const tb = document.getElementById("tbody-tipos");
  if(!tb) return;
  const porTipo = {};
  rows.filter(esAprobada).forEach(c=>{
    const t = nombreTipo(c);
    (porTipo[t] = porTipo[t] || []).push(c);
  });
  const tipos = Object.keys(porTipo).sort((a,b)=> a.localeCompare(b,"es"));
  tb.innerHTML = tipos.map(t=>{
    const s = totales(porTipo[t]);
    return `<tr>
      <td><b>${esc(t)}</b></td>
      <td>${s.entradas}</td>
      <td>${s.compradores}</td>
      <td><b style="color:var(--accent)">${fmt(s.recaudado)}</b></td>
    </tr>`;
  }).join("") || `<tr><td colspan="4" style="text-align:center;color:var(--text-dim);padding:20px">Sin ventas aprobadas con estos filtros</td></tr>`;

  const tf = document.getElementById("tfoot-tipos");
  if(tf){
    const s = totales(rows);
    tf.innerHTML = tipos.length ? `<tr>
      <td><b>Total</b></td><td><b>${s.entradas}</b></td><td><b>${s.compradores}</b></td>
      <td><b style="color:var(--accent)">${fmt(s.recaudado)}</b></td></tr>` : "";
  }
}
function drawAdmin(){
  const rows = filasFiltradas();
  document.getElementById("tbody").innerHTML = rows.map((c,i)=>`
    <tr>
      <td style="color:var(--text-dim)">${i+1}</td>
      <td style="color:var(--text-dim);font-size:12px">${c.creado_en ? new Date(c.creado_en).toLocaleString("es-AR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—"}</td>
      <td>${esc(c.nombre)}</td><td>${esc(c.apellido)}</td><td>${esc(c.evento)}</td>
      <td>${esc(nombreTipo(c))}</td>
      <td>${fmt(c.total)}</td>
      <td>${estadoPill(c.estado)}</td>
      <td>${c.usada ? '<span class="pill" style="border-color:#22c55e;color:#22c55e">Sí</span>' : '<span style="color:var(--text-faint)">—</span>'}</td>
      <td style="font-size:12px">${esc(c.codigo)}</td>
    </tr>`).join("") || `<tr><td colspan="10" style="text-align:center;color:var(--text-dim);padding:28px">Sin compras con estos filtros</td></tr>`;

  dibujarResumenTipos(rows);

  // Tarjetas de arriba: totales de TODO, sin filtrar
  const g = totales(PURCHASES);
  document.getElementById("st-entradas").textContent = g.entradas;
  document.getElementById("st-compradores").textContent = g.compradores;
  document.getElementById("st-total").textContent = fmt(g.recaudado);
  document.getElementById("st-ingresados").textContent = g.ingresados;

  // Línea de resumen de lo que se está viendo ahora
  const s = totales(rows);
  const res = document.getElementById("resumen-filtro");
  if(res){
    const filtrando = rows.length !== PURCHASES.length;
    res.innerHTML = `Mostrando <b>${rows.length}</b> de ${PURCHASES.length} compras`
      + (filtrando ? " (filtrado)" : "")
      + ` · <b>${s.entradas}</b> aprobadas · <b>${s.compradores}</b> compradores · recaudado <b style="color:var(--accent)">${fmt(s.recaudado)}</b>`
      + ` · ingresaron <b>${s.ingresados}</b>`;
  }
}
// Borra TODAS las compras pendientes (limpieza manual del admin)
async function borrarPendientes(){
  const pend = PURCHASES.filter(c => (c.estado||"pendiente").toLowerCase()==="pendiente");
  if(!pend.length){ alert("No hay compras pendientes para borrar."); return; }
  if(!confirm(`Vas a borrar ${pend.length} compra(s) pendiente(s) de forma permanente.\n\nOjo: si alguien está pagando EN ESTE MOMENTO, su compra figura como pendiente y se borraría. Conviene hacer esta limpieza cuando no hay ventas activas.\n\n¿Borrar?`)) return;
  try{
    const r = await fetch(`${SUPABASE_URL}/rest/v1/compras?or=(estado.eq.pendiente,estado.is.null)`, {
      method:"DELETE", headers:authHeaders()
    });
    if(!r.ok){
      let msg = "No se pudo borrar";
      try{ const d = await r.json(); if(d.message) msg += ": " + d.message; }catch(e){}
      alert(msg); return;
    }
    alert("Compras pendientes borradas.");
    loadPurchases();
  }catch(e){ alert("Error de conexión: " + e.message); }
}

// Los campos pueden traer comas (nombres de evento, sobre todo): van entre comillas
const csvCampo = v => `"${(v==null?"":String(v)).replace(/"/g,'""')}"`;
function exportCSV(){
  const rows = filasFiltradas();  // exporta lo mismo que ves en pantalla
  const head = "Fecha,Nombre,Apellido,Email,Evento,Tipo,Precio,Estado,Ingreso,Codigo\n";
  const body = rows.map(c=>[
    c.creado_en||"", c.nombre, c.apellido, c.email||"", c.evento, nombreTipo(c),
    c.total, c.estado||"pendiente", c.usada ? "si" : "no", c.codigo
  ].map(csvCampo).join(",")).join("\n");
  const blob = new Blob(["﻿"+head+body],{type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "compradores-bronx.csv"; a.click();
}

/* ================== USUARIOS REGISTRADOS (ADMIN) ================== */
let USUARIOS = [];
async function loadUsuarios(){
  if(DEMO) return;
  try{
    USUARIOS = await dbGet("perfiles", "order=creado_en.desc");
  }catch(e){ USUARIOS = []; }
  try{ STAFF = await dbGet("staff", "order=creado_en.asc"); }catch(e){ STAFF=[]; }
  drawUsuarios();
}
function drawUsuarios(){
  const tb = document.getElementById("tbody-usuarios");
  if(!tb) return;
  const q = (document.getElementById("filtro-usuarios")?.value||"").toLowerCase();
  const rows = USUARIOS.filter(u => ((u.nombre||"")+" "+(u.apellido||"")+" "+(u.email||"")).toLowerCase().includes(q));
  tb.innerHTML = rows.map((u,i)=>`
    <tr>
      <td style="color:var(--text-dim)">${i+1}</td>
      <td style="color:var(--text-dim);font-size:12px">${u.creado_en ? new Date(u.creado_en).toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"2-digit"}) : "—"}</td>
      <td>${esc(u.nombre||"—")}</td><td>${esc(u.apellido||"—")}</td>
      <td>${esc(u.telefono||"—")}</td><td style="font-size:13px">${esc(u.email||"—")}</td>
      <td>${botonStaff(u.email)}</td>
    </tr>`).join("") || `<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:28px">Sin usuarios registrados todavía</td></tr>`;
}
function exportUsuariosCSV(){
  const head = "Registrado,Nombre,Apellido,Telefono,Email\n";
  const body = USUARIOS.map(u=>`${u.creado_en||""},${u.nombre||""},${u.apellido||""},${u.telefono||""},${u.email||""}`).join("\n");
  const blob = new Blob([head+body],{type:"text/csv"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "usuarios-bronx.csv"; a.click();
}



/* ================== EQUIPO (acceso solo al escáner) ================== */
function esStaff(email){ return STAFF.some(s => (s.email||"").toLowerCase() === (email||"").toLowerCase()); }
function botonStaff(email){
  if(!email) return "—";
  if((email||"").toLowerCase() === ADMIN_EMAIL.toLowerCase()) return `<span class="pill-estado aprobado">Admin</span>`;
  return esStaff(email)
    ? `<button class="btn ghost btn-mini" onclick="toggleStaff('${email}')">Quitar escáner</button>`
    : `<button class="btn btn-mini" onclick="toggleStaff('${email}')">Dar escáner</button>`;
}
async function toggleStaff(email){
  try{
    const s = STAFF.find(x => (x.email||"").toLowerCase() === email.toLowerCase());
    if(s){
      if(!confirm(email + " va a perder el acceso al escáner. ¿Seguro?")) return;
      await dbDelete("staff", s.id);
    } else {
      await dbInsert("staff", { email: email.toLowerCase() });
      alert("Listo. " + email + " ya puede entrar a /admin con su cuenta y usar el escáner.");
    }
    await loadStaff();
    drawUsuarios();
  }catch(e){ alert("No se pudo: " + e.message); }
}

let STAFF = [];
async function loadStaff(){
  if(DEMO) return;
  try{ STAFF = await dbGet("staff", "order=creado_en.asc"); }catch(e){ STAFF=[]; }
  drawStaff();
}
function drawStaff(){
  const box = document.getElementById("staff-list");
  if(!box) return;
  box.innerHTML = STAFF.map(s=>`
    <div class="ev-admin-item">
      <div class="info"><b>${esc(s.email)}</b><span>Puede escanear y ver compradores</span></div>
      <div class="row-actions"><button class="btn ghost" onclick="quitarStaff(${s.id})">Quitar</button></div>
    </div>`).join("") || `<p style="color:var(--text-dim);font-size:14px">Todavía no agregaste a nadie al equipo.</p>`;
}
async function agregarStaff(){
  const ok = document.getElementById("staff-ok"), err = document.getElementById("staff-err");
  ok.style.display="none"; err.style.display="none";
  const email = document.getElementById("staff-email").value.trim().toLowerCase();
  if(!email || !email.includes("@")){ err.textContent="Poné un email válido."; err.style.display="block"; return; }
  try{
    await dbInsert("staff", { email });
    ok.textContent = "Agregado. Esa persona ya puede entrar al panel (tiene que crearse una cuenta en la página con ese email si no la tiene)."; ok.style.display="block";
    document.getElementById("staff-email").value="";
    loadStaff();
  }catch(e){ err.textContent = "No se pudo agregar: "+e.message; err.style.display="block"; }
}
async function quitarStaff(id){
  if(!confirm("¿Quitar a esta persona del equipo?")) return;
  try{ await dbDelete("staff", id); loadStaff(); }catch(e){ alert("No se pudo quitar: "+e.message); }
}

/* ================== ESCÁNER DE ENTRADAS ================== */
let html5Qr = null;
let escaneando = false;
let ultimoCodigo = "";
let ultimoMomento = 0;
let ingresos = [];  // lista de la sesión

/* ---------- APP INSTALADA ----------
   Cuando se abre desde el ícono (no dentro del navegador) el escáner queda
   solo: sin barra de pestañas ni pie, para que el celular de la puerta no
   termine paseando por Eventos o Mis Entradas. */
function esAppInstalada(){
  try{
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
        || window.navigator.standalone === true;   // iPhone
  }catch(e){ return false; }
}
function aplicarModoApp(){
  if(esAppInstalada()) document.body.classList.add("app-instalada");
}

/* ---------- INGRESO DENTRO DEL ESCÁNER ----------
   En iPhone la app instalada tiene su propia memoria, así que la sesión de
   Safari no viaja: hay que poder entrar acá mismo, sin pasar por el panel. */
function mostrarEscaner(){
  const login = document.getElementById("esc-login");
  const app = document.getElementById("esc-app");
  if(login) login.style.display = "none";
  if(app) app.style.display = "block";
  pintarEstadoPuerta();
  window.addEventListener("online", async ()=>{
    pintarEstadoPuerta();
    await sincronizarPuerta(true);
    cargarIngresos();
  });
  window.addEventListener("offline", pintarEstadoPuerta);
  sincronizarPuerta(true).then(()=>cargarIngresos());
}
function mostrarLoginEscaner(){
  const login = document.getElementById("esc-login");
  const app = document.getElementById("esc-app");
  if(login) login.style.display = "block";
  if(app) app.style.display = "none";
}
async function loginEscaner(){
  const email = document.getElementById("esc-email").value.trim();
  const pass = document.getElementById("esc-pass").value;
  const err = document.getElementById("esc-err");
  const btn = document.getElementById("esc-login-btn");
  err.style.display = "none";
  if(!email || !pass){ err.textContent = "Completá email y contraseña"; err.style.display="block"; return; }

  btn.disabled = true; btn.textContent = "Entrando...";
  try{
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method:"POST",
      headers:{ "apikey":SUPABASE_KEY, "Content-Type":"application/json" },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await r.json();
    if(!r.ok || !data.access_token){
      err.textContent = "Email o contraseña incorrectos";
      err.style.display = "block";
      btn.disabled = false; btn.textContent = "Entrar"; return;
    }
    ROL = await determinarRol(data.user.email, data.access_token);
    if(!ROL){
      err.textContent = "Esta cuenta no puede escanear. Pedile al admin que te sume al equipo.";
      err.style.display = "block";
      btn.disabled = false; btn.textContent = "Entrar"; return;
    }
    ADMIN_TOKEN = data.access_token;
    guardarSesionUser(data.access_token, data.refresh_token);
    await restoreUserSession();
    logged = true;
    document.getElementById("esc-pass").value = "";
    mostrarEscaner();
  }catch(e){
    err.textContent = "No se pudo conectar. Probá de nuevo.";
    err.style.display = "block";
  }
  btn.disabled = false; btn.textContent = "Entrar";
}
function salirEscaner(){
  if(leerCola().length && !confirm("Hay ingresos sin subir todavía. Si salís quedan guardados en este celular, pero conviene subirlos antes.\n\n¿Salir igual?")) return;
  stopScanner();
  logged = false; ADMIN_TOKEN = null; ROL = null; USER = null;
  borrarSesionUser();
  mostrarLoginEscaner();
}

/* ---------- VENDIDAS (dentro de la app de la puerta) ----------
   El equipo también necesita ver qué se vendió y a quién, no solo escanear.
   Sin señal cae a la copia descargada, así en la puerta sigue sirviendo. */
let VENDIDAS = [];
function vistaPuerta(v){
  const esEscaner = v === "escaner";
  document.getElementById("et-escaner").classList.toggle("active", esEscaner);
  document.getElementById("et-vendidas").classList.toggle("active", !esEscaner);
  document.getElementById("vista-escaner").style.display = esEscaner ? "block" : "none";
  document.getElementById("vista-vendidas").style.display = esEscaner ? "none" : "block";
  // La cámara no puede quedar prendida atrás consumiendo batería
  if(!esEscaner){ stopScanner(); cargarVendidas(); }
}
async function cargarVendidas(){
  const box = document.getElementById("vend-list");
  if(!box) return;
  if(!VENDIDAS.length) box.innerHTML = `<div class="loading">Cargando...</div>`;

  if(navigator.onLine){
    try{
      const r = await fetch(`${SUPABASE_URL}/rest/v1/compras?estado=eq.aprobado&select=codigo,nombre,apellido,evento,tipo,usada,usada_en&order=creado_en.desc`, {
        headers: authHeaders()
      });
      const filas = await r.json();
      if(Array.isArray(filas)) VENDIDAS = filas;
    }catch(e){}
  }
  // Sin señal, o si falló, usamos la lista que se bajó para la puerta
  if(!VENDIDAS.length){
    const lista = leerLista();
    if(lista && lista.entradas) VENDIDAS = Object.values(lista.entradas);
  }
  dibujarVendidas();
}
function dibujarVendidas(){
  const box = document.getElementById("vend-list");
  const res = document.getElementById("vend-resumen");
  if(!box) return;

  const q = (document.getElementById("vend-filtro")?.value||"").trim().toLowerCase();
  const filas = q
    ? VENDIDAS.filter(c => `${c.nombre||""} ${c.apellido||""} ${c.evento||""} ${c.codigo||""}`.toLowerCase().includes(q))
    : VENDIDAS;

  if(res){
    const entraron = VENDIDAS.filter(c=>c.usada).length;
    res.innerHTML = `<b>${VENDIDAS.length}</b> vendidas · <b>${entraron}</b> ya entraron · faltan <b>${VENDIDAS.length - entraron}</b>`
      + (q ? ` · mostrando ${filas.length}` : "");
  }

  box.innerHTML = filas.map(c=>{
    const hora = c.usada_en ? new Date(c.usada_en).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}) : "";
    return `<div class="vend-item${c.usada?" entro":""}">
      <div class="vend-datos">
        <span class="nm">${esc(c.nombre)} ${esc(c.apellido)}</span>
        <span class="det">${esc(c.evento||"")}${c.tipo?" · "+esc(c.tipo):""}</span>
      </div>
      <span class="vend-estado">${c.usada ? "entró "+hora : "falta"}</span>
    </div>`;
  }).join("") || `<p style="color:var(--text-dim);font-size:14px;padding:14px 0">${VENDIDAS.length ? "Nadie coincide con esa búsqueda." : "No hay entradas vendidas todavía."}</p>`;
}

/* ---------- MODO PUERTA (sin internet) ----------
   Antes de abrir se descarga la lista de entradas aprobadas al celular. Si en
   el evento no hay señal, el escáner valida contra esa copia y va guardando
   los ingresos en una cola que se sube sola cuando vuelve la conexión.

   El límite: dos celulares offline no se ven entre sí, así que la misma
   entrada podría pasar por las dos puertas. Con señal eso no ocurre. */
const LISTA_KEY = "tp_puerta_lista";
const COLA_KEY  = "tp_puerta_cola";

function leerJSON(clave, porDefecto){
  try{ return JSON.parse(localStorage.getItem(clave)) ?? porDefecto; }catch(e){ return porDefecto; }
}
function guardarJSON(clave, valor){
  try{ localStorage.setItem(clave, JSON.stringify(valor)); return true; }
  catch(e){ return false; }   // celular sin espacio
}
function leerLista(){ return leerJSON(LISTA_KEY, null); }
function leerCola(){ const c = leerJSON(COLA_KEY, []); return Array.isArray(c) ? c : []; }

// Baja al celular todas las entradas pagadas
async function descargarLista(){
  const btn = document.getElementById("puerta-bajar");
  if(btn){ btn.disabled = true; btn.textContent = "Descargando..."; }
  try{
    const r = await fetch(`${SUPABASE_URL}/rest/v1/compras?estado=eq.aprobado&select=id,codigo,nombre,apellido,evento,usada,usada_en`, {
      headers: authHeaders()
    });
    if(!r.ok) throw new Error("HTTP " + r.status);
    const filas = await r.json();
    if(!Array.isArray(filas)) throw new Error("respuesta rara");

    const entradas = {};
    filas.forEach(f=>{ if(f.codigo) entradas[f.codigo] = f; });
    const ok = guardarJSON(LISTA_KEY, { actualizado: new Date().toISOString(), entradas });
    if(!ok) throw new Error("no entra en la memoria del celular");
    pintarEstadoPuerta();
    alert(`Lista lista: ${filas.length} entrada(s) guardadas en este celular.\n\nYa podés escanear aunque te quedes sin señal.`);
  }catch(e){
    alert("No se pudo descargar la lista: " + e.message + "\n\nProbá con señal antes de salir para el evento.");
  }
  if(btn){ btn.disabled = false; btn.textContent = "Descargar lista"; }
}

// Valida contra la copia del celular y encola el ingreso
function validarOffline(codigo){
  const lista = leerLista();
  if(!lista || !lista.entradas) return { tipo:"bad", grande:"SIN LISTA", quien:"Descargá la lista con señal" };

  const e = lista.entradas[codigo];
  // En la copia solo están las pagadas: si no está, o no existe o no se pagó
  if(!e) return { tipo:"bad", grande:"NO VÁLIDA", quien:"No figura entre las pagadas" };
  if(e.usada){
    const cuando = e.usada_en ? new Date(e.usada_en).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}) : "";
    return { tipo:"bad", grande:"YA USADA", quien:`${e.nombre} ${e.apellido}${cuando?" · ingresó "+cuando:""}` };
  }

  const ahora = new Date().toISOString();
  e.usada = true; e.usada_en = ahora;
  guardarJSON(LISTA_KEY, lista);

  const cola = leerCola();
  cola.push({ id: e.id, codigo, usada_en: ahora });
  guardarJSON(COLA_KEY, cola);

  ingresos.unshift({ quien: `${e.nombre} ${e.apellido}`, hora: new Date(ahora).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}), pendiente:true });
  renderIngresos();
  pintarEstadoPuerta();
  return { tipo:"ok", grande:"VÁLIDA ✓", quien:`${e.nombre} ${e.apellido} · sin señal` };
}

// Sube los ingresos que quedaron guardados sin conexión
async function sincronizarPuerta(silencioso){
  const cola = leerCola();
  if(!cola.length){ if(!silencioso) alert("No hay ingresos pendientes de subir."); return; }
  if(!navigator.onLine){ if(!silencioso) alert("Seguís sin conexión. Cuando vuelva la señal se suben solos."); return; }

  const quedan = [];
  for(const item of cola){
    try{
      const r = await fetch(`${SUPABASE_URL}/rest/v1/compras?id=eq.${item.id}`, {
        method:"PATCH",
        headers: authHeaders({"Prefer":"return=minimal"}),
        body: JSON.stringify({ usada:true, usada_en:item.usada_en })
      });
      if(!r.ok) quedan.push(item);
    }catch(e){ quedan.push(item); }
  }
  guardarJSON(COLA_KEY, quedan);
  pintarEstadoPuerta();

  const subidos = cola.length - quedan.length;
  if(!silencioso){
    alert(quedan.length
      ? `Se subieron ${subidos} de ${cola.length}. Quedan ${quedan.length} para el próximo intento.`
      : `Se subieron los ${subidos} ingreso(s) que estaban guardados.`);
  }
  if(subidos && navigator.onLine) cargarIngresos();
}

function pintarEstadoPuerta(){
  const box = document.getElementById("puerta-estado");
  if(!box) return;
  const lista = leerLista();
  const cola = leerCola();
  const n = lista && lista.entradas ? Object.keys(lista.entradas).length : 0;

  const partes = [];
  partes.push(navigator.onLine
    ? `<span class="pt-ok">Con señal</span>`
    : `<span class="pt-off">Sin señal · modo puerta</span>`);
  partes.push(lista
    ? `${n} entrada(s) guardadas · ${new Date(lista.actualizado).toLocaleString("es-AR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}`
    : `<span class="pt-warn">Sin lista descargada</span>`);
  if(cola.length) partes.push(`<span class="pt-warn">${cola.length} sin subir</span>`);

  box.innerHTML = partes.join(" · ");
  const btnSync = document.getElementById("puerta-sync");
  if(btnSync) btnSync.style.display = cola.length ? "inline-block" : "none";
}

async function startScanner(){
  if(DEMO){ alert("El escáner funciona con Supabase conectado (no en modo demo)."); return; }
  document.getElementById("scan-start").style.display="none";
  document.getElementById("scan-stop").style.display="inline-block";
  try{
    html5Qr = new Html5Qrcode("reader");
    // Elegir cámara trasera si se puede
    let camConfig = { facingMode: "environment" };
    try{
      const cams = await Html5Qrcode.getCameras();
      if(cams && cams.length){
        const trasera = cams.find(c=>/back|trasera|rear|environment/i.test(c.label));
        camConfig = { deviceId: { exact: (trasera||cams[cams.length-1]).id } };
      }
    }catch(e){}
    await html5Qr.start(
      camConfig,
      { fps: 15, qrbox: { width: 260, height: 260 } },
      onScanSuccess,
      ()=>{}
    );
  }catch(err){
    alert("No se pudo abrir la cámara. Revisá que hayas dado permiso, y que estés entrando por https (no por http ni abriendo el archivo).\n\nDetalle: " + err);
    stopScanner();
  }
}
function stopScanner(){
  if(html5Qr){ html5Qr.stop().then(()=>html5Qr.clear()).catch(()=>{}); html5Qr=null; }
  document.getElementById("scan-start").style.display="inline-block";
  document.getElementById("scan-stop").style.display="none";
}
async function onScanSuccess(codigo){
  const ahora = Date.now();
  if(codigo===ultimoCodigo && ahora-ultimoMomento < 3000) return;
  ultimoCodigo = codigo; ultimoMomento = ahora;
  if(escaneando) return;
  escaneando = true;

  // Sin señal ni siquiera intentamos: vamos derecho a la copia del celular
  if(!navigator.onLine){
    const off = validarOffline(codigo);
    resultado(off.tipo, off.grande, off.quien, codigo);
    setTimeout(()=>{ escaneando=false; }, 1500);
    return;
  }

  try{
    const r = await fetch(`${SUPABASE_URL}/rest/v1/compras?codigo=eq.${encodeURIComponent(codigo)}&select=*`, {
      headers: authHeaders()
    });
    if(!r.ok) throw new Error("HTTP " + r.status);
    const filas = await r.json();

    if(!Array.isArray(filas) || filas.length===0){
      resultado("bad", "NO EXISTE", "Código no encontrado", codigo);
    } else {
      const e = filas[0];
      if(e.estado !== "aprobado"){
        resultado("bad", "NO PAGADA", `${e.nombre} ${e.apellido}`, e.codigo);
      } else if(e.usada){
        const cuando = e.usada_en ? new Date(e.usada_en).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}) : "";
        resultado("bad", "YA USADA", `${e.nombre} ${e.apellido} · ingresó ${cuando}`, e.codigo);
      } else {
        const rp = await fetch(`${SUPABASE_URL}/rest/v1/compras?id=eq.${e.id}`, {
          method:"PATCH",
          headers: authHeaders({"Prefer":"return=minimal"}),
          body: JSON.stringify({ usada:true, usada_en:new Date().toISOString() })
        });
        if(!rp.ok) throw new Error("no se pudo marcar la entrada");
        resultado("ok", "VÁLIDA ✓", `${e.nombre} ${e.apellido}`, e.codigo, true);
      }
    }
  }catch(err){
    // Se cortó la señal en pleno escaneo: la copia del celular sigue sirviendo
    const off = validarOffline(codigo);
    resultado(off.tipo, off.grande, off.quien, codigo);
  }
  setTimeout(()=>{ escaneando=false; }, 1500);
}
function resultado(tipo, grande, quien, codigo, agregar){
  const box = document.getElementById("scan-result");
  box.className = "scan-result show " + tipo;
  box.innerHTML = `<div class="big">${grande}</div><div class="who">${esc(quien)}</div>`;
  if(navigator.vibrate) navigator.vibrate(tipo==="ok" ? 120 : [80,60,80]);
  // Si fue un ingreso válido nuevo, recargar la lista desde la base
  if(agregar) cargarIngresos();
}
// Cargar la lista de ingresos desde la base (entradas ya usadas)
async function cargarIngresos(){
  if(DEMO) return;
  // Sin señal, o con ingresos todavía sin subir, la lista buena es la del
  // celular: si la pisáramos con la de la base desaparecerían de la pantalla.
  if(!navigator.onLine || leerCola().length){ renderIngresos(); pintarEstadoPuerta(); return; }
  try{
    const r = await fetch(`${SUPABASE_URL}/rest/v1/compras?usada=eq.true&select=nombre,apellido,evento,usada_en&order=usada_en.desc`, {
      headers: authHeaders()
    });
    const filas = await r.json();
    ingresos = (Array.isArray(filas)?filas:[]).map(x=>({
      quien: `${x.nombre} ${x.apellido}`,
      hora: x.usada_en ? new Date(x.usada_en).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}) : ""
    }));
    renderIngresos();
  }catch(e){}
  pintarEstadoPuerta();
}
function renderIngresos(){
  const el = document.getElementById("scan-count");
  if(el) el.textContent = ingresos.length + (ingresos.length===1?" ingreso":" ingresos");
  const list = document.getElementById("scan-list");
  if(list) list.innerHTML = ingresos.map(x=>`
    <div class="scan-item ok">
      <span class="nm">${esc(x.quien)}${x.pendiente?' <span class="pt-warn">· sin subir</span>':''}</span>
      <span class="tm">${x.hora}</span>
    </div>`).join("");
}

// [toggleSecreta(); -> ahora se llama desde initPage()]


/* ================== CUENTAS DE USUARIO ================== */
let USER = null; // { token, email, nombre, apellido, telefono }

function guardarSesionUser(access, refresh){
  try{ localStorage.setItem("tp_user_session", JSON.stringify({a:access, r:refresh})); }catch(e){}
}
function borrarSesionUser(){ try{ localStorage.removeItem("tp_user_session"); localStorage.removeItem("tp_tab_admin"); localStorage.removeItem("tp_recuperando"); }catch(e){} TAB_ADMIN_OK=null; }

async function fetchUserInfo(token){
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers:{ "apikey":SUPABASE_KEY, "Authorization":"Bearer "+token }
  });
  if(!r.ok) return null;
  return r.json();
}
function setUserFromInfo(info, token){
  const m = info.user_metadata || {};
  USER = {
    token: token,
    email: info.email,
    nombre: m.nombre || (m.full_name ? m.full_name.split(" ")[0] : ""),
    apellido: m.apellido || (m.full_name ? m.full_name.split(" ").slice(1).join(" ") : ""),
    telefono: m.telefono || ""
  };
  updateNavUser();
}
let TAB_ADMIN_OK = null; // cache: ¿este usuario puede ver el tab Admin?
async function actualizarTabAdmin(){
  const t = document.getElementById("tab-admin");
  if(!t) return;
  if(DEMO){ t.style.display=""; return; }
  if(!USER){ t.style.display="none"; TAB_ADMIN_OK=null; return; }
  if((USER.email||"").toLowerCase() === ADMIN_EMAIL.toLowerCase()){ t.style.display=""; try{ localStorage.setItem("tp_tab_admin","1"); }catch(e){} return; }
  if(TAB_ADMIN_OK === null){
    // Mostrar al instante lo último que sabíamos, mientras verificamos
    try{ if(localStorage.getItem("tp_tab_admin")==="1") t.style.display=""; }catch(e){}
    try{
      const r = await fetch(`${SUPABASE_URL}/rest/v1/staff?email=eq.${encodeURIComponent(USER.email)}&select=email`, {
        headers:{ "apikey":SUPABASE_KEY, "Authorization":"Bearer "+USER.token }
      });
      const filas = await r.json();
      TAB_ADMIN_OK = Array.isArray(filas) && filas.length > 0;
    }catch(e){ TAB_ADMIN_OK = false; }
    try{ localStorage.setItem("tp_tab_admin", TAB_ADMIN_OK ? "1" : "0"); }catch(e){}
  }
  t.style.display = TAB_ADMIN_OK ? "" : "none";
}
function updateNavUser(){
  const t = document.getElementById("tab-cuenta");
  if(!t) return;
  actualizarTabAdmin();
  // Si todavía no se restauró la sesión pero hay una guardada, mostrar la personita ya
  let hay = !!USER;
  if(!hay){ try{ hay = !!localStorage.getItem("tp_user_session"); }catch(e){} }
  if(hay && !USER){
    t.innerHTML = `<svg class="user-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Mi cuenta"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    t.title = "";
    return;
  }
  if(USER){
    t.innerHTML = `<svg class="user-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Mi cuenta"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    t.title = (USER.nombre||"") + " " + (USER.apellido||"");
  } else {
    t.textContent = "Ingresar";
    t.title = "";
  }
}

// Restaurar sesión de usuario (con renovación automática si venció)
async function restoreUserSession(){
  if(DEMO) return;
  let s;
  try{ s = JSON.parse(localStorage.getItem("tp_user_session")||"null"); }catch(e){}
  if(!s || !s.a) return;
  let info = await fetchUserInfo(s.a);
  if(!info && s.r){
    // el token venció: renovar con el refresh token
    try{
      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method:"POST",
        headers:{ "apikey":SUPABASE_KEY, "Content-Type":"application/json" },
        body: JSON.stringify({ refresh_token: s.r })
      });
      const d = await r.json();
      if(r.ok && d.access_token){
        guardarSesionUser(d.access_token, d.refresh_token);
        s = {a:d.access_token, r:d.refresh_token};
        info = await fetchUserInfo(s.a);
      }
    }catch(e){}
  }
  if(info){ setUserFromInfo(info, s.a); }
  else { borrarSesionUser(); }
}

// Registro con email
async function userRegister(){
  const nombre = document.getElementById("re-nombre").value.trim();
  const apellido = document.getElementById("re-apellido").value.trim();
  const telefono = document.getElementById("re-tel").value.trim();
  const email = document.getElementById("re-email").value.trim();
  const pass = document.getElementById("re-pass").value;
  const err = document.getElementById("re-err"), ok = document.getElementById("re-ok");
  err.style.display="none"; ok.style.display="none";

  if(!nombre || !apellido){ err.textContent="Completá nombre y apellido"; err.style.display="block"; return; }
  if(!telefono){ err.textContent="Completá tu teléfono"; err.style.display="block"; return; }
  if(!email || !email.includes("@")){ err.textContent="Email inválido"; err.style.display="block"; return; }
  if(!pass || pass.length<6){ err.textContent="La contraseña debe tener al menos 6 caracteres"; err.style.display="block"; return; }

  const btn = document.getElementById("re-btn");
  btn.disabled=true; btn.textContent="Creando cuenta...";
  try{
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method:"POST",
      headers:{ "apikey":SUPABASE_KEY, "Content-Type":"application/json" },
      body: JSON.stringify({ email, password: pass, data: { nombre, apellido, telefono, full_name: nombre+" "+apellido } })
    });
    const d = await r.json();
    if(!r.ok){
      err.textContent = (d.msg||d.error_description||"").includes("already") ? "Ese email ya tiene una cuenta. Iniciá sesión." : "No se pudo crear la cuenta. " + (d.msg||"");
      err.style.display="block";
    } else if(d.access_token){
      // registrado y logueado directo
      guardarSesionUser(d.access_token, d.refresh_token);
      setUserFromInfo(d.user, d.access_token);
      // Si vino a loguearse para comprar, devolverlo al evento
      let volver=null; try{ volver = localStorage.getItem("tp_volver"); }catch(e){}
      if(volver){ try{ localStorage.removeItem("tp_volver"); }catch(e){} window.location.href = volver; return; }
      mostrarPerfil();
    } else {
      ok.textContent = "Cuenta creada. Revisá tu email para confirmarla y después iniciá sesión.";
      ok.style.display="block";
    }
  }catch(e){ err.textContent="Error de conexión. Probá de nuevo."; err.style.display="block"; }
  btn.disabled=false; btn.textContent="Crear cuenta";
}

// Login con email
async function userLogin(){
  const email = document.getElementById("li-email").value.trim();
  const pass = document.getElementById("li-pass").value;
  const err = document.getElementById("li-err");
  err.style.display="none";
  if(!email || !pass){ err.textContent="Completá email y contraseña"; err.style.display="block"; return; }

  const btn = document.getElementById("li-btn");
  btn.disabled=true; btn.textContent="Ingresando...";
  try{
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method:"POST",
      headers:{ "apikey":SUPABASE_KEY, "Content-Type":"application/json" },
      body: JSON.stringify({ email, password: pass })
    });
    const d = await r.json();
    if(!r.ok || !d.access_token){
      err.textContent = "Email o contraseña incorrectos"; err.style.display="block";
    } else {
      guardarSesionUser(d.access_token, d.refresh_token);
      setUserFromInfo(d.user, d.access_token);
      // Si vino a loguearse para comprar, devolverlo al evento
      let volver=null; try{ volver = localStorage.getItem("tp_volver"); }catch(e){}
      if(volver){ try{ localStorage.removeItem("tp_volver"); }catch(e){} window.location.href = volver; return; }
      mostrarPerfil();
    }
  }catch(e){ err.textContent="Error de conexión. Probá de nuevo."; err.style.display="block"; }
  btn.disabled=false; btn.textContent="Ingresar";
}

function userLogout(){
  USER = null; borrarSesionUser(); updateNavUser();
  logged=false; ADMIN_TOKEN=null; ROL=null;
  const f = document.getElementById("auth-forms"), p = document.getElementById("auth-profile");
  if(f && p){ f.style.display="block"; p.style.display="none"; }
}

// Login con Google (requiere activar el proveedor en Supabase)
function loginGoogle(){
  const dest = window.location.origin + "/cuenta";
  window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(dest)}`;
}

// Al volver de Google —o del mail de recuperación— los tokens llegan en la URL
let RECUPERANDO = false;
const RECUP_KEY = "tp_recuperando";
function olvidarRecuperacion(){ try{ localStorage.removeItem(RECUP_KEY); }catch(e){} }
function handleOAuthReturn(){
  if(!window.location.hash || !window.location.hash.includes("access_token")) return false;
  const h = new URLSearchParams(window.location.hash.slice(1));
  const a = h.get("access_token"), r = h.get("refresh_token");
  // El link del mail de "olvidé mi contraseña" viene marcado como recovery.
  // Queda anotado en el navegador porque Supabase puede soltarnos en la
  // portada en vez de /cuenta, y ahí se pierde la variable al navegar.
  if(h.get("type") === "recovery"){
    RECUPERANDO = true;
    try{ localStorage.setItem(RECUP_KEY, "1"); }catch(e){}
  }
  if(a){ guardarSesionUser(a, r); }
  history.replaceState({}, "", window.location.pathname); // limpiar la URL
  return true;
}

/* ---------- OLVIDÉ MI CONTRASEÑA ----------
   Supabase manda el mail con un link que vuelve a /cuenta ya con sesión
   abierta, y ahí se pide la contraseña nueva. Responde OK aunque el mail no
   exista, a propósito: así nadie puede averiguar qué cuentas están registradas. */
async function pedirRecuperacion(email){
  const r = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method:"POST",
    headers:{ "apikey":SUPABASE_KEY, "Content-Type":"application/json" },
    body: JSON.stringify({ email, redirect_to: window.location.origin + "/cuenta" })
  });
  if(!r.ok){
    let msg = "No se pudo enviar el mail";
    try{ const d = await r.json(); if(d.msg || d.message) msg += ": " + (d.msg || d.message); }catch(e){}
    throw new Error(msg);
  }
}
async function enviarRecuperacion(){
  const email = document.getElementById("ol-email").value.trim();
  const err = document.getElementById("ol-err"), ok = document.getElementById("ol-ok");
  const btn = document.getElementById("ol-btn");
  err.style.display="none"; ok.style.display="none";
  if(!email || !email.includes("@")){ err.textContent="Escribí tu email"; err.style.display="block"; return; }

  btn.disabled=true; btn.textContent="Enviando...";
  try{
    await pedirRecuperacion(email);
    ok.textContent = `Listo. Si ${email} tiene cuenta, te llega un mail con el link para cambiar la contraseña. Revisá también el correo no deseado.`;
    ok.style.display="block";
  }catch(e){ err.textContent = e.message; err.style.display="block"; }
  btn.disabled=false; btn.textContent="Enviarme el link";
}
// Pantalla de contraseña nueva: se llega del mail o desde Mi Cuenta
function mostrarNuevaPassword(){
  const f = document.getElementById("auth-forms"), p = document.getElementById("auth-profile"),
        n = document.getElementById("form-nueva");
  if(f) f.style.display="none";
  if(p) p.style.display="none";
  if(n){
    n.style.display="block";
    ["nv-pass","nv-pass2"].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=""; });
    ["nv-err","nv-ok"].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display="none"; });
  }
}
function volverDePassword(){
  const n = document.getElementById("form-nueva");
  if(n) n.style.display="none";
  if(USER) mostrarPerfil();
  else { const f = document.getElementById("auth-forms"); if(f) f.style.display="block"; authView("login"); }
}
async function guardarPasswordNueva(){
  const p1 = document.getElementById("nv-pass").value;
  const p2 = document.getElementById("nv-pass2").value;
  const err = document.getElementById("nv-err"), ok = document.getElementById("nv-ok");
  const btn = document.getElementById("nv-btn");
  err.style.display="none"; ok.style.display="none";

  if(!p1 || p1.length < 6){ err.textContent="La contraseña tiene que tener al menos 6 caracteres"; err.style.display="block"; return; }
  if(p1 !== p2){ err.textContent="Las dos contraseñas no coinciden"; err.style.display="block"; return; }
  if(!USER || !USER.token){ err.textContent="El link venció. Pedí uno nuevo desde 'Olvidé mi contraseña'."; err.style.display="block"; return; }

  btn.disabled=true; btn.textContent="Guardando...";
  try{
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method:"PUT",
      headers:{ "apikey":SUPABASE_KEY, "Authorization":"Bearer "+USER.token, "Content-Type":"application/json" },
      body: JSON.stringify({ password: p1 })
    });
    if(!r.ok){
      let msg = "No se pudo cambiar";
      try{ const d = await r.json(); if(d.msg || d.message) msg += ": " + (d.msg || d.message); }catch(e){}
      throw new Error(msg);
    }
    RECUPERANDO = false; olvidarRecuperacion();
    ok.textContent = "Contraseña cambiada. Ya podés usarla."; ok.style.display="block";
    document.getElementById("nv-pass").value=""; document.getElementById("nv-pass2").value="";
    setTimeout(volverDePassword, 1400);
  }catch(e){ err.textContent = e.message; err.style.display="block"; }
  btn.disabled=false; btn.textContent="Guardar contraseña";
}
// Desde el escáner: usa el mail que ya escribió y lo manda
async function olvideEscaner(){
  const email = (document.getElementById("esc-email").value||"").trim();
  const err = document.getElementById("esc-err");
  err.style.display="none";
  if(!email || !email.includes("@")){
    err.textContent = "Escribí tu email arriba y volvé a tocar acá.";
    err.style.display="block"; return;
  }
  try{
    await pedirRecuperacion(email);
    alert(`Si ${email} tiene cuenta, te llega un mail con el link para cambiar la contraseña.\n\nSe abre en el navegador: cambiala ahí y después volvé a esta app a ingresar.`);
  }catch(e){ err.textContent = e.message; err.style.display="block"; }
}

// Vistas de la página de cuenta
function authView(v){
  // "olvide" no tiene pestaña propia: se llega desde el link del login
  document.getElementById("at-login").classList.toggle("active", v==="login");
  document.getElementById("at-register").classList.toggle("active", v==="register");
  document.getElementById("form-login").style.display = v==="login" ? "block" : "none";
  document.getElementById("form-register").style.display = v==="register" ? "block" : "none";
  const ol = document.getElementById("form-olvide");
  if(ol) ol.style.display = v==="olvide" ? "block" : "none";
}
function mostrarPerfil(){
  if(!document.getElementById("auth-profile")) return;
  document.getElementById("auth-forms").style.display="none";
  document.getElementById("auth-profile").style.display="block";
  document.getElementById("pf-nombre").textContent = ((USER.nombre||"")+" "+(USER.apellido||"")).trim() || "—";
  document.getElementById("pf-email").textContent = USER.email || "—";
  const tel = document.getElementById("pf-tel-input");
  if(tel) tel.value = USER.telefono || "";
}
async function guardarTelefono(){
  const ok = document.getElementById("pf-tel-ok"), err = document.getElementById("pf-tel-err");
  ok.style.display="none"; err.style.display="none";
  const tel = document.getElementById("pf-tel-input").value.trim();
  if(!tel){ err.textContent="Escribí tu teléfono."; err.style.display="block"; return; }
  try{
    // 1. Guardar en la cuenta (Auth)
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method:"PUT",
      headers:{ "apikey":SUPABASE_KEY, "Authorization":"Bearer "+USER.token, "Content-Type":"application/json" },
      body: JSON.stringify({ data: { telefono: tel } })
    });
    if(!r.ok) throw new Error("No se pudo guardar");
    // 2. Actualizar también el perfil (para que lo veas en el Admin)
    await fetch(`${SUPABASE_URL}/rest/v1/perfiles?id=eq.${encodeURIComponent((await r.json()).id)}`, {
      method:"PATCH",
      headers:{ "apikey":SUPABASE_KEY, "Authorization":"Bearer "+USER.token, "Content-Type":"application/json", "Prefer":"return=minimal" },
      body: JSON.stringify({ telefono: tel })
    }).catch(()=>{});
    USER.telefono = tel;
    ok.textContent="Teléfono guardado."; ok.style.display="block";
  }catch(e){ err.textContent="No se pudo guardar. Probá de nuevo."; err.style.display="block"; }
}


/* ================== EVENTOS PASADOS ================== */
// La carga de galería desde el admin se sacó: los eventos pasados se cargan
// solo con nombre, fecha, lugar y foto de portada. El lado público sigue
// mostrando la galería de los eventos que ya tienen items cargados.


/* ================== ADMIN: EVENTOS PASADOS (gestor propio) ================== */
let PASADOS_ADMIN = [];
async function loadPasadosAdmin(){
  if(DEMO){ PASADOS_ADMIN=[]; renderPasadosAdmin(); return; }
  try{ PASADOS_ADMIN = await dbGet("eventos", "pasado=eq.true&order=id.desc"); }catch(e){ PASADOS_ADMIN=[]; }
  renderPasadosAdmin();
}
function renderPasadosAdmin(){
  const list = document.getElementById("pe-list");
  if(!list) return;
  list.innerHTML = PASADOS_ADMIN.map(ev=>`
    <div class="ev-admin-item">
      <div class="info">
        <b>${esc(ev.nombre)}</b>
        <span>${esc(ev.fecha_texto||"")} ${ev.lugar?"· "+esc(ev.lugar):""}</span>
      </div>
      <div class="row-actions">
        <button class="btn ghost" onclick="editPasado(${ev.id})">Editar / Galería</button>
        <button class="btn ghost" onclick="deletePasado(${ev.id})">Borrar</button>
      </div>
    </div>`).join("") || `<p style="color:var(--text-dim);font-size:14px">Todavía no cargaste eventos pasados.</p>`;
}
function previewFotoPasado(){
  const f = document.getElementById("pe-foto").files[0];
  const img = document.getElementById("pe-thumb");
  if(f){ img.src = URL.createObjectURL(f); img.style.display="block"; }
}
function resetPasadoForm(){
  ["pe-id","pe-nombre","pe-fecha","pe-lugar","pe-desc","pe-direccion","pe-foto-url"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("pe-foto").value="";
  document.getElementById("pe-thumb").style.display="none";
  document.getElementById("pe-form-title").textContent="Nuevo evento pasado";
  document.getElementById("pe-save-btn").textContent="Guardar evento pasado";
  document.getElementById("pe-err").style.display="none";
  document.getElementById("pe-ok").style.display="none";
}
function editPasado(id){
  const ev = PASADOS_ADMIN.find(e=>e.id===id); if(!ev) return;
  document.getElementById("pe-id").value = ev.id;
  document.getElementById("pe-nombre").value = ev.nombre||"";
  document.getElementById("pe-fecha").value = ev.fecha_texto||"";
  document.getElementById("pe-lugar").value = ev.lugar||"";
  document.getElementById("pe-desc").value = ev.descripcion||"";
  document.getElementById("pe-direccion").value = ev.direccion||"";
  document.getElementById("pe-foto-url").value = ev.foto_url||"";
  const img = document.getElementById("pe-thumb");
  if(ev.foto_url){ img.src=ev.foto_url; img.style.display="block"; } else img.style.display="none";
  document.getElementById("pe-form-title").textContent = "Editar: " + ev.nombre;
  document.getElementById("pe-save-btn").textContent = "Guardar cambios";
  document.getElementById("pe-form-title").scrollIntoView({behavior:"smooth"});
}
async function savePasado(){
  const err = document.getElementById("pe-err"), ok = document.getElementById("pe-ok");
  err.style.display="none"; ok.style.display="none";
  const nombre = document.getElementById("pe-nombre").value.trim();
  if(!nombre){ err.textContent="Poné al menos el nombre del evento."; err.style.display="block"; return; }

  const btn = document.getElementById("pe-save-btn");
  btn.disabled=true; const prev=btn.textContent; btn.textContent="Guardando...";
  try{
    let fotoUrl = document.getElementById("pe-foto-url").value || null;
    const file = document.getElementById("pe-foto").files[0];
    if(file){ fotoUrl = DEMO ? URL.createObjectURL(file) : await uploadFoto(file); }
    const data = {
      nombre,
      fecha_texto: document.getElementById("pe-fecha").value.trim(),
      lugar: document.getElementById("pe-lugar").value.trim(),
      descripcion: document.getElementById("pe-desc").value.trim(),
      direccion: document.getElementById("pe-direccion").value.trim(),
      foto_url: fotoUrl,
      pasado: true, activo: true, agotado: false,
      puertas: "", arte: "red"
    };
    const id = document.getElementById("pe-id").value;
    if(!DEMO){
      if(id){ await dbUpdate("eventos", id, data); }
      else {
        const creado = await dbInsert("eventos", data);
        if(creado && creado[0]){ document.getElementById("pe-id").value = creado[0].id; }
      }
    }
    ok.textContent = id ? "Evento pasado actualizado." : "Evento pasado creado."; ok.style.display="block";
    document.getElementById("pe-form-title").textContent = "Editar: " + nombre;
    document.getElementById("pe-save-btn").textContent = "Guardar cambios";
    loadPasadosAdmin(); loadPasados();
  }catch(e){ err.textContent="Error al guardar: "+e.message; err.style.display="block"; }
  btn.disabled=false; if(btn.textContent==="Guardando...") btn.textContent=prev;
}
async function deletePasado(id){
  const ev = PASADOS_ADMIN.find(e=>e.id===id);
  if(!confirm(`¿Borrar "${ev.nombre}" y toda su galería?`)) return;
  try{
    await dbDelete("eventos", id);
    loadPasadosAdmin(); loadPasados();
  }catch(e){ alert("No se pudo borrar: "+e.message); }
}

/* ------- Lado público: sección Eventos pasados ------- */
let PASADOS = [];
async function loadPasados(){
  const sec = document.getElementById("pasados-sec");
  if(!sec) return;
  try{
    PASADOS = DEMO ? [] : await dbGet("eventos", "pasado=eq.true&activo=eq.true&order=id.desc");
  }catch(e){ PASADOS = []; }
  if(!PASADOS.length){ sec.style.display="none"; return; }
  sec.style.display="block";
  document.getElementById("grid-pasados").innerHTML = PASADOS.map(ev=>`
    <article class="ticket pasado">
      <div class="art ${ev.foto_url?'':'red'}" style="${ev.foto_url?`background-image:url('${ev.foto_url}')`:''}" onclick="openPasado(${ev.id})">
        <span>${esc(ev.nombre)}</span>
      </div>
      <div class="body" style="padding:14px 16px">
        <span style="color:var(--text-dim);font-size:13px">${esc(ev.fecha_texto||"")}</span>
        <button class="btn ghost ancho" style="margin-top:10px" onclick="openPasado(${ev.id})">Ver evento</button>
      </div>
    </article>`).join("");
}
function urlVideoEmbed(url){
  // YouTube → iframe embebido; otros links → link normal
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if(yt) return `https://www.youtube.com/embed/${yt[1]}`;
  return null;
}
async function openPasado(evId, empujarURL=true){
  const ev = PASADOS.find(e=>e.id===evId); if(!ev) return;
  if(empujarURL){ try{ history.pushState(null, "", "?pasado="+evId); }catch(e){} }

  document.getElementById("d-name").textContent = ev.nombre;
  // Un evento pasado no vende: sin edad mínima, y el "cuándo" lleva el aviso
  pintarCabeceraDetalle(ev, {
    cuando: [ev.fecha_texto, "Evento finalizado"].filter(Boolean),
    edad: null
  });

  const bg = document.getElementById("d-bg");
  const flyer = document.getElementById("d-flyer");
  if(ev.foto_url){
    bg.style.backgroundImage = `url('${ev.foto_url}')`;
    flyer.classList.remove("nofoto");
    flyer.style.backgroundImage = `url('${ev.foto_url}')`;
  } else {
    bg.style.backgroundImage = "";
    flyer.classList.add("nofoto");
    flyer.style.backgroundImage = "";
  }

  pintarDescripcion(ev.descripcion || "");

  // Evento pasado: sin tarjeta de compra
  const buyCard = document.querySelector(".d-buy-card");
  if(buyCard) buyCard.style.display = "none";

  // Ubicación
  const loc = document.getElementById("d-location");
  if(ev.direccion){
    const q = encodeURIComponent(ev.direccion);
    loc.innerHTML = `<p style="color:var(--text-dim);margin-bottom:12px;font-size:13px">${esc(ev.direccion)}</p>
      <div class="map-wrap"><iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${q}&output=embed"></iframe></div>`;
  } else {
    loc.innerHTML = `<p style="color:var(--text-dim)">${esc(ev.lugar||"")}</p>`;
  }

  // Galería del evento
  const sec = document.getElementById("d-galeria-sec");
  const cont = document.getElementById("d-galeria");
  sec.style.display = "block";
  cont.innerHTML = `<div class="loading">Cargando galería...</div>`;
  let items = [];
  try{ items = await dbGet("galeria", `evento_id=eq.${evId}&order=orden.asc`); }catch(e){}
  // Sin fotos ni videos: ocultamos la sección en vez de mostrarla vacía
  if(!items.length){ sec.style.display="none"; cont.innerHTML=""; }
  else cont.innerHTML = items.map(g=>{
    if(g.tipo==="foto") return `<img src="${g.url}" alt="${esc(ev.nombre)}" loading="lazy">`;
    const emb = urlVideoEmbed(g.url);
    if(emb) return `<div class="gal-video"><iframe src="${emb}" allowfullscreen loading="lazy"></iframe></div>`;
    if(g.url.includes("/storage/") || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(g.url))
      return `<div class="gal-video"><video src="${g.url}" controls playsinline preload="metadata"></video></div>`;
    return `<a class="btn ghost" href="${g.url}" target="_blank" rel="noopener" style="align-self:center">Ver video</a>`;
  }).join("");

  go('detalle');
  medirDesc();
}

/* ================== INICIALIZADOR POR PÁGINA ================== */
// Cada archivo HTML tiene <body data-page="..."> y acá arrancamos lo que corresponde.
async function initPage(){
  const page = document.body.getAttribute("data-page") || "eventos";

  // Marcar el tab activo según la página
  document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
  const tabActivo = document.getElementById("tab-"+page) || document.getElementById("tab-eventos");
  if(tabActivo) tabActivo.classList.add("active");

  // Limpiar anclas viejas (#lista) para que recargar no baje solo
  if(window.location.hash && !window.location.hash.includes("access_token")){
    try{ history.replaceState(null, "", window.location.pathname + window.location.search); }catch(e){}
  }

  // Pintar la barra al instante (evita el parpadeo Ingresar → personita)
  updateNavUser();

  // Si vuelve de Google, capturar los tokens de la URL
  handleOAuthReturn();

  // El link del mail puede caer en cualquier página (si la URL del sitio no
  // está en la lista de redirecciones de Supabase, te suelta en la portada).
  // Lo llevamos igual a la pantalla de contraseña nueva.
  if(!RECUPERANDO){ try{ RECUPERANDO = localStorage.getItem(RECUP_KEY) === "1"; }catch(e){} }
  if(RECUPERANDO && page !== "cuenta"){ window.location.href = "/cuenta"; return; }

  // Restaurar sesiones (usuario y admin)
  await restoreUserSession();
  await restoreAdminSession();

  if(page==="eventos"){
    // Los precios y los cupos dependen de los tipos y de cuántas se vendieron:
    // los dos tienen que estar antes de pintar nada.
    await cargarTipos();
    await cargarVentasTipo();
    await loadEvents();
    pintarFondoHero();
    await loadPasados();
    checkReturnFromPayment();

    // Si la URL apunta a un evento, abrirlo directo (deep link / recarga)
    const prm = new URLSearchParams(location.search);
    if(prm.get("evento")) openDetail(Number(prm.get("evento")), false);
    else if(prm.get("pasado")) openPasado(Number(prm.get("pasado")), false);

    // Botón atrás/adelante del navegador
    window.addEventListener("popstate", ()=>{
      const q = new URLSearchParams(location.search);
      if(q.get("evento")) openDetail(Number(q.get("evento")), false);
      else if(q.get("pasado")) openPasado(Number(q.get("pasado")), false);
      else go("eventos");
    });
  }
  else if(page==="entradas"){
    const sub = document.getElementById("ent-sub");
    const prompt = document.getElementById("ent-login-prompt");
    if(USER){
      if(sub) sub.textContent = `Hola, ${USER.nombre||"vos"}. Acá están tus entradas asociadas a tu cuenta.`;
      if(prompt) prompt.style.display="none";
      cargarEntradasUsuario();
    } else {
      if(sub) sub.textContent = "Tus entradas quedan asociadas a tu cuenta.";
      if(prompt) prompt.style.display="block";
      document.getElementById("my-tickets").innerHTML = "";
    }
  }
  else if(page==="admin"){
    // Cargar eventos en memoria (para el panel) y mostrar login o panel
    // Sin el filtro de pasados, un evento finalizado aparecía en "Eventos" Y en
    // "Eventos pasados" a la vez. Mismo criterio que loadEvents() y saveEvento().
    try{ EVENTS = DEMO ? DEMO_EVENTS : (await dbGet("eventos","activo=eq.true&order=id.asc")).filter(e=>!e.pasado); }catch(e){}
    await cargarVentasTipo();   // deja VENTAS_VISTA_OK para el aviso del panel
    toggleSecreta();
    if(logged){
      abrirPanel();
    } else {
      document.getElementById("admin-login").style.display="block";
    }
  }
  else if(page==="cuenta"){
    // Vino del mail de recuperación: primero la contraseña nueva.
    // Se borra la marca acá para no quedar rebotando a esta pantalla siempre;
    // si recarga sin cambiarla, la tiene igual en Mi Cuenta.
    if(RECUPERANDO){ olvidarRecuperacion(); mostrarNuevaPassword(); return; }
    if(USER){
      // Si vino a loguearse para comprar, devolverlo al evento
      let volver=null; try{ volver = localStorage.getItem("tp_volver"); }catch(e){}
      if(volver){ try{ localStorage.removeItem("tp_volver"); }catch(e){} window.location.href = volver; return; }
      mostrarPerfil();
    }
    else {
      const f=document.getElementById("auth-forms");
      if(f) f.style.display="block";
      // Avisar que hace falta ingresar para comprar
      let vol=null; try{ vol = localStorage.getItem("tp_volver"); }catch(e){}
      if(vol && f && !document.getElementById("aviso-compra")){
        const av = document.createElement("p");
        av.id = "aviso-compra";
        av.style.cssText = "background:rgba(225,6,0,.1);border:1px solid rgba(225,6,0,.4);color:var(--text);padding:12px 16px;border-radius:12px;font-size:14px;margin-bottom:18px";
        av.textContent = "Ingresá o creá tu cuenta para completar la compra de tus entradas.";
        f.prepend(av);
      }
    }
  }
  else if(page==="escaner"){
    aplicarModoApp();
    // Sin sesión se muestra el ingreso acá mismo: antes te mandaba al panel
    // y quedabas ahí adentro, sin volver nunca al escáner.
    if(!logged){ mostrarLoginEscaner(); return; }
    mostrarEscaner();
  }
}
document.addEventListener("DOMContentLoaded", initPage);
