export default function EntregasPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Entregas</h1>
          <p className="page-subtitle">Vehículos pendientes de entrega</p>
        </div>
      </div>
      <div className="card">
        <div className="empty-state">
          <div className="empty-state__icon">🚗</div>
          <div className="empty-state__text">Módulo de entregas en construcción.</div>
        </div>
      </div>
    </div>
  );
}
