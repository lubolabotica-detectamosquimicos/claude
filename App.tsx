/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import { Product, HistoryEntry, UserProfile } from './types';
import { INITIAL_PRODUCTS, NEW_USER } from './data/mockData';
import { Header } from './components/Header';
import { BottomNav, TabId } from './components/BottomNav';
import { ScanScreen } from './components/ScanScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { SavedScreen } from './components/SavedScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { CameraViewfinderModal } from './components/CameraViewfinderModal';
import { FichaTecnicaModal } from './components/FichaTecnicaModal';
import { GroceryListModal } from './components/GroceryListModal';
import { ImpactModal } from './components/ImpactModal';
import { LegalModal } from './components/LegalModal';
import { InicioFormModal, PlanType } from './components/InicioFormModal';
import { LocalVaultService } from './services/localVault';
import { isPaymentsConfigured } from './config/env';
import { startAutoSync, onIngredientsUpdated } from './services/ingredientSync';
import { initEntitlements, claimPayment } from './services/entitlementService';
import { reclassifyProduct } from './services/productFactory';

// El panel administrativo (y Firebase) se cargan solo cuando se abren: no pesan en el escáner.
const AdminPanelModal = lazy(() => import('./components/AdminPanelModal'));

const KEY_HISTORY = 'lubo_history_v1';
const KEY_PRODUCTS = 'lubo_products_v1';
const MAX_HISTORY = 60;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Catálogo de muestra + lo que el usuario guardó/creó (favoritos, lista de compras, escaneos). */
function loadProducts(): Product[] {
  const saved = readJson<Product[]>(KEY_PRODUCTS, []);
  const byId = new Map(saved.map((p) => [p.id, p]));
  const base = INITIAL_PRODUCTS.map((p) => {
    const s = byId.get(p.id);
    return s ? { ...p, isSaved: s.isSaved, isInList: s.isInList, isPurchased: s.isPurchased } : p;
  });
  const baseIds = new Set(INITIAL_PRODUCTS.map((p) => p.id));
  return [...saved.filter((p) => !baseIds.has(p.id)), ...base];
}

function loadUser(): UserProfile {
  const saved = readJson<UserProfile | null>('lubo_user_profile', null);
  if (!saved) return NEW_USER;
  // Si el plan de pago ya venció en la bóveda local, el perfil vuelve a Free.
  const session = LocalVaultService.getUserSession();
  if (saved.tier === 'paid' && session.tier === 'free') {
    return { ...saved, tier: 'free', planType: 'free', membership: 'Plan Free', subscriptionExpiresAt: undefined };
  }
  return saved;
}

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<TabId>('escanear');

  // Core Data State (loaded from Stitch export and local encrypted vault)
  const [products, setProducts] = useState<Product[]>(loadProducts);
  const [history, setHistory] = useState<HistoryEntry[]>(() => readJson<HistoryEntry[]>(KEY_HISTORY, []));
  const [user, setUser] = useState<UserProfile>(loadUser);
  const [currentScannedProduct, setCurrentScannedProduct] = useState<Product>(
    INITIAL_PRODUCTS[0] // Barra de Granola Avena & Miel Silvestre
  );

  // Formulario de Inicio (Abre en primera visita o al solicitar cambio de plan/logout)
  const [isInicioModalOpen, setIsInicioModalOpen] = useState<boolean>(() => {
    return !localStorage.getItem('lubo_has_completed_inicio');
  });

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [dbVersion, setDbVersion] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  // Dark Mode State
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('lubo_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  // Modals State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeFichaProduct, setActiveFichaProduct] = useState<Product | null>(null);
  const [isGroceryListOpen, setIsGroceryListOpen] = useState(false);
  const [isImpactOpen, setIsImpactOpen] = useState(false);

  const [legalModal, setLegalModal] = useState<{
    isOpen: boolean;
    title: string;
    type: 'faq' | 'terms' | 'data' | 'privacy';
  }>({
    isOpen: false,
    title: '',
    type: 'faq',
  });

  // Arranque: valida el plan guardado (derecho firmado) y mantiene la base LuBo igual al Excel de OneDrive.
  useEffect(() => {
    let stopSync: (() => void) | undefined;
    let cancelled = false;

    initEntitlements().then(() => {
      if (cancelled) return;
      // Si el derecho venció o no es válido, el perfil visible vuelve a Free.
      if (LocalVaultService.getUserSession().tier === 'free') {
        setUser((u) => (u.tier === 'paid' ? { ...u, tier: 'free', planType: 'free', membership: 'Plan Free', subscriptionExpiresAt: undefined } : u));
      }
      stopSync = startAutoSync();
    });

    // El Excel cambió → se recalcula el semáforo de todo lo ya escaneado con la lista nueva.
    const offUpdate = onIngredientsUpdated((r) => {
      const db = LocalVaultService.getIngredients();
      setProducts((prev) => prev.map((p) => reclassifyProduct(p, db)));
      setHistory((prev) => prev.map((h) => ({ ...h, product: reclassifyProduct(h.product, db) })));
      setCurrentScannedProduct((prev) => (prev ? reclassifyProduct(prev, db) : prev));
      setActiveFichaProduct((prev) => (prev ? reclassifyProduct(prev, db) : prev));
      setDbVersion((v) => v + 1);
      setToast(`Base LuBo actualizada desde OneDrive · ${r.count} ingredientes`);
    });

    return () => {
      cancelled = true;
      stopSync?.();
      offUpdate();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Persistencia local (historial y productos guardados sobreviven a recargas)
  useEffect(() => {
    try {
      localStorage.setItem(KEY_HISTORY, JSON.stringify(history.slice(0, MAX_HISTORY)));
    } catch (e) {
      console.warn('No se pudo guardar el historial:', e);
    }
  }, [history]);

  useEffect(() => {
    try {
      const baseIds = new Set(INITIAL_PRODUCTS.map((p) => p.id));
      const toSave = products.filter((p) => !baseIds.has(p.id) || p.isSaved || p.isInList || p.isPurchased).slice(0, 80);
      localStorage.setItem(KEY_PRODUCTS, JSON.stringify(toSave));
    } catch (e) {
      console.warn('No se pudo guardar la lista de productos:', e);
    }
  }, [products]);

  // Dark mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('lubo_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('lubo_theme', 'light');
    }
  }, [darkMode]);

  // Toggle Bookmark
  const handleToggleBookmark = (product: Product) => {
    const updatedStatus = !product.isSaved;
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, isSaved: updatedStatus } : p))
    );
    if (currentScannedProduct.id === product.id) {
      setCurrentScannedProduct((prev) => ({ ...prev, isSaved: updatedStatus }));
    }
    setHistory((prev) =>
      prev.map((h) =>
        h.productId === product.id
          ? { ...h, product: { ...h.product, isSaved: updatedStatus } }
          : h
      )
    );
  };

  // Add to grocery list
  const handleAddToCart = (product: Product) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id ? { ...p, isInList: true, isPurchased: false } : p
      )
    );
  };

  // Toggle purchased in grocery list
  const handleTogglePurchased = (productId: string) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, isPurchased: !p.isPurchased } : p
      )
    );
  };

  // Remove from grocery list
  const handleRemoveFromList = (productId: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, isInList: false } : p))
    );
  };

  // Add custom item to grocery list
  const handleAddCustomItem = (name: string) => {
    const customProd: Product = {
      id: `custom-${Date.now()}`,
      upc: `${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      name,
      brand: 'Selección Botica',
      category: 'Despensa Limpia',
      weight: '1 pz',
      priceMxn: 45.0,
      imageUrl: INITIAL_PRODUCTS[1].imageUrl,
      safetyScore: 1.0,
      overallStatus: 'clean',
      statusLabel: '100% Limpio',
      badgeLabel: '0 Aditivos',
      substatusNote: 'Semáforo Óptimo',
      warningSummary: 'Ingrediente verificado por el usuario contra base interna.',
      disruptorCount: 0,
      isSaved: false,
      isInList: true,
      isPurchased: false,
      ingredients: [],
    };
    setProducts((prev) => [customProd, ...prev]);
  };

  // Asegura que un producto nuevo (escaneo/texto) exista en la lista: así guardarlo/agregarlo al carrito funciona.
  const registerProduct = (product: Product) => {
    setProducts((prev) => (prev.some((p) => p.id === product.id) ? prev : [product, ...prev]));
  };

  // Resultado de un escaneo o evaluación. La cuota de cámara se descuenta en el escáner (una sola vez).
  const handleProductScanned = (product: Product) => {
    registerProduct(product);
    setCurrentScannedProduct(product);
    setActiveTab('escanear');
    // Add to history
    const newEntry: HistoryEntry = {
      id: `hist-${Date.now()}`,
      productId: product.id,
      timestamp: new Date().toISOString(),
      dateGroup: 'today',
      timeLabel: `Ahora · UPC ${product.upc}`,
      product,
    };
    setHistory((prev) => [newEntry, ...prev]);
    setUser((prev) => ({
      ...prev,
      scansCount: prev.scansCount + 1,
      levelPoints: Math.min(prev.maxPoints, prev.levelPoints + 15),
    }));
  };

  // Re-scan from history
  const handleReScan = (product: Product) => {
    setCurrentScannedProduct(product);
    setActiveTab('escanear');
  };

  // Clear history
  const handleClearHistory = () => {
    setHistory([]);
  };

  // Export data
  const handleExport = () => {
    const dataStr = JSON.stringify(history, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lubo-botica-analisis-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSaved = () => {
    const saved = products.filter((p) => p.isSaved);
    const dataStr = JSON.stringify(saved, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lubo-favoritos-limpios-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Open Legal Modals
  const handleOpenLegalModal = (
    title: string,
    type: 'faq' | 'terms' | 'data' | 'privacy'
  ) => {
    setLegalModal({
      isOpen: true,
      title,
      type,
    });
  };

  // Confirmar el formulario de inicio con el Plan Free.
  const handleConfirmInicio = (data: { name: string; email: string; plan: PlanType; membership: string }) => {
    const updatedUser: UserProfile = {
      ...user,
      name: data.name,
      email: data.email,
      membership: 'Plan Free',
      tier: 'free',
      planType: 'free',
      subscriptionActivatedAt: undefined,
      subscriptionExpiresAt: undefined,
    };
    setUser(updatedUser);
    localStorage.setItem('lubo_user_profile', JSON.stringify(updatedUser));
    localStorage.setItem('lubo_has_completed_inicio', 'true');
    LocalVaultService.setSubscriptionPlan('free');
    setIsInicioModalOpen(false);
  };

  // Plan de pago: se activa SOLO si el servidor confirma el pago aprobado (webhook de Mercado Pago → Firebase).
  const handleVerifyPayment = async (data: { name: string; email: string; paymentId: string }) => {
    const result = await claimPayment(data.email, data.paymentId);
    if (!result.ok) return { ok: false, message: result.message };

    const membership =
      result.plan === 'monthly' ? 'Plan Mensual' : result.plan === 'annual' ? 'Plan Anual' : 'Aporte voluntario · 1 año';
    const updatedUser: UserProfile = {
      ...user,
      name: data.name,
      email: data.email,
      membership,
      tier: 'paid',
      planType: result.plan === 'monthly' ? 'monthly' : 'annual',
      subscriptionActivatedAt: new Date().toISOString(),
      subscriptionExpiresAt: result.expiresAt,
    };
    setUser(updatedUser);
    localStorage.setItem('lubo_user_profile', JSON.stringify(updatedUser));
    localStorage.setItem('lubo_has_completed_inicio', 'true');
    setIsInicioModalOpen(false);
    setToast(`¡Pago verificado! ${membership} activo`);
    return { ok: true };
  };

  const savedCount = products.filter((p) => p.isSaved).length;

  return (
    <div className="min-h-screen bg-[#CCE510] dark:bg-[#151908] text-[#341011] dark:text-[#f3f4e8] flex flex-col font-sans relative selection:bg-[#341011] selection:text-[#CCE510] transition-colors duration-200">
      {/* Top Header */}
      <Header onOpenInicioModal={() => setIsInicioModalOpen(true)} />

      {/* Main Content Area */}
      <main className="flex-1 w-full pt-16 flex flex-col">
        {activeTab === 'escanear' && (
          <ScanScreen
            currentProduct={currentScannedProduct}
            onOpenLiveScanner={() => setIsCameraOpen(true)}
            onSelectProduct={(p) => {
              registerProduct(p);
              setCurrentScannedProduct(p);
            }}
            onProductEvaluated={handleProductScanned}
            dbVersion={dbVersion}
            onToggleBookmark={handleToggleBookmark}
            onOpenFicha={(p) => setActiveFichaProduct(p)}
            allProducts={products}
            onOpenInicioModal={() => setIsInicioModalOpen(true)}
          />
        )}

        {activeTab === 'historial' && (
          <HistoryScreen
            history={history}
            onSelectProduct={(p) => {
              setCurrentScannedProduct(p);
              setActiveTab('escanear');
            }}
            onReScan={handleReScan}
            onToggleBookmark={handleToggleBookmark}
            onClearHistory={handleClearHistory}
            onExport={handleExport}
          />
        )}

        {activeTab === 'guardados' && (
          <SavedScreen
            products={products}
            onOpenFicha={(p) => setActiveFichaProduct(p)}
            onToggleBookmark={handleToggleBookmark}
            onAddToCart={handleAddToCart}
            onOpenGroceryList={() => setIsGroceryListOpen(true)}
            onOpenImpactModal={() => setIsImpactOpen(true)}
            onExportSaved={handleExportSaved}
          />
        )}

        {activeTab === 'perfil' && (
          <ProfileScreen
            user={user}
            onOpenLegalModal={handleOpenLegalModal}
            onUpdateUser={(updated) => {
              setUser((prev) => {
                const nextUser = { ...prev, ...updated };
                localStorage.setItem('lubo_user_profile', JSON.stringify(nextUser));
                return nextUser;
              });
            }}
            onOpenInicioModal={() => setIsInicioModalOpen(true)}
            onOpenAdmin={() => setIsAdminOpen(true)}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode((d) => !d)}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        savedCount={savedCount}
      />

      {/* Camera / Bio-Spectral Viewfinder Modal */}
      <CameraViewfinderModal
        dbVersion={dbVersion}
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onProductScanned={handleProductScanned}
        allProducts={products}
        onOpenInicioModal={() => {
          setIsCameraOpen(false);
          setIsInicioModalOpen(true);
        }}
      />

      {/* Ficha Técnica Modal */}
      <FichaTecnicaModal
        product={activeFichaProduct}
        onClose={() => setActiveFichaProduct(null)}
        onToggleBookmark={handleToggleBookmark}
        onAddToCart={handleAddToCart}
      />

      {/* Grocery List Checklist Modal */}
      <GroceryListModal
        isOpen={isGroceryListOpen}
        onClose={() => setIsGroceryListOpen(false)}
        products={products}
        onTogglePurchased={handleTogglePurchased}
        onRemoveFromList={handleRemoveFromList}
        onAddCustomItem={handleAddCustomItem}
      />

      {/* Impact 100% Consciente Modal */}
      <ImpactModal
        isOpen={isImpactOpen}
        onClose={() => setIsImpactOpen(false)}
        avoidedCount={user.toxicsAvoidedCount}
      />

      {/* Legal & Help Modals */}
      <LegalModal
        isOpen={legalModal.isOpen}
        onClose={() => setLegalModal((prev) => ({ ...prev, isOpen: false }))}
        title={legalModal.title}
        type={legalModal.type}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] max-w-[90vw] px-4 py-2.5 rounded-full bg-[#341011] text-[#cce510] text-[12px] font-bold shadow-xl animate-fadeIn"
        >
          {toast}
        </div>
      )}

      {/* Panel administrativo (Firebase Auth, carga diferida) */}
      {isAdminOpen && (
        <Suspense fallback={null}>
          <AdminPanelModal onClose={() => setIsAdminOpen(false)} />
        </Suspense>
      )}

      {/* Formulario de Inicio (Free / Mensual / Anual con Link de Pago en COP) */}
      <InicioFormModal
        isOpen={isInicioModalOpen}
        onClose={() => setIsInicioModalOpen(false)}
        canClose={Boolean(localStorage.getItem('lubo_has_completed_inicio'))}
        initialName={user.name}
        initialEmail={user.email}
        initialPlan={
          user.planType ||
          (user.membership.toLowerCase().includes('anual')
            ? 'annual'
            : user.membership.toLowerCase().includes('free')
            ? 'free'
            : 'monthly')
        }
        onConfirm={handleConfirmInicio}
        onVerifyPayment={handleVerifyPayment}
        paymentsEnabled={isPaymentsConfigured}
      />
    </div>
  );
}
