export default function AyudaPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Ayuda</h1>
          <p className="page-subtitle">Documentación y soporte de RentIQ Gestión</p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginTop: 8 }}>
        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Primeros pasos</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            Aprende a configurar sucursales, usuarios, categorías y tarifas antes de comenzar a operar.
          </p>
        </div>

        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Flujo operativo</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            Reserva → Contrato → Checkout → Checkin → Factura. El circuito completo de alquiler.
          </p>
        </div>

        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Roles y permisos</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            Super Admin, Admin y Lector. Cada rol accede a diferentes módulos y operaciones.
          </p>
        </div>

        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Backups y recuperación</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            El sistema realiza copias de seguridad automáticas. Gestiona backups desde Gestor → Backups.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ fontWeight: 600, marginBottom: 12 }}>Atajos de teclado</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          {[
            ['Nueva reserva', 'Reservas → Nueva reserva'],
            ['Nuevo contrato', 'Contratos → Nuevo'],
            ['Buscar cliente', 'Clientes → Listados'],
            ['Ver flota', 'Vehículos → Listados'],
          ].map(([action, path]) => (
            <div key={action} style={{ display: 'flex', flexDirection: 'column', padding: '10px 14px', background: 'var(--color-bg-main)', borderRadius: 6, gap: 2 }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{action}</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{path}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="empty-state" style={{ marginTop: 32 }}>
        <div className="empty-state__icon">🚧</div>
        <div className="empty-state__text">Documentación completa — Próximamente</div>
      </div>
    </div>
  );
}
