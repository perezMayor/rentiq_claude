export default function GestorPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestor</h1>
          <p className="page-subtitle">Administración del sistema y auditoría</p>
        </div>
      </div>
      <div className="card">
        <div className="empty-state">
          <div className="empty-state__icon">⚙️</div>
          <div className="empty-state__text">Panel de administración en construcción. Requiere rol ADMIN o superior.</div>
        </div>
      </div>
    </div>
  );
}
