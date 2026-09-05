# SQL de Bronx Social Club

Todo lo que hay que correr en el proyecto de Supabase de Bronx, **en este orden**,
desde el SQL Editor:

| # | Archivo | Qué hace |
|---|---|---|
| 1 | `01-tablas.sql` | Tablas base: `eventos`, `tipos_ticket`, `compras`, `perfiles`, `staff`, `galeria` + el trigger que crea el perfil al registrarse |
| 2 | `02-rls.sql` | Row Level Security: quién puede leer y escribir cada tabla |
| 3 | `03-vistas.sql` | La vista `ventas_por_tipo` (conteo de vendidas, lo único de `compras` que puede leer el público) |
| 4 | `04-storage.sql` | El bucket `fotos` (portadas de eventos y galería) y sus permisos |
| 5 | `roles-equipo.sql` | Roles del equipo: tablas `colaboradores` y `colaborador_rol` + las policies de cada rol. **Redefine `es_admin()` y `es_staff()`** de `02-rls.sql`, así que va siempre después |
| 6 | `evento-vistas.sql` | Tabla `evento_vistas` (visitas a la página de cada evento) para el KPI "Vistas" y el gráfico de Analytics del Studio. Usa `es_encargado()`, así que va después de `roles-equipo.sql` |
| 7 | `cortesias.sql` | Columna `compras.origen` (`venta`/`cortesia`) + la policy que deja al organizador y a los encargados emitir entradas de invitación desde el Studio. También usa `es_encargado()` |
| 8 | `lotes.sql` | **Lotes**: tabla `lotes`, la vista `lotes_publicos`, `compras.lote_id`/`lote` y la migración de lo que ya estaba cargado. Deja `tipos_ticket` sin uso. Usa `es_escaner()` y `es_encargado()`, así que va después de `roles-equipo.sql` |

Se pueden correr de nuevo sin romper nada: todo es `create ... if not exists` /
`create or replace` / `drop policy if exists`.

### Parches sueltos

Van después de los cuatro de arriba, en cualquier orden. Ya están incluidos en
`01-tablas.sql`, así que en una base nueva no hace falta correrlos; son para
bases que ya existían antes del cambio.

| Archivo | Qué hace |
|---|---|
| `color-evento.sql` | Agrega `eventos.color_acento` (el color de acento propio de cada evento) |
| `patrocinadores.sql` | Tabla `patrocinadores` (fila de logos en la portada, debajo de los eventos) |
| `checkout.sql` | Checkout de 4 pasos: datos de comprador/asistente y `user_id` en `compras`, policy de alta para invitados, y la tabla `cupones` (vacía a propósito) |

## Antes de correrlos: cambiar el mail del admin

La función `es_admin()` tiene el mail del administrador **escrito a mano**. Tiene
que ser el mismo que la constante `ADMIN_EMAIL` de `js/app.js`. Hoy los dos
apuntan al mail del desarrollador; antes de entregarle el sistema a Bronx hay que
poner el de Nano Rabbione **en los tres lados**:

- `js/app.js` → `const ADMIN_EMAIL = "..."` (decide qué se ve en el panel)
- `roles-equipo.sql` → `es_admin()` (la versión vigente, decide qué se puede escribir de verdad)
- `02-rls.sql` → `es_admin()` (la versión vieja, para que una base nueva no quede con el mail del desarrollador antes de llegar al paso 5)

Si solo cambiás uno, o el panel se ve vacío o alguien ve botones que no funcionan.

Ese mail es admin **aunque no esté en `colaboradores`**: es el bootstrap para que
el dueño no pueda quedarse afuera de su propio panel por un borrado en la tabla.

## Roles del equipo

Desde `roles-equipo.sql` el acceso al Studio sale de dos tablas:

- `colaboradores` — quién es cada persona del equipo (por email, el mismo con el
  que se registra en la página), con `activo` para darla de baja sin borrar nada.
- `colaborador_rol` — qué rol tiene y sobre qué evento. `evento_id` en NULL
  significa **todos los eventos**; con un id, ese rol vale sólo para ese evento.

| Rol (valor guardado) | Se muestra como | Puede |
|---|---|---|
| `admin` | **Organizador** | Todo el Studio, incluida la pantalla de Equipo y la configuración |
| `encargado` | Encargado | Ver y editar eventos (los de su alcance) + compradores y analytics, y emitir cortesías. No gestiona roles ni configuración sensible |
| `escaner` | Escáner | Sólo escanear QR en la puerta (leer `compras` y marcarlas usadas) |

⚠️ El rol `admin` **se llama "Organizador" en la interfaz** pero el valor guardado
sigue siendo `admin`: renombrarlo obligaría a migrar `colaborador_rol`, su check
constraint y `es_admin()` sin ganar nada. El nombre visible vive en un solo lugar,
`ROLES[x].titulo` de `js/app.js`.

La tabla vieja `staff` **queda en la base pero ya no la lee nadie**: sus emails se
migran a `colaboradores` con rol `escaner` global la primera vez que se corre
`roles-equipo.sql`. `es_staff()` ahora significa "tiene algún rol en el Studio".

## Cómo quedan los precios

**Un evento vende UNA entrada**, y todo lo que la define vive en `lotes`: la
secuencia de etapas del evento (Early Bird, Lote 1, Lote 2, ...), **cada una
con su nombre, su precio y su cupo**. No hay tipos de ticket, ni categorías,
ni combos.

El **lote vigente es el primero por orden que todavía tenga cupo**. Cuando se
llena, el siguiente pasa a ser el vigente sin que nadie toque nada: no hay
ningún flag "activo" que mantener ni ningún cron. Si no queda ninguno con cupo,
el evento se queda sin entradas. Todo eso lo resuelve la vista `lotes_publicos`
(columna `vigente`).

`cupo` en NULL = sin límite: ese lote no se agota nunca y los que vengan
después quedan inalcanzables. Es lo correcto para el último de la fila; el
Studio no te deja guardarlo en el medio.

`aviso_ultimas` es el umbral del cartel **"¡Quedan las últimas N!"** de la
página del evento: NULL = no mostrarlo nunca, un número = mostrarlo cuando
resten esa cantidad o menos. Lo decide el organizador lote por lote — no es
automático.

Cada fila de `compras` guarda el **nombre** del lote en `tipo` (es lo que
muestran el escáner y "Mis Entradas") y su id en `lote_id`, que es de donde
sale el conteo del cupo. `tipo_ticket_id` queda siempre en NULL.

⚠️ **`tipos_ticket` quedó sin uso.** No se borró porque las compras viejas la
referencian por `tipo_ticket_id`, pero la aplicación no la lee ni la escribe
más — igual que `staff`.

La escalera **es pública**: la página del evento muestra todos los lotes con su
precio, el vigente marcado "en venta" y los siguientes "próximamente". Por eso
`lotes_publicos` devuelve la secuencia entera. La tabla en crudo igual queda
detrás de la vista, porque la vista es la que puede contar `compras` sin que el
visitante pueda leerlas.

`eventos` sigue sin tener `precio_general`, `lotes` ni `lote_activo` (el jsonb
de torino): la secuencia es una tabla de verdad, no una columna.

## Lo que todavía no está y va a necesitar SQL nuevo

- **Tickets ocultos** y **combos con vale de botella**: se fueron junto con los
  tipos de ticket. Si vuelven hay que repensarlos sobre el modelo de lotes, no
  reactivar las columnas viejas de `tipos_ticket`.
- **Entrega diferida** de las entradas (X horas antes del evento): columna en
  `eventos` + un cron que dispare los mails.
</content>
</invoke>
