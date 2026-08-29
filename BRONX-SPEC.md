# BRONX SOCIAL CLUB — Especificación del proyecto

> Documento para pasarle a Claude Code al iniciar el proyecto.
> Base: el código de la ticketera torino (mismo stack), adaptado a un boliche.

---

## 1. El cliente

**Bronx Social Club** — boliche de Bahía Blanca, funcionando desde 2017.

- Dirección: Casanova 888, Bahía Blanca
- Instagram: @bronx.socialclub — 66.600 seguidores
- Dueño: Nano Rabbione
- Contacto: bronxcerveceria@outlook.com · +54 291 566-9812
- Reservas de cena por WhatsApp: wa.me/5492915275187

**Programación fija semanal:**
- Jueves — PICANTE
- Sábado — CACHENGUE ES DE BRONX
- Horarios: Cena 22hs · Previa 00hs · Cachengue 01:30hs · cierre 06:00

**Hoy venden con FlashPass.** El objetivo es reemplazarlo.

---

## 2. Identidad visual

- Fondo negro / muy oscuro
- Color de marca: **degradado de rosa/coral a naranja**, de izquierda a derecha:
  `#F4526B` → `#F58C29`. No es un color plano.
  En CSS: `linear-gradient(90deg, #F4526B, #F58C29)` para el logo y los acentos.
  Para elementos chicos usar el naranja `#F58C29` sólido.
- Logo: "BRONX" en naranja con la N estilizada + "SOCIAL CLUB" chico abajo
- Fotos de eventos con luces azules, magenta y naranja
- Estética: nocturna, urbana, alto contraste

---

## 3. LO MÁS IMPORTANTE: cambio de arquitectura

El sistema de torino vende con **lotes secuenciales**: hay un solo lote activo por
evento y cuando se agota pasa al siguiente.

**Bronx necesita lo contrario: varios tipos de ticket disponibles al mismo tiempo.**

Ejemplo real de un sábado suyo:

| Ticket | Precio | Detalle |
|---|---|---|
| LA TERRAZA - PREVIA DE AMIGOS | $17.000 | Acceso exclusivo terrazas. Barra libre 00:30 a 02:30 |
| GENERAL + CONSUMICIÓN H/02AM | $8.000 | Válido desde 23:30 hasta 02:00 |
| ACCESO LIBERADO H/01.30AM | Gratis | Sin cargo, válido de 23:30 a 01:30 |
| GENERAL 1 | $8.000 | Desde 23:30, sin límite de horario |
| GENERAL 2 | $10.000 | Desde 23:30, sin límite de horario |

Y aparte, una sección de **COMBOS**:

| Combo | Precio |
|---|---|
| 5 ACCESOS + BOTELLA DE FERNET (Branca 1L con Coca) | $115.000 |
| 5 ACCESOS + BOTELLA SERNOVA C/SPEED (4 latas) | $95.000 |
| 5 ACCESOS + BOTELLA SPIRITO BLU (gin con tónica) | $95.000 |

### Qué hay que rehacer

Reemplazar el sistema de lotes (`lotes` jsonb + `lote_activo`) por una tabla
**`tipos_ticket`** con un registro por tipo, con estos campos:

- `evento_id` (FK)
- `nombre` — ej. "GENERAL 1", "LA TERRAZA - PREVIA DE AMIGOS"
- `descripcion` — el texto explicativo que se ve bajo el nombre
- `precio` — puede ser 0 (tickets gratis)
- `cantidad` — cupo de ese tipo (null = sin límite)
- `orden` — para ordenarlos en la página
- `categoria` — 'ticket' o 'combo' (se muestran en secciones separadas)
- `accesos` — cuántas personas entran con ese ticket (1 normalmente, 5 en los combos)
- `activo` — booleano
- `oculto` — booleano (ver punto 4)
- `valido_desde` / `valido_hasta` — texto libre, ej. "23:30" y "02:00"

En la página del evento se listan todos los tipos activos con su selector de
cantidad, agrupados: primero TICKETS, después COMBOS.

**Importante para el escáner:** si un ticket tiene `accesos = 5`, al escanearlo
tienen que entrar 5 personas. Hay que resolver si se generan 5 QR o un QR con
contador de usos.

---

## 4. Otras funciones que Bronx usa hoy y hay que replicar

**Tickets ocultos.** FlashPass tiene "Desbloqueá tickets ocultos" con un código.
Sirve para vender entradas VIP o de prensa solo a quien tiene el código.
→ Campo `oculto` en `tipos_ticket` + un input de código en la página del evento.

**Tickets gratis.** El "ACCESO LIBERADO" sale $0 pero igual genera QR y se escanea
en la puerta (les sirve para contar cuánta gente entró liberada).
→ Si el precio es 0, saltear Mercado Pago y generar la entrada directamente.

**Validez horaria por ticket.** Cada tipo dice desde y hasta qué hora sirve.
→ Mostrarlo en la descripción y que el escáner lo muestre al validar.

**Edad mínima.** Los eventos de Bronx son +18 y lo muestran en la página.
→ Campo `edad_minima` en la tabla eventos.

**Eventos recurrentes.** Hacen dos eventos por semana, todas las semanas.
Cargar cada uno a mano es inviable.
→ Función "duplicar evento" en el admin: copia el evento con todos sus tipos de
ticket y solo hay que cambiar la fecha y el flyer.

---

## 5. Lo que NO cambia (se mantiene igual que en torino)

- Stack: HTML/CSS/JS multipágina + Supabase + Mercado Pago + Resend + Cloudflare
- Compra con sesión obligatoria (login/registro + Google)
- QR por entrada, email automático al aprobarse el pago
- Escáner de QR con marcado de usada y persistencia en base
- Roles: admin / socio / escáner
- Panel con estadísticas, compradores, filtros y CSV
- Eventos pasados con galería
- Costo de servicio configurable

---

## 6. Infraestructura NUEVA (no reutilizar la de torino)

Crear desde cero:

1. **Proyecto de Supabase propio** (correr todos los SQL del proyecto torino,
   más el nuevo de `tipos_ticket`)
2. **Repositorio de GitHub propio**
3. **Deploy propio en Cloudflare**
4. **Credenciales de Mercado Pago DE BRONX** en los secrets
   (`MP_ACCESS_TOKEN`) — la recaudación entra a la cuenta de ellos, no a la de
   torino
5. `ADMIN_EMAIL` = el mail del dueño de Bronx

En `js/app.js` dejar las constantes `SUPABASE_URL`, `SUPABASE_KEY` y
`ADMIN_EMAIL` vacías con un comentario indicando que van las del proyecto nuevo.

---

## 7. Orden de trabajo sugerido

1. Clonar el proyecto de torino y cambiar toda la marca (logo, colores, textos)
2. Crear la tabla `tipos_ticket` y migrar la lógica de lotes a tipos múltiples
3. Rehacer la página del evento con la lista de tickets + combos
4. Adaptar el flujo de compra para varios tipos en un mismo carrito
5. Tickets gratis (saltear MP)
6. Tickets ocultos con código
7. Duplicar evento (para los eventos semanales)
8. Adaptar el escáner a tickets multi-acceso

---

## 8. Datos comerciales confirmados

- **FlashPass les cobra 15% de servicio**, y lo paga el comprador, no Bronx.
  Bronx recibe lo mismo con cualquier ticketera.
- **Objetivo de torino: 10% de servicio.** La entrada le sale más barata al
  público de Bronx y Bronx gana igual.
- **No venden mesas ni reservados.** No hace falta esa funcionalidad.
- La app de Bronx en Google Play está **inhabilitada**.
- El contacto es **Nano Rabbione** (dueño), hermano de un amigo del desarrollador.

## 9. Decisiones tomadas (no consultar, implementar así)

**Combos con botella:** el combo de 5 accesos genera **5 QR de entrada** +
**1 QR de vale de botella** que se escanea aparte en la barra al retirarla.
El vale queda marcado como usado para que no se pida dos veces.

**Tickets ocultos:** cada tipo de ticket puede tener un `codigo_acceso`. En la
página del evento hay un campo "Tengo un código"; al ingresarlo aparecen los
tickets ocultos que coincidan.

**Pendiente de confirmar en la reunión:** capacidad del local.

---

## 10. Flujo de compra de FlashPass (hay que igualarlo o mejorarlo)

Relevado del sistema real. Son 4 pasos con barra de progreso arriba:

**Paso 1 — Revisá tu orden**
Resumen de lo que eligió: `1x ACCESO LIBERADO...`, costo de items, cargo por
servicio y total.

**Paso 2 — Comprador** (datos de quien compra)
- Nombre y Apellido (separados)
- Tipo de documento (select: DNI, etc.)
- Nro de Documento
- Email + **Confirmar Email** (campo repetido)
- Teléfono con selector de país (bandera)
- País y Provincia (selects)

**Paso 3 — Tickets** (datos de cada asistente, uno por entrada)
- Nombre Completo
- **DNI/CI** ← las entradas son NOMINADAS con documento

**Paso 4 — Confirmación**
- Tilde verde grande, "¡Operación exitosa!"
- "Tu orden #2419464 ha sido confirmada"
- Lista de los tickets comprados
- Bloque "Información importante"

**Login:** email + contraseña, con "¿Olvidaste tu contraseña?", más botones de
**Google y Apple**.

### Dato clave sobre la entrega de los tickets

FlashPass avisa: *"Tus tickets se enviarán a tu correo electrónico 3 horas antes
del evento por motivos de seguridad"*. Es una medida antirreventa.

→ Implementar como **opción configurable por evento**: entrega inmediata (default)
o entrega diferida X horas antes. Así Bronx elige. La entrega inmediata es una
ventaja competitiva para el que compra; la diferida es más segura para el
organizador.

También avisan: *"Recuerda llevar una identificación válida para ingresar"* —
en la puerta cruzan el QR con el DNI.

### Qué falta en el sistema actual de torino

- Pedir **DNI por asistente** (hoy solo nombre y apellido)
- Tipo de documento, país y provincia en los datos del comprador
- **Confirmar email** (evita que se equivoquen y no les llegue la entrada)
- **Número de orden** visible al confirmar
- Checkout **por pasos** con barra de progreso (hoy es un modal único)
- Login con **Apple** además de Google
- Checkbox de **términos y condiciones**
- Pantalla de confirmación con el detalle de los tickets

### Oportunidad de mejora sobre FlashPass

El checkout de 4 pasos es largo. Si en torino se resuelve en 2 pasos bien hechos
(datos + confirmación), con los campos autocompletados del usuario logueado, la
compra es más rápida y eso se nota en la conversión. Es un argumento de venta
concreto para Nano.
