# RentIQ Gestión V3 — Project Documentation

## Purpose and Main Goal

**RentIQ Gestión V3** is a self-contained operational management and control system for car rental (rent-a-car) companies. It manages the complete lifecycle of vehicle rentals: from reservations and contracts through fleet management, invoicing, daily expenses, and financial reporting.

The system is designed to be fully independent and deployable without external cloud dependencies — no third-party database, no external auth provider. Everything runs locally or on a single server with SMTP for email delivery.

---

## Target Users and Roles

The application uses a three-tier role hierarchy with strict access control:

| Role | Description | Key Permissions |
|---|---|---|
| **SUPER_ADMIN** | Full system access | All modules + backups, restore, user management, company settings |
| **ADMIN** | Operational manager | All modules except backups/restore and critical system config |
| **LECTOR** | Read-only observer | Dashboard, reservations, contracts, planning, deliveries, pickups, help — no write access |

LECTOR users are automatically blocked from tariffs, gestor/admin settings, invoicing write actions, and all create/edit/delete operations.

A **demo mode** is available with pre-configured users for each role to allow testing without persistent data changes.

---

## Main Modules and Features

### Core Operational Modules

#### 1. Dashboard (`/dashboard`)
- Real-time operational overview with KPI metrics
- Smart alerts for vehicle maintenance and upcoming events
- Agenda view of daily deliveries and pickups
- Reservation forecast visualization
- Manual audit event logging

#### 2. Reservas — Reservations (`/reservas`)
- Create, edit, delete, and manage commercial reservations
- Multi-tab UI: management, deliveries, pickups, location search, channels, audit logs, planning, budgets
- Convert reservations to operational contracts
- Plate assignment with overlap detection
- Reservation confirmation document generation (PDF) and email dispatch
- Sales channel management and statistics
- Vehicle blocking for date intervals
- Full audit trail per reservation

#### 3. Contratos — Contracts (`/contratos`)
- Operational contract lifecycle (check-out → active → check-in → closed)
- Check-out and check-in registration (KM, fuel level, photos, signature, notes)
- Cash payment recording (EFECTIVO, TARJETA, TRANSFERENCIA, OTRO)
- Mid-contract vehicle substitution
- Internal expense linking
- Contract closure (triggers invoice generation)
- Contract renumbering
- Historical view of closed contracts

#### 4. Vehículos — Fleet Management (`/vehiculos`)
- **Vehicle Groups/Categories**: Commercial classification CRUD
- **Models**: Brand/model catalog (transmission, features, fuel type)
- **Fleet**: Active/inactive vehicle registration (plate, VIN, year, color, owner, odometer)
- **Extras/Addons**: Insurance and extra service pricing (fixed or per-day)
- **Production Summary**: Daily vehicle utilization reports
- **Vehicle Tasks**: Maintenance tracking (cleaning, ITV, inspection, revision)

#### 5. Clientes — Clients (`/clientes`)
- Three client types: PARTICULAR (individual), EMPRESA (company), COMISIONISTA (commission agent)
- Full client data: personal/company info, documents, driver's license, contact, addresses
- Commission tracking for commission agents
- Client reservation history and financial summary

#### 6. Facturación — Invoicing (`/facturacion`)
- Invoice generation from contract closure or manually
- Invoice types: F (Factura), V (Venta), R (Rectificativa), A (Abono)
- Invoice statuses: BORRADOR (draft), FINAL (finalized/locked)
- Email dispatch with PDF attachment and send log tracking
- Invoice journal (expense reconciliation)
- Contract closure reconciliation view
- PDF download and visualization

#### 7. Plantillas — Templates (`/plantillas`)
- Reusable HTML templates for emails and documents:
  - Reservation confirmation, budget/quote, invoice, contract, cancellations
- Template macro system (injects company data, client data, rental details)
- Visual drag-and-drop template editor (feature flagged)
- Raw HTML editor for advanced customization
- Template preview with sample data
- Multi-language support (Spanish/English)

#### 8. Tarifas — Tariffs (`/tarifas`) — ADMIN+ only
- Seasonal tariff plan management with validity dates
- Pricing modes: PRECIO_A, PRECIO_B, PRECIO_C
- Day-range brackets (1-3 days, 4-7 days, extra days, etc.)
- Price matrix by vehicle group and bracket
- Max KM per day constraints
- CSV bulk import

#### 9. Gastos — Daily Expenses (`/gastos`)
- Categories: PEAJE, GASOLINA, COMIDA, PARKING, LAVADO, OTRO
- Batch expense entry distributed across active vehicles
- Worker/employee assignment
- Validation: only active vehicles on the entry date
- Historical view with filters

#### 10. Ayuda — Help (`/ayuda`)
- Embedded help documentation and user guides
- Module-specific contextual help

### Admin/Advanced Modules

#### 11. Gestor — System Manager (`/gestor`) — ADMIN+
- **Users**: Create/edit/activate/deactivate user accounts, password management
- **Branches**: Multi-branch configuration (address, phone, email, schedule, contract counters)
- **Branch Schedule**: Weekly hours and exception dates per branch
- **Backups**: List/filter backups, restore with confirmation, force backup (SUPER_ADMIN only)
- **Scheduled Backup Status**: Visibility into automated backup job

#### 12. Planning Completo — Full Planning Grid (`/planning-completo`)
- Interactive grid of vehicle availability across 30/60/90-day periods
- Filter by plate, vehicle group, model, branch
- Manual plate assignment to reservations
- Drag-and-drop reassignment (feature flag controlled)
- Override confirmation for conflicts and group changes

---

## Tech Stack

### Framework & Runtime

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.1.6 |
| UI Library | React | 19.2.3 |
| Language | TypeScript (strict) | 5.x |
| Runtime | Node.js | — |
| Package Manager | npm | — |
| Bundler | Next.js Turbopack | built-in |

### Frontend

| Concern | Technology |
|---|---|
| Styling | Custom CSS Modules + styled-jsx (built-in to Next.js) |
| Font | Poppins (Google Fonts) |
| Theme | Custom light/dark/system toggle (localStorage-persisted) |
| UI Components | Fully custom-built — no external component library |

### Backend & Persistence

| Concern | Technology |
|---|---|
| API | Next.js API Routes (REST) |
| Persistence | Filesystem-based JSON storage (no SQL/NoSQL database) |
| Main data file | `rental-store.json` (single JSON file, all operational data) |
| Audit log | `audit-log.jsonl` (append-only JSON Lines) |
| Backups | Timestamped snapshots with SHA-256 integrity checksums |
| Data path | Configurable via `RENTIQ_DATA_DIR` env var |
| Authentication | Custom email/password with HTTP-only session cookies |
| Concurrency | File-based action lock (`action-lock.ts`) |

### Document & Email

| Concern | Library | Version |
|---|---|---|
| PDF Generation | PDFKit | 0.17.2 |
| Email Dispatch | Nodemailer | 8.0.1 |
| Template Rendering | Custom macro engine | — |

### Development & Testing

| Tool | Purpose | Version |
|---|---|---|
| ESLint | Linting | 9.x |
| Playwright | End-to-end testing | 1.58.2 |
| @swc/helpers | SWC performance optimization | 0.5.19 |

### Key Environment Variables

```env
RENTIQ_DATA_DIR                   # Local data directory (default: ./.rentiq-v3-data)
BACKUP_SCHEDULE_TOKEN             # Bearer token for scheduled backup cron endpoint
BACKUP_RETENTION_DAYS             # Days to retain backups (default: 90)
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_SECURE / MAIL_FROM
ENABLE_DASHBOARD_SMART_ALERTS     # Feature flag
ENABLE_PLANNING_DRAGDROP          # Feature flag
ENABLE_VISUAL_TEMPLATE_EDITOR     # Feature flag
ENABLE_STRICT_ACTION_LOCK         # Feature flag
```

---

## Domain Data Model (Core Entities)

| Entity | Description |
|---|---|
| `Reservation` | Commercial booking (PETICION / CONFIRMADA / CANCELADA) |
| `Contract` | Operational rental agreement (ABIERTO / CERRADO / CANCELADO) |
| `Invoice` | Billing document (BORRADOR / FINAL) |
| `Client` | Customer (PARTICULAR / EMPRESA / COMISIONISTA) |
| `FleetVehicle` | Physical vehicle asset with plate, VIN, category |
| `VehicleCategory` | Commercial vehicle group/classification |
| `VehicleModel` | Brand/model catalog entry |
| `VehicleExtra` | Optional add-on (insurance, extra service) |
| `TariffPlan` | Seasonal pricing structure |
| `TariffBracket` | Day-range bracket within a plan |
| `TariffPrice` | Price matrix cell (group + bracket + plan) |
| `InternalExpense` | Non-billable operational cost |
| `VehicleTask` | Maintenance task (cleaning, ITV, revision) |
| `TemplateDocument` | Reusable HTML email/document template |
| `UserAccount` | Staff user with role |
| `CompanyBranch` | Business location with schedule and counters |
| `CompanySettings` | Global fiscal and operational configuration |

---

## Architecture Notes

- **No external database**: All data is stored as a single JSON file on disk, making the system portable and easy to back up/restore without database tooling.
- **No external auth provider**: Session management uses HTTP-only cookies with custom credential validation.
- **Multi-branch**: Each branch has its own contract/invoice numbering counters, schedule, and user assignments.
- **Audit compliance**: An append-only audit log captures all significant user and system events. Logical suppression hides events in UI without physical deletion.
- **Feature flags**: Environment-level flags allow progressive rollout of experimental features (smart alerts, drag-and-drop planning, visual template editor).
- **Demo mode**: Pre-seeded data and demo users allow evaluation without affecting persistent state.

---

*Generated: 2026-03-18*
