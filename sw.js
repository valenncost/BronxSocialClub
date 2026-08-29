/* Service worker del escáner.
   Guarda en el celular lo que la puerta necesita para arrancar sin internet:
   la página, los estilos, el código y la librería del lector de QR.
   Los datos de las entradas NO pasan por acá — de eso se ocupa la lista que
   se descarga desde el escáner y vive en el navegador.

   Estrategia: se sirve lo guardado al instante y en paralelo se busca la
   versión nueva para la próxima vez. En la puerta importa que abra rápido y
   que abra siempre, aunque el celular no tenga señal. */

const VERSION = "bronx-escaner-v1";
const LECTOR_QR = "https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js";

const ESENCIALES = [
  "/escaner",
  "/css/estilos.css",
  "/js/app.js",
  "/iconos/icono-192.png",
  "/manifest.webmanifest",
  LECTOR_QR
];

self.addEventListener("install", e=>{
  e.waitUntil((async ()=>{
    const cache = await caches.open(VERSION);
    // Uno por uno: si falla alguno, que no se caiga la instalación entera
    await Promise.all(ESENCIALES.map(u => cache.add(new Request(u, {cache:"reload"})).catch(()=>{})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e=>{
  e.waitUntil((async ()=>{
    const viejas = (await caches.keys()).filter(k => k !== VERSION);
    await Promise.all(viejas.map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e=>{
  const req = e.request;
  if(req.method !== "GET") return;

  const url = new URL(req.url);
  const mismoOrigen = url.origin === self.location.origin;
  const esLector = req.url === LECTOR_QR;
  if(!mismoOrigen && !esLector) return;   // Supabase y demás van derecho a la red

  // Nunca cachear las llamadas a la base: los datos tienen que ser los de ahora
  if(mismoOrigen && (url.pathname.startsWith("/rest/") || url.pathname.startsWith("/auth/"))) return;

  e.respondWith((async ()=>{
    const cache = await caches.open(VERSION);
    const guardado = await cache.match(req, {ignoreSearch:true});

    const red = fetch(req).then(res=>{
      if(res && res.ok && (res.type === "basic" || res.type === "cors")) cache.put(req, res.clone()).catch(()=>{});
      return res;
    }).catch(()=> null);

    // Lo guardado primero: abre al toque y funciona sin señal.
    // waitUntil mantiene vivo el worker hasta que baje la versión nueva.
    if(guardado){ e.waitUntil(red); return guardado; }

    const res = await red;
    if(res) return res;

    // Sin señal y sin copia: al menos devolvemos la página del escáner si la tenemos
    if(req.mode === "navigate"){
      const escaner = await cache.match("/escaner", {ignoreSearch:true});
      if(escaner) return escaner;
    }
    return new Response("Sin conexión y sin copia guardada.", {
      status: 503, headers: {"Content-Type":"text/plain; charset=utf-8"}
    });
  })());
});
