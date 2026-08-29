
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
const esc = s => (s||"").toString().replace(/</g,"&lt;").replace(/>/g,"&gt;");

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
  {id:1, nombre:"Winter Fest", fecha_texto:"Sáb 18 Jul 2026", lugar:"Secret Location", puertas:"Open doors 1:30 AM", precio_general:15000, arte:"red", agotado:false, ubicacion_secreta:true, descripcion:"La primera Winter Fest de Torinos Producciones. Una noche de música electrónica en una locación secreta que revelamos el mismo día por mail. Line-up sorpresa, barra completa y la mejor energía. Entrada general. Cupos limitados.", foto_url:null, direccion:null},
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


/* ================== LOTES ================== */
const LOTE_NOMBRES = { eb:"Early Bird", l1:"Lote 1", l2:"Lote 2", l3:"Lote 3", general:"General" };
const ORDEN_LOTES = ["eb","l1","l2","l3"];

/* Ventas aprobadas por evento y por lote: { "Nombre evento": { "Early Bird": 38 } }
   En la página pública se llena desde la vista ventas_por_lote (solo totales,
   sin datos de compradores). En el admin se recalcula desde PURCHASES, que ya
   tiene las compras completas. */
let VENTAS_LOTE = {};
let VENTAS_VISTA_OK = false;

async function cargarVentasLote(){
  VENTAS_LOTE = {}; VENTAS_VISTA_OK = false;
  if(DEMO) return;
  try{
    const filas = await dbGet("ventas_por_lote", "select=evento,tipo,vendidas");
    if(!Array.isArray(filas)) return;
    filas.forEach(f=>{
      if(!VENTAS_LOTE[f.evento]) VENTAS_LOTE[f.evento] = {};
      VENTAS_LOTE[f.evento][f.tipo] = Number(f.vendidas) || 0;
    });
    VENTAS_VISTA_OK = true;
  }catch(e){
    // La vista todavía no está creada en Supabase: sin conteos, los lotes se
    // quedan en el que marca lote_activo (el comportamiento manual de antes).
    console.warn("No se pudo leer ventas_por_lote:", e.message);
  }
}
function ventasDeEvento(nombreEvento){ return VENTAS_LOTE[nombreEvento] || {}; }

/* Un lote puede estar guardado como número (formato viejo: solo precio) o como
   {precio, cantidad} (formato nuevo). Devuelve siempre {precio, cantidad} o null.
   cantidad null = sin cupo definido, ese lote no se agota solo. */
function loteInfo(lotes, clave){
  const v = (lotes || {})[clave];
  if(v == null) return null;
  if(typeof v === "object"){
    const precio = Number(v.precio) || 0;
    if(!precio) return null;
    const c = v.cantidad;
    return { precio, cantidad: (c == null || c === "") ? null : (Number(c) || 0), aviso: v.aviso || "" };
  }
  const precio = Number(v) || 0;
  return precio ? { precio, cantidad: null, aviso: "" } : null;
}
/* Cartelito editable del lote. {N} se reemplaza por las que quedan, así no hay
   que editarlo a mano cada vez que se vende una. Si usa {N} pero el lote no
   tiene cupo, no hay número que poner: no se muestra nada. */
function textoAviso(lote, vendidas){
  if(!lote || !lote.aviso) return "";
  const usaN = /\{N\}/i.test(lote.aviso);
  if(!usaN) return lote.aviso;
  if(lote.cantidad == null) return "";
  const restantes = Math.max(0, lote.cantidad - (Number(vendidas) || 0));
  return lote.aviso.replace(/\{N\}/gi, restantes);
}
// Lotes cargados del evento, en orden, ya normalizados
function lotesDefinidos(ev){
  const lotes = ev.lotes || {};
  return ORDEN_LOTES.map(k=>{
    const info = loteInfo(lotes, k);
    return info ? { clave:k, nombre:LOTE_NOMBRES[k], precio:info.precio, cantidad:info.cantidad, aviso:info.aviso } : null;
  }).filter(Boolean);
}

/* Lote a la venta: {clave, nombre, precio, cantidad, vendidas, todosAgotados}.
   Avanza solo — se salta los lotes cuyas ventas aprobadas ya llegaron al cupo.
   lote_activo se sigue respetando como PISO: nunca volvemos a un lote anterior
   al que el admin eligió a mano, así los eventos viejos no bajan de precio. */
function loteActivo(ev){
  const general = { clave:"general", nombre:"General", precio:Number(ev.precio_general)||0,
                    cantidad:null, vendidas:0, todosAgotados:false };
  const la = ev.lote_activo || "general";
  if(la === "general") return general;

  const defs = lotesDefinidos(ev);
  if(!defs.length) return general;

  const ventas = ventasDeEvento(ev.nombre);
  let i = defs.findIndex(d => d.clave === la);
  if(i < 0) i = 0;
  for(; i < defs.length; i++){
    const d = defs[i];
    const vendidas = Number(ventas[d.nombre]) || 0;
    if(d.cantidad == null || vendidas < d.cantidad) return { ...d, vendidas, todosAgotados:false };
  }
  const ult = defs[defs.length-1];
  return { ...ult, vendidas: Number(ventas[ult.nombre]) || 0, todosAgotados:true };
}
// Agotado a mano desde el admin, o porque se vendieron todos los lotes
function eventoAgotado(ev){ return !!ev.agotado || loteActivo(ev).todosAgotados; }

// Cuenta ventas aprobadas por lote a partir de las compras cargadas en el admin
function ventasLoteDesdePurchases(){
  const m = {};
  PURCHASES.forEach(c=>{
    if((c.estado||"").toLowerCase() !== "aprobado") return;
    const ev = c.evento, t = c.tipo || "General";
    if(!m[ev]) m[ev] = {};
    m[ev][t] = (m[ev][t] || 0) + 1;
  });
  return m;
}

/* ================== EVENTOS (tarjetas) ================== */
async function loadEvents(){
  const grid = document.getElementById("grid");
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
    const artClass = ev.foto_url ? "photo" : ev.arte;
    const artStyle = ev.foto_url ? `style="background-image:url('${ev.foto_url}')"` : "";
    el.innerHTML = `
      <div class="art ${artClass}" ${artStyle} onclick="openDetail(${ev.id})">
        <span class="art-name">${esc(ev.nombre)}</span>
      </div>
      <div class="body"><div class="meta">
        <span>📅 <b>${esc(ev.fecha_texto)}</b></span>
        <span>📍 <b>${esc(ev.lugar)}</b></span>
        <span>🕐 <b>${esc(ev.puertas)}</b></span>
      </div></div>
      <div class="stub">
        <div class="price"><small>Desde</small>${fmt(loteActivo(ev).precio)}</div>
        ${agotado ? '<span class="tag-soldout">Agotado</span>'
          : `<div class="actions">
               <button class="btn ghost" onclick="openDetail(${ev.id})">Ver más</button>
               <button class="btn buy" onclick="openBuy(${ev.id})">Comprar</button>
             </div>`}
      </div>`;
    grid.appendChild(el);
  });
}
// [loadEvents(); -> ahora se llama desde initPage()]

/* ================== DETALLE ================== */
function openDetail(id, empujarURL=true){
  if(empujarURL){ try{ history.pushState(null, "", "?evento="+id); }catch(e){} }
  const ev = EVENTS.find(e=>e.id===id);
  if(!ev) return;
  document.getElementById("d-name").textContent = ev.nombre;
  document.getElementById("d-meta").innerHTML =
    `<span>📅 <b>${esc(ev.fecha_texto)}</b></span>
     <span>🕐 <b>${esc(ev.puertas)}</b></span>
     <span>📍 <b>${esc(ev.lugar)}</b></span>`;

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

  document.getElementById("d-desc").textContent = ev.descripcion || "Pronto más información sobre este evento.";

  const loc = document.getElementById("d-location");
  if(ev.ubicacion_secreta){
    loc.innerHTML = `<div class="secret-box">📍 <b>Ubicación secreta.</b> Vamos a publicar el lugar cerca de la fecha del evento.</div>`;
  } else if(ev.direccion){
    const q = encodeURIComponent(ev.direccion);
    loc.innerHTML = `<p style="color:#c7c7cd;margin-bottom:12px;font-family:'Space Mono',monospace;font-size:13px">📍 ${esc(ev.direccion)}</p>
      <div class="map-wrap"><iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${q}&output=embed"></iframe></div>
      <a class="back" style="margin-top:14px;display:inline-block;text-decoration:none" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">Abrir en Google Maps</a>`;
  } else {
    loc.innerHTML = `<p style="color:var(--dim)">Ubicación a confirmar.</p>`;
  }

  const buyCardDet = document.querySelector(".d-buy-card");
  if(buyCardDet) buyCardDet.style.display = "";
  const galSec = document.getElementById("d-galeria-sec");
  if(galSec) galSec.style.display = "none";

  const laDet = loteActivo(ev);
  // El lote a la venta es el título de la tarjeta (con su pill roja) y el precio
  // va solo debajo. Antes el lote se repetía en el título Y en la pill: tres
  // líneas apiladas diciendo lo mismo que la lista de lotes de acá arriba.
  document.getElementById("d-buy-name").innerHTML = laDet.clave==="general"
    ? "Entrada General"
    : `<span class="lote-pill">${esc(laDet.nombre)}</span>`;
  document.getElementById("d-price").textContent = fmt(laDet.precio);
  // Agotado a mano desde el admin, o porque se vendieron todos los lotes:
  // en los dos casos la lista va entera tachada y sin cartelito de urgencia.
  const agotado = !!ev.agotado || laDet.todosAgotados;
  // Cartelito del lote a la venta, ej: "Quedan las últimas 10"
  const aviso = agotado ? "" : textoAviso(laDet, laDet.vendidas);

  // Lista de lotes: cuál está tachado sale del cálculo automático de loteActivo
  const lotesBox = document.getElementById("d-lotes");
  let listaVisible = false;
  if(lotesBox){
    const definidos = lotesDefinidos(ev);
    const idxActivo = definidos.findIndex(d => d.clave === laDet.clave);
    listaVisible = laDet.clave!=="general" && definidos.length > 1;
    if(listaVisible){
      lotesBox.style.display = "flex";
      lotesBox.innerHTML = definidos.map((d,i)=>{
        let clase = "proximo", tag = "Próximamente", extra = "";
        // Evento agotado: no queda ninguno "en venta", van todos tachados
        if(agotado || i < idxActivo){ clase = "agotado"; tag = "Agotado"; }
        else if(d.clave === laDet.clave){
          clase = "activo"; tag = "En venta";
          // El aviso va pegado a SU lote: abajo del total parecía hablar de todas las entradas
          if(aviso) extra = `<div class="lote-aviso">${esc(aviso)}</div>`;
        }
        return `<div class="lote-item">
          <div class="lote-row ${clase}"><span>${d.nombre}</span><span class="lote-precio">${fmt(d.precio)}</span><span class="lote-tag${clase==="activo"?" venta":""}">${tag}</span></div>
          ${extra}
        </div>`;
      }).join("");
    } else {
      lotesBox.style.display = "none";
      lotesBox.innerHTML = "";
    }
  }
  // Con un solo lote no hay lista donde colgarlo, así que ahí sí va en la tarjeta
  const avisoEl = document.getElementById("d-aviso");
  if(avisoEl){
    const enTarjeta = !!aviso && !listaVisible;
    avisoEl.textContent = enTarjeta ? aviso : "";
    avisoEl.style.display = enTarjeta ? "block" : "none";
  }
  const btn = document.getElementById("d-buy-btn");
  if(agotado){ btn.textContent="Agotado"; btn.disabled=true; }
  else {
    btn.textContent = (USER||DEMO) ? "Comprar" : "Ingresá para comprar";
    btn.disabled=false; btn.onclick=()=>openBuy(ev.id);
  }

  go('detalle');
}

/* ================== COMPRA ================== */
let cur=null, qty=1;
function openBuy(id){
  // Comprar requiere sesión: guardar el evento y mandar a ingresar
  if(!USER && !DEMO){
    try{ localStorage.setItem("tp_volver", "/?evento="+id); }catch(e){}
    go('cuenta');
    return;
  }
  cur = EVENTS.find(e=>e.id===id); qty=1;
  document.getElementById("m-title").textContent = cur.nombre;
  document.getElementById("m-date").textContent = cur.fecha_texto + " · " + cur.lugar;
  document.getElementById("qty").textContent = 1;
  document.getElementById("buy-err").style.display="none";
  renderAttendees(); updTotal();
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
function chQty(d){ qty=Math.min(10,Math.max(1,qty+d)); document.getElementById("qty").textContent=qty; renderAttendees(); updTotal(); }
function renderAttendees(){
  const box = document.getElementById("attendees");
  const prev = [...box.querySelectorAll(".attendee-row")].map(r=>({n:r.querySelector(".a-nombre").value,a:r.querySelector(".a-apellido").value}));
  box.innerHTML = "";
  for(let i=0;i<qty;i++){
    const row = document.createElement("div");
    row.className = "attendee-row";
    row.innerHTML = `<span class="num">${i+1}</span>
      <input class="a-nombre" placeholder="Nombre" value="${prev[i]?esc(prev[i].n):''}">
      <input class="a-apellido" placeholder="Apellido" value="${prev[i]?esc(prev[i].a):''}">`;
    box.appendChild(row);
  }
}
function precioActual(){ return cur ? loteActivo(cur).precio : 0; }
function servicioPorEntrada(){ return Math.round(precioActual() * SERVICIO_PCT); }
function updTotal(){
  const p = precioActual();
  const s = servicioPorEntrada();
  document.getElementById("sub-label").textContent = `Entradas (${qty} × ${fmt(p)})`;
  document.getElementById("subtotal").textContent = fmt(p * qty);
  // El porcentaje sale de la constante para que no se desincronice del cálculo
  const svcLabel = document.getElementById("serv-label");
  if(svcLabel) svcLabel.textContent = `Costo de servicio (${+(SERVICIO_PCT*100).toFixed(2)}%)`;
  document.getElementById("serv-total").textContent = fmt(s * qty);
  document.getElementById("total-label").textContent = "Total";
  document.getElementById("total").textContent = fmt((p + s) * qty);
}
async function confirmBuy(){
  const errEl = document.getElementById("buy-err");
  const rows = [...document.querySelectorAll("#attendees .attendee-row")];
  const asistentes = rows.map(r=>({nombre:r.querySelector(".a-nombre").value.trim(), apellido:r.querySelector(".a-apellido").value.trim()}));
  const email = document.getElementById("f-email").value.trim();
  if(asistentes.some(a=>!a.nombre || !a.apellido)){
    errEl.textContent="Completá nombre y apellido de cada entrada"; errEl.style.display="block"; return;
  }
  if(!email || !email.includes("@")){
    errEl.textContent="Completá un email válido para recibir las entradas"; errEl.style.display="block"; return;
  }
  errEl.style.display="none";

  const btn = document.getElementById("btn-confirm");
  btn.disabled=true; btn.textContent="Redirigiendo al pago...";

  // MODO DEMO: sin Supabase, simula la compra sin pago real
  if(DEMO){
    const grupo = "TP-" + Math.random().toString(36).slice(2,8).toUpperCase();
    const entradas = asistentes.map((a,i)=>({
      nombre:a.nombre, apellido:a.apellido, email, evento:cur.nombre,
      fecha_texto:cur.fecha_texto, lugar:cur.lugar, tipo:loteActivo(cur).nombre,
      cantidad:1, total:precioActual(), codigo:grupo+"-"+(i+1), estado:"aprobado"
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

  // REAL: llamar a la Edge Function crear-pago y redirigir a Mercado Pago
  try{
    const r = await fetch(`${SUPABASE_URL}/functions/v1/crear-pago`, {
      method:"POST",
      headers:{ "apikey":SUPABASE_KEY, "Authorization":"Bearer "+SUPABASE_KEY, "Content-Type":"application/json" },
      body: JSON.stringify({
        evento: cur.nombre,
        fecha_texto: cur.fecha_texto,
        precio: precioActual() + servicioPorEntrada(),  // entrada + costo de servicio
        lote: loteActivo(cur).nombre,
        asistentes: asistentes,
        email: email
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
    <p class="confirm-note">Mostrá este QR en la puerta · Torinos Producciones</p>
    <button class="btn" style="display:block;width:100%;margin-top:14px" onclick="descargarQR('${qrId}','${esc(c.codigo)}')">Descargar QR</button>
  </div>`;
}
// Generar los QR reales como imagen (API confiable)
function pintarQRs(){
  document.querySelectorAll(".qr-real").forEach(el=>{
    if(el.dataset.done) return;
    el.dataset.done = "1";
    const code = el.dataset.code;
    const url = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=" + encodeURIComponent(code);
    el.innerHTML = `<img src="${url}" alt="QR ${esc(code)}" style="width:100%;height:100%;display:block">`;
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
  ctx.fillStyle = "#e10600"; ctx.fillRect(0,140,W,8);
  // Título
  ctx.fillStyle = "#ffffff"; ctx.textAlign = "center";
  ctx.font = "bold 34px Arial";
  ctx.fillText("TORINOS ● PRODUCCIONES", W/2, 85);

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
    ctx.fillText("Mostrá este QR en la puerta · Torinos Producciones", W/2, 980);
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
      alert("✅ ¡Pago confirmado! Tus entradas ya están en Mis Entradas y también te llegan por email.");
      go('entradas');
    } else {
      alert("✅ ¡Pago confirmado! Te enviamos las entradas por email. Iniciá sesión con ese mismo email para verlas acá.");
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
function aplicarRol(){
  const soloAdmin = ["sec-eventos","sec-pasados","sec-usuarios","sec-equipo","btn-borrar-pend"];
  soloAdmin.forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.style.display = (ROL==="admin") ? "" : "none";
  });
}
// Carga todo el panel según el rol
// Hace plegable cada sección del panel con animación suave
function initColapsables(){
  document.querySelectorAll("#admin-panel .admin-section > h3").forEach(t=>{
    if(t.dataset.colap) return;
    t.dataset.colap = "1";
    const sec = t.parentElement;

    // Envolver todo lo que no es el título en un cuerpo animable
    const body = document.createElement("div");
    body.className = "sec-body";
    while(t.nextSibling){ body.appendChild(t.nextSibling); }
    sec.appendChild(body);

    // Arrancan abiertas y sin tope de altura: el contenido se carga después
    // (tablas, listas) y si dejábamos una altura fija quedaba recortado y no
    // se podía scrollear hasta abajo.
    body.style.maxHeight = "none";

    // Suelta el tope apenas termina de abrir. El temporizador es el seguro:
    // si la animación no dispara —por ejemplo con animaciones reducidas— el
    // evento nunca llega y la sección se quedaría cortada para siempre.
    let liberar = null;
    function liberarAltura(){
      clearTimeout(liberar);
      body.style.maxHeight = "none";
    }

    t.addEventListener("click", ()=>{
      const abierto = !sec.classList.contains("colapsada");
      clearTimeout(liberar);
      if(abierto){
        // Cerrar: fijar la altura actual y recién ahí ir a cero
        body.style.maxHeight = body.scrollHeight + "px";
        void body.offsetHeight;   // forzar el reflow para que anime
        requestAnimationFrame(()=>{
          sec.classList.add("colapsada");
          body.style.maxHeight = "0px";
        });
      } else {
        // Abrir: de cero a la altura real y después soltar el tope
        sec.classList.remove("colapsada");
        body.style.maxHeight = body.scrollHeight + "px";
        body.addEventListener("transitionend", function fin(e){
          if(e.propertyName === "max-height"){
            body.removeEventListener("transitionend", fin);
            liberarAltura();
          }
        });
        liberar = setTimeout(liberarAltura, 500);
      }
    });
  });
}
async function abrirPanel(){
  document.getElementById("admin-login").style.display="none";
  document.getElementById("admin-panel").style.display="block";
  initColapsables();
  aplicarRol();
  // Esperamos las compras: renderEventAdmin necesita los conteos por lote
  await loadPurchases();
  if(ROL==="admin"){ renderEventAdmin(); loadUsuarios(); loadPasadosAdmin(); loadStaff(); }
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
// Los ids de los inputs de precio vienen de antes y no son uniformes (ev-lote-eb
// pero ev-lote-1), así que el mapa evita repetirlos en cada función.
const LOTE_INPUTS = {
  eb: { precio:"ev-lote-eb", cantidad:"ev-cant-eb", aviso:"ev-aviso-eb", vendidas:"ev-vend-eb" },
  l1: { precio:"ev-lote-1",  cantidad:"ev-cant-l1", aviso:"ev-aviso-l1", vendidas:"ev-vend-l1" },
  l2: { precio:"ev-lote-2",  cantidad:"ev-cant-l2", aviso:"ev-aviso-l2", vendidas:"ev-vend-l2" },
  l3: { precio:"ev-lote-3",  cantidad:"ev-cant-l3", aviso:"ev-aviso-l3", vendidas:"ev-vend-l3" }
};
// Arma el jsonb de lotes con el formato nuevo {precio, cantidad, aviso}
function lotesDesdeForm(){
  const out = {};
  ORDEN_LOTES.forEach(k=>{
    const io = LOTE_INPUTS[k];
    const precio = parseInt(document.getElementById(io.precio).value,10) || 0;
    if(!precio){ out[k] = null; return; }
    const c = document.getElementById(io.cantidad).value.trim();
    out[k] = {
      precio,
      cantidad: c === "" ? null : (parseInt(c,10) || 0),
      aviso: document.getElementById(io.aviso).value.trim()
    };
  });
  return out;
}
function renderEventAdmin(){
  const list = document.getElementById("ev-admin-list");
  const aviso = (!DEMO && !VENTAS_VISTA_OK)
    ? `<p class="err" style="display:block;margin-bottom:14px">⚠️ Falta crear la vista <b>ventas_por_lote</b> en Supabase. Los números de acá abajo son correctos, pero en la página pública los lotes no van a avanzar solos hasta que la crees.</p>`
    : "";
  if(EVENTS.length===0){ list.innerHTML = aviso + `<p style="color:var(--dim);font-size:14px">No hay eventos. Creá el primero abajo.</p>`; return; }
  list.innerHTML = aviso + EVENTS.map(ev=>{
    const la = loteActivo(ev);
    const ventas = ventasDeEvento(ev.nombre);
    const defs = lotesDefinidos(ev);
    // Vendidas sobre el cupo de cada lote, ej: "Early Bird 38/50"
    const detalleVentas = defs.length
      ? defs.map(d=>{
          const v = Number(ventas[d.nombre]) || 0;
          return `${d.nombre} ${v}${d.cantidad != null ? "/" + d.cantidad : ""}`;
        }).join(" · ")
      : `General: ${Number(ventas["General"]) || 0}`;
    return `
    <div class="ev-admin-item">
      <div class="info">
        <b>${esc(ev.nombre)}</b> ${ev.pasado?'<span class="pill" style="border-color:var(--dim);color:var(--dim)">PASADO</span>':''}
        <span>${esc(ev.fecha_texto)} · A la venta: <b style="color:var(--red-soft)">${la.nombre} ${fmt(la.precio)}</b> ${eventoAgotado(ev)?'· AGOTADO':''} ${ev.ubicacion_secreta?'· 📍 secreta':''}</span>
        <span class="lote-counts">Vendidas → ${detalleVentas}</span>
      </div>
      <div class="row-actions">
        <button class="btn ghost" onclick="editEvento(${ev.id})">Editar</button>
        <button class="btn ghost" onclick="deleteEvento(${ev.id})">Borrar</button>
      </div>
    </div>`;}).join("");
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
  ["ev-id","ev-nombre","ev-fecha","ev-puertas","ev-precio","ev-lugar","ev-desc","ev-direccion","ev-foto-url"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("ev-secreta").checked=false;
  document.getElementById("ev-agotado").checked=false;
  ORDEN_LOTES.forEach(k=>{
    const io = LOTE_INPUTS[k];
    document.getElementById(io.precio).value="";
    document.getElementById(io.cantidad).value="";
    document.getElementById(io.aviso).value="";
    document.getElementById(io.vendidas).textContent="";
  });
  document.getElementById("ev-lote-activo").value="general";
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
  document.getElementById("ev-precio").value = ev.precio_general||"";
  document.getElementById("ev-lugar").value = ev.lugar||"";
  document.getElementById("ev-desc").value = ev.descripcion||"";
  document.getElementById("ev-direccion").value = ev.direccion||"";
  document.getElementById("ev-foto-url").value = ev.foto_url||"";
  document.getElementById("ev-secreta").checked = !!ev.ubicacion_secreta;
  document.getElementById("ev-agotado").checked = !!ev.agotado;
  // Precio + cupo de cada lote, y cuántas se vendieron de cada uno
  const ventasEv = ventasDeEvento(ev.nombre);
  ORDEN_LOTES.forEach(k=>{
    const io = LOTE_INPUTS[k], info = loteInfo(ev.lotes, k);
    document.getElementById(io.precio).value = info ? info.precio : "";
    document.getElementById(io.cantidad).value = (info && info.cantidad != null) ? info.cantidad : "";
    document.getElementById(io.aviso).value = info ? (info.aviso || "") : "";
    const v = Number(ventasEv[LOTE_NOMBRES[k]]) || 0;
    document.getElementById(io.vendidas).textContent =
      info ? `Vendidas: ${v}${info.cantidad != null ? "/" + info.cantidad : ""}` : "";
  });
  document.getElementById("ev-lote-activo").value = ev.lote_activo || "general";
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
  const precio = parseInt(document.getElementById("ev-precio").value,10);
  if(!nombre || !precio){ err.textContent="Completá al menos nombre y precio."; err.style.display="block"; return; }

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
      precio_general: precio,
      lugar: document.getElementById("ev-lugar").value.trim(),
      descripcion: document.getElementById("ev-desc").value.trim(),
      direccion: secreta ? null : document.getElementById("ev-direccion").value.trim(),
      ubicacion_secreta: secreta,
      agotado: document.getElementById("ev-agotado").checked,
      lotes: lotesDesdeForm(),
      lote_activo: document.getElementById("ev-lote-activo").value,
      foto_url: fotoUrl,
      arte: "red"
    };
    const id = document.getElementById("ev-id").value;
    const nombreViejo = id ? (EVENTS.find(e=>e.id==id)||{}).nombre : null;
    if(DEMO){
      if(id){ Object.assign(EVENTS.find(e=>e.id==id), data); }
      else { data.id = Date.now(); data.activo=true; EVENTS.push(data); }
    } else {
      if(id){ await dbUpdate("eventos", id, data); }
      else { await dbInsert("eventos", data); }
      if(nombreViejo && nombreViejo !== nombre) await renombrarCompras(nombreViejo, nombre);
      EVENTS = (await dbGet("eventos", "activo=eq.true&order=id.asc")).filter(e=>!e.pasado);
    }
    ok.textContent = id ? "✅ Evento actualizado." : "✅ Evento creado."; ok.style.display="block";
    resetEventoForm(); renderEventAdmin(); loadEvents();
  }catch(e){
    err.textContent = "Error al guardar: " + e.message; err.style.display="block";
  }
  btn.disabled=false; btn.textContent=prevTxt;
}
/* compras.evento guarda el NOMBRE del evento, no el id. Si le cambiás el nombre
   al evento, las compras viejas quedan colgadas del nombre anterior: el conteo
   por lote vuelve a cero y el precio baja al primer lote. Así que al renombrar
   reetiquetamos las compras para que sigan contando. */
async function renombrarCompras(viejo, nuevo){
  const afectadas = PURCHASES.filter(c => c.evento === viejo).length;
  if(!afectadas) return;
  if(!confirm(`Le cambiaste el nombre al evento: "${viejo}" → "${nuevo}".\n\nHay ${afectadas} compra(s) guardadas con el nombre viejo. Si no se actualizan, el conteo de lotes arranca de cero y el precio vuelve al primer lote.\n\n¿Actualizarlas al nombre nuevo? (recomendado)`)) return;
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
    else { await dbDelete("eventos", id); EVENTS = (await dbGet("eventos", "activo=eq.true&order=id.asc")).filter(e=>!e.pasado); }
    renderEventAdmin(); loadEvents();
  }catch(e){ alert("No se pudo borrar: " + e.message); }
}

/* ================== ADMIN: COMPRADORES ================== */
async function loadPurchases(){
  try{
    PURCHASES = DEMO ? DEMO_PURCHASES : await dbGet("compras", "order=creado_en.desc");
  }catch(e){
    document.getElementById("tbody").innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--red);padding:28px">Error cargando compras. Revisá Supabase.</td></tr>`;
    return;
  }
  // En el admin tenemos las compras completas: los conteos por lote salen de acá
  // y no de la vista, así los números son exactos aunque la vista no exista.
  VENTAS_LOTE = ventasLoteDesdePurchases();
  // Poblar los filtros con lo que realmente existe en las compras
  const sel = document.getElementById("f-evento");
  if(sel){
    const actual = sel.value;
    const evs = [...new Set(PURCHASES.map(c=>c.evento).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
    sel.innerHTML = `<option value="">Todos los eventos</option>` + evs.map(e=>`<option value="${esc(e)}"${e===actual?" selected":""}>${esc(e)}</option>`).join("");
  }
  const selLote = document.getElementById("f-lote");
  if(selLote){
    const actual = selLote.value;
    const tipos = [...new Set(PURCHASES.map(c=>c.tipo||"General"))].sort((a,b)=> ordenTipo(a)-ordenTipo(b) || a.localeCompare(b,"es"));
    selLote.innerHTML = `<option value="">Todos los lotes</option>` + tipos.map(t=>`<option value="${esc(t)}"${t===actual?" selected":""}>${esc(t)}</option>`).join("");
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
// Los lotes primero y en orden, después General, y al final cualquier otro
const ORDEN_TIPOS = [...ORDEN_LOTES.map(k=>LOTE_NOMBRES[k]), "General"];
function ordenTipo(t){ const i = ORDEN_TIPOS.indexOf(t); return i < 0 ? 99 : i; }

function filasFiltradas(){
  const q = (document.getElementById("filtro")?.value||"").trim().toLowerCase();
  const fEv  = (document.getElementById("f-evento")?.value)||"";
  const fLot = (document.getElementById("f-lote")?.value)||"";
  const fEst = (document.getElementById("f-estado")?.value)||"";
  const fIng = (document.getElementById("f-ingreso")?.value)||"";
  const fOrd = (document.getElementById("f-orden")?.value)||"recientes";

  let rows = PURCHASES.slice();
  if(q) rows = rows.filter(c =>
    `${c.nombre||""} ${c.apellido||""} ${c.email||""} ${c.codigo||""}`.toLowerCase().includes(q));
  if(fEv)  rows = rows.filter(c => c.evento === fEv);
  if(fLot) rows = rows.filter(c => (c.tipo || "General") === fLot);
  if(fEst) rows = rows.filter(c => (c.estado||"pendiente").toLowerCase() === fEst);
  if(fIng) rows = rows.filter(c => fIng === "si" ? !!c.usada : !c.usada);

  if(fOrd==="antiguos")  rows.sort((a,b)=> new Date(a.creado_en||0) - new Date(b.creado_en||0));
  if(fOrd==="recientes") rows.sort((a,b)=> new Date(b.creado_en||0) - new Date(a.creado_en||0));
  if(fOrd==="nombre")    rows.sort((a,b)=> (a.nombre+" "+a.apellido).localeCompare(b.nombre+" "+b.apellido, "es"));
  if(fOrd==="total")     rows.sort((a,b)=> Number(b.total||0) - Number(a.total||0));
  if(fOrd==="evento")    rows.sort((a,b)=> (a.evento||"").localeCompare(b.evento||"", "es"));
  if(fOrd==="lote")      rows.sort((a,b)=> ordenTipo(a.tipo||"General") - ordenTipo(b.tipo||"General"));
  return rows;
}
function limpiarFiltros(){
  ["filtro","f-evento","f-lote","f-estado","f-ingreso"].forEach(id=>{
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
// Desglose por lote de las filas visibles
function dibujarResumenLotes(rows){
  const tb = document.getElementById("tbody-lotes");
  if(!tb) return;
  const porTipo = {};
  rows.filter(esAprobada).forEach(c=>{
    const t = c.tipo || "General";
    (porTipo[t] = porTipo[t] || []).push(c);
  });
  const tipos = Object.keys(porTipo).sort((a,b)=> ordenTipo(a) - ordenTipo(b) || a.localeCompare(b,"es"));
  tb.innerHTML = tipos.map(t=>{
    const s = totales(porTipo[t]);
    return `<tr>
      <td><b>${esc(t)}</b></td>
      <td>${s.entradas}</td>
      <td>${s.compradores}</td>
      <td><b style="color:var(--red-soft)">${fmt(s.recaudado)}</b></td>
    </tr>`;
  }).join("") || `<tr><td colspan="4" style="text-align:center;color:var(--dim);padding:20px">Sin ventas aprobadas con estos filtros</td></tr>`;

  const tf = document.getElementById("tfoot-lotes");
  if(tf){
    const s = totales(rows);
    tf.innerHTML = tipos.length ? `<tr>
      <td><b>Total</b></td><td><b>${s.entradas}</b></td><td><b>${s.compradores}</b></td>
      <td><b style="color:var(--red-soft)">${fmt(s.recaudado)}</b></td></tr>` : "";
  }
}
function drawAdmin(){
  const rows = filasFiltradas();
  document.getElementById("tbody").innerHTML = rows.map((c,i)=>`
    <tr>
      <td style="color:var(--dim)">${i+1}</td>
      <td style="color:var(--dim);font-family:'Space Mono',monospace;font-size:12px">${c.creado_en ? new Date(c.creado_en).toLocaleString("es-AR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—"}</td>
      <td>${esc(c.nombre)}</td><td>${esc(c.apellido)}</td><td>${esc(c.evento)}</td>
      <td>${esc(c.tipo || "General")}</td>
      <td>${fmt(c.total)}</td>
      <td>${estadoPill(c.estado)}</td>
      <td>${c.usada ? '<span class="pill" style="border-color:#22c55e;color:#22c55e">Sí</span>' : '<span style="color:var(--dim2)">—</span>'}</td>
      <td style="font-family:'Space Mono',monospace;font-size:12px">${esc(c.codigo)}</td>
    </tr>`).join("") || `<tr><td colspan="10" style="text-align:center;color:var(--dim);padding:28px">Sin compras con estos filtros</td></tr>`;

  dibujarResumenLotes(rows);

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
      + ` · <b>${s.entradas}</b> aprobadas · <b>${s.compradores}</b> compradores · recaudado <b style="color:var(--red-soft)">${fmt(s.recaudado)}</b>`
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
    alert("✅ Compras pendientes borradas.");
    loadPurchases();
  }catch(e){ alert("Error de conexión: " + e.message); }
}

// Los campos pueden traer comas (nombres de evento, sobre todo): van entre comillas
const csvCampo = v => `"${(v==null?"":String(v)).replace(/"/g,'""')}"`;
function exportCSV(){
  const rows = filasFiltradas();  // exporta lo mismo que ves en pantalla
  const head = "Fecha,Nombre,Apellido,Email,Evento,Lote,Precio,Estado,Ingreso,Codigo\n";
  const body = rows.map(c=>[
    c.creado_en||"", c.nombre, c.apellido, c.email||"", c.evento, c.tipo||"General",
    c.total, c.estado||"pendiente", c.usada ? "si" : "no", c.codigo
  ].map(csvCampo).join(",")).join("\n");
  const blob = new Blob(["﻿"+head+body],{type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "compradores-torinos.csv"; a.click();
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
      <td style="color:var(--dim)">${i+1}</td>
      <td style="color:var(--dim);font-size:12px">${u.creado_en ? new Date(u.creado_en).toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"2-digit"}) : "—"}</td>
      <td>${esc(u.nombre||"—")}</td><td>${esc(u.apellido||"—")}</td>
      <td>${esc(u.telefono||"—")}</td><td style="font-size:13px">${esc(u.email||"—")}</td>
      <td>${botonStaff(u.email)}</td>
    </tr>`).join("") || `<tr><td colspan="7" style="text-align:center;color:var(--dim);padding:28px">Sin usuarios registrados todavía</td></tr>`;
}
function exportUsuariosCSV(){
  const head = "Registrado,Nombre,Apellido,Telefono,Email\n";
  const body = USUARIOS.map(u=>`${u.creado_en||""},${u.nombre||""},${u.apellido||""},${u.telefono||""},${u.email||""}`).join("\n");
  const blob = new Blob([head+body],{type:"text/csv"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "usuarios-torinos.csv"; a.click();
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
      alert("✅ Listo. " + email + " ya puede entrar a /admin con su cuenta y usar el escáner.");
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
    </div>`).join("") || `<p style="color:var(--dim);font-size:14px">Todavía no agregaste a nadie al equipo.</p>`;
}
async function agregarStaff(){
  const ok = document.getElementById("staff-ok"), err = document.getElementById("staff-err");
  ok.style.display="none"; err.style.display="none";
  const email = document.getElementById("staff-email").value.trim().toLowerCase();
  if(!email || !email.includes("@")){ err.textContent="Poné un email válido."; err.style.display="block"; return; }
  try{
    await dbInsert("staff", { email });
    ok.textContent = "✅ Agregado. Esa persona ya puede entrar al panel (tiene que crearse una cuenta en la página con ese email si no la tiene)."; ok.style.display="block";
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
  }).join("") || `<p style="color:var(--dim);font-size:14px;padding:14px 0">${VENDIDAS.length ? "Nadie coincide con esa búsqueda." : "No hay entradas vendidas todavía."}</p>`;
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
    alert(`✅ Lista lista: ${filas.length} entrada(s) guardadas en este celular.\n\nYa podés escanear aunque te quedes sin señal.`);
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
      : `✅ Se subieron los ${subidos} ingreso(s) que estaban guardados.`);
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
      ok.textContent = "✅ Cuenta creada. Revisá tu email para confirmarla y después iniciá sesión.";
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
    ok.textContent = `✅ Listo. Si ${email} tiene cuenta, te llega un mail con el link para cambiar la contraseña. Revisá también el correo no deseado.`;
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
    ok.textContent = "✅ Contraseña cambiada. Ya podés usarla."; ok.style.display="block";
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
    ok.textContent="✅ Teléfono guardado."; ok.style.display="block";
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
    </div>`).join("") || `<p style="color:var(--dim);font-size:14px">Todavía no cargaste eventos pasados.</p>`;
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
      precio_general: 0,
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
    ok.textContent = id ? "✅ Evento pasado actualizado." : "✅ Evento pasado creado."; ok.style.display="block";
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
        <span style="color:var(--dim);font-size:13px">${esc(ev.fecha_texto||"")}</span>
        <button class="btn ghost" style="width:100%;margin-top:10px" onclick="openPasado(${ev.id})">Ver evento</button>
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
  document.getElementById("d-meta").innerHTML =
    `${ev.fecha_texto?`<span>📅 <b>${esc(ev.fecha_texto)}</b></span>`:""}
     ${ev.lugar?`<span>📍 <b>${esc(ev.lugar)}</b></span>`:""}
     <span>✅ <b>Evento finalizado</b></span>`;

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

  document.getElementById("d-desc").textContent = ev.descripcion || "";

  // Evento pasado: sin tarjeta de compra
  const buyCard = document.querySelector(".d-buy-card");
  if(buyCard) buyCard.style.display = "none";

  // Ubicación
  const loc = document.getElementById("d-location");
  if(ev.direccion){
    const q = encodeURIComponent(ev.direccion);
    loc.innerHTML = `<p style="color:#c7c7cd;margin-bottom:12px;font-size:13px">📍 ${esc(ev.direccion)}</p>
      <div class="map-wrap"><iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${q}&output=embed"></iframe></div>`;
  } else {
    loc.innerHTML = `<p style="color:var(--dim)">${esc(ev.lugar||"")}</p>`;
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
    await cargarVentasLote();   // los precios dependen de cuántas se vendieron
    await loadEvents();
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
    await cargarVentasLote();   // deja VENTAS_VISTA_OK para el aviso del panel
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
        av.style.cssText = "background:rgba(225,6,0,.1);border:1px solid rgba(225,6,0,.4);color:var(--white);padding:12px 16px;border-radius:12px;font-size:14px;margin-bottom:18px";
        av.textContent = "🎟️ Ingresá o creá tu cuenta para completar la compra de tus entradas.";
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
