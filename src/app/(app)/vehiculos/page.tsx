'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import DatePicker from '@/src/components/DatePicker';
import styles from './vehiculos.module.css';

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
  active: boolean;
}

interface VehicleInsurance {
  id: string;
  code: string;
  name: string;
  pricingMode: 'FIXED' | 'PER_DAY';
  unitPrice: number;
  maxDays?: number;
  active: boolean;
}

interface VehicleCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  defaultInsuranceId?: string;
  active: boolean;
}

type Tab = 'flota' | 'categorias' | 'modelos' | 'extras' | 'seguros';

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
  active: true,
});

const blankModel = (): {
  brand: string;
  model: string;
  categoryId: string;
  transmission: 'MANUAL' | 'AUTOMATICO';
  fuel: 'GASOLINA' | 'DIESEL' | 'ELECTRICO' | 'HIBRIDO';
  seats: number;
  features: string;
  active: boolean;
} => ({
  brand: '',
  model: '',
  categoryId: '',
  transmission: 'MANUAL',
  fuel: 'GASOLINA',
  seats: 5,
  features: '',
  active: true,
});

const blankExtra = (): Partial<VehicleExtra> => ({
  code: '',
  name: '',
  pricingMode: 'FIXED',
  unitPrice: 0,
  active: true,
});

const blankInsurance = (): Partial<VehicleInsurance> => ({
  code: '',
  name: '',
  pricingMode: 'PER_DAY',
  unitPrice: 0,
  maxDays: undefined,
  active: true,
});

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
      features: m.features.join(', '),
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

      const features = modelForm.features
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean);

      const payload = { ...modelForm, features, seats: Number(modelForm.seats) };

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
    setExtraForm({ ...e });
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
    setInsuranceForm({ ...i });
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
        {activeTab === 'flota' && (
          <button className="btn btn-primary" onClick={openCreateVehicle}>
            + Nuevo Vehículo
          </button>
        )}
        {activeTab === 'categorias' && (
          <button className="btn btn-primary" onClick={openCreateCategory}>
            + Nuevo Grupo
          </button>
        )}
        {activeTab === 'modelos' && (
          <button className="btn btn-primary" onClick={openCreateModel}>
            + Nuevo Modelo
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
                onChange={(e) => setFilterActive(e.target.checked)}
              />
              Solo activos
            </label>
            <select
              className="form-select"
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
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
              onChange={(e) => setFilterCategory(e.target.value)}
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
              onChange={(e) => setFilterPlate(e.target.value)}
            />
          </div>

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
                    value={modelForm.seats}
                    onChange={(e) =>
                      setModelForm({ ...modelForm, seats: Number(e.target.value) })
                    }
                    min={1}
                    max={50}
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
                <div className="form-group col-span-2">
                  <label className="form-label">
                    Características (separadas por coma)
                  </label>
                  <textarea
                    className="form-textarea"
                    value={modelForm.features}
                    onChange={(e) =>
                      setModelForm({ ...modelForm, features: e.target.value })
                    }
                    placeholder="Ej: GPS, Bluetooth, Cámara trasera"
                    rows={2}
                  />
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
      </div>
      <VehiculosTabNav active={tab} />
      {innerTab ? (
        <VehiculosContent initialTab={innerTab} />
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
