'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import DatePicker from '@/src/components/DatePicker';
import styles from './vehiculos.module.css';
import PrintButton from '@/src/components/PrintButton';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Branch {
  id: string;
  name: string;
  active: boolean;
}

interface VehicleModel {
  id: string;
  brand: string;
  model: string;
  categoryId: string;
  transmission: 'MANUAL' | 'AUTOMATICO';
  fuel: 'GASOLINA' | 'DIESEL' | 'ELECTRICO' | 'HIBRIDO';
  seats: number;
  doors?: number;
  year?: number;
  features: string[];
  active: boolean;
}

interface FleetVehicle {
  id: string;
  plate: string;
  vin?: string;
  modelId: string;
  categoryId: string;
  branchId: string;
  year: number;
  color?: string;
  owner: string;
  currentOdometer: number;
  active: boolean;
  activeFrom: string;
  activeTo?: string;
  notes?: string;
}

interface VehicleExtra {
  id: string;
  code: string;
  name: string;
  pricingMode: 'FIXED' | 'PER_DAY';
  unitPrice: number;
  maxDays?: number;
  applicableGroupIds?: string[];
  active: boolean;
}

interface VehicleInsurance {
  id: string;
  code: string;
  name: string;
  pricingMode: 'FIXED' | 'PER_DAY';
  unitPrice: number;
  maxDays?: number;
  applicableGroupIds?: string[];
  active: boolean;
}

interface VehicleCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  defaultInsuranceId?: string;
  insuranceCode?: string;
  insuranceAmount?: number;
  franchiseAmount?: number;
  fuelChargeAmount?: number;
  active: boolean;
}

type Tab = 'flota' | 'categorias' | 'modelos' | 'extras' | 'seguros';

interface ContractSummary {
  id: string;
  plate: string;
  billedDays: number;
  totalAmount: number;
  status: string;
  startDate: string;
  endDate?: string;
}

// ─── Blank form states ──────────────────────────────────────────────────────

const blankVehicle = (): Partial<FleetVehicle> => ({
  plate: '',
  modelId: '',
  categoryId: '',
  branchId: '',
  year: new Date().getFullYear(),
  color: '',
  owner: 'PROPIO',
  currentOdometer: 0,
  active: true,
  activeFrom: new Date().toISOString().slice(0, 10),
  notes: '',
});

const blankCategory = (): Partial<VehicleCategory> => ({
  code: '',
  name: '',
  description: '',
  insuranceCode: '',
  insuranceAmount: 0,
  franchiseAmount: 0,
  fuelChargeAmount: 0,
  active: true,
});

const blankModel = (): {
  brand: string;
  model: string;
  categoryId: string;
  transmission: 'MANUAL' | 'AUTOMATICO';
  fuel: 'GASOLINA' | 'DIESEL' | 'ELECTRICO' | 'HIBRIDO';
  seats: number;
  doors: number;
  year: number;
  features: string[];
  active: boolean;
} => ({
  brand: '',
  model: '',
  categoryId: '',
  transmission: 'MANUAL',
  fuel: 'GASOLINA',
  seats: 5,
  doors: 5,
  year: new Date().getFullYear(),
  features: [],
  active: true,
});

const blankExtra = (): Partial<VehicleExtra> => ({
  code: '',
  name: '',
  pricingMode: 'FIXED',
  unitPrice: 0,
  applicableGroupIds: [],
  active: true,
});

const blankInsurance = (): Partial<VehicleInsurance> => ({
  code: '',
  name: '',
  pricingMode: 'PER_DAY',
  unitPrice: 0,
  maxDays: undefined,
  applicableGroupIds: [],
  active: true,
});

// ─── Vehicle features list ──────────────────────────────────────────────────

const VEHICLE_FEATURES = [
  'Aire acondicionado', 'GPS / Navegador', 'Bluetooth', 'USB / AUX',
  'Cámara trasera', 'Sensores aparcamiento', 'Control crucero',
  'Arranque sin llave', 'Techo solar / panorámico', 'Apple CarPlay / Android Auto',
  'Asientos calefactados', '4x4 / AWD', 'Cargador eléctrico',
  'Asistente de carril', 'Freno de emergencia autónomo',
];

// ─── Component ─────────────────────────────────────────────────────────────

function VehiculosContent({ initialTab }: { initialTab?: Tab }) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'flota');

  // Data
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [extras, setExtras] = useState<VehicleExtra[]>([]);
  const [insurances, setInsurances] = useState<VehicleInsurance[]>([]);

  // Flota filters
  const [filterActive, setFilterActive] = useState(true);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPlate, setFilterPlate] = useState('');
  const [hasSearchedFlota, setHasSearchedFlota] = useState(false);

  // Modal state
  const [vehicleModal, setVehicleModal] = useState<'create' | 'edit' | null>(null);
  const [categoryModal, setCategoryModal] = useState<'create' | 'edit' | null>(null);
  const [modelModal, setModelModal] = useState<'create' | 'edit' | null>(null);
  const [extraModal, setExtraModal] = useState<'create' | 'edit' | null>(null);
  const [insuranceModal, setInsuranceModal] = useState<'create' | 'edit' | null>(null);

  // Form data
  const [vehicleForm, setVehicleForm] = useState<Partial<FleetVehicle>>(blankVehicle());
  const [categoryForm, setCategoryForm] = useState<Partial<VehicleCategory>>(blankCategory());
  const [modelForm, setModelForm] = useState<ReturnType<typeof blankModel>>(blankModel());
  const [extraForm, setExtraForm] = useState<Partial<VehicleExtra>>(blankExtra());
  const [insuranceForm, setInsuranceForm] = useState<Partial<VehicleInsurance>>(blankInsurance());

  // Editing IDs
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editingExtraId, setEditingExtraId] = useState<string | null>(null);
  const [editingInsuranceId, setEditingInsuranceId] = useState<string | null>(null);

  // Error/loading
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ─── Data fetching ─────────────────────────────────────────────────────

  const fetchBranches = useCallback(async () => {
    try {
      const res = await fetch('/api/sucursales');
      if (res.ok) {
        const data = await res.json() as { branches: Branch[] };
        setBranches(data.branches ?? []);
      }
    } catch {
      // non-critical
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/vehiculos/categorias');
      if (res.ok) {
        const data = await res.json() as { categories: VehicleCategory[] };
        setCategories(data.categories ?? []);
      }
    } catch {
      // non-critical
    }
  }, []);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch('/api/vehiculos/modelos');
      if (res.ok) {
        const data = await res.json() as { models: VehicleModel[] };
        setModels(data.models ?? []);
      }
    } catch {
      // non-critical
    }
  }, []);

  const fetchVehicles = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('active', String(filterActive));
      if (filterBranch) params.set('branchId', filterBranch);
      if (filterCategory) params.set('categoryId', filterCategory);
      if (filterPlate) params.set('search', filterPlate);

      const res = await fetch(`/api/vehiculos/flota?${params.toString()}`);
      if (res.ok) {
        const data = await res.json() as { vehicles: FleetVehicle[] };
        setVehicles(data.vehicles ?? []);
      }
    } catch {
      // non-critical
    }
  }, [filterActive, filterBranch, filterCategory, filterPlate]);

  const fetchExtras = useCallback(async () => {
    try {
      const res = await fetch('/api/vehiculos/extras');
      if (res.ok) {
        const data = await res.json() as { extras: VehicleExtra[] };
        setExtras(data.extras ?? []);
      }
    } catch {
      // non-critical
    }
  }, []);

  const fetchInsurances = useCallback(async () => {
    try {
      const res = await fetch('/api/vehiculos/seguros');
      if (res.ok) {
        const data = await res.json() as { insurances: VehicleInsurance[] };
        setInsurances(data.insurances ?? []);
      }
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void fetchBranches();
    void fetchCategories();
    void fetchModels();
    void fetchExtras();
    void fetchInsurances();
  }, [fetchBranches, fetchCategories, fetchModels, fetchExtras, fetchInsurances]);

  useEffect(() => {
    void fetchVehicles();
  }, [fetchVehicles]);

  // ─── Helpers ──────────────────────────────────────────────────────────

  const getCategoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? id;

  const getModelLabel = (id: string) => {
    const m = models.find((m) => m.id === id);
    return m ? `${m.brand} ${m.model}` : id;
  };

  const getBranchName = (id: string) =>
    branches.find((b) => b.id === id)?.name ?? id;

  const modelsForCategory = (categoryId: string) =>
    models.filter((m) => m.categoryId === categoryId && m.active);

  // ─── Vehicle CRUD ──────────────────────────────────────────────────────

  const openCreateVehicle = () => {
    setVehicleForm(blankVehicle());
    setEditingVehicleId(null);
    setError(null);
    setVehicleModal('create');
  };

  const openEditVehicle = (v: FleetVehicle) => {
    setVehicleForm({ ...v });
    setEditingVehicleId(v.id);
    setError(null);
    setVehicleModal('edit');
  };

  const saveVehicle = async () => {
    setError(null);
    setSaving(true);
    try {
      const isEdit = vehicleModal === 'edit';
      const url = isEdit
        ? `/api/vehiculos/flota/${editingVehicleId}`
        : '/api/vehiculos/flota';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        ...vehicleForm,
        plate: (vehicleForm.plate ?? '').toUpperCase(),
        year: Number(vehicleForm.year),
        currentOdometer: Number(vehicleForm.currentOdometer),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Error al guardar');
        return;
      }
      setVehicleModal(null);
      void fetchVehicles();
    } finally {
      setSaving(false);
    }
  };

  const toggleVehicleActive = async (v: FleetVehicle) => {
    const now = new Date().toISOString().slice(0, 10);
    await fetch(`/api/vehiculos/flota/${v.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        active: !v.active,
        ...(v.active ? { activeTo: now } : { activeTo: undefined }),
      }),
    });
    void fetchVehicles();
  };

  // ─── Category CRUD ────────────────────────────────────────────────────

  const openCreateCategory = () => {
    setCategoryForm(blankCategory());
    setEditingCategoryId(null);
    setError(null);
    setCategoryModal('create');
  };

  const openEditCategory = (c: VehicleCategory) => {
    setCategoryForm({ ...c });
    setEditingCategoryId(c.id);
    setError(null);
    setCategoryModal('edit');
  };

  const saveCategory = async () => {
    setError(null);
    setSaving(true);
    try {
      const isEdit = categoryModal === 'edit';
      const url = isEdit
        ? `/api/vehiculos/categorias/${editingCategoryId}`
        : '/api/vehiculos/categorias';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        ...categoryForm,
        code: (categoryForm.code ?? '').toUpperCase(),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Error al guardar');
        return;
      }
      setCategoryModal(null);
      void fetchCategories();
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Eliminar esta categoría?')) return;
    const res = await fetch(`/api/vehiculos/categorias/${id}`, { method: 'DELETE' });
    const data = await res.json() as { error?: string };
    if (!res.ok) {
      alert(data.error ?? 'No se pudo eliminar');
      return;
    }
    void fetchCategories();
  };

  // ─── Model CRUD ───────────────────────────────────────────────────────

  const openCreateModel = () => {
    setModelForm(blankModel());
    setEditingModelId(null);
    setError(null);
    setModelModal('create');
  };

  const openEditModel = (m: VehicleModel) => {
    setModelForm({
      brand: m.brand,
      model: m.model,
      categoryId: m.categoryId,
      transmission: m.transmission,
      fuel: m.fuel,
      seats: m.seats,
      doors: m.doors ?? 5,
      year: m.year ?? new Date().getFullYear(),
      features: m.features ?? [],
      active: m.active,
    });
    setEditingModelId(m.id);
    setError(null);
    setModelModal('edit');
  };

  const saveModel = async () => {
    setError(null);
    setSaving(true);
    try {
      const isEdit = modelModal === 'edit';
      const url = isEdit
        ? `/api/vehiculos/modelos/${editingModelId}`
        : '/api/vehiculos/modelos';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        ...modelForm,
        features: modelForm.features,
        seats: Number(modelForm.seats),
        doors: Number(modelForm.doors),
        year: Number(modelForm.year),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Error al guardar');
        return;
      }
      setModelModal(null);
      void fetchModels();
    } finally {
      setSaving(false);
    }
  };

  const deleteModel = async (id: string) => {
    if (!confirm('Eliminar este modelo?')) return;
    const res = await fetch(`/api/vehiculos/modelos/${id}`, { method: 'DELETE' });
    const data = await res.json() as { error?: string };
    if (!res.ok) {
      alert(data.error ?? 'No se pudo eliminar');
      return;
    }
    void fetchModels();
  };

  // ─── Extra CRUD ───────────────────────────────────────────────────────

  const openCreateExtra = () => {
    setExtraForm(blankExtra());
    setEditingExtraId(null);
    setError(null);
    setExtraModal('create');
  };

  const openEditExtra = (e: VehicleExtra) => {
    setExtraForm({ ...e, applicableGroupIds: e.applicableGroupIds ?? [] });
    setEditingExtraId(e.id);
    setError(null);
    setExtraModal('edit');
  };

  const saveExtra = async () => {
    setError(null);
    setSaving(true);
    try {
      const isEdit = extraModal === 'edit';
      const url = isEdit
        ? `/api/vehiculos/extras/${editingExtraId}`
        : '/api/vehiculos/extras';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        ...extraForm,
        code: (extraForm.code ?? '').toUpperCase(),
        unitPrice: Number(extraForm.unitPrice),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Error al guardar');
        return;
      }
      setExtraModal(null);
      void fetchExtras();
    } finally {
      setSaving(false);
    }
  };

  const deleteExtra = async (id: string) => {
    if (!confirm('Eliminar este extra?')) return;
    const res = await fetch(`/api/vehiculos/extras/${id}`, { method: 'DELETE' });
    const data = await res.json() as { error?: string };
    if (!res.ok) {
      alert(data.error ?? 'No se pudo eliminar');
      return;
    }
    void fetchExtras();
  };

  // ─── Insurance CRUD ───────────────────────────────────────────────────

  const openCreateInsurance = () => {
    setInsuranceForm(blankInsurance());
    setEditingInsuranceId(null);
    setError(null);
    setInsuranceModal('create');
  };

  const openEditInsurance = (i: VehicleInsurance) => {
    setInsuranceForm({ ...i, applicableGroupIds: i.applicableGroupIds ?? [] });
    setEditingInsuranceId(i.id);
    setError(null);
    setInsuranceModal('edit');
  };

  const saveInsurance = async () => {
    setError(null);
    setSaving(true);
    try {
      const isEdit = insuranceModal === 'edit';
      const url = isEdit
        ? `/api/vehiculos/seguros/${editingInsuranceId}`
        : '/api/vehiculos/seguros';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        ...insuranceForm,
        code: (insuranceForm.code ?? '').toUpperCase(),
        unitPrice: Number(insuranceForm.unitPrice),
        maxDays: insuranceForm.maxDays ? Number(insuranceForm.maxDays) : undefined,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Error al guardar');
        return;
      }
      setInsuranceModal(null);
      void fetchInsurances();
    } finally {
      setSaving(false);
    }
  };

  const deleteInsurance = async (id: string) => {
    if (!confirm('Eliminar este seguro?')) return;
    const res = await fetch(`/api/vehiculos/seguros/${id}`, { method: 'DELETE' });
    const data = await res.json() as { error?: string };
    if (!res.ok) {
      alert(data.error ?? 'No se pudo eliminar');
      return;
    }
    void fetchInsurances();
  };

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <div className="page-header">
        <div />
        {activeTab === 'categorias' && (
          <button className="btn btn-primary" onClick={openCreateCategory}>
            + Añadir grupo
          </button>
        )}
        {activeTab === 'modelos' && (
          <button className="btn btn-primary" onClick={openCreateModel}>
            + Añadir modelo
          </button>
        )}
        {activeTab === 'extras' && (
          <button className="btn btn-primary" onClick={openCreateExtra}>
            + Nuevo Extra
          </button>
        )}
        {activeTab === 'seguros' && (
          <button className="btn btn-primary" onClick={openCreateInsurance}>
            + Nuevo Seguro
          </button>
        )}
      </div>

      {/* ── TAB: FLOTA ─────────────────────────────────────────────────────── */}
      {activeTab === 'flota' && (
        <>
          <div className="filters-bar">
            <label className={styles.filterCheckbox}>
              <input
                type="checkbox"
                checked={filterActive}
                onChange={(e) => { setFilterActive(e.target.checked); setHasSearchedFlota(true); }}
              />
              Solo activos
            </label>
            <select
              className="form-select"
              value={filterBranch}
              onChange={(e) => { setFilterBranch(e.target.value); setHasSearchedFlota(true); }}
            >
              <option value="">Todas las sucursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              className="form-select"
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setHasSearchedFlota(true); }}
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            <input
              className="form-input"
              placeholder="Buscar matrícula..."
              value={filterPlate}
              onChange={(e) => { setFilterPlate(e.target.value); setHasSearchedFlota(true); }}
            />
          </div>

          {!hasSearchedFlota ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '24px 0', textAlign: 'center' }}>Aplica los filtros para ver el listado.</div>
          ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Modelo</th>
                  <th>Categoría</th>
                  <th>Sucursal</th>
                  <th>Año</th>
                  <th>Propietario</th>
                  <th>Odómetro</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="empty-state">
                        <div className="empty-state__text">No hay vehículos que coincidan con los filtros.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  vehicles.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <span className={styles.plate}>{v.plate}</span>
                      </td>
                      <td>{getModelLabel(v.modelId)}</td>
                      <td>{getCategoryName(v.categoryId)}</td>
                      <td>{getBranchName(v.branchId)}</td>
                      <td>{v.year}</td>
                      <td>{v.owner}</td>
                      <td>{v.currentOdometer.toLocaleString()} km</td>
                      <td>
                        <span
                          className={`badge ${v.active ? 'badge-confirmada' : 'badge-cancelada'}`}
                        >
                          {v.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionsCell}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => openEditVehicle(v)}
                          >
                            Editar
                          </button>
                          <button
                            className={`btn btn-sm ${v.active ? 'btn-ghost' : 'btn-accent'}`}
                            onClick={() => void toggleVehicleActive(v)}
                          >
                            {v.active ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}

      {/* ── TAB: CATEGORIAS ─────────────────────────────────────────────────── */}
      {activeTab === 'categorias' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Seguro</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-state__text">No hay categorías definidas.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                categories.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.code}</strong>
                    </td>
                    <td>{c.name}</td>
                    <td className="text-muted">{c.description ?? '—'}</td>
                    <td className="text-muted" style={{ fontSize: '0.82rem' }}>
                      {insurances.find((i) => i.id === c.defaultInsuranceId)?.name ?? '—'}
                    </td>
                    <td>
                      <span
                        className={`badge ${c.active ? 'badge-confirmada' : 'badge-cancelada'}`}
                      >
                        {c.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionsCell}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openEditCategory(c)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => void deleteCategory(c.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB: MODELOS ────────────────────────────────────────────────────── */}
      {activeTab === 'modelos' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Marca</th>
                <th>Modelo</th>
                <th>Categoría</th>
                <th>Transmisión</th>
                <th>Combustible</th>
                <th>Plazas</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {models.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <div className="empty-state__text">No hay modelos definidos.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                models.map((m) => (
                  <tr key={m.id}>
                    <td>{m.brand}</td>
                    <td>{m.model}</td>
                    <td>{getCategoryName(m.categoryId)}</td>
                    <td>{m.transmission}</td>
                    <td>{m.fuel}</td>
                    <td>{m.seats}</td>
                    <td>
                      <span
                        className={`badge ${m.active ? 'badge-confirmada' : 'badge-cancelada'}`}
                      >
                        {m.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionsCell}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openEditModel(m)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => void deleteModel(m.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB: EXTRAS ─────────────────────────────────────────────────────── */}
      {activeTab === 'extras' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Modo precio</th>
                <th>Precio unitario</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {extras.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-state__text">No hay extras definidos.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                extras.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.code}</strong>
                    </td>
                    <td>{e.name}</td>
                    <td>{e.pricingMode === 'FIXED' ? 'Precio fijo' : 'Por día'}</td>
                    <td>{e.unitPrice.toFixed(2)} €</td>
                    <td>
                      <span
                        className={`badge ${e.active ? 'badge-confirmada' : 'badge-cancelada'}`}
                      >
                        {e.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionsCell}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openEditExtra(e)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => void deleteExtra(e.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB: SEGUROS ─────────────────────────────────────────────────── */}
      {activeTab === 'seguros' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Tipo precio</th>
                <th>Precio ud.</th>
                <th>Máx. días</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {insurances.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-state__text">No hay seguros definidos.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                insurances.map((ins) => (
                  <tr key={ins.id}>
                    <td><strong>{ins.code}</strong></td>
                    <td>{ins.name}</td>
                    <td>{ins.pricingMode === 'FIXED' ? 'Precio fijo' : 'Por día'}</td>
                    <td>{ins.unitPrice.toFixed(2)} €</td>
                    <td style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      {ins.maxDays ?? '—'}
                    </td>
                    <td>
                      <span className={`badge ${ins.active ? 'badge-confirmada' : 'badge-cancelada'}`}>
                        {ins.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionsCell}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditInsurance(ins)}>
                          Editar
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => void deleteInsurance(ins.id)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODAL: VEHÍCULO ─────────────────────────────────────────────────── */}
      {vehicleModal !== null && (
        <div className="modal-overlay" onClick={() => setVehicleModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">
                {vehicleModal === 'create' ? 'Nuevo Vehículo' : 'Editar Vehículo'}
              </h2>
              <button className="modal__close" onClick={() => setVehicleModal(null)}>
                ×
              </button>
            </div>
            <div className="modal__body">
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Matrícula *</label>
                  <input
                    className="form-input"
                    value={vehicleForm.plate ?? ''}
                    onChange={(e) =>
                      setVehicleForm({ ...vehicleForm, plate: e.target.value.toUpperCase() })
                    }
                    readOnly={vehicleModal === 'edit'}
                    style={vehicleModal === 'edit' ? { opacity: 0.6 } : undefined}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Sucursal *</label>
                  <select
                    className="form-select"
                    value={vehicleForm.branchId ?? ''}
                    onChange={(e) =>
                      setVehicleForm({ ...vehicleForm, branchId: e.target.value })
                    }
                  >
                    <option value="">Seleccionar sucursal</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Categoría *</label>
                  <select
                    className="form-select"
                    value={vehicleForm.categoryId ?? ''}
                    onChange={(e) =>
                      setVehicleForm({
                        ...vehicleForm,
                        categoryId: e.target.value,
                        modelId: '',
                      })
                    }
                  >
                    <option value="">Seleccionar categoría</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Modelo *</label>
                  <select
                    className="form-select"
                    value={vehicleForm.modelId ?? ''}
                    onChange={(e) =>
                      setVehicleForm({ ...vehicleForm, modelId: e.target.value })
                    }
                    disabled={!vehicleForm.categoryId}
                  >
                    <option value="">Seleccionar modelo</option>
                    {modelsForCategory(vehicleForm.categoryId ?? '').map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.brand} {m.model}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Año *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={vehicleForm.year ?? ''}
                    onChange={(e) =>
                      setVehicleForm({ ...vehicleForm, year: Number(e.target.value) })
                    }
                    min={1990}
                    max={new Date().getFullYear() + 1}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Propietario *</label>
                  <select
                    className="form-select"
                    value={vehicleForm.owner ?? 'PROPIO'}
                    onChange={(e) =>
                      setVehicleForm({ ...vehicleForm, owner: e.target.value })
                    }
                  >
                    <option value="PROPIO">PROPIO</option>
                    <option value="RENTING">RENTING</option>
                    <option value="EXTERNO">EXTERNO</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Color</label>
                  <input
                    className="form-input"
                    value={vehicleForm.color ?? ''}
                    onChange={(e) =>
                      setVehicleForm({ ...vehicleForm, color: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Odómetro actual (km) *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={vehicleForm.currentOdometer ?? 0}
                    onChange={(e) =>
                      setVehicleForm({
                        ...vehicleForm,
                        currentOdometer: Number(e.target.value),
                      })
                    }
                    min={0}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de alta *</label>
                  <DatePicker
                    className="form-input"
                    value={vehicleForm.activeFrom ?? ''}
                    onChange={(v) =>
                      setVehicleForm({ ...vehicleForm, activeFrom: v })
                    }
                  />
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">Notas</label>
                  <textarea
                    className="form-textarea"
                    value={vehicleForm.notes ?? ''}
                    onChange={(e) =>
                      setVehicleForm({ ...vehicleForm, notes: e.target.value })
                    }
                    rows={3}
                  />
                </div>
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setVehicleModal(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void saveVehicle()}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CATEGORÍA ────────────────────────────────────────────────── */}
      {categoryModal !== null && (
        <div className="modal-overlay" onClick={() => setCategoryModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">
                {categoryModal === 'create' ? 'Nueva Categoría' : 'Editar Categoría'}
              </h2>
              <button className="modal__close" onClick={() => setCategoryModal(null)}>
                ×
              </button>
            </div>
            <div className="modal__body">
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Código *</label>
                  <input
                    className="form-input"
                    value={categoryForm.code ?? ''}
                    onChange={(e) =>
                      setCategoryForm({
                        ...categoryForm,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input
                    className="form-input"
                    value={categoryForm.name ?? ''}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, name: e.target.value })
                    }
                  />
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">Descripción</label>
                  <input
                    className="form-input"
                    value={categoryForm.description ?? ''}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, description: e.target.value })
                    }
                  />
                </div>
                <div style={{ gridColumn: '1/-1', borderBottom: '1px solid var(--color-border)', paddingBottom: 4, marginTop: 8, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Seguro del grupo</div>
                <div className="form-group">
                  <label className="form-label">Código seguro</label>
                  <input
                    className="form-input"
                    placeholder="Código seguro"
                    value={categoryForm.insuranceCode ?? ''}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, insuranceCode: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Importe seguro (€)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Importe €"
                    value={categoryForm.insuranceAmount ?? 0}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, insuranceAmount: Number(e.target.value) })
                    }
                    step={0.01}
                    min={0}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Franquicia (€)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Importe franquicia €"
                    value={categoryForm.franchiseAmount ?? 0}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, franchiseAmount: Number(e.target.value) })
                    }
                    step={0.01}
                    min={0}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Cargo combustible (€)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Cargo combustible €"
                    value={categoryForm.fuelChargeAmount ?? 0}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, fuelChargeAmount: Number(e.target.value) })
                    }
                    step={0.01}
                    min={0}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select
                    className="form-select"
                    value={categoryForm.active ? 'true' : 'false'}
                    onChange={(e) =>
                      setCategoryForm({
                        ...categoryForm,
                        active: e.target.value === 'true',
                      })
                    }
                  >
                    <option value="true">Activa</option>
                    <option value="false">Inactiva</option>
                  </select>
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">Seguro predeterminado</label>
                  <select
                    className="form-select"
                    value={categoryForm.defaultInsuranceId ?? ''}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, defaultInsuranceId: e.target.value || undefined })
                    }
                  >
                    <option value="">— Sin seguro predeterminado —</option>
                    {insurances.filter((i) => i.active).map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.code ? `[${i.code}] ` : ''}{i.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setCategoryModal(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void saveCategory()}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: MODELO ───────────────────────────────────────────────────── */}
      {modelModal !== null && (
        <div className="modal-overlay" onClick={() => setModelModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">
                {modelModal === 'create' ? 'Nuevo Modelo' : 'Editar Modelo'}
              </h2>
              <button className="modal__close" onClick={() => setModelModal(null)}>
                ×
              </button>
            </div>
            <div className="modal__body">
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Marca *</label>
                  <input
                    className="form-input"
                    value={modelForm.brand}
                    onChange={(e) =>
                      setModelForm({ ...modelForm, brand: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Modelo *</label>
                  <input
                    className="form-input"
                    value={modelForm.model}
                    onChange={(e) =>
                      setModelForm({ ...modelForm, model: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Categoría *</label>
                  <select
                    className="form-select"
                    value={modelForm.categoryId}
                    onChange={(e) =>
                      setModelForm({ ...modelForm, categoryId: e.target.value })
                    }
                  >
                    <option value="">Seleccionar categoría</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Transmisión</label>
                  <select
                    className="form-select"
                    value={modelForm.transmission}
                    onChange={(e) =>
                      setModelForm({
                        ...modelForm,
                        transmission: e.target.value as 'MANUAL' | 'AUTOMATICO',
                      })
                    }
                  >
                    <option value="MANUAL">Manual</option>
                    <option value="AUTOMATICO">Automático</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Combustible</label>
                  <select
                    className="form-select"
                    value={modelForm.fuel}
                    onChange={(e) =>
                      setModelForm({
                        ...modelForm,
                        fuel: e.target.value as 'GASOLINA' | 'DIESEL' | 'ELECTRICO' | 'HIBRIDO',
                      })
                    }
                  >
                    <option value="GASOLINA">Gasolina</option>
                    <option value="DIESEL">Diesel</option>
                    <option value="ELECTRICO">Eléctrico</option>
                    <option value="HIBRIDO">Híbrido</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Plazas</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Plazas"
                    value={modelForm.seats}
                    onChange={(e) =>
                      setModelForm({ ...modelForm, seats: Number(e.target.value) })
                    }
                    min={1}
                    max={50}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Puertas</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Puertas"
                    value={modelForm.doors}
                    onChange={(e) =>
                      setModelForm({ ...modelForm, doors: Number(e.target.value) })
                    }
                    min={2}
                    max={10}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Año del modelo</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Año del modelo"
                    value={modelForm.year}
                    onChange={(e) =>
                      setModelForm({ ...modelForm, year: Number(e.target.value) })
                    }
                    min={1990}
                    max={new Date().getFullYear() + 1}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select
                    className="form-select"
                    value={modelForm.active ? 'true' : 'false'}
                    onChange={(e) =>
                      setModelForm({ ...modelForm, active: e.target.value === 'true' })
                    }
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1', borderBottom: '1px solid var(--color-border)', paddingBottom: 4, marginTop: 8, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Características</div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {VEHICLE_FEATURES.map((feat) => (
                      <label key={feat} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={modelForm.features.includes(feat)}
                          onChange={(e) => {
                            const current = modelForm.features;
                            const updated = e.target.checked
                              ? [...current, feat]
                              : current.filter((f) => f !== feat);
                            setModelForm({ ...modelForm, features: updated });
                          }}
                        />
                        {feat}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setModelModal(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void saveModel()}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EXTRA ────────────────────────────────────────────────────── */}
      {extraModal !== null && (
        <div className="modal-overlay" onClick={() => setExtraModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">
                {extraModal === 'create' ? 'Nuevo Extra' : 'Editar Extra'}
              </h2>
              <button className="modal__close" onClick={() => setExtraModal(null)}>
                ×
              </button>
            </div>
            <div className="modal__body">
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Código *</label>
                  <input
                    className="form-input"
                    value={extraForm.code ?? ''}
                    onChange={(e) =>
                      setExtraForm({ ...extraForm, code: e.target.value.toUpperCase() })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input
                    className="form-input"
                    value={extraForm.name ?? ''}
                    onChange={(e) =>
                      setExtraForm({ ...extraForm, name: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Modo precio</label>
                  <select
                    className="form-select"
                    value={extraForm.pricingMode ?? 'FIXED'}
                    onChange={(e) =>
                      setExtraForm({
                        ...extraForm,
                        pricingMode: e.target.value as 'FIXED' | 'PER_DAY',
                      })
                    }
                  >
                    <option value="FIXED">Precio fijo</option>
                    <option value="PER_DAY">Por día</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Precio unitario (€) *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={extraForm.unitPrice ?? 0}
                    onChange={(e) =>
                      setExtraForm({
                        ...extraForm,
                        unitPrice: Number(e.target.value),
                      })
                    }
                    min={0}
                    step={0.01}
                  />
                </div>
                {extraForm.pricingMode === 'PER_DAY' && (
                  <div className="form-group">
                    <label className="form-label">Máx. días (opcional)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={extraForm.maxDays ?? ''}
                      onChange={(e) =>
                        setExtraForm({
                          ...extraForm,
                          maxDays: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      min={1}
                      placeholder="Sin límite"
                    />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select
                    className="form-select"
                    value={extraForm.active ? 'true' : 'false'}
                    onChange={(e) =>
                      setExtraForm({ ...extraForm, active: e.target.value === 'true' })
                    }
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1', borderBottom: '1px solid var(--color-border)', paddingBottom: 4, marginTop: 8, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Grupos aplicables</div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 6, padding: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer', marginBottom: 4 }}>
                      <input
                        type="checkbox"
                        checked={(extraForm.applicableGroupIds ?? []).length === 0 || (extraForm.applicableGroupIds ?? []).includes('__all__')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setExtraForm({ ...extraForm, applicableGroupIds: ['__all__'] });
                          } else {
                            setExtraForm({ ...extraForm, applicableGroupIds: [] });
                          }
                        }}
                      />
                      Todos los grupos
                    </label>
                    {categories.map((cat) => (
                      <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer', marginBottom: 2 }}>
                        <input
                          type="checkbox"
                          checked={(extraForm.applicableGroupIds ?? []).includes(cat.id)}
                          onChange={(e) => {
                            const current = (extraForm.applicableGroupIds ?? []).filter((id) => id !== '__all__');
                            const updated = e.target.checked
                              ? [...current, cat.id]
                              : current.filter((id) => id !== cat.id);
                            setExtraForm({ ...extraForm, applicableGroupIds: updated });
                          }}
                        />
                        {cat.code} — {cat.name}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setExtraModal(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void saveExtra()}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: SEGURO ───────────────────────────────────────────────────── */}
      {insuranceModal !== null && (
        <div className="modal-overlay" onClick={() => setInsuranceModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">
                {insuranceModal === 'create' ? 'Nuevo Seguro' : 'Editar Seguro'}
              </h2>
              <button className="modal__close" onClick={() => setInsuranceModal(null)}>
                ×
              </button>
            </div>
            <div className="modal__body">
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Código</label>
                  <input
                    className="form-input"
                    value={insuranceForm.code ?? ''}
                    onChange={(e) =>
                      setInsuranceForm({ ...insuranceForm, code: e.target.value.toUpperCase() })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input
                    className="form-input"
                    value={insuranceForm.name ?? ''}
                    onChange={(e) =>
                      setInsuranceForm({ ...insuranceForm, name: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Modo precio</label>
                  <select
                    className="form-select"
                    value={insuranceForm.pricingMode ?? 'PER_DAY'}
                    onChange={(e) =>
                      setInsuranceForm({
                        ...insuranceForm,
                        pricingMode: e.target.value as 'FIXED' | 'PER_DAY',
                      })
                    }
                  >
                    <option value="PER_DAY">Por día</option>
                    <option value="FIXED">Precio fijo</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Precio unitario (€) *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={insuranceForm.unitPrice ?? 0}
                    onChange={(e) =>
                      setInsuranceForm({ ...insuranceForm, unitPrice: Number(e.target.value) })
                    }
                    min={0}
                    step={0.01}
                  />
                </div>
                {insuranceForm.pricingMode === 'PER_DAY' && (
                  <div className="form-group">
                    <label className="form-label">Máx. días (opcional)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={insuranceForm.maxDays ?? ''}
                      onChange={(e) =>
                        setInsuranceForm({
                          ...insuranceForm,
                          maxDays: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      min={1}
                      placeholder="Sin límite"
                    />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select
                    className="form-select"
                    value={insuranceForm.active ? 'true' : 'false'}
                    onChange={(e) =>
                      setInsuranceForm({ ...insuranceForm, active: e.target.value === 'true' })
                    }
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1', borderBottom: '1px solid var(--color-border)', paddingBottom: 4, marginTop: 8, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Grupos aplicables</div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 6, padding: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer', marginBottom: 4 }}>
                      <input
                        type="checkbox"
                        checked={(insuranceForm.applicableGroupIds ?? []).length === 0 || (insuranceForm.applicableGroupIds ?? []).includes('__all__')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setInsuranceForm({ ...insuranceForm, applicableGroupIds: ['__all__'] });
                          } else {
                            setInsuranceForm({ ...insuranceForm, applicableGroupIds: [] });
                          }
                        }}
                      />
                      Todos los grupos
                    </label>
                    {categories.map((cat) => (
                      <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer', marginBottom: 2 }}>
                        <input
                          type="checkbox"
                          checked={(insuranceForm.applicableGroupIds ?? []).includes(cat.id)}
                          onChange={(e) => {
                            const current = (insuranceForm.applicableGroupIds ?? []).filter((id) => id !== '__all__');
                            const updated = e.target.checked
                              ? [...current, cat.id]
                              : current.filter((id) => id !== cat.id);
                            setInsuranceForm({ ...insuranceForm, applicableGroupIds: updated });
                          }}
                        />
                        {cat.code} — {cat.name}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setInsuranceModal(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void saveInsurance()}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Altas/Bajas Tab ─────────────────────────────────────────────────────────

function AltasBajasTab() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterPlate, setFilterPlate] = useState('');
  const [modal, setModal] = useState<'create' | 'edit' | 'baja' | null>(null);
  const [form, setForm] = useState<Partial<FleetVehicle>>(blankVehicle());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bajaVehicleId, setBajaVehicleId] = useState('');
  const [bajaDate, setBajaDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, bRes, cRes, mRes] = await Promise.all([
        fetch('/api/vehiculos/flota?includeInactive=true'),
        fetch('/api/sucursales'),
        fetch('/api/vehiculos/categorias'),
        fetch('/api/vehiculos/modelos'),
      ]);
      if (vRes.ok) setVehicles((await vRes.json()).vehicles ?? []);
      if (bRes.ok) setBranches((await bRes.json()).branches ?? []);
      if (cRes.ok) setCategories((await cRes.json()).categories ?? []);
      if (mRes.ok) setModels((await mRes.json()).models ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = vehicles.filter((v) => {
    if (filterBranch && v.branchId !== filterBranch) return false;
    if (filterCategory && v.categoryId !== filterCategory) return false;
    if (filterStatus === 'active' && !v.active) return false;
    if (filterStatus === 'inactive' && v.active) return false;
    if (filterPlate && !v.plate.toLowerCase().includes(filterPlate.toLowerCase())) return false;
    return true;
  });

  const getCatName = (id: string) => categories.find(c => c.id === id)?.name ?? id;
  const getModelLabel = (id: string) => { const m = models.find(m => m.id === id); return m ? `${m.brand} ${m.model}` : id; };
  const getBranchName = (id: string) => branches.find(b => b.id === id)?.name ?? id;

  async function save() {
    setError(null); setSaving(true);
    try {
      const isEdit = modal === 'edit';
      const url = isEdit ? `/api/vehiculos/flota/${editingId}` : '/api/vehiculos/flota';
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, plate: (form.plate ?? '').toUpperCase(), year: Number(form.year), currentOdometer: Number(form.currentOdometer) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error'); return; }
      setModal(null);
      void load();
    } finally { setSaving(false); }
  }

  async function toggle(v: FleetVehicle) {
    if (!v.active) {
      if (!confirm(`¿Reactivar el vehículo ${v.plate}?`)) return;
      await fetch(`/api/vehiculos/flota/${v.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true, activeTo: null }),
      });
      void load();
    }
  }

  async function saveBaja() {
    if (!bajaVehicleId) { setError('Selecciona un vehículo'); return; }
    setError(null); setSaving(true);
    try {
      const res = await fetch(`/api/vehiculos/flota/${bajaVehicleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false, activeTo: bajaDate }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error'); return; }
      setModal(null);
      void load();
    } finally { setSaving(false); }
  }

  const activeVehicles = vehicles.filter(v => v.active);

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => { setForm(blankVehicle()); setEditingId(null); setError(null); setModal('create'); }}>
            + Alta de vehículo
          </button>
          <button className="btn btn-ghost" style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
            onClick={() => { setBajaVehicleId(''); setBajaDate(new Date().toISOString().slice(0, 10)); setError(null); setModal('baja'); }}>
            Dar de baja
          </button>
        </div>
      </div>

      <div className="filters-bar" style={{ marginBottom: 16 }}>
        <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}>
          <option value="all">Todos</option>
          <option value="active">Solo activos</option>
          <option value="inactive">Solo inactivos</option>
        </select>
        <select className="form-select" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
          <option value="">Todas las sucursales</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="form-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
        </select>
        <input className="form-input" placeholder="Buscar matrícula…" value={filterPlate} onChange={(e) => setFilterPlate(e.target.value)} />
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Cargando…</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Matrícula</th>
                <th>Modelo</th>
                <th>Categoría</th>
                <th>Sucursal</th>
                <th>Alta</th>
                <th>Baja</th>
                <th>Propietario</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>No hay vehículos que coincidan con los filtros.</td></tr>
              ) : filtered.map(v => (
                <tr key={v.id}>
                  <td><strong style={{ fontFamily: 'monospace', fontSize: '0.9rem', letterSpacing: '0.05em' }}>{v.plate}</strong></td>
                  <td>{getModelLabel(v.modelId)}</td>
                  <td>{getCatName(v.categoryId)}</td>
                  <td>{getBranchName(v.branchId)}</td>
                  <td style={{ fontSize: '0.85rem' }}>{v.activeFrom ?? '—'}</td>
                  <td style={{ fontSize: '0.85rem', color: v.activeTo ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>{v.activeTo ?? '—'}</td>
                  <td style={{ fontSize: '0.82rem' }}>{v.owner}</td>
                  <td>
                    <span className={`badge ${v.active ? 'badge-confirmada' : 'badge-cancelada'}`}>
                      {v.active ? 'Activo' : 'Baja'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ ...v }); setEditingId(v.id); setError(null); setModal('edit'); }}>Editar</button>
                      {!v.active && (
                        <button className="btn btn-accent btn-sm" onClick={() => void toggle(v)}>Reactivar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal === 'baja' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal__header">
              <span className="modal__title">Dar de baja vehículo</span>
              <button className="modal__close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal__body">
              {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
              <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="form-group">
                  <label className="form-label">Vehículo *</label>
                  <select className="form-select" value={bajaVehicleId} onChange={e => setBajaVehicleId(e.target.value)}>
                    <option value="">— Seleccionar vehículo activo —</option>
                    {activeVehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.plate} — {getModelLabel(v.modelId) || getCatName(v.categoryId)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de baja</label>
                  <input type="date" className="form-input" value={bajaDate} onChange={e => setBajaDate(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => void saveBaja()} disabled={saving}>
                {saving ? 'Guardando…' : 'Confirmar baja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(modal === 'create' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal__header">
              <span className="modal__title">{modal === 'create' ? 'Alta de vehículo' : 'Editar Vehículo'}</span>
              <button className="modal__close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal__body">
              {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
              <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="form-group">
                  <label className="form-label">Matrícula *</label>
                  <input type="text" className="form-input" value={form.plate ?? ''} onChange={e => setForm({ ...form, plate: e.target.value.toUpperCase() })} disabled={modal === 'edit'} style={modal === 'edit' ? { opacity: 0.6 } : {}} />
                </div>
                <div className="form-group">
                  <label className="form-label">Sucursal *</label>
                  <select className="form-select" value={form.branchId ?? ''} onChange={e => setForm({ ...form, branchId: e.target.value, modelId: '', categoryId: '' })}>
                    <option value="">— Seleccionar —</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Categoría *</label>
                  <select className="form-select" value={form.categoryId ?? ''} onChange={e => setForm({ ...form, categoryId: e.target.value, modelId: '' })}>
                    <option value="">— Seleccionar —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Modelo</label>
                  <select className="form-select" value={form.modelId ?? ''} onChange={e => setForm({ ...form, modelId: e.target.value })}>
                    <option value="">— Sin modelo —</option>
                    {models.filter(m => !form.categoryId || m.categoryId === form.categoryId).map(m => <option key={m.id} value={m.id}>{m.brand} {m.model}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Año</label>
                  <input type="number" className="form-input" value={form.year ?? ''} min={1990} max={2100} onChange={e => setForm({ ...form, year: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Propietario</label>
                  <select className="form-select" value={form.owner ?? 'PROPIO'} onChange={e => setForm({ ...form, owner: e.target.value })}>
                    <option value="PROPIO">Propio</option>
                    <option value="RENTING">Renting</option>
                    <option value="LEASING">Leasing</option>
                    <option value="TERCERO">Tercero</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Color</label>
                  <input type="text" className="form-input" value={form.color ?? ''} onChange={e => setForm({ ...form, color: e.target.value })} placeholder="Blanco, Negro…" />
                </div>
                <div className="form-group">
                  <label className="form-label">Odómetro (km)</label>
                  <input type="number" className="form-input" value={form.currentOdometer ?? 0} min={0} onChange={e => setForm({ ...form, currentOdometer: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de alta</label>
                  <input type="date" className="form-input" value={form.activeFrom ?? ''} onChange={e => setForm({ ...form, activeFrom: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select className="form-select" value={form.active ? 'true' : 'false'} onChange={e => setForm({ ...form, active: e.target.value === 'true' })}>
                    <option value="true">Activo</option>
                    <option value="false">Inactivo / Baja</option>
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: 'span 3' }}>
                  <label className="form-label">Notas</label>
                  <textarea className="form-input" value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} style={{ resize: 'vertical' }} />
                </div>
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Producción Tab ──────────────────────────────────────────────────────────

function ProduccionTab() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, cRes, bRes, ctRes] = await Promise.all([
        fetch('/api/vehiculos/flota?includeInactive=true'),
        fetch('/api/vehiculos/categorias'),
        fetch('/api/sucursales'),
        fetch(`/api/contratos?dateFrom=${dateFrom}&dateTo=${dateTo}&status=CERRADO`),
      ]);
      if (vRes.ok) setVehicles((await vRes.json()).vehicles ?? []);
      if (cRes.ok) setCategories((await cRes.json()).categories ?? []);
      if (bRes.ok) setBranches((await bRes.json()).branches ?? []);
      if (ctRes.ok) setContracts((await ctRes.json()).contracts ?? []);
    } finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { void load(); }, [load]);

  const getCatName = (id: string) => categories.find(c => c.id === id)?.name ?? '—';
  const getBranchName = (id: string) => branches.find(b => b.id === id)?.name ?? '—';

  // Calculate stats per vehicle
  const stats = vehicles
    .filter(v => {
      if (filterBranch && v.branchId !== filterBranch) return false;
      if (filterCategory && v.categoryId !== filterCategory) return false;
      return true;
    })
    .map(v => {
      const vehicleContracts = contracts.filter(c => c.plate === v.plate);
      const totalDays = vehicleContracts.reduce((sum, c) => sum + (c.billedDays || 0), 0);
      const totalRevenue = vehicleContracts.reduce((sum, c) => sum + (c.totalAmount || 0), 0);
      // Utilization: days with contracts / days in period
      const periodDays = Math.max(1, Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const utilization = Math.min(100, Math.round((totalDays / periodDays) * 100));
      return { vehicle: v, contractCount: vehicleContracts.length, totalDays, totalRevenue, utilization, periodDays };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const totalRevenue = stats.reduce((s, r) => s + r.totalRevenue, 0);
  const totalDays = stats.reduce((s, r) => s + r.totalDays, 0);
  const avgUtilization = stats.length > 0 ? Math.round(stats.reduce((s, r) => s + r.utilization, 0) / stats.length) : 0;

  return (
    <div>
      <div className="filters-bar" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <label className="form-label" style={{ marginBottom: 0, alignSelf: 'center', whiteSpace: 'nowrap' }}>Periodo:</label>
        <input type="date" className="form-input" style={{ width: 160 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span style={{ alignSelf: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>—</span>
        <input type="date" className="form-input" style={{ width: 160 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <select className="form-select" value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
          <option value="">Todas las sucursales</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="form-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Vehículos', value: stats.length.toString() },
          { label: 'Días facturados', value: totalDays.toString() },
          { label: 'Importe total', value: `${totalRevenue.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` },
          { label: 'Utilización media', value: `${avgUtilization}%` },
        ].map(card => (
          <div key={card.label} style={{ flex: '1 1 150px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{card.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Cargando…</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Matrícula</th>
                <th>Categoría</th>
                <th>Sucursal</th>
                <th style={{ textAlign: 'right' }}>Contratos</th>
                <th style={{ textAlign: 'right' }}>Días facturados</th>
                <th style={{ textAlign: 'right' }}>Importe</th>
                <th style={{ textAlign: 'right' }}>Utilización</th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>No hay datos para el periodo seleccionado.</td></tr>
              ) : stats.map(({ vehicle: v, contractCount, totalDays: td, totalRevenue: tr, utilization }) => (
                <tr key={v.id}>
                  <td><strong style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{v.plate}</strong></td>
                  <td>{getCatName(v.categoryId)}</td>
                  <td>{getBranchName(v.branchId)}</td>
                  <td style={{ textAlign: 'right' }}>{contractCount}</td>
                  <td style={{ textAlign: 'right' }}>{td}</td>
                  <td style={{ textAlign: 'right' }}>{tr.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ display: 'inline-block', width: 48, height: 6, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: `${utilization}%`, background: utilization > 70 ? 'var(--color-status-contratado)' : utilization > 40 ? 'var(--color-primary)' : 'var(--color-status-peticion)', borderRadius: 3 }} />
                      </span>
                      {utilization}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Sub-tab wrapper ──────────────────────────────────────────────────────────

const VEHICULOS_TABS = [
  { key: 'flota',      label: 'Listados' },
  { key: 'grupos',     label: 'Grupos' },
  { key: 'modelos',    label: 'Modelos' },
  { key: 'altasbajas', label: 'Altas/Bajas' },
  { key: 'produccion', label: 'Producción' },
  { key: 'extras',     label: 'Extras' },
  { key: 'seguros',    label: 'Seguros' },
];

function VehiculosTabNav({ active }: { active: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(key: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', key);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, marginBottom: 24 }}>
      {VEHICULOS_TABS.map((t) => (
        <button key={t.key} type="button" onClick={() => go(t.key)} style={{ flex: 1, textAlign: 'center', padding: '7px 8px', fontSize: '0.82rem', fontWeight: active === t.key ? 600 : 500, color: active === t.key ? 'var(--color-primary)' : 'var(--color-text-muted)', background: active === t.key ? 'var(--color-surface-strong)' : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap' }}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

// Map outer URL tab key → inner VehiculosContent Tab
const URL_TO_INNER: Partial<Record<string, Tab>> = {
  flota:    'flota',
  grupos:   'categorias',
  modelos:  'modelos',
  extras:   'extras',
  seguros:  'seguros',
};

function VehiculosInner() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') ?? 'flota';
  const innerTab = URL_TO_INNER[tab];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Vehículos</h1>
          <p className="page-subtitle">{VEHICULOS_TABS.find((t) => t.key === tab)?.label ?? 'Flota'}</p>
        </div>
        <PrintButton />
      </div>
      <VehiculosTabNav active={tab} />
      {innerTab ? (
        <VehiculosContent initialTab={innerTab} />
      ) : tab === 'altasbajas' ? (
        <AltasBajasTab />
      ) : tab === 'produccion' ? (
        <ProduccionTab />
      ) : (
        <div className="empty-state" style={{ marginTop: 32 }}>
          <div className="empty-state__icon">🚧</div>
          <div className="empty-state__text">{VEHICULOS_TABS.find((t) => t.key === tab)?.label ?? tab} — Próximamente</div>
        </div>
      )}
    </div>
  );
}

export default function VehiculosPage() {
  return (
    <Suspense>
      <VehiculosInner />
    </Suspense>
  );
}
