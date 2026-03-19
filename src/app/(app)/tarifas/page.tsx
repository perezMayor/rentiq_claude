export default function TarifasPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tarifas</h1>
          <p className="page-subtitle">Gestión de planes tarifarios</p>
        </div>
      </div>
      <div className="card">
        <div className="empty-state">
          <div className="empty-state__icon">💲</div>
          <div className="empty-state__text">Módulo de tarifas en construcción. Requiere rol ADMIN o superior.</div>
        </div>
      </div>
    </div>
  );
}
