# SQL de Bronx Social Club

Todo lo que hay que correr en el proyecto de Supabase de Bronx, **en este orden**,
desde el SQL Editor:

| # | Archivo | Qué hace |
|---|---|---|
| 1 | `01-tablas.sql` | Tablas base: `eventos`, `tipos_ticket`, `compras`, `perfiles`, `staff`, `galeria` + el trigger que crea el perfil al registrarse |
| 2 | `02-rls.sql` | Row Level Security: quién puede leer y escribir cada tabla |
| 3 | `03-vistas.sql` | La vista `ventas_por_tipo` (conteo de vendidas, lo único de `compras` que puede leer el público) |
| 4 | `04-storage.sql` | El bucket `fotos` (portadas de eventos y galería) y sus permisos |

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

En `02-rls.sql` está la función `es_admin()` con el mail del administrador
**escrito a mano**. Tiene que ser el mismo que la constante `ADMIN_EMAIL` de
`js/app.js`. Hoy los dos apuntan al mail del desarrollador; antes de entregarle
el sistema a Bronx hay que poner el de Nano Rabbione **en los dos lados**:

- `js/app.js` → `const ADMIN_EMAIL = "..."` (decide qué se ve en el panel)
- `02-rls.sql` → `es_admin()` (decide qué se puede escribir de verdad)

Si solo cambiás uno, o el panel se ve vacío o alguien ve botones que no funcionan.

## Cómo quedan los precios (cambió respecto de torino)

En torino el precio vivía en el evento (`precio_general` + un jsonb `lotes` con
lotes secuenciales que avanzaban solos). **Acá no existe nada de eso.** Cada
evento tiene N filas en `tipos_ticket`, todas a la venta al mismo tiempo, y el
precio del evento es el más barato de los tipos que todavía tienen cupo.

Por eso `eventos` no tiene `precio_general`, `lotes` ni `lote_activo`.

## Lo que todavía no está y va a necesitar SQL nuevo

- **Tickets ocultos**: la columna `oculto` y `codigo_acceso` ya están en
  `tipos_ticket`, pero la policy pública los esconde y no hay forma de
  desbloquearlos. Cuando se implemente hace falta una función RPC que reciba el
  código y devuelva los tipos que coinciden (no se puede resolver con una policy
  sola sin filtrar el código al cliente).
- **Vale de botella de los combos**: va a necesitar su propia tabla o una
  columna de tipo en `compras`.
- **Entrega diferida** de las entradas (X horas antes del evento): columna en
  `eventos` + un cron que dispare los mails.
</content>
</invoke>
