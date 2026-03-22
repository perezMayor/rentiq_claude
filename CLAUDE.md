# CLAUDE.md — RentIQ Gestión V3

Este archivo define el contexto, reglas y directrices de trabajo para cualquier agente que opere sobre este proyecto.
Léelo completo antes de hacer cualquier acción.

---

## 1. Qué es este sistema

`RentIQ Gestión V3` es un SaaS operativo para la gestión diaria de una empresa de alquiler de vehículos. Es un SaaS que debe ser 100% profesional ya que ha de venderse

Cubre:

- reservas
- contratos
- planning
- entregas y recogidas
- vehículos y flota
- clientes
- gastos
- facturación
- tarifas
- gestor/administración
- auditoría
- backups

El sistema corre localmente en puerto `4000`. Persiste en filesystem local con directorio de datos configurable.

---

## 2. Principios obligatorios

Estas reglas son estructurales. No tienen excepciones:

- no existen estados implícitos
- no se inventan campos, reglas ni comportamientos no documentados
- no se asumen intenciones no explícitas
- toda acción de escritura valida permisos en backend
- toda operación crítica deja trazabilidad auditable
- todo cambio de esquema requiere migración explícita
- todo cambio de contrato HTTP debe documentarse
- no se silencian errores críticos
- todo cambio relevante debe tener test acorde al impacto
- la UI nunca es el único control de seguridad

Si hay ambigüedad en una regla de negocio: **detente y pide validación humana antes de decidir.**

---

## 3. Stack técnico

- lenguaje: TypeScript
- fuente tipográfica: Poppins
- modo oscuro: soportado y obligatorio (`data-theme="dark"`)
- logos disponibles en: `public/brand/`
- puerto local: `3203`

---

## 4. Roles y permisos

Roles existentes: `SUPER_ADMIN`, `ADMIN`, `LECTOR`

Reglas mínimas:

- `LECTOR` no puede ejecutar acciones de escritura operativa
- `LECTOR` no tiene acceso operativo a `tarifas` ni a `gestor`
- el backend debe denegar por rol en cada acción sensible
- los accesos denegados deben quedar trazados

---

## 5. Módulos y prioridades funcionales

Orden de prioridad:

1. reservas
2. contratos
3. planning
4. vehículos
5. clientes
6. gastos
7. facturación
8. gestor
9. backups
10. auditoría

---

## 6. Entidades principales

### Reserva

Estados: `PETICION`, `CONFIRMADA`, `CANCELADA`
Estado derivado: si tiene contrato asociado → operativamente "contratada"

Campos mínimos: id interno, número (`RSV-{AAAA}-{contador_6}`), sucursal entrega/recogida, fechas y horas, cliente, grupo facturable, modelo solicitado, matrícula asignada, días facturados, tarifa, desglose económico, observaciones, estado, vínculo a contrato, logs de confirmación.

Regla crítica: **una reserva solo puede borrarse si no tiene contrato asociado.**

### Contrato

Estados: `ABIERTO`, `CERRADO`, `CANCELADO`

Campos mínimos: id interno, número (patrón por año y sucursal), referencia a reserva origen, sucursal, cliente, matrícula, grupo facturado, fechas, importes, caja/cobros, checkout, checkin, gastos internos, factura asociada.

Reglas críticas:
- no se cierra sin caja registrada
- el cierre genera factura
- si queda importe pendiente, no puede cerrarse

### Factura

Campos mínimos: id, número (por serie/año/sucursal), fecha, tipo, contrato origen, base imponible, extras, seguros, combustible, penalizaciones, IVA, total, estado, logs de envío.

### Cliente

Tipos: `PARTICULAR`, `EMPRESA`, `COMISIONISTA`

### Vehículo

Campos mínimos: matrícula, modelo, grupo/categoría, propietario, estado operativo, fechas de alta/baja.

### Extra

Campos mínimos: código, nombre, modo de precio, precio unitario, estado activo/inactivo.

### Sucursal

Multi-sucursal real: afecta numeración, filtros, horarios y comportamiento operativo.
Debe contemplar horario semanal y excepciones de calendario.

### Usuario

Campos mínimos: id, nombre, email, rol, password, estado activo/inactivo.

---

## 7. Reglas operativas clave

### Flujo reserva → contrato

- la conversión debe dejar vínculo bidireccional
- una reserva con contrato no puede borrarse libremente

### Asignación de matrícula

- verificar solape temporal
- verificar coherencia con grupo/categoría
- si hay conflicto: no continuar silenciosamente
- override debe ser explícito y trazable

### Checkout

Registra: km salida, combustible salida, notas, fotos si existen, firma si aplica.

### Checkin

Registra: km llegada, combustible llegada, notas, fotos si existen, firma si aplica.

### Caja del contrato

- distingue método e importe
- devoluciones quedan trazadas
- el cálculo no puede depender de datos ambiguos

### Gasto diario operativo

- validar contra fecha y matrículas reales
- si se reparte entre matrículas, dejar rastro del reparto

### Bloqueo manual de vehículo

- definido por matrícula y rango temporal
- si existe conflicto con reserva/contrato: exigir confirmación/override explícito

### Facturación

- factura vinculada al contrato de origen
- envío por email registra resultado
- conciliación entre contrato, caja y factura debe ser verificable

---

## 8. Numeración

- reserva: `RSV-{AAAA}-{contador_6}`
- contrato: patrón por año y sucursal
- factura: patrón por serie, año y sucursal

Reglas:
- debe ser consistente y sin colisiones
- debe respetar configuración de empresa y sucursal
- solo se genera desde el servicio responsable

---

## 9. Auditoría

Es parte del sistema, no un añadido opcional.

Eventos auditables: `AUTH_LOGIN`, `AUTH_LOGOUT`, `UI_OPEN_MODULE`, `RBAC_DENIED`, `OVERRIDE_CONFIRMATION`, `SYSTEM`, `AUDIT_SUPPRESS`

Principios:
- append-only en origen
- supresión lógica, nunca borrado físico
- quién, cuándo y qué en cada operación crítica

---

## 10. API

Convenciones:
- endpoints protegidos requieren sesión válida
- errores responden con JSON consistente
- no se exponen secretos ni stack traces

Capacidades HTTP que deben existir:
- autenticación y logout
- lectura y supresión lógica de auditoría
- descarga de preimpresión de contrato
- descarga de confirmación de reserva
- descarga/visualización de factura
- exportes: entregas, recogidas, gastos, productividad, facturas, conciliación
- ejecución de backup programado

---

## 11. Backups y restore

- backup manual forzado
- backup programado por endpoint protegido con bearer token
- ventana horaria y retención configurables

Restore:
- validar integridad del backup
- crear snapshot de seguridad antes de restaurar
- requerir confirmación reforzada
- dejar trazabilidad del restore

---

## 12. Integridad y consistencia

No deben romperse:
- no existe contrato huérfano respecto a su reserva origen
- no existe factura de cierre sin rastro del contrato de origen
- no puede borrarse una entidad si rompe referencias activas
- no existe escritura parcial silenciosa en operaciones críticas
- no se pierden logs de auditoría por cambios de datos

---

## 13. Identidad visual y branding

### Tipografía

- fuente principal: `Poppins`
- se mantiene en: login, panel, sidebar, formularios, tarjetas

### Logos disponibles en `public/brand/`

| Archivo | Uso |
|---|---|
| `rentiq-logo-dark.png` | login |
| `logo_RIQ_compl_osc_pq.png` | sidebar |
| `rentiq-logo-light.png` / `rentiq-sidebar-white.png` | contextos oscuros |
| `rentiq-isotipo.svg` / `R.png` | piezas compactas o avatares |

### Tokens de color — modo claro

```
--color-primary: #2b6cbd
--color-accent: #1f8a8f
--color-bg-main: #d1d5db
--color-surface: #e5e7eb
--color-surface-strong: #ffffff
--color-sidebar-bg: #1e3a5f
--color-sidebar-text: #f3f4f6
--color-text-primary: #0f172a
--color-text-muted: #4b5563
--color-border: #c0c7d1
--color-danger: #b42318
```

### Tokens de color — modo oscuro

```
--color-bg-main: #111827
--color-surface: #1f2937
--color-surface-strong: #0f172a
--color-sidebar-bg: #0b1220
--color-sidebar-text: #e5e7eb
--color-text-primary: #e5e7eb
--color-text-muted: #9ca3af
--color-border: #334155
```

### Estados funcionales

```
--color-status-peticion: #f59e0b
--color-status-confirmada: #2563eb
--color-status-contratado: #15803d
--color-status-no-disponible: #64748b
--color-status-bloqueado: #7c3aed
```

### Login

- fondo con gradientes radiales azul + turquesa
- tarjeta translúcida tipo glass
- logo centrado
- subtítulo de producto
- modo oscuro equivalente, no simplemente invertido

### Sidebar

- fondo oscuro fijo
- logo visible arriba
- links con estado hover y active (color primario/acento)
- bloque inferior: sesión, sucursal y logout

### Lenguaje visual

La app es operativa, no de marketing. Debe verse:
- sidebar oscura y sólida
- superficies claras con contraste limpio
- tarjetas con radio medio
- sombras suaves
- formularios compactos y densos

No debe verse:
- minimalista vacía
- futurista exagerada
- SaaS genérico morado
- dashboard oscuro total sin contraste funcional

---

## 14. Checklist antes de entregar cambios visuales

- ¿Se sigue usando `Poppins`?
- ¿Se reutilizan los logos existentes?
- ¿La paleta sigue siendo azul + turquesa + sidebar oscura?
- ¿El login sigue reconociéndose como RentIQ?
- ¿La sidebar sigue reconociéndose como la del producto?
- ¿El modo oscuro sigue funcionando?
- ¿Los estados de negocio conservan contraste suficiente?
- ¿Las tablas y formularios son operativos y legibles?

---

## 15. Documentación de referencia

Leer en este orden al empezar:

1. `docs/arquitectura.md`
2. `docs/modulos-y-flujos.md`
3. `docs/operativa-modulos.md`
4. `docs/api.md`
5. `docs/operacion.md`
6. `docs/CORE_RULES.md`
7. `docs/INTEGRATION_CHECKLIST.md`

---

## 16. Orden de trabajo recomendado

1. Leer este CLAUDE.md completo
2. Leer la documentación de referencia
3. Validar con humano cualquier duda en reglas de negocio
4. Reconstruir modelo conceptual: entidades, relaciones, estados, invariantes
5. Reconstruir servicios por flujo: reservas → contratos → planning → gastos → facturación → gestor
6. Montar UI y endpoints alrededor de esos contratos

**Prioridad siempre: reglas → datos → servicios → interfaces**

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Antigravity Kit is an AI-powered design intelligence toolkit providing searchable databases of UI styles, color palettes, font pairings, chart types, and UX guidelines. It works as a skill/workflow for AI coding assistants (Claude Code, Windsurf, Cursor, etc.).

## Search Command

```bash
python3 src/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain> [-n <max_results>]
```

**Domain search:**
- `product` - Product type recommendations (SaaS, e-commerce, portfolio)
- `style` - UI styles (glassmorphism, minimalism, brutalism) + AI prompts and CSS keywords
- `typography` - Font pairings with Google Fonts imports
- `color` - Color palettes by product type
- `landing` - Page structure and CTA strategies
- `chart` - Chart types and library recommendations
- `ux` - Best practices and anti-patterns

**Stack search:**
```bash
python3 src/ui-ux-pro-max/scripts/search.py "<query>" --stack <stack>
```
Available stacks: `html-tailwind` (default), `react`, `nextjs`, `astro`, `vue`, `nuxtjs`, `nuxt-ui`, `svelte`, `swiftui`, `react-native`, `flutter`, `shadcn`, `jetpack-compose`

## Architecture

```
src/ui-ux-pro-max/                # Source of Truth
├── data/                         # Canonical CSV databases
│   ├── products.csv, styles.csv, colors.csv, typography.csv, ...
│   └── stacks/                   # Stack-specific guidelines
├── scripts/
│   ├── search.py                 # CLI entry point
│   ├── core.py                   # BM25 + regex hybrid search engine
│   └── design_system.py          # Design system generation
└── templates/
    ├── base/                     # Base templates (skill-content.md, quick-reference.md)
    └── platforms/                # Platform configs (claude.json, cursor.json, ...)

cli/                              # CLI installer (uipro-cli on npm)
├── src/
│   ├── commands/init.ts          # Install command with template generation
│   └── utils/template.ts         # Template rendering engine
└── assets/                       # Bundled assets (~564KB)
    ├── data/                     # Copy of src/ui-ux-pro-max/data/
    ├── scripts/                  # Copy of src/ui-ux-pro-max/scripts/
    └── templates/                # Copy of src/ui-ux-pro-max/templates/

.claude/skills/ui-ux-pro-max/     # Claude Code skill (symlinks to src/)
.factory/skills/ui-ux-pro-max/   # Droid (Factory) skill (symlinks to src/)
.shared/ui-ux-pro-max/            # Symlink to src/ui-ux-pro-max/
.claude-plugin/                   # Claude Marketplace publishing
```

The search engine uses BM25 ranking combined with regex matching. Domain auto-detection is available when `--domain` is omitted.

## Sync Rules

**Source of Truth:** `src/ui-ux-pro-max/`

When modifying files:

1. **Data & Scripts** - Edit in `src/ui-ux-pro-max/`:
   - `data/*.csv` and `data/stacks/*.csv`
   - `scripts/*.py`
   - Changes automatically available via symlinks in `.claude/`, `.factory/`, `.shared/`

2. **Templates** - Edit in `src/ui-ux-pro-max/templates/`:
   - `base/skill-content.md` - Common SKILL.md content
   - `base/quick-reference.md` - Quick reference section (Claude only)
   - `platforms/*.json` - Platform-specific configs

3. **CLI Assets** - Run sync before publishing:
   ```bash
   cp -r src/ui-ux-pro-max/data/* cli/assets/data/
   cp -r src/ui-ux-pro-max/scripts/* cli/assets/scripts/
   cp -r src/ui-ux-pro-max/templates/* cli/assets/templates/
   ```

4. **Reference Folders** - No manual sync needed. The CLI generates these from templates during `uipro init`.

## Prerequisites

Python 3.x (no external dependencies required)

## Git Workflow

Never push directly to `main`. Always:

1. Create a new branch: `git checkout -b feat/...` or `fix/...`
2. Commit changes
3. Push branch: `git push -u origin <branch>`
4. Create PR: `gh pr create`
