# RentIQ Gestión V3

Sistema SaaS operativo para la gestión diaria de empresas de alquiler de vehículos.

---

## Índice

- [Descripción](#descripción)
- [Módulos](#módulos)
- [Stack técnico](#stack-técnico)
- [Requisitos](#requisitos)
- [Instalación y arranque](#instalación-y-arranque)
- [Variables de entorno](#variables-de-entorno)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Roles y permisos](#roles-y-permisos)
- [Entidades principales](#entidades-principales)
- [Flujos operativos](#flujos-operativos)
- [API](#api)
- [Auditoría](#auditoría)
- [Backups](#backups)
- [Identidad visual](#identidad-visual)

---

## Descripción

RentIQ Gestión V3 es una aplicación web operativa diseñada para cubrir el ciclo completo de gestión de una empresa de alquiler de vehículos:

- Gestión de reservas y contratos
- Control de flota y planning visual
- Entregas y recogidas
- Facturación integrada
- Gestión de clientes y gastos
- Auditoría completa de operaciones
- Backups automáticos y manuales
- Multi-sucursal real

El sistema corre en local en el puerto `4000` y persiste los datos en el filesystem mediante un directorio configurable.

---

## Módulos

| Módulo | Descripción |
|---|---|
| **Reservas** | Alta, confirmación, cancelación y conversión a contrato |
| **Contratos** | Ciclo completo: apertura, checkout, checkin, caja y cierre |
| **Planning** | Vista de disponibilidad de flota y bloqueos manuales |
| **Vehículos** | Gestión de flota, categorías, modelos y extras |
| **Clientes** | Particulares, empresas y comisionistas |
| **Gastos** | Registro de gastos operativos por matrícula y fecha |
| **Facturación** | Generación, envío y conciliación de facturas |
| **Tarifas** | Gestión de precios por categoría y modo |
| **Gestor** | Administración de empresa, sucursales y usuarios |
| **Backups** | Ejecución manual y programada de copias de seguridad |
| **Auditoría** | Log append-only de todas las operaciones críticas |

---

## Stack técnico

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
- **Lenguaje:** TypeScript
- **Estilos:** CSS Modules + variables CSS personalizadas
- **Tipografía:** Poppins
- **Persistencia:** Filesystem local (JSON estructurado)
- **Autenticación:** Sesión por cookie, bcryptjs para contraseñas
- **PDF:** PDFKit
- **Email:** Nodemailer
- **Runtime:** Node.js

---

## Requisitos

- Node.js 18+
- npm 9+

---

## Instalación y arranque

```bash
# Clonar el repositorio
git clone git@github.com:perezMayor/rentiq_claude.git
cd rentiq_claude

# Instalar dependencias
npm install

# Copiar y configurar variables de entorno
cp .env.local.example .env.local
# Editar .env.local con tus valores

# Arrancar en modo desarrollo
npm run dev
```

La aplicación estará disponible en [http://localhost:4000](http://localhost:4000).

### Otros comandos

```bash
npm run build    # Build de producción
npm run start    # Arrancar en producción (puerto 4000)
npm run lint     # Linter
```

---

## Variables de entorno

Crear un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```env
# Directorio de datos (filesystem)
RENTIQ_DATA_DIR=./.rentiq-v3-data

# Modo demo (seed de datos iniciales)
RENTIQ_DEMO_MODE=true
NEXT_PUBLIC_RENTIQ_DEMO_MODE=true

# Token para backups programados
BACKUP_SCHEDULE_TOKEN=tu-token-secreto

# Retención de backups (días)
BACKUP_RETENTION_DAYS=90

# Configuración SMTP (envío de facturas)
SMTP_HOST=smtp.tudominio.com
SMTP_PORT=587
SMTP_USER=tu@email.com
SMTP_PASS=tu-contraseña
SMTP_SECURE=false
MAIL_FROM=noreply@tudominio.com

# Feature flags
ENABLE_DASHBOARD_SMART_ALERTS=true
ENABLE_PLANNING_DRAGDROP=false
ENABLE_VISUAL_TEMPLATE_EDITOR=false
ENABLE_STRICT_ACTION_LOCK=false
```

> **Nunca subas `.env.local` al repositorio.** Está incluido en `.gitignore`.

---

## Estructura del proyecto

```
rentiq_claude/
├── src/
│   ├── app/
│   │   ├── (app)/                  # Módulos protegidos de la aplicación
│   │   │   ├── AppShell.tsx        # Layout principal (sidebar + cabecera)
│   │   │   ├── dashboard/          # Panel de inicio
│   │   │   ├── reservas/           # Módulo de reservas
│   │   │   ├── contratos/          # Módulo de contratos
│   │   │   ├── planning/           # Planning de flota
│   │   │   ├── vehiculos/          # Gestión de flota
│   │   │   ├── clientes/           # Gestión de clientes
│   │   │   ├── gastos/             # Gastos operativos
│   │   │   ├── facturacion/        # Facturación
│   │   │   ├── tarifas/            # Tarifas
│   │   │   ├── entregas/           # Entregas del día
│   │   │   ├── recogidas/          # Recogidas del día
│   │   │   ├── gestor/             # Administración
│   │   │   └── plantillas/         # Plantillas de documentos
│   │   ├── api/                    # API Routes (Next.js)
│   │   │   ├── login/              # Autenticación
│   │   │   ├── logout/             # Cierre de sesión
│   │   │   ├── me/                 # Sesión activa
│   │   │   ├── reservas/           # CRUD reservas
│   │   │   ├── contratos/          # CRUD contratos + operaciones
│   │   │   ├── clientes/           # CRUD clientes
│   │   │   ├── vehiculos/          # Flota, categorías, modelos, extras
│   │   │   ├── planning/           # Planning y bloqueos
│   │   │   ├── gastos/             # Gastos
│   │   │   ├── sucursales/         # Sucursales
│   │   │   ├── audit/              # Consulta de auditoría
│   │   │   ├── audit-log/          # Registro de eventos
│   │   │   └── rbac-denied/        # Log de accesos denegados
│   │   ├── login/                  # Página de login
│   │   ├── globals.css             # Variables CSS y estilos globales
│   │   └── layout.tsx              # Root layout
│   ├── lib/
│   │   ├── types.ts                # Tipos TypeScript del dominio
│   │   ├── store.ts                # Capa de persistencia (filesystem)
│   │   ├── auth.ts                 # Autenticación y sesión
│   │   ├── audit.ts                # Sistema de auditoría
│   │   └── seed.ts                 # Datos iniciales (modo demo)
│   └── middleware.ts               # Protección de rutas y sesión
├── public/
│   └── brand/                      # Logos y assets de marca
├── .env.local                      # Variables de entorno (no en git)
├── .gitignore
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## Roles y permisos

| Rol | Acceso |
|---|---|
| `SUPER_ADMIN` | Acceso completo a todos los módulos y operaciones |
| `ADMIN` | Acceso operativo completo excepto configuración de sistema |
| `LECTOR` | Solo lectura. Sin acceso a tarifas ni gestor. Sin escritura operativa |

Reglas de seguridad:
- El backend deniega por rol en cada acción sensible
- Los accesos denegados quedan registrados en auditoría
- La UI nunca es el único control de seguridad

---

## Entidades principales

### Reserva
- **Estados:** `PETICION` → `CONFIRMADA` → `CANCELADA`
- **Numeración:** `RSV-{AAAA}-{contador_6}`
- Una reserva con contrato asociado no puede borrarse

### Contrato
- **Estados:** `ABIERTO` → `CERRADO` / `CANCELADO`
- No se cierra sin caja registrada
- El cierre genera factura automáticamente
- Si queda importe pendiente, no puede cerrarse

### Factura
- **Tipos:** `F` (factura), `V` (venta), `R` (rectificativa), `A` (abono)
- **Estados:** `BORRADOR` → `FINAL`
- Numeración por serie, año y sucursal

### Cliente
- **Tipos:** `PARTICULAR`, `EMPRESA`, `COMISIONISTA`

### Vehículo
- Identificado por matrícula
- Asociado a categoría y modelo
- Estados operativos (disponible, no disponible, bloqueado)

---

## Flujos operativos

### Reserva → Contrato

```
Alta reserva (PETICION)
    → Confirmación (CONFIRMADA)
    → Conversión a contrato (ABIERTO)
        → Checkout (km salida, combustible, notas, firma)
        → Checkin (km llegada, combustible, notas, firma)
        → Registro de caja
        → Cierre (genera factura)
```

### Asignación de matrícula

- Se verifica solape temporal antes de asignar
- Se verifica coherencia con la categoría solicitada
- Cualquier conflicto detiene el proceso (no silencioso)
- Override explícito y trazable en auditoría

### Bloqueo de vehículo

- Definido por matrícula y rango temporal
- Si hay conflicto con reserva/contrato activo: requiere confirmación explícita

---

## API

Todos los endpoints requieren sesión activa (cookie de sesión).

### Autenticación
| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/login` | Inicio de sesión |
| `POST` | `/api/logout` | Cierre de sesión |
| `GET` | `/api/me` | Datos de sesión activa |

### Reservas
| Método | Endpoint | Descripción |
|---|---|---|
| `GET / POST` | `/api/reservas` | Listar / crear reserva |
| `GET / PUT / DELETE` | `/api/reservas/[id]` | Detalle / editar / eliminar |
| `POST` | `/api/reservas/[id]/confirmar` | Confirmar reserva |
| `POST` | `/api/reservas/[id]/cancelar` | Cancelar reserva |
| `POST` | `/api/reservas/[id]/convertir` | Convertir a contrato |

### Contratos
| Método | Endpoint | Descripción |
|---|---|---|
| `GET / POST` | `/api/contratos` | Listar / crear contrato |
| `GET / PUT` | `/api/contratos/[id]` | Detalle / editar |
| `POST` | `/api/contratos/[id]/checkout` | Registrar checkout |
| `POST` | `/api/contratos/[id]/checkin` | Registrar checkin |
| `POST` | `/api/contratos/[id]/pago` | Registrar pago en caja |
| `POST` | `/api/contratos/[id]/cerrar` | Cerrar contrato |
| `POST` | `/api/contratos/[id]/cancelar` | Cancelar contrato |

### Vehículos
| Método | Endpoint | Descripción |
|---|---|---|
| `GET / POST` | `/api/vehiculos/flota` | Listar / crear vehículo |
| `GET / PUT / DELETE` | `/api/vehiculos/flota/[id]` | Detalle / editar / baja |
| `GET / POST` | `/api/vehiculos/categorias` | Categorías |
| `GET / POST` | `/api/vehiculos/modelos` | Modelos |
| `GET / POST` | `/api/vehiculos/extras` | Extras |

### Planning y bloqueos
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/planning` | Vista de planning por rango de fechas |
| `POST` | `/api/planning/bloquear` | Crear bloqueo manual |
| `DELETE` | `/api/planning/bloquear/[id]` | Eliminar bloqueo |

### Clientes
| Método | Endpoint | Descripción |
|---|---|---|
| `GET / POST` | `/api/clientes` | Listar / crear cliente |
| `GET / PUT` | `/api/clientes/[id]` | Detalle / editar |
| `GET` | `/api/clientes/[id]/reservas` | Historial de reservas del cliente |

### Auditoría
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/audit` | Consultar log de auditoría |
| `POST` | `/api/audit-log` | Registrar evento de auditoría |
| `POST` | `/api/rbac-denied` | Registrar acceso denegado |

---

## Auditoría

El sistema de auditoría es append-only y no tiene excepciones. Registra:

| Evento | Descripción |
|---|---|
| `AUTH_LOGIN` | Inicio de sesión |
| `AUTH_LOGOUT` | Cierre de sesión |
| `UI_OPEN_MODULE` | Apertura de módulo en la UI |
| `RBAC_DENIED` | Intento de acción sin permisos |
| `OVERRIDE_CONFIRMATION` | Override explícito de una restricción |
| `SYSTEM` | Eventos internos del sistema |
| `AUDIT_SUPPRESS` | Supresión lógica de un evento |

Principios:
- **Append-only** en origen: nunca se borran registros físicamente
- **Supresión lógica**: los eventos se marcan como suprimidos, nunca se eliminan
- Cada registro incluye: quién, cuándo, qué, desde dónde

---

## Backups

### Manual
Disponible desde el módulo **Gestor** para usuarios con rol `ADMIN` o `SUPER_ADMIN`.

### Programado
Endpoint protegido por bearer token:

```
POST /api/backup/schedule
Authorization: Bearer {BACKUP_SCHEDULE_TOKEN}
```

### Restore
- Valida integridad del backup antes de restaurar
- Crea snapshot de seguridad del estado actual
- Requiere confirmación reforzada
- Deja trazabilidad del restore en auditoría

---

## Identidad visual

### Paleta de colores

| Token | Claro | Oscuro |
|---|---|---|
| `--color-primary` | `#2b6cbd` | — |
| `--color-accent` | `#1f8a8f` | — |
| `--color-bg-main` | `#d1d5db` | `#111827` |
| `--color-surface` | `#e5e7eb` | `#1f2937` |
| `--color-sidebar-bg` | `#1e3a5f` | `#0b1220` |
| `--color-danger` | `#b42318` | — |

### Estados de negocio

| Estado | Color |
|---|---|
| `PETICION` | `#f59e0b` (ámbar) |
| `CONFIRMADA` | `#2563eb` (azul) |
| Contratado | `#15803d` (verde) |
| No disponible | `#64748b` (gris) |
| Bloqueado | `#7c3aed` (violeta) |

### Logos disponibles en `public/brand/`

| Archivo | Uso |
|---|---|
| `rentiq-logo-dark.png` | Pantalla de login |
| `logo_RIQ_compl_osc_pq.png` | Sidebar |
| `rentiq-isotipo.svg` / `R.png` | Favicon / piezas compactas |

---

## Licencia

Proyecto privado. Todos los derechos reservados.
