
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
// Costo por servicio: 10% del valor de la entrada, lo paga el comprador y se
// suma al total. Único lugar donde vive el porcentaje — el cálculo
// (servicioDe) y los textos de la UI salen los dos de acá.
const SERVICIO_PCT = 0.10;
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
  {id:1, nombre:"Cachengue es de Bronx", fecha_texto:"Sáb 5 Sep 2026", lugar:"Bronx Social Club", puertas:"Cena 22hs · Previa 00hs · Cachengue 01:30", arte:"red", color_acento:"violeta", agotado:false, ubicacion_secreta:false, descripcion:"El sábado clásico de Bronx. Cena, previa y cachengue hasta las 6. +18 con documento.", foto_url:null, direccion:"Casanova 888, Bahía Blanca"},
];
const DEMO_TIPOS = [
  {id:101, evento_id:1, nombre:"LA TERRAZA - PREVIA DE AMIGOS", descripcion:"Acceso exclusivo terrazas. Barra libre.", precio:17000, cantidad:40, orden:0, categoria:"ticket", accesos:1, activo:true, oculto:false, valido_desde:"00:30", valido_hasta:"02:30"},
  {id:102, evento_id:1, nombre:"GENERAL 1", descripcion:"Desde las 23:30, sin límite de horario.", precio:8000, cantidad:null, orden:1, categoria:"ticket", accesos:1, activo:true, oculto:false, valido_desde:"23:30", valido_hasta:null},
  {id:103, evento_id:1, nombre:"GENERAL 2", descripcion:"Desde las 23:30, sin límite de horario.", precio:10000, cantidad:null, orden:2, categoria:"ticket", accesos:1, activo:true, oculto:false, valido_desde:"23:30", valido_hasta:null},
  {id:104, evento_id:1, nombre:"5 ACCESOS + BOTELLA DE FERNET", descripcion:"Branca 1L con Coca.", precio:115000, cantidad:10, orden:3, categoria:"combo", accesos:5, activo:true, oculto:false, valido_desde:null, valido_hasta:null},
];
let DEMO_PURCHASES = [];
const DEMO_PATROCINADORES = [
  {id:1, nombre:"Cervecería Bronx", logo_url:"/iconos/logo-bronx.png", link:null, orden:0, activo:true},
];
// Equipo de demo: mismo shape que devuelve colaboradores con sus roles
// embebidos (ver loadEquipo y sql/roles-equipo.sql).
let DEMO_COLABORADORES = [
  {id:1, nombre:"Nano Rabbione", email:"nano@bronx.test", telefono:"291-500-0000", foto_url:null, activo:true, colaborador_rol:[{rol:"admin", evento_id:null}]},
  {id:2, nombre:"Sofi Encargada", email:"sofi@bronx.test", telefono:"291-500-1111", foto_url:null, activo:true, colaborador_rol:[{rol:"encargado", evento_id:1}]},
  {id:3, nombre:"Tincho Puerta",  email:"tincho@bronx.test", telefono:null, foto_url:null, activo:true, colaborador_rol:[{rol:"escaner", evento_id:null}]},
];

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
    if(p==="eventos" && /[?&]evento=/.test(location.search)){
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

/* ================== COLOR DE ACENTO POR EVENTO ==================
   eventos.color_acento guarda una CLAVE ("rojo"), no un hex: los valores de
   cada una viven en el bloque "COLOR DE ACENTO POR EVENTO" de estilos.css.
   Acá sólo se escribe esa clave como data-color-evento en el contenedor
   correspondiente; el CSS redefine ahí los tokens del acento y todo lo que
   ya pintaba con var(--accent) cambia solo.

   El scope importa: se pone en #page-detalle, en el overlay de compra y en
   cada tarjeta de la grilla. Nunca en <body> ni en el header/footer, que
   siguen siendo el naranja de la marca. */
const COLORES_EVENTO = ["naranja","rojo","blanco","violeta","verde"];
const COLOR_EVENTO_DEFECTO = "naranja";
// Tolera null, una clave vieja o una que ya no existe en la paleta
function colorEvento(ev){
  const c = ev && ev.color_acento;
  return COLORES_EVENTO.includes(c) ? c : COLOR_EVENTO_DEFECTO;
}
// Tiñe la página de detalle (y el modal de compra, que vive fuera de ella)
function pintarColorDetalle(ev){
  const color = colorEvento(ev);
  const pag = document.getElementById("page-detalle");
  if(pag) pag.dataset.colorEvento = color;
  const ov = document.getElementById("overlay");
  if(ov) ov.dataset.colorEvento = color;
}

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
    const el = document.createElement("article");
    el.className = "ticket" + (agotado ? " soldout" : "");
    el.dataset.colorEvento = colorEvento(ev);   // el glow de la tarjeta sale de acá
    el.onclick = () => openDetail(ev.id);       // toda la tarjeta es el link, sin botones
    const artClass = ev.foto_url ? "" : ev.arte;
    const artStyle = ev.foto_url ? `style="background-image:url('${ev.foto_url}')"` : "";
    const horario = [ev.fecha_texto, ev.puertas].filter(Boolean).join(" · ");
    el.innerHTML = `
      <div class="art ${artClass}" ${artStyle}>
        ${ev.foto_url ? "" : `<span class="art-name">${esc(ev.nombre)}</span>`}
        ${agotado ? '<span class="tag-soldout">Agotado</span>' : ""}
      </div>
      <div class="ticket-info">
        <h3 class="ticket-nombre">${esc(ev.nombre)}</h3>
        <p class="ticket-meta">${esc(horario)}</p>
      </div>`;
    grid.appendChild(el);
  });
}
// [loadEvents(); -> ahora se llama desde initPage()]

/* ---------- PATROCINADORES (fila de logos, debajo de los eventos) ----------
   El track se arma con la lista de sponsors DUPLICADA una vez, seguida: la
   animación CSS (patrocinadores-scroll en estilos.css) corre translateX de
   0 a -50%, así el segundo tramo empalma exacto con el primero y el loop no
   se nota. Sin sponsors activos, la sección entera queda oculta.

   Cada .marquee-item arranca invisible (ver estilos.css) y recibe acá un
   transition-delay escalonado por posición (80ms × índice, mod la cantidad
   real de sponsors — así la copia duplicada del loop repite el mismo ritmo
   en vez de acumular delay); un IntersectionObserver agrega ".visible" a la
   sección la primera vez que entra en el viewport, disparando la cascada. */
let PATROCINADORES_PUB = [];
let obsPatrocinadores = null;
async function loadPatrocinadores(){
  const sec = document.getElementById("patrocinadores-sec");
  if(!sec) return;
  try{
    PATROCINADORES_PUB = DEMO ? DEMO_PATROCINADORES : await dbGet("patrocinadores", "activo=eq.true&order=orden.asc");
  }catch(e){ PATROCINADORES_PUB = []; }
  if(!PATROCINADORES_PUB.length){ sec.style.display = "none"; return; }
  const track = document.getElementById("patrocinadores-track");
  const item = p => {
    const img = `<img src="${esc(p.logo_url)}" alt="${esc(p.nombre)}" loading="lazy">`;
    return `<div class="marquee-item">${p.link ? `<a href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">${img}</a>` : img}</div>`;
  };
  const html = PATROCINADORES_PUB.map(item).join("");
  track.innerHTML = html + html;
  sec.classList.remove("visible");
  const n = PATROCINADORES_PUB.length;
  track.querySelectorAll(".marquee-item").forEach((el, i)=>{
    el.style.transitionDelay = (i % n) * 80 + "ms";
  });

  sec.style.display = "";

  if(obsPatrocinadores) obsPatrocinadores.disconnect();
  if("IntersectionObserver" in window){
    obsPatrocinadores = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){ sec.classList.add("visible"); obsPatrocinadores.disconnect(); }
      });
    }, {threshold:0.2});
    obsPatrocinadores.observe(sec);
  } else {
    sec.classList.add("visible");   // sin soporte, se muestran directo
  }
}

/* ================== CARRUSEL DEL HERO ==================
   Título + bajada rotan cada 4s con cross-fade de 600ms (CSS, vía la clase
   "activa"); acá sólo se decide CUÁL está activo. Cada slide trae su propia
   foto de fondo (.hero-bg-slide) y su propio glow de color detrás del
   título (.hero-glow) — los tres elementos de cada tipo comparten el mismo
   data-tinte y togglean "activa"/"activo" juntos, así la foto, el glow, el
   título y el botón (que se retiñe por CSS con hero.dataset.tinte, ver
   estilos.css) cruzan todos en sincro. */
const HERO_SLIDES = ["naranja", "rojo", "neutro"];
let heroSlideActual = 0;
let heroTimer = null;

function activarHeroSlide(i){
  const hero = document.getElementById("hero");
  if(!hero) return;
  hero.dataset.tinte = HERO_SLIDES[i];
  document.querySelectorAll("#hero-slides .hero-slide").forEach((el, idx)=>{
    el.classList.toggle("activa", idx === i);
  });
  document.querySelectorAll(".hero-bg-slide").forEach(el=>{
    el.classList.toggle("activa", el.dataset.tinte === HERO_SLIDES[i]);
  });
  document.querySelectorAll(".hero-glow").forEach(el=>{
    el.classList.toggle("activo", el.dataset.tinte === HERO_SLIDES[i]);
  });
}

function iniciarHeroCarrusel(){
  const hero = document.getElementById("hero");
  if(!hero) return;
  activarHeroSlide(0);
  clearInterval(heroTimer);
  // Reduced motion: se queda en el primer slide fijo, sin arrancar el intervalo.
  if(matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  heroTimer = setInterval(()=>{
    heroSlideActual = (heroSlideActual + 1) % HERO_SLIDES.length;
    activarHeroSlide(heroSlideActual);
  }, 4000);
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
  pintarColorDetalle(ev);

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
  registrarVistaEvento(ev.id);
}

/* ---------- VISTAS DE LA PÁGINA DEL EVENTO ----------
   Suma una fila en evento_vistas (sql/evento-vistas.sql) para el KPI
   "Vistas" y la línea de visitas del gráfico de Analytics.

   Dedup en dos capas: acá el sessionStorage evita el insert si esta pestaña
   ya contó este evento (refrescar diez veces no suma diez visitas), y en la
   base un índice único por (evento, sesión, día) tapa lo que llegue igual.
   El 409 de ese índice es el caso esperado, no un error que mostrar: esto
   es analítica, nunca puede romper la página del comprador. */
function idSesionVisitante(){
  try{
    let sid = localStorage.getItem("tp_sid");
    if(!sid){
      sid = (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
      localStorage.setItem("tp_sid", sid);
    }
    return sid;
  }catch(e){ return null; }   // navegador sin storage: no se cuenta y listo
}
async function registrarVistaEvento(eventoId){
  if(DEMO || !eventoId) return;
  const sid = idSesionVisitante();
  if(!sid) return;
  const marca = "tp_vista_" + eventoId;
  try{ if(sessionStorage.getItem(marca)) return; }catch(e){}
  try{
    await fetch(`${SUPABASE_URL}/rest/v1/evento_vistas`, {
      method:"POST",
      // return=minimal: anon puede insertar pero no leer esta tabla, así que
      // pedir la fila de vuelta daría 401 (mismo patrón que compras).
      headers:{ "apikey":SUPABASE_KEY, "Authorization":"Bearer "+SUPABASE_KEY,
                "Content-Type":"application/json", "Prefer":"return=minimal" },
      body: JSON.stringify({ evento_id: eventoId, session_id: sid })
    });
    try{ sessionStorage.setItem(marca, "1"); }catch(e){}
  }catch(e){ /* silencio: una visita no contada no le arruina la compra a nadie */ }
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
  // Ya no hace falta tener sesión para comprar: el paso 2 del checkout
  // ofrece seguir como invitado (ver "CHECKOUT DE 4 PASOS").
  btn.textContent = `Comprar ${s.entradas} ${s.entradas === 1 ? "entrada" : "entradas"} · ${fmt(s.total)}`;
  btn.onclick = ()=>abrirCheckout(cur.id);

  const floatbar = document.getElementById("d-floatbar");
  if(floatbar){
    floatbar.style.display = s.entradas ? "flex" : "none";
    const fbCount = document.getElementById("d-floatbar-count");
    if(fbCount) fbCount.textContent = `${s.entradas} ${s.entradas === 1 ? "entrada" : "entradas"}`;
    const fbTotal = document.getElementById("d-floatbar-total");
    if(fbTotal) fbTotal.textContent = fmt(s.total);
    const fbBtn = document.getElementById("d-floatbar-btn");
    if(fbBtn) fbBtn.onclick = ()=>abrirCheckout(cur.id);
  }
}

/* ================== CHECKOUT ==================
   Un solo modal con stepper arriba, cuerpo dibujado desde acá
   (renderCheckout) sobre la cáscara que está en index.html.

   Regla que se repite en todo el archivo y también acá: los inputs escriben
   en el estado (CK) con oninput y NO re-renderizan, porque redibujar en cada
   tecla pierde el foco a mitad de palabra. Sólo re-renderizan los cambios de
   estructura (cambiar de paso, sumar/restar una entrada, tildar "usar mis
   datos"). Lo que sí se refresca en vivo es el cartel de error y el estado
   del botón "Siguiente", que se tocan por id.

   Los 4 pasos de siempre (Revisá tu orden · Comprador · Tickets ·
   Confirmación) son el flujo por defecto — el único que existe en desktop,
   sin excepción. En mobile, si además hay sesión iniciada (o DEMO) y la
   compra es de una sola entrada, ckPasosActivos() devuelve una versión de 3
   pasos que fusiona Comprador+Tickets en un solo paso "Tus datos": con un
   solo asistente, sus datos son los mismos que los del comprador, así que
   no tiene sentido pedirlos dos veces. Con 2+ entradas o sin sesión (mobile
   o desktop) se mantienen los 4 pasos, porque cada asistente necesita sus
   propios datos.
   Los botones "Volver"/"Siguiente" navegan siempre en relativo
   (CK.paso-1 / CK.paso+1) para no tener que saber en qué array de pasos
   están parados. */
const CK_PASOS = [
  { clave:"orden",     titulo:"Revisá tu orden" },
  { clave:"comprador", titulo:"Comprador" },
  { clave:"tickets",   titulo:"Tickets" },
  { clave:"confirmacion", titulo:"Confirmación" }
];
// Sólo mobile: en desktop este checkout es siempre el de 4 pasos de arriba.
const CK_MOBILE_MQ = "(max-width:640px)";
function ckModoCombinado(){
  return !!(CK && (USER || DEMO) && matchMedia(CK_MOBILE_MQ).matches && totalesSeleccion().entradas === 1);
}
function ckPasosActivos(){
  if(!ckModoCombinado()) return CK_PASOS;
  return [ CK_PASOS[0], { clave:"datos", titulo:"Tus datos" }, CK_PASOS[3] ];
}
function ckPasoClave(paso){
  const pasos = ckPasosActivos();
  const p = pasos[(paso || CK.paso) - 1];
  return p ? p.clave : pasos[pasos.length - 1].clave;
}

/* El selector de país del teléfono. Argentina primero porque es el default
   real del negocio (un boliche de Bahía Blanca); el resto son los países
   desde donde algún turista podría comprar. */
const CK_PAISES = [
  { cod:"+54",  pais:"Argentina", bandera:"🇦🇷" },
  { cod:"+598", pais:"Uruguay",   bandera:"🇺🇾" },
  { cod:"+56",  pais:"Chile",     bandera:"🇨🇱" },
  { cod:"+55",  pais:"Brasil",    bandera:"🇧🇷" },
  { cod:"+595", pais:"Paraguay",  bandera:"🇵🇾" },
  { cod:"+591", pais:"Bolivia",   bandera:"🇧🇴" },
  { cod:"+34",  pais:"España",    bandera:"🇪🇸" },
  { cod:"+1",   pais:"EE.UU.",    bandera:"🇺🇸" }
];
const CK_TIPOS_DOC = ["DNI", "Pasaporte", "Cédula", "LC", "LE"];

let CK = null;   // estado del checkout abierto; null = modal cerrado

function ckNuevo(){
  return {
    paso: 1,
    // Sin sesión hay que elegir camino antes de ver el formulario del paso 2.
    // Con sesión no se pregunta nada: ya sabemos quién es.
    camino: (USER || DEMO) ? "sesion" : null,
    comprador: {
      nombre:   USER ? (USER.nombre   || "") : "",
      apellido: USER ? (USER.apellido || "") : "",
      tipo_doc: "DNI",
      documento: "",
      email:    USER ? (USER.email || "") : "",
      email2:   USER ? (USER.email || "") : "",
      pais: "+54",
      telefono: USER ? (USER.telefono || "") : ""
    },
    asistentes: [],
    usarMisDatos: false,
    cuponAbierto: false,
    cuponTexto: "",
    cuponMsg: "",
    cuponOk: false,
    terminosAceptados: false,
    error: ""
  };
}

/* Una ficha de asistente por QR, en el mismo orden que unidadesSeleccionadas()
   (que es el orden en que confirmBuy las lee de vuelta). Al cambiar cantidades
   en el paso 1 se conservan los datos ya cargados por posición.
   En el paso combinado ("Tus datos", ver arriba) hay un solo asistente y no
   existe una pantalla propia para cargarlo: sus datos son un espejo en vivo
   de los del comprador, así que acá se pisan con los de CK.comprador en cada
   sync en vez de conservar lo que hubiera antes. */
function ckSincronizarAsistentes(){
  const unidades = unidadesSeleccionadas();
  const previos = CK.asistentes || [];
  const combinado = ckModoCombinado() && unidades.length === 1;
  CK.asistentes = unidades.map((tipo, i)=>({
    tipo_ticket_id: tipo.id,
    tipo: tipo.nombre,
    accesos: Number(tipo.accesos) || 1,
    precio: Number(tipo.precio) || 0,
    servicio: servicioDe(tipo.precio),
    nombre:    combinado ? CK.comprador.nombre    : (previos[i] ? previos[i].nombre    : ""),
    apellido:  combinado ? CK.comprador.apellido  : (previos[i] ? previos[i].apellido  : ""),
    documento: combinado ? CK.comprador.documento : (previos[i] ? previos[i].documento : "")
  }));
}

function abrirCheckout(id){
  cur = EVENTS.find(e=>e.id===id);
  if(!cur || !totalesSeleccion().entradas) return;
  CK = ckNuevo();
  ckSincronizarAsistentes();
  document.getElementById("m-title").textContent = cur.nombre;
  document.getElementById("m-date").textContent = [cur.fecha_texto, cur.lugar].filter(Boolean).join(" · ");
  document.getElementById("modal-buy").style.display = "block";
  document.getElementById("modal-done").style.display = "none";
  document.getElementById("overlay").classList.add("open");
  renderCheckout();
  ckPrecargarUltimaCompra();
}

/* Mobile + con sesión: además de nombre/apellido/email (ya vienen del
   propio USER, ver ckNuevo), completa DNI y teléfono con lo que haya en su
   última compra aprobada — la cuenta no guarda esos datos, sólo quedan en
   compras.comprador_*. Es un "nice to have" en segundo plano: si falla o
   tarda, el comprador completa esos campos a mano como siempre. Sólo pisa
   inputs que siguen vacíos, para no llevarse por delante algo que el
   usuario ya haya tipeado mientras esto viajaba por la red. */
async function ckPrecargarUltimaCompra(){
  if(!CK || DEMO || !USER || !matchMedia(CK_MOBILE_MQ).matches) return;
  try{
    const r = await fetch(`${SUPABASE_URL}/rest/v1/compras?email=eq.${encodeURIComponent(USER.email)}&estado=eq.aprobado&order=creado_en.desc&limit=1&select=comprador_documento,comprador_telefono`, {
      headers:{ "apikey":SUPABASE_KEY, "Authorization":"Bearer "+USER.token }
    });
    if(!r.ok || !CK) return;
    const filas = await r.json();
    const ultima = Array.isArray(filas) ? filas[0] : null;
    if(!ultima) return;
    if(!CK.comprador.documento && ultima.comprador_documento) CK.comprador.documento = ultima.comprador_documento;
    if(!CK.comprador.telefono && ultima.comprador_telefono) CK.comprador.telefono = ultima.comprador_telefono;
    const setVal = (id, val) => { const el = document.getElementById(id); if(el && !el.value && val) el.value = val; };
    setVal("ck-documento", CK.comprador.documento);
    setVal("ck-telefono", CK.comprador.telefono);
    ckSincronizarAsistentes();
    ckRefrescarValidacion();
  }catch(e){ /* silencioso: sin esto, el comprador completa los campos a mano */ }
}

/* ---------- Navegación entre pasos ---------- */
function ckIr(paso){
  if(!CK) return;
  // Hacia adelante se valida el paso actual; hacia atrás nunca se bloquea.
  if(paso > CK.paso && !ckPasoValido(CK.paso)) return;
  CK.error = "";
  CK.paso = Math.min(ckPasosActivos().length, Math.max(1, paso));
  renderCheckout();
  const modal = document.getElementById("modal-buy");
  if(modal) modal.scrollTop = 0;
}

function ckPasoValido(paso){
  ckSincronizarAsistentes();
  const clave = ckPasoClave(paso);
  if(clave === "orden") return totalesSeleccion().entradas > 0;
  if(clave === "comprador") return !!CK.camino && ckCompradorValido() === "";
  if(clave === "tickets") return ckTicketsValido() === "";
  if(clave === "datos") return ckCompradorValido() === "" && ckTicketsValido() === "";
  return true;
}

/* Devuelven "" si está todo bien, o el texto del error a mostrar. */
function ckCompradorValido(){
  const c = CK.comprador;
  if(!c.nombre.trim() || !c.apellido.trim()) return "Completá nombre y apellido.";
  if(!c.documento.trim()) return "Completá tu número de documento.";
  if(c.tipo_doc === "DNI" && !/^\d+$/.test(c.documento.trim())) return "El DNI tiene que ser sólo números.";
  if(!emailValido(c.email)) return "Escribí un email válido.";
  if(c.email.trim().toLowerCase() !== c.email2.trim().toLowerCase()) return "Los dos emails no coinciden.";
  if(!c.telefono.trim()) return "Completá tu teléfono.";
  return "";
}
function ckTicketsValido(){
  if(!CK.asistentes.length) return "No hay entradas seleccionadas.";
  for(let i = 0; i < CK.asistentes.length; i++){
    const a = CK.asistentes[i];
    if(!a.nombre.trim() || !a.apellido.trim()) return `Completá nombre y apellido de la entrada ${i+1}.`;
    if(!a.documento.trim()) return `Completá el DNI de la entrada ${i+1}.`;
    if(!/^\d+$/.test(a.documento.trim())) return `El DNI de la entrada ${i+1} tiene que ser sólo números.`;
  }
  return "";
}
const emailValido = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e||"").trim());

/* ---------- Escritura en el estado (sin re-render, ver nota de arriba) ---------- */
function ckCampo(campo, valor){
  if(!CK) return;
  CK.comprador[campo] = valor;
  ckRefrescarValidacion();
}
function ckAsistente(i, campo, valor){
  if(!CK || !CK.asistentes[i]) return;
  CK.asistentes[i][campo] = valor;
  ckRefrescarValidacion();
}
/* Actualiza sólo el cartel de error y el botón, para no perder el foco */
function ckRefrescarValidacion(){
  if(!CK) return;
  // Mantiene CK.asistentes al día con lo que se va tipeando en "Tus datos"
  // (paso combinado, ver ckSincronizarAsistentes) antes de validar nada.
  ckSincronizarAsistentes();
  const clave = ckPasoClave();
  const msg = clave === "comprador" ? ckCompradorValido()
    : clave === "tickets" ? ckTicketsValido()
    : clave === "datos" ? (ckCompradorValido() || ckTicketsValido())
    : "";
  const err = document.getElementById("ck-error");
  // El error se muestra recién cuando el campo tiene algo escrito: que salte
  // en rojo apenas abrís el formulario vacío es peor que no decir nada.
  const empezoACargar = (clave === "comprador" || clave === "datos")
    ? Object.values(CK.comprador).some(v => (v||"").trim() && v !== "DNI" && v !== "+54")
    : CK.asistentes.some(a => a.nombre || a.apellido || a.documento);
  if(err){
    err.textContent = (msg && empezoACargar) ? msg : "";
    err.style.display = (msg && empezoACargar) ? "block" : "none";
  }
  const btn = document.getElementById("ck-siguiente");
  if(btn) btn.disabled = msg !== "";
}

/* ---------- Cupones ----------
   Todavía no hay sistema de descuentos: la tabla `cupones` existe y está
   vacía a propósito (ver sql/checkout.sql), así que esto siempre responde
   "código inválido". Cuando se carguen cupones, esto ya funciona. */
function ckToggleCupon(){
  CK.cuponAbierto = !CK.cuponAbierto;
  renderCheckout();
}
async function ckAplicarCupon(){
  const codigo = (CK.cuponTexto || "").trim().toUpperCase();
  const msg = document.getElementById("ck-cupon-msg");
  if(!codigo){
    CK.cuponMsg = "Escribí un código."; CK.cuponOk = false;
    if(msg){ msg.textContent = CK.cuponMsg; msg.className = "ck-error"; }
    return;
  }
  if(msg){ msg.textContent = "Validando..."; msg.className = "ck-error"; }
  let filas = [];
  try{
    filas = DEMO ? [] : await dbGet("cupones", `codigo=eq.${encodeURIComponent(codigo)}&select=*`);
  }catch(e){ filas = []; }
  CK.cuponOk = Array.isArray(filas) && filas.length > 0;
  CK.cuponMsg = CK.cuponOk ? "Cupón aplicado." : "Ese código no es válido.";
  if(msg){
    msg.textContent = CK.cuponMsg;
    msg.className = CK.cuponOk ? "ok" : "ck-error";
    msg.style.display = "block";
  }
}

/* ---------- Render ---------- */
function renderCheckout(){
  if(!CK) return;
  ckSincronizarAsistentes();
  renderCkStepper();
  const cuerpo = document.getElementById("ck-cuerpo");
  if(!cuerpo) return;
  const clave = ckPasoClave();
  cuerpo.innerHTML =
    clave === "orden"     ? ckPaso1() :
    clave === "comprador" ? ckPaso2() :
    clave === "tickets"   ? ckPaso3() :
    clave === "datos"     ? ckPasoDatos() : ckPaso4();
  // Fade + slide sutil en cada cambio de paso (ver "ANIMACIONES SUAVES" del
  // pedido). Sacar y volver a poner la clase fuerza un reflow entre medio:
  // sin eso, la animación de la clase CSS sólo correría la primera vez que
  // #ck-cuerpo se crea, no en cada innerHTML nuevo.
  cuerpo.classList.remove("ck-paso-anim");
  void cuerpo.offsetWidth;
  cuerpo.classList.add("ck-paso-anim");
  ckRefrescarValidacion();
}

function renderCkStepper(){
  const ol = document.getElementById("ck-stepper");
  if(!ol) return;
  ol.innerHTML = ckPasosActivos().map((p, i)=>{
    const n = i + 1;
    const clase = n === CK.paso ? "activo" : n < CK.paso ? "hecho" : "";
    const dentro = n < CK.paso ? "✓" : n;
    return `<li class="ck-step ${clase}">
      <span class="ck-circulo">${dentro}</span>
      <span class="ck-label">${esc(p.titulo)}</span>
    </li>`;
  }).join("");
}

/* PASO 1 — Revisá tu orden */
function ckPaso1(){
  const items = itemsSeleccionados();
  const s = totalesSeleccion();
  const tacho = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/><path d="M10 11v5M14 11v5"/></svg>`;
  const mas = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>`;
  const etiqueta = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12V5.5A2.5 2.5 0 0 1 5.5 3H12l9 9-8.5 8.5z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>`;
  const chevron = `<svg class="ck-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;

  return `
    ${items.map(({tipo, cantidad})=>`
      <div class="ck-item">
        <div class="ck-item-info">
          <p class="ck-item-nombre">${esc(tipo.nombre)}</p>
          <p class="ck-item-precio">${fmt(tipo.precio)} - Ticket</p>
        </div>
        <div class="ck-item-qty">
          <button class="ck-icon-btn" onclick="ckQuitar(${tipo.id})" aria-label="Quitar una entrada de ${esc(tipo.nombre)}">${tacho}</button>
          <b>${cantidad}</b>
          <button class="ck-icon-btn" onclick="ckSumar(${tipo.id})" aria-label="Sumar una entrada de ${esc(tipo.nombre)}">${mas}</button>
        </div>
      </div>`).join("")}

    <button class="ck-cupon-fila" onclick="ckToggleCupon()" aria-expanded="${CK.cuponAbierto}">
      ${etiqueta}<span>¿Tenés un código de descuento?</span>${chevron}
    </button>
    ${CK.cuponAbierto ? `
      <div class="ck-cupon-caja">
        <input id="ck-cupon" placeholder="CÓDIGO" value="${esc(CK.cuponTexto)}"
               oninput="CK.cuponTexto=this.value"
               onkeydown="if(event.key==='Enter'){event.preventDefault();ckAplicarCupon()}">
        <button class="btn ghost" onclick="ckAplicarCupon()">Aplicar</button>
      </div>
      <p id="ck-cupon-msg" class="${CK.cuponOk ? "ok" : "ck-error"}" style="display:${CK.cuponMsg ? "block" : "none"};margin:-8px 0 16px">${esc(CK.cuponMsg)}</p>
    ` : ""}

    <div class="ck-resumen">
      <div class="ck-linea"><span>Subtotal</span><b>${fmt(s.subtotal)}</b></div>
      <div class="ck-linea"><span>Cargo por servicio (${+(SERVICIO_PCT*100).toFixed(2)}%)</span><b>${fmt(s.servicio)}</b></div>
      <div class="ck-linea ck-total"><span>Total</span><b>${fmt(s.total)}</b></div>
    </div>

    <div class="ck-pie ck-pie-solo">
      <button class="btn" id="ck-siguiente" onclick="ckIr(${CK.paso + 1})">Siguiente</button>
    </div>`;
}
function ckSumar(tipoId){
  const t = (TIPOS[cur.id] || []).find(x=>x.id===tipoId);
  if(!t) return;
  const tope = Math.min(MAX_POR_TIPO, restantesTipo(t));
  SELECCION[tipoId] = Math.min(tope, (Number(SELECCION[tipoId]) || 0) + 1);
  actualizarResumenDetalle();
  renderCheckout();
}
/* El tacho baja de a uno; al llegar a 0 el ítem desaparece de la lista.
   Si se queda sin entradas, no tiene sentido seguir en el checkout. */
function ckQuitar(tipoId){
  SELECCION[tipoId] = Math.max(0, (Number(SELECCION[tipoId]) || 0) - 1);
  if(!SELECCION[tipoId]) delete SELECCION[tipoId];
  actualizarResumenDetalle();
  if(!totalesSeleccion().entradas){ closeModal(); return; }
  renderCheckout();
}

/* PASO 2 — Comprador */
function ckPaso2(){
  // Sin sesión y sin camino elegido: primero las dos puertas de entrada.
  if(!CK.camino){
    return `
      <div class="ck-caminos">
        <button class="ck-camino" onclick="ckCamino('invitado')">
          <b>Continuar como invitado</b>
          <span>Te mandamos las entradas por mail. No hace falta crear una cuenta.</span>
        </button>
        <button class="ck-camino" onclick="ckCamino('sesion')">
          <b>Iniciar sesión</b>
          <span>Con tu cuenta vas a poder ver tus entradas cuando quieras desde Mis Entradas.</span>
        </button>
      </div>
      <div class="ck-pie">
        <button class="btn ghost" onclick="ckIr(${CK.paso - 1})">Volver</button>
      </div>`;
  }

  return `
    ${CK.camino === "invitado" ? `<p style="color:var(--text-dim);font-size:0.8125rem;margin-bottom:16px">Comprás como invitado. Te mandamos las entradas a este mail.</p>` : ""}
    ${ckCamposComprador()}
    <p class="ck-error" id="ck-error" style="display:none"></p>
    <div class="ck-pie">
      <button class="btn ghost" onclick="ckIr(${CK.paso - 1})">Volver</button>
      <button class="btn" id="ck-siguiente" onclick="ckIr(${CK.paso + 1})">Siguiente</button>
    </div>`;
}
function ckCamino(cual){
  // "Iniciar sesión" sin sesión activa manda a /cuenta y vuelve al evento
  if(cual === "sesion" && !USER && !DEMO){
    try{ localStorage.setItem("tp_volver", "/?evento=" + cur.id); }catch(e){}
    go("cuenta");
    return;
  }
  CK.camino = cual;
  renderCheckout();
}
/* El formulario de datos del comprador — lo comparten el paso 2 de siempre
   (ckPaso2) y el paso combinado de mobile logueado (ckPasoDatos). */
function ckCamposComprador(){
  const c = CK.comprador;
  const campo = (id, label, tipo, valor, extra="") => `
    <div class="ck-campo">
      <label for="ck-${id}">${label}</label>
      <input id="ck-${id}" type="${tipo}" value="${esc(valor)}" ${extra}
             oninput="ckCampo('${id}', this.value)">
    </div>`;

  return `
    <div class="ck-campos">
      ${campo("nombre", "Nombre", "text", c.nombre, 'autocomplete="given-name"')}
      ${campo("apellido", "Apellido", "text", c.apellido, 'autocomplete="family-name"')}
      <div class="ck-campo">
        <label for="ck-tipo_doc">Tipo de documento</label>
        <select id="ck-tipo_doc" onchange="ckCampo('tipo_doc', this.value)">
          ${CK_TIPOS_DOC.map(t=>`<option value="${t}" ${c.tipo_doc===t?"selected":""}>${t}</option>`).join("")}
        </select>
      </div>
      ${campo("documento", "Nro de documento", "text", c.documento, 'inputmode="numeric"')}
      ${campo("email", "Email", "email", c.email, 'autocomplete="email"')}
      ${campo("email2", "Confirmar email", "email", c.email2, 'onpaste="return false"')}
      <div class="ck-campo">
        <label for="ck-telefono">Teléfono</label>
        <div class="ck-tel">
          <select id="ck-pais" onchange="ckCampo('pais', this.value)" aria-label="Código de país">
            ${CK_PAISES.map(p=>`<option value="${p.cod}" ${c.pais===p.cod?"selected":""}>${p.bandera} ${p.cod}</option>`).join("")}
          </select>
          <input id="ck-telefono" type="tel" inputmode="tel" value="${esc(c.telefono)}"
                 oninput="ckCampo('telefono', this.value)" autocomplete="tel">
        </div>
      </div>
    </div>`;
}
/* PASO COMBINADO — sólo mobile + con sesión + 1 sola entrada (ver
   ckModoCombinado). Fusiona Comprador+Tickets: con un único asistente sus
   datos son los del comprador (el espejo lo hace ckSincronizarAsistentes),
   así que alcanza con este único formulario ya precargado — el comprador
   sólo confirma que está bien y sigue. */
function ckPasoDatos(){
  return `
    <p style="color:var(--text-dim);font-size:0.8125rem;margin-bottom:16px">Comprás con tu cuenta. Revisá que tus datos estén bien.</p>
    ${ckCamposComprador()}
    <p class="ck-error" id="ck-error" style="display:none"></p>
    <div class="ck-pie">
      <button class="btn ghost" onclick="ckIr(${CK.paso - 1})">Volver</button>
      <button class="btn" id="ck-siguiente" onclick="ckIr(${CK.paso + 1})">Siguiente</button>
    </div>`;
}

/* PASO 3 — Tickets */
function ckPaso3(){
  return `
    ${CK.asistentes.map((a, i)=>{
      // "GENERAL 1 - Entrada 2 de 3" cuenta dentro del mismo tipo, no sobre
      // el total: si comprás 2 de un tipo y 1 de otro, cada bloque se numera
      // contra los suyos, que es lo que el comprador espera leer.
      const delTipo = CK.asistentes.filter(x=>x.tipo_ticket_id === a.tipo_ticket_id);
      const nro = delTipo.indexOf(a) + 1;
      return `
      <div class="ck-ticket">
        <h4 class="ck-ticket-titulo">${esc(a.tipo)} - Entrada ${nro} de ${delTipo.length}</h4>
        ${i === 0 ? `
          <label class="ck-check">
            <input type="checkbox" ${CK.usarMisDatos ? "checked" : ""} onchange="ckUsarMisDatos(this.checked)">
            <span>Usar mis datos</span>
          </label>` : ""}
        <div class="ck-campos">
          <div class="ck-campo">
            <label for="ck-a${i}-nombre">Nombre</label>
            <input id="ck-a${i}-nombre" value="${esc(a.nombre)}" oninput="ckAsistente(${i},'nombre',this.value)">
          </div>
          <div class="ck-campo">
            <label for="ck-a${i}-apellido">Apellido</label>
            <input id="ck-a${i}-apellido" value="${esc(a.apellido)}" oninput="ckAsistente(${i},'apellido',this.value)">
          </div>
          <div class="ck-campo">
            <label for="ck-a${i}-doc">DNI</label>
            <input id="ck-a${i}-doc" inputmode="numeric" value="${esc(a.documento)}" oninput="ckAsistente(${i},'documento',this.value)">
          </div>
        </div>
      </div>`;
    }).join("")}
    <p class="ck-error" id="ck-error" style="display:none"></p>
    <div class="ck-pie">
      <button class="btn ghost" onclick="ckIr(${CK.paso - 1})">Volver</button>
      <button class="btn" id="ck-siguiente" onclick="ckIr(${CK.paso + 1})">Siguiente</button>
    </div>`;
}
function ckUsarMisDatos(tildado){
  CK.usarMisDatos = tildado;
  if(tildado && CK.asistentes[0]){
    CK.asistentes[0].nombre    = CK.comprador.nombre;
    CK.asistentes[0].apellido  = CK.comprador.apellido;
    CK.asistentes[0].documento = CK.comprador.documento;
  }
  renderCheckout();
}

/* PASO 4 — Confirmación (compacta: sólo lo que no se vio ya en los pasos
   1-3 — el detalle del evento y los datos del comprador no se repiten acá). */
function ckPaso4(){
  const s = totalesSeleccion();
  return `
    <div class="ck-items-compacto">
      ${itemsSeleccionados().map(({tipo, cantidad})=>`
        <div class="ck-item-simple">
          <span class="ck-item-simple-nombre" title="${esc(tipo.nombre)}">${cantidad > 1 ? cantidad + "× " : ""}${esc(tipo.nombre)}</span>
          <b>${fmt((Number(tipo.precio)||0)*cantidad)}</b>
        </div>`).join("")}
    </div>

    <div class="ck-resumen">
      <div class="ck-linea"><span>Costo de tus items</span><b>${fmt(s.subtotal)}</b></div>
      <div class="ck-linea"><span>Cargo por servicio (${+(SERVICIO_PCT*100).toFixed(2)}%)</span><b>${fmt(s.servicio)}</b></div>
      <div class="ck-linea ck-total"><span>Total</span><b>${fmt(s.total)}</b></div>
    </div>

    <label class="ck-check ck-terminos">
      <input type="checkbox" ${CK.terminosAceptados ? "checked" : ""} onchange="ckToggleTerminos(this.checked)">
      <span>Acepto los <a href="/terminos" target="_blank" rel="noopener">Términos y Condiciones</a>, la <a href="/privacidad" target="_blank" rel="noopener">Política de Privacidad</a> y la <a href="/devoluciones" target="_blank" rel="noopener">Política de Devoluciones</a></span>
    </label>

    <p class="ck-error" id="ck-error" style="display:none"></p>
    <div class="ck-pie ck-pie-confirmar">
      <button class="btn ghost" onclick="ckIr(${CK.paso - 1})">Volver</button>
      <button class="btn ancho" id="ck-pagar" onclick="ckPagar()" ${CK.terminosAceptados ? "" : "disabled"}>Confirmar y Pagar</button>
    </div>`;
}
function ckToggleTerminos(tildado){
  CK.terminosAceptados = tildado;
  const btn = document.getElementById("ck-pagar");
  if(btn) btn.disabled = !tildado;
}

/* ---------- Pago ----------
   El total que se manda ya incluye el cargo por servicio. La compra de un
   invitado va sin user_id: no se le crea cuenta a nadie, el QR le llega por
   mail igual (lo manda el backend, ver nota del contrato abajo). */
async function ckPagar(){
  const err = document.getElementById("ck-error");
  const btn = document.getElementById("ck-pagar");
  const mostrarError = txt => { if(err){ err.textContent = txt; err.style.display = "block"; } };

  const problema = ckCompradorValido() || ckTicketsValido();
  if(problema){ mostrarError(problema); return; }
  if(!CK.terminosAceptados){ mostrarError("Aceptá los Términos y Condiciones para continuar."); return; }

  const c = CK.comprador;
  const s = totalesSeleccion();
  const asistentes = CK.asistentes.map(a=>({
    nombre: a.nombre.trim(), apellido: a.apellido.trim(), documento: a.documento.trim(),
    tipo_ticket_id: a.tipo_ticket_id, tipo: a.tipo, accesos: a.accesos,
    precio: a.precio, servicio: a.servicio
  }));
  const comprador = {
    nombre: c.nombre.trim(), apellido: c.apellido.trim(),
    tipo_doc: c.tipo_doc, documento: c.documento.trim(),
    email: c.email.trim(), telefono: (c.pais + " " + c.telefono.trim()).trim(),
    user_id: USER ? (USER.id || null) : null
  };

  btn.disabled = true; btn.textContent = "Redirigiendo al pago...";

  // MODO DEMO: sin Supabase, simula la compra sin pago real
  if(DEMO){
    const grupo = "BX-" + Math.random().toString(36).slice(2,8).toUpperCase();
    const entradas = asistentes.map((a,i)=>({
      nombre:a.nombre, apellido:a.apellido, documento:a.documento, email:comprador.email,
      evento:cur.nombre, evento_id:cur.id, fecha_texto:cur.fecha_texto, lugar:cur.lugar,
      tipo:a.tipo, tipo_ticket_id:a.tipo_ticket_id, accesos:a.accesos,
      grupo, total:a.precio + a.servicio, codigo:grupo+"-"+(i+1), estado:"aprobado"
    }));
    entradas.forEach(e=>{DEMO_PURCHASES.push(e); MY_TICKETS.push(e);});
    updBadge();
    document.getElementById("done-ticket").innerHTML = entradas.map(ticketHTML).join("");
    setTimeout(pintarQRs, 50);
    document.getElementById("modal-buy").style.display="none";
    document.getElementById("modal-done").style.display="block";
    btn.disabled=false; btn.textContent="Confirmar y Pagar";
    return;
  }

  /* REAL: la Edge Function crear-pago arma la preferencia de Mercado Pago y
     crea una fila en compras por asistente (con service_role). Contrato:
       { evento, evento_id, fecha_texto, lugar, email,
         comprador: {nombre, apellido, tipo_doc, documento, email, telefono, user_id},
         items: [{tipo_ticket_id, nombre, precio, servicio, cantidad}],
         asistentes: [{nombre, apellido, documento, tipo_ticket_id, tipo, accesos, precio, servicio}],
         cupon, total }
     El precio de cada entrada es precio + servicio; `total` ya viene sumado.
     comprador.user_id es null cuando compró un invitado. */
  try{
    const r = await fetch(`${SUPABASE_URL}/functions/v1/crear-pago`, {
      method:"POST",
      headers:{ "apikey":SUPABASE_KEY, "Authorization":"Bearer "+(USER ? USER.token : SUPABASE_KEY), "Content-Type":"application/json" },
      body: JSON.stringify({
        evento: cur.nombre,
        evento_id: cur.id,
        fecha_texto: cur.fecha_texto,
        lugar: cur.lugar,
        email: comprador.email,
        comprador,
        items: itemsSeleccionados().map(({tipo, cantidad})=>({
          tipo_ticket_id: tipo.id,
          nombre: tipo.nombre,
          precio: Number(tipo.precio) || 0,
          servicio: servicioDe(tipo.precio),
          cantidad
        })),
        asistentes,
        cupon: CK.cuponOk ? (CK.cuponTexto || "").trim().toUpperCase() : null,
        total: s.total
      })
    });
    const data = await r.json();
    if(!r.ok || !data.init_point){
      mostrarError("No se pudo iniciar el pago. Probá de nuevo.");
      btn.disabled=false; btn.textContent="Confirmar y Pagar"; return;
    }
    window.location.href = data.init_point;
  }catch(e){
    mostrarError("Error de conexión con el pago. Probá de nuevo.");
    btn.disabled=false; btn.textContent="Confirmar y Pagar";
  }
}
// CK ya se reemplaza entero en abrirCheckout() (CK = ckNuevo()), así que un
// CK viejo sin resetear acá no debería filtrarse a la próxima compra — pero
// se limpia explícito igual: barato, y así ningún camino futuro que reabra
// el modal sin pasar por abrirCheckout() puede reusar sin querer los datos
// de una compra anterior (invitado o logueado).
function closeModal(){
  const o=document.getElementById("overlay");
  if(o) o.classList.remove("open");
  CK = null;
}
const _overlay = document.getElementById("overlay");
if(_overlay) _overlay.addEventListener("click", e=>{ if(e.target.id==="overlay") closeModal(); });
// El modal del equipo (Studio) se cierra igual: tocando afuera o con Escape
const _overlayEquipo = document.getElementById("overlay-equipo");
if(_overlayEquipo) _overlayEquipo.addEventListener("click", e=>{ if(e.target.id==="overlay-equipo") cerrarEquipoModal(); });
document.addEventListener("keydown", e=>{
  if(e.key !== "Escape") return;
  closeModal();
  if(typeof EQ !== "undefined" && EQ) cerrarEquipoModal();
});

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

/* ---------- RECUPERAR ENTRADAS POR EMAIL ----------
   Para el que compró como invitado: no tiene sesión, así que no hay forma de
   listarle las entradas en pantalla sin verificar que ese mail es suyo. Por
   eso esto NO muestra nada acá — le pide al backend que las reenvíe a esa
   casilla, y la casilla es la verificación.

   Además la respuesta es siempre la misma, exista o no ese mail en la base:
   si dijera "no encontramos entradas" cualquiera podría usar el formulario
   para averiguar quién compró. */
async function recuperarEntradas(){
  const input = document.getElementById("rec-email");
  const ok = document.getElementById("rec-ok"), err = document.getElementById("rec-err");
  const btn = document.getElementById("rec-btn");
  if(!input) return;
  ok.style.display = "none"; err.style.display = "none";

  const email = input.value.trim();
  if(!emailValido(email)){
    err.textContent = "Escribí un email válido."; err.style.display = "block"; return;
  }
  const mensajeNeutro = "Si hay entradas compradas con ese email, te las reenviamos ahí. Revisá también el correo no deseado.";

  if(DEMO){
    ok.textContent = mensajeNeutro; ok.style.display = "block"; input.value = ""; return;
  }

  btn.disabled = true; btn.textContent = "Enviando...";
  try{
    const r = await fetch(`${SUPABASE_URL}/functions/v1/reenviar-entradas`, {
      method:"POST",
      headers:{ "apikey":SUPABASE_KEY, "Authorization":"Bearer "+SUPABASE_KEY, "Content-Type":"application/json" },
      body: JSON.stringify({ email })
    });
    if(!r.ok) throw new Error("falló el reenvío");
    ok.textContent = mensajeNeutro; ok.style.display = "block";
    input.value = "";
  }catch(e){
    err.textContent = "No se pudo enviar ahora. Probá de nuevo en un rato.";
    err.style.display = "block";
  }finally{
    btn.disabled = false; btn.textContent = "Reenviar entradas";
  }
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

/* ---------- ROLES DEL STUDIO ----------
   La fuente de verdad es sql/roles-equipo.sql: colaboradores (quién es cada
   uno, por email) + colaborador_rol (qué rol tiene y sobre qué evento, con
   evento_id null = todos los eventos). Los 3 roles, de mayor a menor:

     admin      todo el Studio, incluida esta pantalla de Equipo.
     encargado  ve y edita eventos, ve compradores y analytics, manda
                cortesías. No gestiona roles ni configuración sensible
                (Mercado Pago, Resend…).
     escaner    sólo la pantalla de escaneo de QR, nada más del Studio.

   ⚠️ El rol "admin" se MUESTRA como "Organizador" en toda la interfaz, pero
   la clave guardada sigue siendo 'admin'. Es a propósito: renombrar el valor
   obligaría a migrar colaborador_rol, su check constraint y es_admin() sin
   ganar nada. El único lugar donde vive el nombre visible es ROLES[x].titulo
   — si alguna vez hay que volver a cambiarlo, se cambia acá y listo.

   Esto es gating de interfaz: lo que de verdad frena a alguien son las
   policies de Supabase (es_admin/es_encargado/es_escaner), porque con un
   token válido cualquiera puede llamar a la API REST sin pasar por acá. */
const ROLES = {
  admin:     { titulo:"Organizador", desc:"Acceso total al Studio, incluida la gestión del equipo." },
  encargado: { titulo:"Encargado",   desc:"Ve y edita eventos, ve compradores y analytics, y manda cortesías. No gestiona roles ni configuración." },
  escaner:   { titulo:"Escáner",     desc:"Sólo la pantalla de escaneo de QR en la puerta." }
};
// El nombre visible de un rol, siempre desde ROLES (nunca hardcodeado)
function tituloRol(rol){ return ROLES[rol] ? ROLES[rol].titulo : "Sin rol"; }
const ROL_ORDEN = ["admin", "encargado", "escaner"];  // de mayor a menor alcance
function iconoRol(rol){
  if(rol === "admin")     return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7.5 3.2v5c0 4.4-3 8.3-7.5 9.6-4.5-1.3-7.5-5.2-7.5-9.6v-5z"/><path d="M9.2 12l2 2 3.6-3.8"/></svg>`;
  if(rol === "encargado") return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M9.5 15l1.8 1.8 3.4-3.6"/></svg>`;
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M4 12h16"/></svg>`;
}

// Datos del colaborador logueado (null si entró con ADMIN_EMAIL, que es
// admin por hardcodeo, o si no es del equipo).
let MI_COLAB = null;
let MIS_ROLES = [];   // [{rol, evento_id}] del que entró

/* Devuelve el rol más alto que tenga esta cuenta, o null si no es del
   equipo. ADMIN_EMAIL es admin siempre — es el bootstrap para que el dueño
   no se quede afuera de su propio panel (mismo criterio que es_admin() en
   sql/roles-equipo.sql: cambiar los dos juntos). */
async function determinarRol(email, token){
  MI_COLAB = null; MIS_ROLES = [];
  if((email||"").toLowerCase() === ADMIN_EMAIL.toLowerCase()) return "admin";
  try{
    const r = await fetch(`${SUPABASE_URL}/rest/v1/colaboradores?email=eq.${encodeURIComponent((email||"").toLowerCase())}&select=id,nombre,email,telefono,foto_url,activo,colaborador_rol(rol,evento_id)`, {
      headers:{ "apikey":SUPABASE_KEY, "Authorization":"Bearer "+token }
    });
    const filas = await r.json();
    const c = Array.isArray(filas) ? filas[0] : null;
    // Desactivado = como si no estuviera: las policies piensan igual (c.activo)
    if(!c || !c.activo) return null;
    MI_COLAB = c;
    MIS_ROLES = c.colaborador_rol || [];
    return ROL_ORDEN.find(rr => MIS_ROLES.some(x => x.rol === rr)) || null;
  }catch(e){}
  return null;
}

// Muestra u oculta secciones del panel según el rol
/* Secciones del panel: cada una es una pestaña del sidebar, con la lista de
   roles que pueden verla. El escáner es una página aparte, así que no tiene
   entrada propia acá. "Eventos pasados" vivía adentro de Eventos pero se
   sacó del Studio (pendiente reemplazo por una sección de artistas que
   pasaron por Bronx, ver CLAUDE.md) — su sección de HTML (id="sec-pasados")
   y todo su JS quedaron comentados más abajo, no borrados. */
const SECCIONES_ADMIN = [
  { clave:"resumen",        titulo:"Resumen",        roles:["admin","encargado"] },
  { clave:"eventos",        titulo:"Eventos",        roles:["admin","encargado"] },
  { clave:"compradores",    titulo:"Compradores",    roles:["admin","encargado"] },
  { clave:"cortesias",      titulo:"Cortesías",      roles:["admin","encargado"] },
  { clave:"usuarios",       titulo:"Usuarios",       roles:["admin"] },
  { clave:"equipo",         titulo:"Equipo",         roles:["admin"] },
  { clave:"patrocinadores", titulo:"Patrocinadores", roles:["admin"] }
];
let SECCION_ADMIN = "resumen";

function puedeVerSeccion(clave){
  const s = SECCIONES_ADMIN.find(x => x.clave === clave);
  return !!s && s.roles.includes(ROL);
}
// Primera sección que este rol sí puede abrir (a dónde cae al entrar)
function seccionInicial(){
  const s = SECCIONES_ADMIN.find(x => x.roles.includes(ROL));
  return s ? s.clave : null;
}

function aplicarRol(){
  // Ojo: además de la sección hay que esconder su botón del sidebar, si no
  // se ven pestañas que llevan a un panel vacío.
  SECCIONES_ADMIN.forEach(s=>{
    const permitida = s.roles.includes(ROL);
    const sec = document.getElementById("sec-" + s.clave);
    if(sec) sec.style.display = permitida ? "" : "none";
    const nav = document.getElementById("nav-" + s.clave);
    if(nav) nav.style.display = permitida ? "" : "none";
  });
  // Crear/editar eventos va con Eventos (el botón "Nuevo evento" vive dentro
  // de esa sección, así que se esconde con ella); borrar compras es sólo del admin.
  const btnBorrar = document.getElementById("btn-borrar-pend");
  if(btnBorrar) btnBorrar.style.display = ROL === "admin" ? "" : "none";
  if(!puedeVerSeccion(SECCION_ADMIN)) SECCION_ADMIN = seccionInicial();
}

/* Cambia de pestaña: muestra una sola sección y actualiza el breadcrumb.
   No recarga nada — los datos ya los cargó abrirPanel(). */
function mostrarSeccionAdmin(clave){
  const sec = SECCIONES_ADMIN.find(s => s.clave === clave);
  if(!sec) return;
  // Ocultar el link no alcanza: si alguien llega igual (link viejo, consola),
  // se le dice por qué no puede y se lo deja en una sección suya.
  if(!sec.roles.includes(ROL)){ avisarSinPermiso(sec.titulo); return; }
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
  // Entrar a "Eventos" desde el menú siempre cae en la lista, no en el
  // detalle que quedó abierto la vez anterior. (nuevoEvento/abrirEventoStudio
  // llaman a esto y después abren el detalle, así que no se pisan.)
  if(clave === "eventos"){ EV_DETALLE = null; mostrarVistaEventos("lista"); }
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

/* "Nuevo evento" (al final de la lista): abre el detalle en modo alta, con
   el formulario en blanco. Un evento que todavía no existe no tiene
   analytics, así que ahí no hay tabs: sólo el formulario. */
function nuevoEvento(){
  mostrarSeccionAdmin("eventos");
  EV_DETALLE = null;
  resetEventoForm();
  const titulo = document.getElementById("ev-detalle-nombre");
  if(titulo) titulo.textContent = "Nuevo evento";
  const acciones = document.getElementById("ev-detalle-acciones");
  if(acciones) acciones.innerHTML = "";
  const tabs = document.getElementById("ev-tabs");
  if(tabs) tabs.style.display = "none";
  mostrarVistaEventos("detalle");
  mostrarTabEvento("editar");
  const nombre = document.getElementById("ev-nombre");
  if(nombre) nombre.focus({preventScroll:true});
}
/* Sin permiso para entrar al Studio: en vez de dejarlo mirando un panel
   vacío (o de sólo esconderle los links), se le explica y se lo manda a
   donde sí puede entrar. Lo usa el escáner al abrir /admin. */
function bloquearStudio(mensaje, destino, textoBoton){
  const login = document.getElementById("admin-login");
  const panel = document.getElementById("admin-panel");
  const caja  = document.getElementById("admin-sinacceso");
  if(login) login.style.display = "none";
  if(panel) panel.style.display = "none";
  if(!caja){ alert(mensaje); go(destino); return; }
  const msg = document.getElementById("sinacceso-msg");
  if(msg) msg.textContent = mensaje;
  const btn = document.getElementById("sinacceso-btn");
  if(btn){ btn.textContent = textoBoton; btn.onclick = ()=>go(destino); }
  caja.style.display = "block";
  // Se lo lleva solo, pero después de que alcance a leer por qué.
  setTimeout(()=>{ if(caja.style.display === "block") go(destino); }, 3500);
}
/* Sección vedada dentro del panel (el rol sí entra al Studio, pero no ahí) */
function avisarSinPermiso(titulo){
  alert(`No tenés permiso para ver "${titulo}". Tu rol es ${ROL ? tituloRol(ROL) : "sin acceso"}.`);
  const inicial = seccionInicial();
  if(inicial && inicial !== SECCION_ADMIN) mostrarSeccionAdmin(inicial);
}

// Carga todo el panel según el rol
async function abrirPanel(){
  // El escáner no entra al Studio: su lugar es la pantalla de la puerta.
  if(ROL === "escaner"){
    bloquearStudio(
      "Tu cuenta tiene permiso de escáner: podés validar entradas en la puerta, pero no entrar al Studio. Te llevamos al escáner.",
      "escaner", "Ir al escáner");
    return;
  }
  if(!ROL || !seccionInicial()){
    bloquearStudio("Tu cuenta no tiene acceso al Studio. Pedile al admin de Bronx que te asigne un rol.",
      "eventos", "Volver al sitio");
    return;
  }
  const sinacceso = document.getElementById("admin-sinacceso");
  if(sinacceso) sinacceso.style.display = "none";
  document.getElementById("admin-login").style.display="none";
  // Sin valor: el display lo pone .dash (flex), no un inline
  document.getElementById("admin-panel").style.display="";
  aplicarRol();
  mostrarSeccionAdmin(SECCION_ADMIN);   // aplicarRol ya lo corrigió según el rol
  // Esperamos las compras: renderEventAdmin necesita los conteos por tipo
  await loadPurchases();
  if(puedeVerSeccion("eventos")){
    await cargarTipos(true);   // el panel también edita los tipos pausados
    renderTiposForm();
    renderEventAdmin();
  }
  // Los selects de cortesías salen de EVENTS + TIPOS, así que van después
  if(puedeVerSeccion("cortesias")){
    if(!puedeVerSeccion("eventos")) await cargarTipos(true);
    cargarSelectsCortesia();
  }
  // El equipo primero: la tabla de usuarios muestra el rol de cada uno
  if(puedeVerSeccion("equipo")) await loadEquipo();
  if(puedeVerSeccion("usuarios")) loadUsuarios();
  if(puedeVerSeccion("patrocinadores")) loadPatrocinadoresAdmin();
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
  MI_COLAB=null; MIS_ROLES=[]; COLABORADORES=[]; EQ=null;
  USER=null; CK=null; borrarSesionUser(); updateNavUser();
  document.getElementById("email").value="";
  document.getElementById("pass").value="";
  document.getElementById("admin-login").style.display="block";
  document.getElementById("admin-panel").style.display="none";
  const sinacceso = document.getElementById("admin-sinacceso");
  if(sinacceso) sinacceso.style.display="none";
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
// Vendidas totales de un evento y, si TODOS sus tipos tienen cupo, el total
// de ese cupo — para la barra de progreso de la tarjeta. Si algún tipo no
// tiene límite (cantidad null), la suma "sobre qué" deja de tener sentido:
// se muestra sólo el número vendido, sin barra ni "/Y".
function progresoEvento(ev){
  const tipos = tiposDeEvento(ev.id);
  const vendidas = tipos.reduce((a,t) => a + vendidasTipo(t), 0);
  const todosConCupo = tipos.length > 0 && tipos.every(t => t.cantidad != null);
  const cupo = todosConCupo ? tipos.reduce((a,t) => a + Number(t.cantidad), 0) : null;
  const pct = cupo ? Math.min(100, Math.round(vendidas / cupo * 100)) : null;
  return { tipos, vendidas, cupo, pct };
}
/* ---------- EVENTOS DEL STUDIO: LISTA ⇄ DETALLE ----------
   "Eventos" tiene dos vistas: la lista de tarjetas simples (nombre, fecha,
   estado) y el detalle de un evento con dos tabs, Analytics y Editar. El
   formulario de siempre vive adentro del tab Editar; no se duplicó nada.
   EV_DETALLE es el id del evento abierto (null = lista, o alta nueva). */
let EV_DETALLE = null;
let EV_TAB = "analytics";

// Estado que se muestra en la tarjeta de la lista
function estadoEvento(ev){
  if(ev.activo === false) return { txt:"Borrador", clase:"borrador" };
  if(eventoAgotado(ev))   return { txt:"Agotado",  clase:"agotado" };
  if(sinVenta(ev))        return { txt:"Sin entradas cargadas", clase:"sinventa" };
  return { txt:"En venta", clase:"venta" };
}

function renderEventAdmin(){
  const list = document.getElementById("ev-admin-list");
  if(!list) return;
  const aviso = (!DEMO && !VENTAS_VISTA_OK)
    ? `<p class="err" style="display:block;margin-bottom:14px">Falta crear la vista <b>ventas_por_tipo</b> en Supabase (sql/03-vistas.sql). Los números de acá abajo son correctos, pero en la página pública los cupos no se van a cerrar solos hasta que la crees.</p>`
    : "";
  if(EVENTS.length===0){
    list.innerHTML = aviso + `<p style="color:var(--text-dim);font-size:14px">Todavía no hay eventos. Creá el primero con el botón de abajo.</p>`;
    return;
  }
  list.innerHTML = aviso + EVENTS.map(ev=>{
    const est = estadoEvento(ev);
    const { vendidas } = progresoEvento(ev);
    return `
    <button class="ev-item" onclick="abrirEventoStudio(${ev.id})">
      <span class="ev-item-portada" ${ev.foto_url ? `style="background-image:url('${esc(ev.foto_url)}')"` : ""}></span>
      <span class="ev-item-info">
        <b class="ev-item-nombre">${esc(ev.nombre)}</b>
        <span class="ev-item-fecha">${esc(ev.fecha_texto || "Sin fecha cargada")}</span>
        <span class="ev-item-meta">${vendidas} vendida${vendidas===1?"":"s"}</span>
      </span>
      <span class="ev-item-estado ${est.clase}">${est.txt}</span>
    </button>`;}).join("");
}

/* Abre el detalle de un evento: carga el formulario (tab Editar) y dibuja
   los analytics, que arrancan en el tab visible por defecto. */
function abrirEventoStudio(id){
  const ev = EVENTS.find(e => e.id === id);
  if(!ev) return;
  EV_DETALLE = id;
  editEvento(id);                 // deja el formulario del tab Editar cargado
  const titulo = document.getElementById("ev-detalle-nombre");
  if(titulo) titulo.textContent = ev.nombre || "Evento";
  // Ver / Duplicar / Borrar vivían en la tarjeta de la lista; ahora que la
  // tarjeta abre el evento, sus acciones van acá arriba.
  const acciones = document.getElementById("ev-detalle-acciones");
  if(acciones) acciones.innerHTML = `
    <button class="btn ghost btn-mini" onclick="verEventoPublico(${ev.id})">Ver página</button>
    <button class="btn ghost btn-mini" onclick="duplicarEvento(${ev.id})">Duplicar</button>
    <button class="btn ghost btn-mini" onclick="deleteEvento(${ev.id})" style="border-color:rgba(239,68,68,.4);color:#ef4444">Borrar</button>`;
  const tabs = document.getElementById("ev-tabs");
  if(tabs) tabs.style.display = "";
  mostrarVistaEventos("detalle");
  mostrarTabEvento("analytics");
}
function volverAListaEventos(){
  EV_DETALLE = null;
  resetEventoForm();
  renderEventAdmin();
  mostrarVistaEventos("lista");
}
function mostrarVistaEventos(cual){
  const lista = document.getElementById("ev-vista-lista");
  const detalle = document.getElementById("ev-vista-detalle");
  if(lista) lista.style.display = cual === "lista" ? "" : "none";
  if(detalle) detalle.style.display = cual === "detalle" ? "" : "none";
  window.scrollTo({top:0});
}
function mostrarTabEvento(tab){
  EV_TAB = tab;
  const panA = document.getElementById("ev-pane-analytics");
  const panE = document.getElementById("ev-pane-editar");
  if(panA) panA.style.display = tab === "analytics" ? "" : "none";
  if(panE) panE.style.display = tab === "editar" ? "" : "none";
  const tabA = document.getElementById("ev-tab-analytics");
  const tabE = document.getElementById("ev-tab-editar");
  if(tabA) tabA.classList.toggle("activo", tab === "analytics");
  if(tabE) tabE.classList.toggle("activo", tab === "editar");
  if(tab === "analytics") renderAnalyticsEvento();
}
// Abre la página pública del evento en una pestaña nueva, tal cual la ve un comprador
function verEventoPublico(id){
  window.open("/?evento=" + id, "_blank");
}
// Precarga el formulario de "Nuevo evento" con los datos de otro evento ya
// cargado (tipos de entrada incluidos) para no repetir todo a mano. No
// escribe nada en la base hasta que el admin apriete "Guardar evento": es
// el mismo editEvento() de siempre, sólo que sin el id del evento ni los
// ids de sus tipos, así saveEvento() los inserta como filas nuevas en vez
// de pisar el original.
function duplicarEvento(id){
  const ev = EVENTS.find(e => e.id === id);
  if(!ev) return;
  editEvento(id);
  document.getElementById("ev-id").value = "";
  document.getElementById("ev-nombre").value = (ev.nombre || "") + " (copia)";
  TIPOS_FORM.forEach(t => t.id = null);
  document.getElementById("form-title").textContent = "Duplicando evento — revisá y guardá";
  document.getElementById("ev-save-btn").textContent = "Guardar evento";
  // La copia todavía no existe: no tiene analytics propios, así que queda
  // igual que un alta nueva (sólo formulario, sin tabs).
  EV_DETALLE = null;
  const titulo = document.getElementById("ev-detalle-nombre");
  if(titulo) titulo.textContent = "Duplicar evento";
  const acciones = document.getElementById("ev-detalle-acciones");
  if(acciones) acciones.innerHTML = "";
  const tabs = document.getElementById("ev-tabs");
  if(tabs) tabs.style.display = "none";
  mostrarVistaEventos("detalle");
  mostrarTabEvento("editar");
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
/* Selector de color del formulario: guarda la clave en el input oculto
   ev-color y marca el círculo elegido. El color no se aplica al panel — el
   Studio sigue en naranja; recién se ve en la página del evento. */
function elegirColorEvento(clave){
  const color = COLORES_EVENTO.includes(clave) ? clave : COLOR_EVENTO_DEFECTO;
  const campo = document.getElementById("ev-color");
  if(campo) campo.value = color;
  document.querySelectorAll(".color-swatch").forEach(b=>{
    b.classList.toggle("elegido", b.dataset.colorEvento === color);
  });
}
function resetEventoForm(){
  ["ev-id","ev-nombre","ev-fecha","ev-puertas","ev-lugar","ev-desc","ev-direccion","ev-foto-url"].forEach(id=>document.getElementById(id).value="");
  elegirColorEvento(COLOR_EVENTO_DEFECTO);
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
  elegirColorEvento(colorEvento(ev));
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
      color_acento: document.getElementById("ev-color").value || COLOR_EVENTO_DEFECTO,
      arte: "red"
    };
    const id = document.getElementById("ev-id").value;
    const nombreViejo = id ? (EVENTS.find(e=>e.id==id)||{}).nombre : null;
    let eventoId = id;
    if(DEMO){
      if(id){ Object.assign(EVENTS.find(e=>e.id==id), data); }
      else { data.id = Date.now(); data.activo=true; EVENTS.push(data); eventoId = data.id; }
      sincronizarTiposDemo(eventoId);
    } else {
      // Los tipos necesitan el id del evento, así que el evento se guarda primero
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
    renderEventAdmin(); loadEvents();
    // Se queda en el detalle del evento guardado (recargado con lo que quedó
    // en la base), no en un formulario en blanco: si acabás de crearlo, lo
    // normal es querer ver sus analytics o seguir tocándolo.
    const guardado = EVENTS.find(e => String(e.id) === String(eventoId));
    if(guardado) abrirEventoStudio(guardado.id);
    ok.textContent = id ? "Evento actualizado." : "Evento creado."; ok.style.display="block";
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
    // El evento que estabas mirando ya no existe: vuelta a la lista
    volverAListaEventos();
  }catch(e){ alert("No se pudo borrar: " + e.message); }
}

/* ================== ANALYTICS DE UN EVENTO ==================
   Todo sale de datos que ya existen: PURCHASES (compras aprobadas de ese
   evento) y evento_vistas (sql/evento-vistas.sql). Sin ventas todavía, los
   KPIs muestran $0 / 0 — nunca datos inventados ni un error. */
let VISTAS_EVENTO = [];       // [{fecha}] del evento abierto
let VISTAS_EVENTO_ID = null;  // de qué evento son las de arriba

// Las entradas aprobadas de un evento (ventas Y cortesías). Se busca por id
// y, para las compras viejas que sólo guardaron el nombre, también por nombre.
function comprasDeEvento(ev){
  return PURCHASES.filter(c=>{
    if(!esAprobada(c)) return false;
    if(c.evento_id != null) return String(c.evento_id) === String(ev.id);
    return (c.evento || "") === (ev.nombre || "");
  });
}
/* Una cortesía es una entrada regalada desde el Studio (ver "CORTESÍAS"):
   vale en la puerta igual que cualquier otra, pero NO es una venta. Todo lo
   que diga "facturación", "vendidos" o "recaudación" la deja afuera; se
   cuenta aparte para que no parezca que desaparecieron entradas. */
const esCortesia = c => (c.origen || "venta") === "cortesia";
function ventasDeEvento(ev){ return comprasDeEvento(ev).filter(c => !esCortesia(c)); }
async function cargarVistasEvento(eventoId){
  if(DEMO){ VISTAS_EVENTO = []; VISTAS_EVENTO_ID = eventoId; return; }
  try{
    VISTAS_EVENTO = await dbGet("evento_vistas", `evento_id=eq.${eventoId}&select=fecha&order=fecha.asc`);
  }catch(e){ VISTAS_EVENTO = []; }   // sin permiso o sin tabla: 0 vistas, no un error
  VISTAS_EVENTO_ID = eventoId;
}

function renderAnalyticsEvento(){
  const ev = EVENTS.find(e => e.id === EV_DETALLE);
  if(!ev) return;
  pintarAnalyticsEvento(ev);
  // Las vistas llegan por su cuenta; cuando están, se repinta con el número
  // real en vez de dejar el KPI en 0 para siempre.
  if(VISTAS_EVENTO_ID !== ev.id){
    cargarVistasEvento(ev.id).then(()=>{
      if(EV_DETALLE === ev.id && EV_TAB === "analytics") pintarAnalyticsEvento(ev);
    });
  }
}

function pintarAnalyticsEvento(ev){
  // Los KPIs de plata miran sólo las ventas; las cortesías van aparte.
  const ventas = ventasDeEvento(ev);
  const cortesias = comprasDeEvento(ev).filter(esCortesia);
  const facturacion = ventas.reduce((a,c) => a + (Number(c.total) || 0), 0);
  const tickets = ventas.length;
  const vistas = VISTAS_EVENTO_ID === ev.id ? VISTAS_EVENTO.length : 0;
  const promedio = tickets ? Math.round(facturacion / tickets) : 0;

  const kpis = document.getElementById("ev-kpis");
  if(kpis) kpis.innerHTML = [
    { label:"Facturación total", valor:fmt(facturacion) },
    { label:"Tickets vendidos",  valor:String(tickets) },
    { label:"Vistas de la página", valor:String(vistas) },
    { label:"Ticket promedio",   valor:fmt(promedio) }
  ].map(k => `<div class="kpi"><small>${k.label}</small><b>${esc(k.valor)}</b></div>`).join("");

  // Las cortesías existen y entran por la puerta, así que se muestran —
  // sólo que no como venta.
  const nota = document.getElementById("ev-cortesias-nota");
  if(nota){
    nota.textContent = cortesias.length
      ? `+ ${cortesias.length} cortesía${cortesias.length===1?"":"s"} enviada${cortesias.length===1?"":"s"} (no cuentan en la facturación)`
      : "";
    nota.style.display = cortesias.length ? "block" : "none";
  }

  pintarTiposAnalytics(ev, ventas, cortesias);
  pintarChartEvento(ev, ventas);
}

/* Desglose por tipo de ticket, de mayor a menor recaudación. "Disponibles"
   es el cupo que queda; un tipo sin cupo (cantidad null) no tiene ni tope ni
   porcentaje, así que muestra "Sin límite" y un guion.

   Las cortesías no suman a "vendidos" ni a la recaudación, pero SÍ ocupan
   lugar en el cupo (el que entra con una cortesía ocupa un lugar real en el
   boliche), así que se descuentan de "disponibles" y se muestran al lado del
   nombre del tipo. */
function pintarTiposAnalytics(ev, ventas, cortesias){
  const tb = document.getElementById("ev-an-tipos");
  if(!tb) return;
  const delTipo = (filas, t) => filas.filter(c => String(c.tipo_ticket_id) === String(t.id)
    || (c.tipo_ticket_id == null && (c.tipo || "") === (t.nombre || "")));
  const filas = tiposDeEvento(ev.id).map(t=>{
    const suyas = delTipo(ventas, t);
    const vendidos = suyas.length;
    const cortesiasTipo = delTipo(cortesias || [], t).length;
    const recaudado = suyas.reduce((a,c) => a + (Number(c.total) || 0), 0);
    const cupo = t.cantidad == null ? null : Number(t.cantidad);
    const ocupados = vendidos + cortesiasTipo;
    return { nombre:t.nombre || "—", vendidos, cortesias:cortesiasTipo, recaudado, cupo,
             disponibles: cupo == null ? null : Math.max(0, cupo - ocupados),
             pct: cupo ? Math.min(100, Math.round(ocupados / cupo * 100)) : null };
  }).sort((a,b) => b.recaudado - a.recaudado);

  if(!filas.length){
    tb.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:24px">Este evento todavía no tiene tipos de entrada cargados.</td></tr>`;
    return;
  }
  tb.innerHTML = filas.map(f => `
    <tr>
      <td data-label="Tipo" class="tabla-tipos-nombre"><b>${esc(f.nombre)}</b>${f.cortesias ? ` <span class="an-cortesias">+${f.cortesias} cortesía${f.cortesias===1?"":"s"}</span>` : ""}</td>
      <td data-label="Vendidos">${f.vendidos}</td>
      <td data-label="Disponibles">${f.disponibles == null ? "Sin límite" : f.disponibles}</td>
      <td data-label="% vendido">${f.pct == null ? "—" : `
        <span class="an-pct">
          <span class="an-pct-track"><span class="an-pct-fill" style="width:${f.pct}%"></span></span>
          <span class="an-pct-num">${f.pct}%</span>
        </span>`}</td>
      <td data-label="Recaudación"><b style="color:var(--accent)">${fmt(f.recaudado)}</b></td>
    </tr>`).join("");
}

/* ---------- Gráfico: ventas (área, $) + visitas (línea, cantidad) ----------
   Un día por punto, desde que se publicó el evento hasta hoy. Dos escalas
   independientes: la plata y las visitas no comparten unidad, así que cada
   serie se normaliza contra su propio máximo (por eso los dos ejes Y). */
function serieEventoDiaria(ev, compras){
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const desde = new Date(ev.creado_en || hoy); desde.setHours(0,0,0,0);
  // Tope de 90 días para que el gráfico no se vuelva ilegible ni pesado
  const dias = Math.min(90, Math.max(1, Math.round((hoy - desde) / 86400000) + 1));
  const buckets = [];
  for(let i = dias - 1; i >= 0; i--){
    const fecha = new Date(hoy); fecha.setDate(fecha.getDate() - i);
    buckets.push({ fecha, ventas:0, visitas:0 });
  }
  const porDia = new Map(buckets.map(b => [b.fecha.toDateString(), b]));
  compras.forEach(c=>{
    if(!c.creado_en) return;
    const d = new Date(c.creado_en); d.setHours(0,0,0,0);
    const b = porDia.get(d.toDateString());
    if(b) b.ventas += Number(c.total) || 0;
  });
  (VISTAS_EVENTO_ID === ev.id ? VISTAS_EVENTO : []).forEach(v=>{
    if(!v.fecha) return;
    const d = new Date(v.fecha); d.setHours(0,0,0,0);
    const b = porDia.get(d.toDateString());
    if(b) b.visitas += 1;
  });
  return buckets;
}

function pintarChartEvento(ev, compras){
  const cont = document.getElementById("ev-an-chart");
  if(!cont) return;
  const buckets = serieEventoDiaria(ev, compras);
  CHART_EVENTO = buckets;   // lo lee el tooltip

  const totalVentas = buckets.reduce((a,b) => a + b.ventas, 0);
  const totalVisitas = buckets.reduce((a,b) => a + b.visitas, 0);
  const caption = document.getElementById("ev-an-chart-caption");
  if(caption) caption.textContent =
    `${buckets.length} día${buckets.length===1?"":"s"} desde que se publicó · ${fmt(totalVentas)} vendidos · ${totalVisitas} visita${totalVisitas===1?"":"s"}`;

  if(!totalVentas && !totalVisitas){
    cont.innerHTML = `<p class="loading" style="padding:32px 0">Todavía no hay ventas ni visitas para graficar.</p>`;
    return;
  }

  const W = 720, H = 220, padT = 14, padB = 28, padL = 46, padR = 44;
  const n = buckets.length;
  const maxV = Math.max(1, ...buckets.map(b => b.ventas));
  const maxU = Math.max(1, ...buckets.map(b => b.visitas));
  const xAt = i => padL + (W - padL - padR) * (n === 1 ? 0.5 : i / (n - 1));
  const yV = v => padT + (H - padT - padB) * (1 - v / maxV);
  const yU = v => padT + (H - padT - padB) * (1 - v / maxU);
  const base = padT + (H - padT - padB);

  const lineaV = buckets.map((b,i) => `${xAt(i).toFixed(1)},${yV(b.ventas).toFixed(1)}`).join(" ");
  const areaV = `${xAt(0).toFixed(1)},${base.toFixed(1)} ${lineaV} ${xAt(n-1).toFixed(1)},${base.toFixed(1)}`;
  const lineaU = buckets.map((b,i) => `${xAt(i).toFixed(1)},${yU(b.visitas).toFixed(1)}`).join(" ");
  const corta = d => d.toLocaleDateString("es-AR", {day:"numeric", month:"short"});
  // Una banda invisible por día: es lo que capta el hover para el tooltip.
  const ancho = (W - padL - padR) / Math.max(1, n - 1 || 1);
  const bandas = buckets.map((b,i) => `<rect class="ev-chart-banda" x="${(xAt(i) - ancho/2).toFixed(1)}" y="${padT}" width="${ancho.toFixed(1)}" height="${(base - padT).toFixed(1)}" data-i="${i}"/>`).join("");

  cont.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="ev-chart-svg" role="img"
         aria-label="Ventas y visitas por día desde que se publicó el evento">
      <line x1="${padL}" y1="${base}" x2="${W-padR}" y2="${base}" class="resumen-chart-base"/>
      <polygon points="${areaV}" class="resumen-chart-area"/>
      <polyline points="${lineaV}" class="resumen-chart-linea"/>
      <polyline points="${lineaU}" class="ev-chart-visitas"/>
      <text x="4" y="${padT+8}" class="resumen-chart-label">${esc(fmt(maxV))}</text>
      <text x="4" y="${base}" class="resumen-chart-label">$0</text>
      <text x="${W-4}" y="${padT+8}" text-anchor="end" class="resumen-chart-label visitas">${maxU}</text>
      <text x="${W-4}" y="${base}" text-anchor="end" class="resumen-chart-label visitas">0</text>
      <text x="${padL}" y="${H-6}" class="resumen-chart-label">${esc(corta(buckets[0].fecha))}</text>
      <text x="${W-padR}" y="${H-6}" text-anchor="end" class="resumen-chart-label">${esc(corta(buckets[n-1].fecha))}</text>
      <line class="ev-chart-guia" id="ev-chart-guia" x1="0" y1="${padT}" x2="0" y2="${base}" style="display:none"/>
      ${bandas}
    </svg>
    <div class="ev-chart-tooltip" id="ev-chart-tooltip" style="display:none"></div>`;

  // Tooltip: se mueve por las bandas invisibles y muestra los dos valores.
  cont.querySelectorAll(".ev-chart-banda").forEach(banda=>{
    banda.addEventListener("mouseenter", ()=> mostrarTooltipChart(cont, Number(banda.dataset.i), xAt(Number(banda.dataset.i)), W));
    banda.addEventListener("mouseleave", ()=> ocultarTooltipChart(cont));
  });
}
let CHART_EVENTO = [];
function mostrarTooltipChart(cont, i, x, W){
  const b = CHART_EVENTO[i];
  if(!b) return;
  const tip = cont.querySelector("#ev-chart-tooltip");
  const guia = cont.querySelector("#ev-chart-guia");
  if(guia){ guia.setAttribute("x1", x); guia.setAttribute("x2", x); guia.style.display = ""; }
  if(!tip) return;
  tip.innerHTML = `<b>${esc(b.fecha.toLocaleDateString("es-AR",{day:"numeric",month:"short"}))}</b>
    <span class="tip-ventas">${fmt(b.ventas)} vendidos</span>
    <span class="tip-visitas">${b.visitas} visita${b.visitas===1?"":"s"}</span>`;
  tip.style.left = (x / W * 100) + "%";
  tip.style.display = "block";
}
function ocultarTooltipChart(cont){
  const tip = cont.querySelector("#ev-chart-tooltip");
  const guia = cont.querySelector("#ev-chart-guia");
  if(tip) tip.style.display = "none";
  if(guia) guia.style.display = "none";
}

/* CSV de todas las ventas del evento. Una línea por orden y tipo (no por QR):
   así "cantidad" y "monto" son los de la venta, que es lo que se mira en una
   planilla. Las compras viejas sin `grupo` quedan cada una en su línea. */
function descargarVentasEvento(){
  const ev = EVENTS.find(e => e.id === EV_DETALLE);
  if(!ev) return;
  const compras = comprasDeEvento(ev);
  if(!compras.length){ alert("Este evento todavía no tiene ventas aprobadas para exportar."); return; }

  const ordenes = new Map();
  compras.forEach(c=>{
    const clave = (c.grupo || ("fila-" + c.id)) + "|" + (c.tipo_ticket_id || c.tipo || "");
    const prev = ordenes.get(clave);
    if(prev){ prev.cantidad += 1; prev.monto += Number(c.total) || 0; return; }
    ordenes.set(clave, {
      fecha: c.creado_en ? new Date(c.creado_en).toLocaleString("es-AR") : "",
      comprador: [c.comprador_nombre || c.nombre || "", c.comprador_apellido || c.apellido || ""].join(" ").trim(),
      email: c.email || "",
      dni: c.comprador_documento || c.documento || "",
      tipo: nombreTipo(c),
      cantidad: 1,
      monto: Number(c.total) || 0,
      estado: c.estado || "aprobado",
      // Para que en la planilla se vea cuál es venta y cuál regalada
      origen: esCortesia(c) ? "cortesía" : "venta"
    });
  });

  const limpiar = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const head = ["Fecha","Comprador","Email","DNI","Tipo de ticket","Cantidad","Monto","Estado","Origen"].join(",");
  const body = [...ordenes.values()]
    .map(o => [o.fecha, o.comprador, o.email, o.dni, o.tipo, o.cantidad, o.monto, o.estado, o.origen].map(limpiar).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + head + "\n" + body], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ventas-" + (ev.nombre || "evento").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") + ".csv";
  a.click();
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
  renderResumenDashboard();
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
  // data-label en cada <td>: en desktop no se usan (la tabla es la de
  // siempre), pero en mobile el CSS los vuelve la etiqueta de cada renglón
  // cuando la fila pasa a tarjeta apilada (ver .tabla-compras en la MÓVIL).
  document.getElementById("tbody").innerHTML = rows.map((c,i)=>`
    <tr>
      <td data-label="#" style="color:var(--text-dim)">${i+1}</td>
      <td data-label="Fecha compra" style="color:var(--text-dim);font-size:12px">${c.creado_en ? new Date(c.creado_en).toLocaleString("es-AR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—"}</td>
      <td data-label="Nombre">${esc(c.nombre)}</td><td data-label="Apellido">${esc(c.apellido)}</td>
      <td data-label="Evento">${esc(c.evento)}</td>
      <td data-label="Tipo" class="tabla-compras-tipo">${esc(nombreTipo(c))}</td>
      <td data-label="Precio">${fmt(c.total)}</td>
      <td data-label="Estado">${estadoPill(c.estado)}</td>
      <td data-label="Ingresó">${c.usada ? '<span class="pill" style="border-color:#22c55e;color:#22c55e">Sí</span>' : '<span style="color:var(--text-faint)">—</span>'}</td>
      <td data-label="Código" style="font-size:12px">${esc(c.codigo)}</td>
    </tr>`).join("") || `<tr><td colspan="10" style="text-align:center;color:var(--text-dim);padding:28px">Sin compras con estos filtros</td></tr>`;

  dibujarResumenTipos(rows);

  // Línea de resumen de lo que se está viendo ahora. Cada dato va en su
  // propio <span> (nowrap) para que en mobile el salto de línea caiga
  // entre datos, no a mitad de uno.
  const s = totales(rows);
  const res = document.getElementById("resumen-filtro");
  if(res){
    const filtrando = rows.length !== PURCHASES.length;
    const chips = [
      `Mostrando <b>${rows.length}</b> de ${PURCHASES.length} compras${filtrando ? " (filtrado)" : ""}`,
      `<b>${s.entradas}</b> aprobadas`,
      `<b>${s.compradores}</b> compradores`,
      `recaudado <b style="color:var(--accent)">${fmt(s.recaudado)}</b>`,
      `ingresaron <b>${s.ingresados}</b>`
    ];
    res.innerHTML = chips.map(c => `<span class="resumen-filtro-item">${c}</span>`).join("");
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

/* ================== ADMIN: RESUMEN ==================
   Las 4 métricas, el gráfico de ventas y las últimas órdenes son sólo
   lectura de PURCHASES — se repintan junto con drawAdmin() cada vez que
   loadPurchases() trae datos nuevos, no tienen su propio fetch. */

// Un balde por día, los últimos `dias` días (incluido hoy), en orden
// cronológico. Sólo suma compras aprobadas — lo mismo que cuenta totales().
function serieVentasDiarias(dias){
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const buckets = [];
  for(let i = dias - 1; i >= 0; i--){
    const fecha = new Date(hoy); fecha.setDate(fecha.getDate() - i);
    buckets.push({ fecha, total: 0 });
  }
  const porDia = new Map(buckets.map(b => [b.fecha.toDateString(), b]));
  PURCHASES.filter(esAprobada).forEach(c=>{
    if(!c.creado_en) return;
    const d = new Date(c.creado_en); d.setHours(0,0,0,0);
    const b = porDia.get(d.toDateString());
    if(b) b.total += Number(c.total) || 0;
  });
  return buckets;
}

// Gráfico de línea nativo, sin librerías: un <svg> con viewBox fijo y
// preserveAspectRatio="none" para que estire al ancho real de la tarjeta.
function svgVentasChart(buckets){
  const W = 720, H = 200, padB = 26, padT = 12, padX = 4;
  const n = buckets.length;
  const max = Math.max(1, ...buckets.map(b => b.total));
  const xAt = i => padX + (W - padX*2) * (i / (n - 1 || 1));
  const yAt = v => padT + (H - padT - padB) * (1 - v / max);
  const base = yAt(0);
  const linea = buckets.map((b,i) => `${xAt(i).toFixed(1)},${yAt(b.total).toFixed(1)}`).join(" ");
  const area = `${padX},${base.toFixed(1)} ${linea} ${xAt(n-1).toFixed(1)},${base.toFixed(1)}`;
  const corta = d => d.toLocaleDateString("es-AR", {day:"numeric", month:"short"});
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="resumen-chart-svg" role="img" aria-label="Ventas por día, últimos ${n} días">
    <line x1="${padX}" y1="${base.toFixed(1)}" x2="${W-padX}" y2="${base.toFixed(1)}" class="resumen-chart-base"/>
    <polygon points="${area}" class="resumen-chart-area"/>
    <polyline points="${linea}" class="resumen-chart-linea"/>
    <text x="${padX}" y="${H-6}" class="resumen-chart-label">${esc(corta(buckets[0].fecha))}</text>
    <text x="${W-padX}" y="${H-6}" text-anchor="end" class="resumen-chart-label">${esc(corta(buckets[n-1].fecha))}</text>
  </svg>`;
}

function renderResumenDashboard(){
  const cRec = document.getElementById("res-recaudado");
  if(!cRec) return;   // esta sección no está en el documento (u otra página)

  const g = totales(PURCHASES);
  const promedio = g.entradas ? Math.round(g.recaudado / g.entradas) : 0;
  cRec.textContent = fmt(g.recaudado);
  document.getElementById("res-entradas").textContent = g.entradas;
  document.getElementById("res-promedio").textContent = fmt(promedio);
  document.getElementById("res-compradores").textContent = g.compradores;

  const buckets = serieVentasDiarias(30);
  const totalPeriodo = buckets.reduce((a,b) => a + b.total, 0);
  const caption = document.getElementById("resumen-chart-caption");
  if(caption) caption.textContent = `Recaudado en los últimos 30 días: ${fmt(totalPeriodo)}`;
  const chart = document.getElementById("resumen-chart");
  if(chart){
    chart.innerHTML = totalPeriodo > 0
      ? svgVentasChart(buckets)
      : `<p class="loading" style="padding:32px 0">Todavía no hay ventas para graficar.</p>`;
  }

  // Las 10 compras más recientes, cualquiera sea su estado (igual que la
  // tabla de Compradores por defecto) — no sólo las aprobadas.
  const ordenes = [...PURCHASES]
    .sort((a,b) => new Date(b.creado_en||0) - new Date(a.creado_en||0))
    .slice(0, 10);
  const tbOrdenes = document.getElementById("resumen-ordenes");
  if(tbOrdenes){
    tbOrdenes.innerHTML = ordenes.map(c => `
      <tr>
        <td><b>${esc(c.nombre)} ${esc(c.apellido)}</b></td>
        <td>${esc(c.evento)}</td>
        <td>${esc(nombreTipo(c))}</td>
        <td>${fmt(c.total)}</td>
        <td>${estadoPill(c.estado)}</td>
      </tr>`).join("") || `<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:24px">Todavía no hay órdenes</td></tr>`;
  }
}

/* ================== USUARIOS REGISTRADOS (ADMIN) ================== */
let USUARIOS = [];
async function loadUsuarios(){
  if(DEMO) return;
  try{
    USUARIOS = await dbGet("perfiles", "order=creado_en.desc");
  }catch(e){ USUARIOS = []; }
  // La tabla muestra el rol de cada uno, así que necesita el equipo cargado
  if(!COLABORADORES.length) await loadEquipo();
  drawUsuarios();
}
// El rol de un usuario registrado, para la columna "Rol" y su filtro:
// "admin"/"encargado"/"escaner" si está en el equipo, o null si no tiene
// ninguno todavía (el filtro lo llama "sinrol", ver drawUsuarios).
function rolDeUsuario(u){
  const email = (u.email||"").toLowerCase();
  if(!email) return null;
  if(email === ADMIN_EMAIL.toLowerCase()) return "admin";
  const c = COLABORADORES.find(x => (x.email||"").toLowerCase() === email);
  return c ? rolPrincipal(c) : null;
}
function drawUsuarios(){
  const tb = document.getElementById("tbody-usuarios");
  if(!tb) return;
  const q = (document.getElementById("filtro-usuarios")?.value||"").toLowerCase();
  const rolFiltro = document.getElementById("filtro-usuarios-rol")?.value || "";
  let rows = USUARIOS.filter(u => ((u.nombre||"")+" "+(u.apellido||"")+" "+(u.email||"")).toLowerCase().includes(q));
  if(rolFiltro) rows = rows.filter(u => (rolDeUsuario(u) || "sinrol") === rolFiltro);
  tb.innerHTML = rows.map((u,i)=>`
    <tr>
      <td style="color:var(--text-dim)">${i+1}</td>
      <td style="color:var(--text-dim);font-size:12px">${u.creado_en ? new Date(u.creado_en).toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"2-digit"}) : "—"}</td>
      <td>${esc(u.nombre||"—")}</td><td>${esc(u.apellido||"—")}</td>
      <td>${esc(u.telefono||"—")}</td><td style="font-size:13px">${esc(u.email||"—")}</td>
      <td>${botonEquipoUsuario(u)}</td>
    </tr>`).join("") || `<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:28px">Sin usuarios registrados todavía</td></tr>`;
}
function exportUsuariosCSV(){
  const head = "Registrado,Nombre,Apellido,Telefono,Email\n";
  const body = USUARIOS.map(u=>`${u.creado_en||""},${u.nombre||""},${u.apellido||""},${u.telefono||""},${u.email||""}`).join("\n");
  const blob = new Blob([head+body],{type:"text/csv"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "usuarios-bronx.csv"; a.click();
}



/* ================== EQUIPO: COLABORADORES Y ROLES ==================
   Sólo para el admin (SECCIONES_ADMIN). Una tarjeta cuadrada por
   colaborador; al tocarla se abre el detalle, donde se cambia el rol, el
   alcance (todos los eventos o algunos), y si está activo.

   El alcance sale de colaborador_rol.evento_id: null = todos los eventos,
   un id = sólo ese. Guardar un rol borra las filas anteriores de esa
   persona y escribe las nuevas — una persona, un rol (con su alcance). */
let COLABORADORES = [];

async function loadEquipo(){
  if(DEMO){ COLABORADORES = DEMO_COLABORADORES.map(c=>({...c})); drawEquipo(); return; }
  try{
    COLABORADORES = await dbGet("colaboradores",
      "select=id,nombre,email,telefono,foto_url,activo,creado_en,colaborador_rol(id,rol,evento_id)&order=creado_en.asc");
  }catch(e){ COLABORADORES = []; }
  drawEquipo();
}
// El rol que manda, si tuviera más de uno cargado
function rolPrincipal(c){
  const roles = c.colaborador_rol || [];
  return ROL_ORDEN.find(r => roles.some(x => x.rol === r)) || null;
}
// Ids de eventos del rol principal ([] = todos los eventos)
function eventosDeRol(c){
  const rol = rolPrincipal(c);
  return (c.colaborador_rol || [])
    .filter(x => x.rol === rol && x.evento_id != null)
    .map(x => x.evento_id);
}
function alcanceTexto(c){
  const ids = eventosDeRol(c);
  if(!ids.length) return "Todos los eventos";
  if(ids.length === 1){
    const ev = EVENTS.find(e => e.id === ids[0]);
    return ev ? ev.nombre : "1 evento";
  }
  return ids.length + " eventos";
}
function inicialDe(c){ return ((c.nombre||c.email||"?").trim()[0] || "?").toUpperCase(); }

function drawEquipo(){
  const box = document.getElementById("equipo-grid");
  if(!box) return;
  if(!COLABORADORES.length){
    box.innerHTML = `<p style="color:var(--text-dim);font-size:14px">Todavía no hay nadie en el equipo. Agregá al primero con el botón de arriba.</p>`;
    return;
  }
  box.innerHTML = COLABORADORES.map(c=>{
    const rol = rolPrincipal(c);
    const avatar = c.foto_url
      ? `<img src="${esc(c.foto_url)}" alt="">`
      : esc(inicialDe(c));
    return `<button class="colab-card${c.activo ? "" : " inactivo"}" onclick="abrirColaborador(${c.id})">
      <span class="colab-avatar">${avatar}</span>
      <span class="colab-nombre">${esc(c.nombre || c.email)}</span>
      ${rol
        ? `<span class="colab-rol" data-rol="${rol}">${iconoRol(rol)}${tituloRol(rol)}</span>`
        : `<span class="colab-rol" data-rol="ninguno">Sin rol</span>`}
      <span class="colab-alcance">${esc(alcanceTexto(c))}</span>
      ${c.activo ? "" : `<span class="colab-tag">Inactivo</span>`}
    </button>`;
  }).join("");
}

/* ---------- Detalle / alta (modal) ----------
   EQ es el borrador que se está editando; null = modal cerrado. Igual que
   en el checkout: los inputs escriben en EQ sin re-renderizar (si no, se
   pierde el foco a mitad de palabra), y sólo los cambios de estructura
   (rol, alcance, tildar un evento) vuelven a dibujar. */
let EQ = null;

function abrirColaborador(id){
  const c = COLABORADORES.find(x => x.id === id);
  if(!c) return;
  const ids = eventosDeRol(c);
  EQ = {
    nuevo:false, id:c.id,
    nombre:c.nombre || "", email:c.email || "", telefono:c.telefono || "",
    activo:!!c.activo,
    rol: rolPrincipal(c) || "escaner",
    alcance: ids.length ? "eventos" : "todos",
    eventos: ids.slice()
  };
  renderEquipoModal();
}
function nuevoColaborador(prefill){
  EQ = {
    nuevo:true, id:null,
    nombre:(prefill && prefill.nombre) || "", email:(prefill && prefill.email) || "", telefono:(prefill && prefill.telefono) || "",
    activo:true, rol:"escaner", alcance:"todos", eventos:[]
  };
  renderEquipoModal();
}
function cerrarEquipoModal(){
  EQ = null;
  const ov = document.getElementById("overlay-equipo");
  if(ov) ov.classList.remove("open");
}
function eqCampo(campo, valor){ if(EQ) EQ[campo] = valor; }
function eqSetRol(rol){ if(!EQ) return; EQ.rol = rol; renderEquipoModal(); }
function eqSetAlcance(alcance){
  if(!EQ) return;
  EQ.alcance = alcance;
  if(alcance === "todos") EQ.eventos = [];
  renderEquipoModal();
}
function eqToggleEvento(id){
  if(!EQ) return;
  EQ.eventos = EQ.eventos.includes(id) ? EQ.eventos.filter(x => x !== id) : EQ.eventos.concat(id);
  renderEquipoModal();
}
function eqSetActivo(valor){ if(!EQ) return; EQ.activo = !!valor; renderEquipoModal(); }

function renderEquipoModal(){
  const ov = document.getElementById("overlay-equipo");
  const cuerpo = document.getElementById("equipo-modal-cuerpo");
  const titulo = document.getElementById("equipo-modal-titulo");
  if(!ov || !cuerpo || !EQ) return;
  if(titulo) titulo.textContent = EQ.nuevo ? "Nuevo colaborador" : (EQ.nombre || EQ.email);

  const campo = (id, label, tipo, valor, extra="") => `
    <div class="ck-campo">
      <label for="eq-${id}">${label}</label>
      <input id="eq-${id}" type="${tipo}" value="${esc(valor)}" ${extra}
             oninput="eqCampo('${id}', this.value)">
    </div>`;

  cuerpo.innerHTML = `
    <div class="ck-campos">
      ${campo("nombre", "Nombre", "text", EQ.nombre)}
      ${EQ.nuevo
        ? campo("email", "Email (el de su cuenta en la página)", "email", EQ.email, 'autocomplete="off"')
        : `<div class="ck-campo"><label>Email</label><p class="eq-fijo">${esc(EQ.email)}</p></div>`}
      ${campo("telefono", "Teléfono", "tel", EQ.telefono)}
    </div>

    <h4 class="eq-titulo">Rol</h4>
    <div class="eq-roles">
      ${ROL_ORDEN.map(r=>`
        <button class="eq-rol${EQ.rol === r ? " elegido" : ""}" data-rol="${r}" onclick="eqSetRol('${r}')">
          <span class="eq-rol-ico">${iconoRol(r)}</span>
          <b>${tituloRol(r)}</b>
          <span>${ROLES[r].desc}</span>
        </button>`).join("")}
    </div>

    <h4 class="eq-titulo">¿Sobre qué eventos?</h4>
    <div class="eq-alcance">
      <button class="eq-chip${EQ.alcance === "todos" ? " elegido" : ""}" onclick="eqSetAlcance('todos')">Todos los eventos</button>
      <button class="eq-chip${EQ.alcance === "eventos" ? " elegido" : ""}" onclick="eqSetAlcance('eventos')">Sólo algunos</button>
    </div>
    ${EQ.alcance === "eventos" ? `
      <div class="eq-eventos">
        ${EVENTS.length ? EVENTS.map(ev=>`
          <label class="ck-check">
            <input type="checkbox" ${EQ.eventos.includes(ev.id) ? "checked" : ""} onchange="eqToggleEvento(${ev.id})">
            <span>${esc(ev.nombre)}</span>
          </label>`).join("") : `<p style="color:var(--text-dim);font-size:13px">No hay eventos cargados todavía.</p>`}
      </div>` : ""}

    <h4 class="eq-titulo">Estado</h4>
    <label class="ck-check">
      <input type="checkbox" ${EQ.activo ? "checked" : ""} onchange="eqSetActivo(this.checked)">
      <span>Activo — si lo desactivás pierde el acceso sin borrar su historial.</span>
    </label>

    <p class="ck-error" id="eq-err" style="display:none"></p>
    <div class="ck-pie">
      ${EQ.nuevo
        ? `<button class="btn ghost" onclick="cerrarEquipoModal()">Cancelar</button>`
        : `<button class="btn ghost" onclick="eliminarColaborador(${EQ.id})">Eliminar</button>`}
      <button class="btn" id="eq-guardar" onclick="guardarColaborador()">${EQ.nuevo ? "Agregar" : "Guardar"}</button>
    </div>`;
  ov.classList.add("open");
}

// Las filas de colaborador_rol que le corresponden al borrador actual
function eqFilasRol(colaboradorId){
  if(EQ.alcance === "eventos" && EQ.eventos.length){
    return EQ.eventos.map(evId => ({ colaborador_id:colaboradorId, rol:EQ.rol, evento_id:evId }));
  }
  return [{ colaborador_id:colaboradorId, rol:EQ.rol, evento_id:null }];
}

async function guardarColaborador(){
  if(!EQ) return;
  const err = document.getElementById("eq-err");
  const fallar = txt => { if(err){ err.textContent = txt; err.style.display = "block"; } };
  const btn = document.getElementById("eq-guardar");

  if(!EQ.nombre.trim()) return fallar("Poné el nombre.");
  if(EQ.nuevo && !emailValido(EQ.email)) return fallar("Poné un email válido: tiene que ser el mismo con el que se creó la cuenta en la página.");
  if(EQ.alcance === "eventos" && !EQ.eventos.length) return fallar("Elegí al menos un evento, o pasalo a “Todos los eventos”.");

  if(btn){ btn.disabled = true; btn.textContent = "Guardando..."; }
  try{
    if(DEMO){
      if(EQ.nuevo){
        const id = Math.max(0, ...DEMO_COLABORADORES.map(c=>c.id)) + 1;
        DEMO_COLABORADORES.push({ id, nombre:EQ.nombre, email:EQ.email.toLowerCase(), telefono:EQ.telefono, foto_url:null, activo:EQ.activo, colaborador_rol:eqFilasRol(id) });
      } else {
        const c = DEMO_COLABORADORES.find(x=>x.id===EQ.id);
        if(c){ c.nombre=EQ.nombre; c.telefono=EQ.telefono; c.activo=EQ.activo; c.colaborador_rol=eqFilasRol(c.id); }
      }
      cerrarEquipoModal(); loadEquipo(); return;
    }

    let id = EQ.id;
    if(EQ.nuevo){
      const filas = await dbInsert("colaboradores", {
        nombre:EQ.nombre.trim(), email:EQ.email.trim().toLowerCase(),
        telefono:EQ.telefono.trim() || null, activo:EQ.activo
      });
      id = Array.isArray(filas) && filas[0] ? filas[0].id : null;
      if(!id) throw new Error("no se pudo crear el colaborador");
    } else {
      await dbUpdate("colaboradores", id, {
        nombre:EQ.nombre.trim(), telefono:EQ.telefono.trim() || null, activo:EQ.activo
      });
      // Se reemplazan los roles viejos: una persona, un rol con su alcance
      const previo = COLABORADORES.find(c => c.id === id);
      for(const r of (previo && previo.colaborador_rol) || []){
        if(r.id) await dbDelete("colaborador_rol", r.id);
      }
    }
    for(const fila of eqFilasRol(id)) await dbInsert("colaborador_rol", fila);
    cerrarEquipoModal();
    await loadEquipo();
    drawUsuarios();
  }catch(e){
    const dup = (e.message||"").includes("duplicate") || (e.message||"").includes("colaboradores_email_unico");
    fallar(dup ? "Ese email ya está en el equipo." : "No se pudo guardar: " + e.message);
  }
  if(btn){ btn.disabled = false; btn.textContent = EQ && EQ.nuevo ? "Agregar" : "Guardar"; }
}

async function eliminarColaborador(id){
  const c = COLABORADORES.find(x => x.id === id);
  if(!confirm(`${(c && (c.nombre||c.email)) || "Esta persona"} va a perder todo su acceso. ¿Seguro?\n\nSi es algo temporal, mejor desactivalo.`)) return;
  try{
    if(DEMO){ DEMO_COLABORADORES = DEMO_COLABORADORES.filter(x=>x.id!==id); }
    else await dbDelete("colaboradores", id);   // colaborador_rol se borra en cascada
    cerrarEquipoModal();
    await loadEquipo();
    drawUsuarios();
  }catch(e){ alert("No se pudo eliminar: " + e.message); }
}

/* Columna "Equipo" de la tabla de usuarios registrados: si ya es del equipo
   muestra su rol; si no, el atajo para sumarlo con sus datos ya cargados. */
function botonEquipoUsuario(u){
  const email = (u.email||"").toLowerCase();
  if(!email) return "—";
  if(email === ADMIN_EMAIL.toLowerCase()) return `<span class="pill-estado aprobado">${tituloRol("admin")}</span>`;
  const c = COLABORADORES.find(x => (x.email||"").toLowerCase() === email);
  if(c){
    return `<button class="btn ghost btn-mini" onclick="abrirColaborador(${c.id})">${tituloRol(rolPrincipal(c))}</button>`;
  }
  const datos = JSON.stringify({ nombre:((u.nombre||"")+" "+(u.apellido||"")).trim(), email, telefono:u.telefono||"" }).replace(/"/g,"&quot;");
  return `<button class="btn btn-mini" onclick="nuevoColaborador(${datos})">Sumar al equipo</button>`;
}

/* ================== CORTESÍAS (Studio) ==================
   Una cortesía es una entrada válida emitida a mano por el organizador o un
   encargado y mandada por mail, sin pasar por Mercado Pago. Va a la misma
   tabla `compras` que una venta —así el escáner de la puerta la acepta sin
   saber nada nuevo— pero con origen='cortesia', que es lo que la deja
   afuera de la facturación en Analytics (ver comprasDeEvento/ventasDeEvento).

   Quién puede: organizador (rol admin) sobre cualquier evento, y encargado
   sobre los eventos que tenga asignados. El escáner no. Eso lo decide la
   policy compras_cortesia_equipo (sql/cortesias.sql), no este archivo: acá
   sólo se esconde la sección, que es gating de interfaz nada más. */
function cargarSelectsCortesia(){
  const selEv = document.getElementById("cor-evento");
  if(!selEv) return;
  const previo = selEv.value;
  selEv.innerHTML = EVENTS.length
    ? EVENTS.map(ev => `<option value="${ev.id}">${esc(ev.nombre)}</option>`).join("")
    : `<option value="">No hay eventos cargados</option>`;
  if(previo && EVENTS.some(e => String(e.id) === previo)) selEv.value = previo;
  corCambiarEvento();
}
function corCambiarEvento(){
  const selEv = document.getElementById("cor-evento");
  const selTipo = document.getElementById("cor-tipo");
  if(!selEv || !selTipo) return;
  const ev = EVENTS.find(e => String(e.id) === selEv.value);
  // Todos los tipos del evento, incluidos los pausados/ocultos: una cortesía
  // no depende de que ese tipo esté a la venta al público.
  const tipos = ev ? tiposDeEvento(ev.id) : [];
  selTipo.innerHTML = tipos.length
    ? tipos.map(t => `<option value="${t.id}">${esc(t.nombre)}${Number(t.accesos) > 1 ? ` (${Number(t.accesos)} accesos)` : ""}</option>`).join("")
    : `<option value="">Este evento no tiene tipos de entrada</option>`;
}
// Vacía los campos pero deja a la vista la cortesía recién generada
function corLimpiarCampos(){
  ["cor-nombre","cor-apellido","cor-email"].forEach(id=>{
    const el = document.getElementById(id); if(el) el.value = "";
  });
  const err = document.getElementById("cor-err"); if(err) err.style.display = "none";
}
// El botón "Limpiar": además se lleva puesto el QR de la anterior
function resetCortesiaForm(){
  corLimpiarCampos();
  const res = document.getElementById("cor-resultado"); if(res) res.innerHTML = "";
}

async function enviarCortesia(){
  const err = document.getElementById("cor-err");
  const btn = document.getElementById("cor-btn");
  const res = document.getElementById("cor-resultado");
  const fallar = txt => { if(err){ err.textContent = txt; err.style.display = "block"; } };
  if(err) err.style.display = "none";

  const ev = EVENTS.find(e => String(e.id) === (document.getElementById("cor-evento")?.value || ""));
  if(!ev) return fallar("Elegí un evento.");
  const tipoId = document.getElementById("cor-tipo")?.value || "";
  const tipo = tiposDeEvento(ev.id).find(t => String(t.id) === tipoId);
  if(!tipo) return fallar("Elegí un tipo de entrada. Si el evento no tiene ninguno, cargalo primero en Eventos.");
  const email = (document.getElementById("cor-email")?.value || "").trim();
  if(!emailValido(email)) return fallar("Escribí un email de destino válido.");

  const nombre = (document.getElementById("cor-nombre")?.value || "").trim() || "Invitación";
  const apellido = (document.getElementById("cor-apellido")?.value || "").trim();

  // compras.codigo es único: el grupo lleva bastante azar como para no
  // chocar, y el prefijo CORT- hace obvio de dónde salió mirando la tabla.
  const grupo = "CORT-" + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).slice(2,6).toUpperCase();
  const codigo = grupo + "-1";
  const fila = {
    grupo, codigo,
    evento: ev.nombre, evento_id: ev.id,
    fecha_texto: ev.fecha_texto || null, lugar: ev.lugar || null,
    tipo: tipo.nombre, tipo_ticket_id: tipo.id, accesos: Number(tipo.accesos) || 1,
    nombre, apellido, email,
    comprador_nombre: nombre, comprador_apellido: apellido, comprador_documento: null, comprador_telefono: null,
    total: 0,                 // una cortesía no factura: se regala
    estado: "aprobado",       // lo que hace que el escáner la acepte
    usada: false,
    origen: "cortesia",
    user_id: null
  };

  if(btn){ btn.disabled = true; btn.textContent = "Generando..."; }
  let creada = false, mailOk = false;
  try{
    if(DEMO){ DEMO_PURCHASES.push({...fila, creado_en:new Date().toISOString()}); creada = true; }
    else { await dbInsert("compras", fila); creada = true; }
  }catch(e){
    const sinPermiso = (e.message||"").includes("row-level security");
    fallar(sinPermiso
      ? "Tu rol no puede emitir cortesías para este evento."
      : "No se pudo generar la entrada: " + e.message);
  }

  /* El mail lo manda una Edge Function, igual que las entradas de una compra
     real: la clave de Resend no puede vivir en el navegador. Contrato:
       POST /functions/v1/enviar-cortesia
       { email, codigo, evento, evento_id, fecha_texto, lugar, tipo,
         accesos, nombre, apellido }
     Todavía NO está deployada (como crear-pago y reenviar-entradas, vive
     fuera de este repo), así que hoy esto falla y se muestra el QR en
     pantalla para mandarlo a mano. La entrada ya quedó creada y es válida. */
  if(creada && !DEMO){
    try{
      const r = await fetch(`${SUPABASE_URL}/functions/v1/enviar-cortesia`, {
        method:"POST",
        headers:{ "apikey":SUPABASE_KEY, "Authorization":"Bearer "+(ADMIN_TOKEN || SUPABASE_KEY), "Content-Type":"application/json" },
        body: JSON.stringify({
          email, codigo, evento: ev.nombre, evento_id: ev.id,
          fecha_texto: ev.fecha_texto || "", lugar: ev.lugar || "",
          tipo: tipo.nombre, accesos: Number(tipo.accesos) || 1, nombre, apellido
        })
      });
      mailOk = r.ok;
    }catch(e){ mailOk = false; }
  } else if(creada && DEMO){ mailOk = true; }

  if(creada && res){
    res.innerHTML = `
      <div class="dash-card cortesia-ok">
        <p class="cortesia-ok-titulo">${mailOk ? "Cortesía enviada" : "Cortesía generada"}</p>
        <p class="cortesia-ok-detalle">
          ${esc(tipo.nombre)} · ${esc(ev.nombre)}<br>
          ${mailOk
            ? `Le mandamos el QR a <b>${esc(email)}</b>.`
            : `La entrada ya es válida, pero <b>el mail no salió</b>: falta deployar la función <code>enviar-cortesia</code>. Mostrale o mandale este QR mientras tanto.`}
        </p>
        <div class="cortesia-qr">
          <div class="qr-real" data-code="${esc(codigo)}"></div>
          <p class="cortesia-codigo">${esc(codigo)}</p>
        </div>
      </div>`;
    pintarQRs();
    corLimpiarCampos();
    // Que aparezca ya en Compradores y en los analytics del evento
    if(!DEMO) loadPurchases();
  }
  if(btn){ btn.disabled = false; btn.textContent = "Generar y enviar"; }
}

/* ================== PATROCINADORES (Studio) ==================
   Mismo patrón que Equipo: un formulario de alta/edición arriba, lista abajo.
   El logo se sube al bucket "fotos" (el mismo de las portadas de evento). */
let PATROCINADORES = [];
async function loadPatrocinadoresAdmin(){
  if(DEMO){ PATROCINADORES = DEMO_PATROCINADORES.slice(); drawPatrocinadoresAdmin(); return; }
  try{ PATROCINADORES = await dbGet("patrocinadores", "order=orden.asc"); }catch(e){ PATROCINADORES=[]; }
  drawPatrocinadoresAdmin();
}
function drawPatrocinadoresAdmin(){
  const box = document.getElementById("pt-list");
  if(!box) return;
  box.innerHTML = PATROCINADORES.map(p=>`
    <div class="ev-admin-item">
      <img src="${esc(p.logo_url)}" alt="" class="thumb-mini">
      <div class="info">
        <b>${esc(p.nombre)}</b>
        <span>${p.activo ? "Activo" : "Pausado"} · orden ${p.orden}${p.link ? " · " + esc(p.link) : ""}</span>
      </div>
      <div class="row-actions">
        <button class="btn ghost btn-mini" onclick="editarPatrocinador(${p.id})">Editar</button>
        <button class="btn ghost btn-mini" onclick="togglePatrocinadorActivo(${p.id})">${p.activo ? "Pausar" : "Activar"}</button>
        <button class="btn ghost btn-mini" onclick="borrarPatrocinador(${p.id})">Borrar</button>
      </div>
    </div>`).join("") || `<p style="color:var(--text-dim);font-size:14px">Todavía no cargaste ningún sponsor.</p>`;
}
function previewLogoPatrocinador(){
  const f = document.getElementById("pt-logo").files[0];
  const img = document.getElementById("pt-thumb");
  if(f){ img.src = URL.createObjectURL(f); img.style.display="block"; }
}
function resetPatrocinadorForm(){
  ["pt-id","pt-nombre","pt-link","pt-logo-url"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("pt-orden").value = PATROCINADORES.length;
  document.getElementById("pt-activo").checked = true;
  document.getElementById("pt-logo").value = "";
  const thumb = document.getElementById("pt-thumb");
  thumb.src = ""; thumb.style.display = "none";
  document.getElementById("pt-form-title").textContent = "Nuevo sponsor";
  document.getElementById("pt-err").style.display="none";
  document.getElementById("pt-ok").style.display="none";
}
function editarPatrocinador(id){
  const p = PATROCINADORES.find(x=>x.id===id);
  if(!p) return;
  document.getElementById("pt-id").value = p.id;
  document.getElementById("pt-nombre").value = p.nombre || "";
  document.getElementById("pt-link").value = p.link || "";
  document.getElementById("pt-orden").value = p.orden || 0;
  document.getElementById("pt-activo").checked = !!p.activo;
  document.getElementById("pt-logo-url").value = p.logo_url || "";
  const thumb = document.getElementById("pt-thumb");
  if(p.logo_url){ thumb.src = p.logo_url; thumb.style.display="block"; } else { thumb.style.display="none"; }
  document.getElementById("pt-form-title").textContent = "Editar sponsor";
  document.getElementById("pt-form").scrollIntoView({behavior:"smooth", block:"start"});
}
async function guardarPatrocinador(){
  const err = document.getElementById("pt-err"), ok = document.getElementById("pt-ok");
  err.style.display="none"; ok.style.display="none";
  const id = document.getElementById("pt-id").value;
  const nombre = document.getElementById("pt-nombre").value.trim();
  const link = document.getElementById("pt-link").value.trim();
  const orden = parseInt(document.getElementById("pt-orden").value, 10) || 0;
  const activo = document.getElementById("pt-activo").checked;
  let logoUrl = document.getElementById("pt-logo-url").value;
  const file = document.getElementById("pt-logo").files[0];

  if(!nombre){ err.textContent="Poné el nombre del sponsor."; err.style.display="block"; return; }
  if(!file && !logoUrl){ err.textContent="Subí el logo."; err.style.display="block"; return; }

  const btn = document.getElementById("pt-save-btn");
  btn.disabled = true; btn.textContent = "Guardando...";
  try{
    if(file){ logoUrl = DEMO ? URL.createObjectURL(file) : await uploadFoto(file); }
    const row = { nombre, logo_url: logoUrl, link: link || null, orden, activo };
    if(DEMO){
      if(id) Object.assign(PATROCINADORES.find(x=>x.id==id), row);
      else PATROCINADORES.push({ id: Date.now(), ...row });
    } else if(id){
      await dbUpdate("patrocinadores", id, row);
    } else {
      await dbInsert("patrocinadores", row);
    }
    ok.textContent = "Guardado."; ok.style.display="block";
    resetPatrocinadorForm();
    loadPatrocinadoresAdmin();
  }catch(e){
    err.textContent = "No se pudo guardar: " + e.message; err.style.display="block";
  }finally{
    btn.disabled = false; btn.textContent = "Guardar sponsor";
  }
}
async function togglePatrocinadorActivo(id){
  const p = PATROCINADORES.find(x=>x.id===id);
  if(!p) return;
  try{
    if(DEMO) p.activo = !p.activo;
    else await dbUpdate("patrocinadores", id, { activo: !p.activo });
    loadPatrocinadoresAdmin();
  }catch(e){ alert("No se pudo: " + e.message); }
}
async function borrarPatrocinador(id){
  if(!confirm("¿Borrar este sponsor?")) return;
  try{
    if(DEMO) PATROCINADORES = PATROCINADORES.filter(x=>x.id!==id);
    else await dbDelete("patrocinadores", id);
    loadPatrocinadoresAdmin();
  }catch(e){ alert("No se pudo borrar: " + e.message); }
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

/* Antes también escribía la línea "Con señal · Sin lista descargada" arriba
   del botón "Descargar lista" (#puerta-estado); se sacó de la pantalla del
   escáner a pedido, así que esto quedó sólo con lo que sigue siendo
   funcional: mostrar "Subir ingresos" cuando hay check-ins offline sin
   sincronizar todavía. */
function pintarEstadoPuerta(){
  const btnSync = document.getElementById("puerta-sync");
  if(btnSync) btnSync.style.display = leerCola().length ? "inline-block" : "none";
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
    // El id de auth.users viaja en la compra como compras.user_id (null si
    // compró un invitado), ver ckPagar()
    id: info.id || null,
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
  USER = null; CK = null; borrarSesionUser(); updateNavUser();
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


// ================== EVENTOS PASADOS + GALERÍA (DESACTIVADO) ==================
// Sacado de la portada y del Studio: pendiente reemplazo por una sección de
// artistas que pasaron por Bronx (ver CLAUDE.md, "Current status"). Todo el
// bloque queda comentado, no borrado, para retomarlo cuando se defina esa
// sección nueva. Mientras tanto: nada llama a nada de acá (ver initPage,
// abrirPanel y aplicarRol, donde se sacaron los call sites), y el HTML que
// usaba (pasados-sec, grid-pasados, sec-pasados, pe-*, d-galeria-sec,
// d-galeria) está comentado en index.html / admin.html.
//
// let PASADOS_ADMIN = [];
// async function loadPasadosAdmin(){
//   if(DEMO){ PASADOS_ADMIN=[]; renderPasadosAdmin(); return; }
//   try{ PASADOS_ADMIN = await dbGet("eventos", "pasado=eq.true&order=id.desc"); }catch(e){ PASADOS_ADMIN=[]; }
//   renderPasadosAdmin();
// }
// function renderPasadosAdmin(){
//   const list = document.getElementById("pe-list");
//   if(!list) return;
//   list.innerHTML = PASADOS_ADMIN.map(ev=>`
//     <div class="ev-admin-item">
//       <div class="info">
//         <b>${esc(ev.nombre)}</b>
//         <span>${esc(ev.fecha_texto||"")} ${ev.lugar?"· "+esc(ev.lugar):""}</span>
//       </div>
//       <div class="row-actions">
//         <button class="btn ghost" onclick="editPasado(${ev.id})">Editar / Galería</button>
//         <button class="btn ghost" onclick="deletePasado(${ev.id})">Borrar</button>
//       </div>
//     </div>`).join("") || `<p style="color:var(--text-dim);font-size:14px">Todavía no cargaste eventos pasados.</p>`;
// }
// function previewFotoPasado(){
//   const f = document.getElementById("pe-foto").files[0];
//   const img = document.getElementById("pe-thumb");
//   if(f){ img.src = URL.createObjectURL(f); img.style.display="block"; }
// }
// function resetPasadoForm(){
//   ["pe-id","pe-nombre","pe-fecha","pe-lugar","pe-desc","pe-direccion","pe-foto-url"].forEach(id=>document.getElementById(id).value="");
//   document.getElementById("pe-foto").value="";
//   document.getElementById("pe-thumb").style.display="none";
//   document.getElementById("pe-form-title").textContent="Nuevo evento pasado";
//   document.getElementById("pe-save-btn").textContent="Guardar evento pasado";
//   document.getElementById("pe-err").style.display="none";
//   document.getElementById("pe-ok").style.display="none";
// }
// function editPasado(id){
//   const ev = PASADOS_ADMIN.find(e=>e.id===id); if(!ev) return;
//   document.getElementById("pe-id").value = ev.id;
//   document.getElementById("pe-nombre").value = ev.nombre||"";
//   document.getElementById("pe-fecha").value = ev.fecha_texto||"";
//   document.getElementById("pe-lugar").value = ev.lugar||"";
//   document.getElementById("pe-desc").value = ev.descripcion||"";
//   document.getElementById("pe-direccion").value = ev.direccion||"";
//   document.getElementById("pe-foto-url").value = ev.foto_url||"";
//   const img = document.getElementById("pe-thumb");
//   if(ev.foto_url){ img.src=ev.foto_url; img.style.display="block"; } else img.style.display="none";
//   document.getElementById("pe-form-title").textContent = "Editar: " + ev.nombre;
//   document.getElementById("pe-save-btn").textContent = "Guardar cambios";
//   document.getElementById("pe-form-title").scrollIntoView({behavior:"smooth"});
// }
// async function savePasado(){
//   const err = document.getElementById("pe-err"), ok = document.getElementById("pe-ok");
//   err.style.display="none"; ok.style.display="none";
//   const nombre = document.getElementById("pe-nombre").value.trim();
//   if(!nombre){ err.textContent="Poné al menos el nombre del evento."; err.style.display="block"; return; }
//
//   const btn = document.getElementById("pe-save-btn");
//   btn.disabled=true; const prev=btn.textContent; btn.textContent="Guardando...";
//   try{
//     let fotoUrl = document.getElementById("pe-foto-url").value || null;
//     const file = document.getElementById("pe-foto").files[0];
//     if(file){ fotoUrl = DEMO ? URL.createObjectURL(file) : await uploadFoto(file); }
//     const data = {
//       nombre,
//       fecha_texto: document.getElementById("pe-fecha").value.trim(),
//       lugar: document.getElementById("pe-lugar").value.trim(),
//       descripcion: document.getElementById("pe-desc").value.trim(),
//       direccion: document.getElementById("pe-direccion").value.trim(),
//       foto_url: fotoUrl,
//       pasado: true, activo: true, agotado: false,
//       puertas: "", arte: "red"
//     };
//     const id = document.getElementById("pe-id").value;
//     if(!DEMO){
//       if(id){ await dbUpdate("eventos", id, data); }
//       else {
//         const creado = await dbInsert("eventos", data);
//         if(creado && creado[0]){ document.getElementById("pe-id").value = creado[0].id; }
//       }
//     }
//     ok.textContent = id ? "Evento pasado actualizado." : "Evento pasado creado."; ok.style.display="block";
//     document.getElementById("pe-form-title").textContent = "Editar: " + nombre;
//     document.getElementById("pe-save-btn").textContent = "Guardar cambios";
//     loadPasadosAdmin(); loadPasados();
//   }catch(e){ err.textContent="Error al guardar: "+e.message; err.style.display="block"; }
//   btn.disabled=false; if(btn.textContent==="Guardando...") btn.textContent=prev;
// }
// async function deletePasado(id){
//   const ev = PASADOS_ADMIN.find(e=>e.id===id);
//   if(!confirm(`¿Borrar "${ev.nombre}" y toda su galería?`)) return;
//   try{
//     await dbDelete("eventos", id);
//     loadPasadosAdmin(); loadPasados();
//   }catch(e){ alert("No se pudo borrar: "+e.message); }
// }
//
// // ------- Lado público: sección Eventos pasados -------
// let PASADOS = [];
// async function loadPasados(){
//   const sec = document.getElementById("pasados-sec");
//   if(!sec) return;
//   try{
//     PASADOS = DEMO ? [] : await dbGet("eventos", "pasado=eq.true&activo=eq.true&order=id.desc");
//   }catch(e){ PASADOS = []; }
//   if(!PASADOS.length){ sec.style.display="none"; return; }
//   sec.style.display="block";
//   document.getElementById("grid-pasados").innerHTML = PASADOS.map(ev=>`
//     <article class="ticket pasado">
//       <div class="art ${ev.foto_url?'':'red'}" style="${ev.foto_url?`background-image:url('${ev.foto_url}')`:''}" onclick="openPasado(${ev.id})">
//         <span>${esc(ev.nombre)}</span>
//       </div>
//       <div class="body" style="padding:14px 16px">
//         <span style="color:var(--text-dim);font-size:13px">${esc(ev.fecha_texto||"")}</span>
//         <button class="btn ghost ancho" style="margin-top:10px" onclick="openPasado(${ev.id})">Ver evento</button>
//       </div>
//     </article>`).join("");
// }
// function urlVideoEmbed(url){
//   // YouTube → iframe embebido; otros links → link normal
//   const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
//   if(yt) return `https://www.youtube.com/embed/${yt[1]}`;
//   return null;
// }
// async function openPasado(evId, empujarURL=true){
//   const ev = PASADOS.find(e=>e.id===evId); if(!ev) return;
//   if(empujarURL){ try{ history.pushState(null, "", "?pasado="+evId); }catch(e){} }
//
//   document.getElementById("d-name").textContent = ev.nombre;
//   // Un evento pasado no vende: sin edad mínima, y el "cuándo" lleva el aviso
//   pintarCabeceraDetalle(ev, {
//     cuando: [ev.fecha_texto, "Evento finalizado"].filter(Boolean),
//     edad: null
//   });
//   pintarColorDetalle(ev);
//
//   const bg = document.getElementById("d-bg");
//   const flyer = document.getElementById("d-flyer");
//   if(ev.foto_url){
//     bg.style.backgroundImage = `url('${ev.foto_url}')`;
//     flyer.classList.remove("nofoto");
//     flyer.style.backgroundImage = `url('${ev.foto_url}')`;
//   } else {
//     bg.style.backgroundImage = "";
//     flyer.classList.add("nofoto");
//     flyer.style.backgroundImage = "";
//   }
//
//   pintarDescripcion(ev.descripcion || "");
//
//   // Evento pasado: sin tarjeta de compra
//   const buyCard = document.querySelector(".d-buy-card");
//   if(buyCard) buyCard.style.display = "none";
//
//   // Ubicación
//   const loc = document.getElementById("d-location");
//   if(ev.direccion){
//     const q = encodeURIComponent(ev.direccion);
//     loc.innerHTML = `<p style="color:var(--text-dim);margin-bottom:12px;font-size:13px">${esc(ev.direccion)}</p>
//       <div class="map-wrap"><iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${q}&output=embed"></iframe></div>`;
//   } else {
//     loc.innerHTML = `<p style="color:var(--text-dim)">${esc(ev.lugar||"")}</p>`;
//   }
//
//   // Galería del evento
//   const sec = document.getElementById("d-galeria-sec");
//   const cont = document.getElementById("d-galeria");
//   sec.style.display = "block";
//   cont.innerHTML = `<div class="loading">Cargando galería...</div>`;
//   let items = [];
//   try{ items = await dbGet("galeria", `evento_id=eq.${evId}&order=orden.asc`); }catch(e){}
//   // Sin fotos ni videos: ocultamos la sección en vez de mostrarla vacía
//   if(!items.length){ sec.style.display="none"; cont.innerHTML=""; }
//   else cont.innerHTML = items.map(g=>{
//     if(g.tipo==="foto") return `<img src="${g.url}" alt="${esc(ev.nombre)}" loading="lazy">`;
//     const emb = urlVideoEmbed(g.url);
//     if(emb) return `<div class="gal-video"><iframe src="${emb}" allowfullscreen loading="lazy"></iframe></div>`;
//     if(g.url.includes("/storage/") || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(g.url))
//       return `<div class="gal-video"><video src="${g.url}" controls playsinline preload="metadata"></video></div>`;
//     return `<a class="btn ghost" href="${g.url}" target="_blank" rel="noopener" style="align-self:center">Ver video</a>`;
//   }).join("");
//
//   go('detalle');
//   medirDesc();
// }

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
    iniciarHeroCarrusel();
    // Los precios y los cupos dependen de los tipos y de cuántas se vendieron:
    // los dos tienen que estar antes de pintar nada.
    await cargarTipos();
    await cargarVentasTipo();
    await loadEvents();
    loadPatrocinadores();
    checkReturnFromPayment();

    // Si la URL apunta a un evento, abrirlo directo (deep link / recarga)
    // ("pasado" se sacó junto con "Eventos pasados" — ver más abajo)
    const prm = new URLSearchParams(location.search);
    if(prm.get("evento")) openDetail(Number(prm.get("evento")), false);

    // Botón atrás/adelante del navegador
    window.addEventListener("popstate", ()=>{
      const q = new URLSearchParams(location.search);
      if(q.get("evento")) openDetail(Number(q.get("evento")), false);
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
