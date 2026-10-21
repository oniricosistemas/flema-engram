# Flema Engram para OpenCode

[![CI](https://github.com/oniricosistemas/flema-engram/actions/workflows/ci.yml/badge.svg)](https://github.com/oniricosistemas/flema-engram/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/opencode-flema-engram-sidebar?logo=npm)](https://www.npmjs.com/package/opencode-flema-engram-sidebar)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/github/license/oniricosistemas/flema-engram)](https://github.com/oniricosistemas/flema-engram/blob/main/LICENSE)

Un sidebar local y de solo lectura que mantiene visible el contexto reciente de
[Engram](https://github.com/Gentleman-Programming/engram) mientras trabajás dentro de OpenCode.

La canción **“Y aún yo te recuerdo”** inspiró artísticamente la idea central: que la
última memoria guardada siga presente en el contexto de desarrollo. Esta referencia
es un homenaje a esa inspiración; no implica afiliación, patrocinio ni titularidad
sobre la obra.

> **English summary:** Flema Engram is a local-first, read-only OpenCode
> plugin/sidebar that surfaces Engram health, project context, recent memories,
> blockers, and ODD task progress by default. An MCP stdio adapter is included only as an optional
> integration path.

## Inicio rápido

### Requisitos

| Componente | Requisito |
| --- | --- |
| Node.js | 22 o posterior |
| OpenCode | 1.18.25 o posterior |
| Engram | Servicio HTTP local activo en `http://127.0.0.1:7437` (o accesible vía red en `<host>:7437` cuando se usa `opencode attach`) |
| Proyecto | Alguna observación o sesión reciente que permita validar el nombre |

### 1. Registrá el sidebar en `tui.json`

Configuración mínima:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["opencode-flema-engram-sidebar@0.1.8"]
}
```

Fijá una versión exacta. OpenCode 1.18.x conserva paquetes npm en caché y una entrada
sin versión o con `@latest` puede seguir resolviendo una release anterior después de
que npm publique otra. El plugin no puede actualizarse a sí mismo porque OpenCode lo
resuelve e importa antes de ejecutar su código.

Para ubicar el archivo global, ejecutá `opencode debug paths` y abrí `tui.json` dentro
de la ruta `config`. Una vez guardado, cerrá completamente OpenCode y abrí un proceso
nuevo para que el plugin se cargue.

#### Actualizar a una nueva release

Consultá primero la versión publicada:

```sh
npm view opencode-flema-engram-sidebar dist-tags.latest \
  --registry=https://registry.npmjs.org/
```

Luego instalá esa versión exacta —reemplazá `<version>` por el valor anterior—:

```sh
opencode plugin opencode-flema-engram-sidebar@<version> --force --global
```

Este paso actualiza el `tui.json` global y prepara un wrapper de caché específico. No
hay una actualización automática confiable en OpenCode 1.18.x: para despliegues
reproducibles, repetí este comando de forma explícita con cada release.

#### Usando `opencode attach`
Si vas a conectarte a una instancia remota de OpenCode mediante `opencode attach <url>`, el plugin funcionará siempre que:
- El servicio Engram en la máquina remota sea accesible en el puerto 7437 (por defecto solo escucha en 127.0.0.1; se recomienda crear un puente TCP como se describe en los documentos internos o usar `engram-bridge.service`).
- Usá una versión exacta del plugin y actualizala explícitamente; `opencode attach` puede reutilizar una copia npm ya resuelta en la caché local.
- La detección automática usa el host recibido por `opencode attach`; si el puente de Engram usa otra URL, configurá `baseUrl` explícitamente en `tui.json`.
- Verás en el sidebar la línea `🔌 Target: Local=<host>:7437 | Cloud=<URL>` para confirmar a qué endpoints se está conectando.

### 2. Iniciá Engram y abrí OpenCode en tu proyecto

El sidebar hace una carga inicial, vuelve a consultar cada 30 segundos de forma
predeterminada y permite refrescar manualmente con <kbd>Alt</kbd>+<kbd>R</kbd>.

## Qué es — y qué no es

| Sí es | No es |
| --- | --- |
| Un plugin para el slot `sidebar_content` de OpenCode | Una TUI independiente |
| Una vista local y de solo lectura sobre Engram | Un reemplazo de Engram |
| Project context, activity, and ODD task progress | A memory editor or manager |
| Un cliente del HTTP local de Engram | Un servicio cloud o de sincronización |
| Un paquete con un adaptador MCP stdio opcional | Un producto centrado en MCP |

El sidebar es el producto principal. El comando MCP existe para integraciones
avanzadas y puede ignorarse por completo al usar el plugin de OpenCode.

## Cómo funciona

1. OpenCode carga el export raíz de `opencode-flema-engram-sidebar`.
2. El plugin resuelve un candidato de proyecto, lo prueba primero con una consulta
   acotada por proyecto y conserva la enumeración reciente como fallback.
3. Consulta en paralelo salud, proyectos y observaciones del proyecto.
4. Derives ODD task state from canonical `odd/<feature>/tasks` mirrors, orders
   recent activity by update time, and recognizes explicit blockers.
5. Renderiza texto dentro del sidebar de la sesión visible y conserva datos útiles
   como `STALE` si una actualización posterior queda incompleta.

Las llamadas usan exclusivamente `GET` contra el Engram local. El plugin no guarda,
edita ni elimina memorias.

### Endpoints utilizados

| Propósito | Endpoint local |
| --- | --- |
| Salud | `GET /health` |
| Observaciones | `GET /observations/recent` |
| Sesiones para derivar proyectos | `GET /sessions/recent` |

El adaptador local y los guards de cada etapa usan un timeout de 5 segundos, salvo
que `timeoutMs` configure otro presupuesto común. Para mantener la vista acotada, el
sidebar solicita hasta 20 observaciones del proyecto; si la respuesta filtrada está
vacía o mezcla proyectos, usa una consulta sin filtro de hasta 100 registros y aplica
una coincidencia exacta local.

## Configuración

### Opciones soportadas por el plugin

Usá la forma `[plugin, options]` solamente cuando necesites opciones:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "opencode-flema-engram-sidebar@0.1.8",
      {
        "enabled": true,
        "project": "mi-proyecto",
        "pollInterval": 30000,
        "baseUrl": "http://127.0.0.1:7437",
        "timeoutMs": 5000
      }
    ]
  ]
}
```

| Opción | Tipo | Comportamiento |
| --- | --- | --- |
| `enabled` | `boolean` | `false` evita que el plugin registre el sidebar. Por defecto está habilitado. |
| `project` | `string` | Nombre exacto de proyecto Engram. Tiene la prioridad más alta. |
| `pollInterval` | `number` | Intervalo automático en milisegundos; debe ser mayor que cero. Por defecto: `30000`. |
| `baseUrl` | `string` | Endpoint HTTP(S) de Engram local. Gana sobre variables de entorno y detección por `opencode attach`. Por defecto: `http://127.0.0.1:7437`. |
| `timeoutMs` | `number` | Presupuesto común para requests locales y guards de etapas; debe ser finito y mayor que cero. Por defecto: `5000`. |

La precedencia del endpoint local es `baseUrl` explícito, `ENGRAM_URL`,
`ENGRAM_BASE_URL`, host detectado de `opencode attach` y, finalmente, loopback. Un
`timeoutMs` ausente o inválido conserva el valor predeterminado de 5 segundos.

### Resolución del proyecto

La precedencia real es:

1. `project` no vacío en el `tui.json` que declara el plugin;
2. variable de entorno `ENGRAM_PROJECT` no vacía;
3. nombre normalizado del directorio de trabajo y, como segundo candidato automático,
   su ruta absoluta normalizada.

```powershell
$env:ENGRAM_PROJECT = "mi-proyecto"
opencode .
```

Cada candidato debe coincidir con un proyecto conocido por Engram. Se acepta una
coincidencia exacta o una única coincidencia sin distinguir mayúsculas. Un valor
explícito o de entorno inválido **no** cae silenciosamente al nombre del directorio.
Tampoco hay búsqueda difusa, recorrido de directorios padre, selector ni elección
automática del primer proyecto.

### Tema

El render del plugin usa el color de texto del tema activo que entrega OpenCode y no
impone una paleta ni crea archivos de tema propios. Los estados también se distinguen
por etiquetas e iconos, no solamente por color.

## Qué muestra el sidebar

### Health

| Estado | Significado |
| --- | --- |
| `CHECKING` | La carga inicial todavía no terminó. |
| `OK` | El HTTP local responde y las observaciones requeridas se obtuvieron. |
| `STALE` | Hay datos utilizables o previos, pero una etapa de la actualización quedó incompleta. |
| `ERROR` | Hubo respuesta parcial o un fallo de salud sin una carga completa. |
| `OFFLINE` | No pudo obtenerse información central de Engram. |

Los fallos muestran la etapa o endpoint relevante. Un error queda contenido en el
sidebar para no derribar el host de OpenCode.

### Proyecto y contexto detectado

Muestra el nombre validado del proyecto o `unresolved`. Cuando no puede resolverlo,
explica si falta configuración, el candidato no existe, es ambiguo o Engram estaba
offline durante la validación.

### Observaciones indexadas

La línea `Indexed observations` refleja las observaciones del proyecto cargadas para
la vista actual, dentro del límite acotado del sidebar; no debe interpretarse como un
contador histórico total de toda la base. Si no hay registros, se muestra un estado
vacío explícito.

### ODD Progress

The sidebar derives ODD state from full feature-document mirrors whose `topic_key`
is `odd/<feature>/tasks`. Each feature shows explicit task counts: done out of total,
cancelled, in progress, blocked, and pending. Cancelled tasks are reported separately,
not counted as done. See [the ODD state contract](docs/odd-state-contract.md) for the
canonical checklist format and newest-valid-document selection.

This is a bounded recent-observation view (up to 20 canonical project observations),
not a complete project inventory. ODD derivation uses that entire window, not just
the five-item activity feed. Invalid mirrors produce a visible diagnostic summary;
they never trigger an SDD fallback. When no valid features are available, the empty
state explains where to mirror feature documents.

The default sidebar does not derive or render SDD progress. The expanded sidebar
shows the current workflow mode. Use the explicit Engram commands in OpenCode:

- **Enable legacy SDD for this session** (`engram.workflow.legacy-sdd`) shows the
  existing SDD phase progress instead of ODD progress, derived from the entire
  retained bounded observation window rather than the five-item activity feed.
- **Return this session to ODD** (`engram.workflow.odd`) immediately clears SDD
  progress and restores ODD progress without a network refresh.

The choice applies only to the current session, survives sidebar remounts within
the same plugin instance, and does not affect other sessions. It is not persisted:
every new plugin instance starts in ODD. Invalid ODD mirrors never enable legacy
mode automatically. Sidebar session mode is independent of the MCP request-level
legacy opt-in described below.

### Bloqueos

Lista títulos de observaciones reconocidas como bloqueos por tipo, título o frases
explícitas como `status: blocked`, `blocker:`, `blocked by`, `depends on` o
`waiting for`. No infiere bloqueos a partir de sentimiento o contexto ambiguo.

### Actividad reciente

Muestra los títulos de las cinco observaciones más recientes del proyecto, ordenadas
por `updated_at` y luego por ID. Cuando no hay actividad, aparece un estado vacío.

### Última memoria guardada

No existe un panel duplicado para “última memoria”: la observación actualizada más
reciente ocupa el primer lugar de **Recent Activity**. La vista muestra su título, no
el contenido completo. Así mantiene presente la referencia más nueva sin convertir
el sidebar en un explorador de memorias.

### Refresh, carga y errores

- La primera carga se agenda una sola vez para el sidebar de la sesión visible.
- El polling automático usa `pollInterval` o 30 segundos.
- <kbd>Alt</kbd>+<kbd>R</kbd> vuelve a resolver el proyecto y repite todas las consultas.
- La tecla `r` sin modificadores queda libre para escribir en el prompt.
- `Refreshing…`, `Refreshed` y `Refresh incomplete` describen el resultado manual.
- Last-good ODD features and diagnostics remain visible as `STALE` only for the
  same resolved project; changing or losing project resolution clears them.
- Projects without observations, valid ODD features, or explicit blockers have
  useful empty states distinct from connection failures.

## Ejemplos de uso

### Detección automática desde el directorio

```sh
cd mi-proyecto
opencode .
```

Si Engram conoce `mi-proyecto`, el sidebar valida ese nombre y carga sus memorias.

### Fijar un proyecto por workspace

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    ["opencode-flema-engram-sidebar@0.1.8", { "project": "backend-api" }]
  ]
}
```

Esto es útil cuando el nombre del directorio no coincide con el proyecto guardado en
Engram. El valor debe coincidir; una configuración incorrecta queda como `unresolved`.

### Reducir la frecuencia de actualización

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    ["opencode-flema-engram-sidebar@0.1.8", { "pollInterval": 60000 }]
  ]
}
```

El sidebar actualizará cada 60 segundos y seguirá aceptando <kbd>Alt</kbd>+<kbd>R</kbd>.

## Instalación desde el código fuente

```sh
git clone https://github.com/oniricosistemas/flema-engram.git
cd flema-engram
npm install
```

El archivo versionado `tui.example.json` es la referencia para desarrollo desde el
código fuente y apunta directamente a:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [["./src/sidebar/plugin.tsx", {}]]
}
```

Creá tu copia local con `Copy-Item tui.example.json tui__.json` en PowerShell o
`cp tui.example.json tui__.json` en shells compatibles. `tui__.json` está ignorado
por Git a propósito: es la copia local para adaptar sin versionar rutas u opciones
específicas de tu máquina. Si tu entorno requiere el nombre `tui.json`, copiá allí el
contenido de `tui__.json` o fusioná su bloque `plugin` en tu configuración existente.

La ruta se resuelve desde el archivo que declara el plugin. En una configuración
global de Windows, reemplazá la ruta relativa de tu copia local por una URL absoluta:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    ["file:///D:/general/mcp-flema-engram/src/sidebar/plugin.tsx", {}]
  ]
}
```

Preservá el resto de tus plugins y opciones al fusionar la configuración.

## Solución de problemas

### Engram aparece offline

- Confirmá que Engram escuche en `127.0.0.1:7437` o en el endpoint declarado por `baseUrl`.
- Probá `<baseUrl>/health` desde la misma máquina donde corre OpenCode.
- Revisá firewalls o proxies locales; el plugin no intenta conectarse a un servicio
  cloud como alternativa.
- Si una red o puente responde lentamente, aumentá `timeoutMs`; el mismo valor limita
  requests HTTP y etapas del refresh.
- Una URL que no use `http:` o `https:` se rechaza dentro del sidebar con un diagnóstico
  acotado, sin exponer credenciales incluidas en el valor configurado.
- Corregí la causa y presioná <kbd>Alt</kbd>+<kbd>R</kbd>.

### El proyecto no se detecta

- Verificá el nombre real guardado en Engram.
- Definí `project` en `tui.json` si el workspace tiene otro nombre.
- Usá `ENGRAM_PROJECT` solamente cuando deba aplicar al proceso completo.
- Recordá la precedencia: `project` explícito gana sobre `ENGRAM_PROJECT`.
- Un proyecto sin observaciones ni sesiones recientes puede no aparecer en la lista
  derivada que se usa para validarlo.

### Los datos parecen viejos

- Mirá si Health dice `STALE` y leé el detalle de etapa/endpoint.
- Esperá el próximo polling o usá <kbd>Alt</kbd>+<kbd>R</kbd>.
- Confirmá que la memoria pertenece exactamente al proyecto resuelto.
- El feed solo muestra cinco títulos y la consulta del sidebar está acotada a 20
  observaciones.

### El plugin no carga

- Cerrá y reiniciá OpenCode después de cambiar `tui.json`.
- Validá el JSON y la ruta del plugin.
- Confirmá Node.js 22+ y OpenCode 1.18.25+.
- Para npm, usá `opencode-flema-engram-sidebar@<version>` con una versión publicada exacta.
- Para fuente local, ejecutá `npm install` y comprobá que la ruta termine en
  `src/sidebar/plugin.tsx`.
- Revisá la salida de arranque de OpenCode. El plugin no crea archivos de log propios.

### El sidebar muestra una versión anterior

1. Cerrá todos los procesos OpenCode.
2. Ejecutá `opencode debug paths` y anotá las rutas `config` y `cache`.
3. Confirmá que `config/tui.json` use `opencode-flema-engram-sidebar@<version>`.
4. Instalá de nuevo esa versión exacta:

   ```sh
   opencode plugin opencode-flema-engram-sidebar@<version> --force --global
   ```

5. Si el sidebar todavía muestra la release anterior, inspeccioná dentro de
   `cache/packages` los wrappers `opencode-flema-engram-sidebar@*`. Eliminá solamente
   el wrapper obsoleto `opencode-flema-engram-sidebar@latest` después de confirmar que
   su `node_modules/opencode-flema-engram-sidebar/package.json` contiene la versión
   vieja. Conservá el wrapper exacto y repetí el comando anterior.
6. Abrí un proceso OpenCode nuevo; los procesos existentes no recargan plugins.

En PowerShell, reemplazá `<old-version>` por la versión anterior que esperás borrar.
El comando se niega a eliminar el wrapper si su manifiesto contiene otro valor:

```powershell
$cache = (opencode debug paths | Select-String '^cache\s+').Line -replace '^cache\s+', ''
$stale = Join-Path $cache 'packages\opencode-flema-engram-sidebar@latest'
$manifest = Join-Path $stale 'node_modules\opencode-flema-engram-sidebar\package.json'
$staleVersion = (Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json).version
if ($staleVersion -ne '<old-version>') { throw "Refusing to remove wrapper: found $staleVersion" }
Remove-Item -LiteralPath $stale -Recurse -Force
```

En shells POSIX, reemplazá `<cache>` y `<old-version>` por los valores confirmados:

```sh
stale='<cache>/packages/opencode-flema-engram-sidebar@latest'
manifest="$stale/node_modules/opencode-flema-engram-sidebar/package.json"
stale_version="$(node -e 'const fs = require("node:fs"); console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).version)' "$manifest")"
[ "$stale_version" = '<old-version>' ] || {
  printf 'Refusing to remove wrapper: found %s\n' "$stale_version" >&2
  exit 1
}
rm -rf -- "$stale"
```

No borres el directorio completo de caché: puede contener otros plugins, servidores de
lenguaje y modelos descargados.

### OpenCode no encuentra el export del paquete

- Confirmá que la versión instalada tiene un export raíz por defecto con `id` y `tui`.
- Ejecutá `npm view opencode-flema-engram-sidebar exports` para inspeccionar la
  metadata publicada.
- Si trabajás sobre un tarball local, verificá que incluya
  `dist/index.js`, `dist/sidebar/plugin.js` y sus declaraciones.
- Usá `opencode-flema-engram-sidebar` en la configuración. El subpath `/tui` queda
  disponible para imports directos, pero OpenCode 1.18.25 puede no cachear ese spec de
  npm de forma confiable.

### Diagnóstico para contribuidores

```sh
npm run typecheck
npm test
npm run verify:package
```

`typecheck` valida TypeScript sin emitir archivos; `test` ejecuta Vitest una vez; y
`verify:package` inspecciona un `npm pack --dry-run` contra el contenido compilado
existente. No hay una opción de log JSONL ni un archivo de diagnóstico del sidebar.

## Desarrollo y contribución

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run verify:package
```

| Comando | Qué comprueba |
| --- | --- |
| `npm ci` | Instala exactamente el árbol de `package-lock.json`; es el usado por CI. |
| `npm install` | Instala dependencias y permite actualizar el lockfile en desarrollo. |
| `npm run typecheck` | Ejecuta `tsc --noEmit` con configuración estricta. |
| `npm test` | Ejecuta la suite unitaria y de integración con Vitest. |
| `npm run test:watch` | Mantiene Vitest activo durante el desarrollo. |
| `npm run test:coverage` | Genera cobertura mediante V8. |
| `npm run build` | Compila `src` a ESM, declaraciones y sourcemaps en `dist`. |
| `npm run verify:package` | Valida metadata y contenido del tarball sin publicarlo. Requiere un `dist` actualizado. |
| `npm run mcp` | Inicia desde fuente el adaptador MCP stdio opcional mediante `tsx`. |

La CI usa Node 22 y ejecuta, en este orden: typecheck, tests, build y verificación del
paquete. No publica artefactos ni necesita secretos. Antes de proponer un cambio:

- [ ] Mantené el sidebar como producto principal y el MCP como integración opcional.
- [ ] No introduzcas escrituras sobre Engram en el flujo de solo lectura.
- [ ] Agregá o actualizá pruebas para cambios de comportamiento.
- [ ] Ejecutá los cuatro checks de CI.
- [ ] No incluyas `src`, tests, OpenSpec, configs locales ni logs en el tarball.

## Empaquetado y publicación

La lista `files` permite publicar `dist`, `README.md` y `LICENSE`; npm agrega además
la metadata obligatoria. El verificador exige, como mínimo:

- API raíz: `dist/index.js` y `dist/index.d.ts`;
- plugin: `dist/sidebar/plugin.js` y `dist/sidebar/plugin.d.ts`;
- CLI opcional: `dist/stdio.js`;
- README, licencia y `package.json`.

`prepublishOnly` ejecuta automáticamente:

```sh
npm run typecheck && npm test && npm run build && npm run verify:package
```

Para publicar necesitás permisos sobre
[`opencode-flema-engram-sidebar`](https://www.npmjs.com/package/opencode-flema-engram-sidebar),
una sesión npm válida y un `package.json` con versión todavía no publicada. Este
repositorio no configura publicación automática, tokens ni secretos.

## Integración MCP opcional

> Sección avanzada: no es necesaria para usar el sidebar.

La instalación global expone el comando stdio:

```sh
mcp-flema-engram
```

Desde el repositorio puede iniciarse sin compilar con:

```sh
npm run mcp
```

Ejemplo de configuración local de OpenCode, equivalente a `opencode.example.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "engram": {
      "type": "local",
      "command": ["npm", "run", "mcp"],
      "enabled": true
    }
  }
}
```

The server offers read-only MCP tools and resources for health, projects,
observations, sessions, ODD state, and explicit legacy SDD access. It uses the same
local Engram HTTP service, without adding persistence or cloud synchronization.

### ODD-first project state and explicit legacy access

Call `engram_get_project_state` with an exact project name:

```json
{ "project": "backend-api" }
```

The response always includes `odd: { bounded: true, features, diagnostics }`,
derived from canonical `odd/<feature>/tasks` feature-document mirrors in the
loaded exact-project observation window. Existing project metadata, observation
counts, explicit blockers, and recent activity remain available. Invalid mirrors
stay visible as diagnostics and never cause SDD fallback. Counts and derived
workflow state describe bounded recent observations, not an exhaustive inventory
or historical total. See [the ODD state contract](docs/odd-state-contract.md).

`includeLegacySdd` is an optional boolean, defaulting to `false`. By default the
tool does not derive legacy SDD or expose `changes`. To add legacy SDD changes to
the same ODD response for one request:

```json
{ "project": "backend-api", "includeLegacySdd": true }
```

This request-scoped opt-in neither reads nor changes the sidebar's session-scoped
workflow mode. Dedicated `engram://changes`,
`engram://changes/{change_name}/state`, and
`engram://changes/{change_name}/artifacts` resources remain operational as
explicit legacy SDD access, independently of OpenCode session state. Their results
are also limited to the adapter's recent-observation window; other resource
behavior is unchanged.

## Seguridad, privacidad y enfoque local-first

- Los datos de Engram permanecen en la máquina y el runtime consulta loopback.
- El sidebar no requiere credenciales, telemetría ni servicios cloud.
- No ejecuta operaciones de escritura sobre memorias.
- No crea logs propios con contenido de observaciones.
- El contenido de memorias puede ser sensible: protegé el acceso al proceso y puerto
  local de Engram como protegerías cualquier herramienta de desarrollo.
- Las conexiones externas solo son necesarias para tareas ajenas al runtime local,
  como instalar desde npm o abrir enlaces de documentación.

El repositorio contiene una clase experimental de adaptador cloud con operaciones no
implementadas. No forma parte del flujo del plugin ni constituye soporte cloud.

## Roadmap y alcance diferido

Están explícitamente fuera del MVP actual:

- dashboard visual y acciones/atajos para abrirlo;
- conexión remota mediante `opencode attach`;
- selector manual de proyecto, navegación `j`/`k` y más atajos globales;
- sincronización cloud y edición de memorias.

## Licencia y enlaces

Distribuido bajo la [licencia MIT](./LICENSE).

- [Repositorio](https://github.com/oniricosistemas/flema-engram)
- [Issues](https://github.com/oniricosistemas/flema-engram/issues)
- [Paquete npm](https://www.npmjs.com/package/opencode-flema-engram-sidebar)
- [CI](https://github.com/oniricosistemas/flema-engram/actions/workflows/ci.yml)
