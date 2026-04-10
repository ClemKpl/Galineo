'use client';
'use client';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, type AccentColor } from '@/components/ThemeProvider';
import PricingModal from '@/components/PricingModal';

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

type Toast = { message: string; type: 'success' | 'error' };

function Toast({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-medium animate-[fadeUp_0.3s_ease-out] ${
      toast.type === 'success' ? 'bg-stone-900 text-white' : 'bg-red-500 text-white'
    }`}>
      {toast.type === 'success'
        ? <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        : <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      }
      {toast.message}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-stone-100">
        <h2 className="font-semibold text-stone-900 text-base">{title}</h2>
        {description && <p className="text-stone-400 text-sm mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-stone-100 last:border-b-0">
      <div>
        <p className="text-sm font-medium text-stone-800">{label}</p>
        {description && <p className="text-xs text-stone-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${checked ? 'bg-orange-500' : 'bg-stone-200'}`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { user, login, updateUser, logout, token, refreshUser } = useAuth();
  const searchParams = useSearchParams();
  const handledBillingSuccessRef = useRef(false);

  // Profil
  const [name, setName]   = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? '');
  const [profileLoading, setProfileLoading] = useState(false);

  // Mot de passe
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd]         = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  const { accent, setAccent } = useTheme();
  const [accentLoading, setAccentLoading] = useState(false);

  // Notifications
  const [notifProject, setNotifProject]     = useState(true);
  const [notifMember, setNotifMember]       = useState(true);
  const [notifDeadline, setNotifDeadline]   = useState(true);
  const [notifLoading, setNotifLoading]     = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [testDowngradeLoading, setTestDowngradeLoading] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

  // Charger les paramètres au montage
  useEffect(() => {
    if (user) {
      setNotifProject(user.notif_project_updates !== 0);
      setNotifMember(user.notif_added_to_project !== 0);
      setNotifDeadline(user.notif_deadlines !== 0);
    }
  }, [user]);

  const updateNotifSetting = async (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value); // Optimistic update
    try {
      const updated = await api.patch('/users/me', { [key]: value });
      updateUser(updated);
    } catch (err: any) {
      setter(!value); // Rollback
      showToast(err.message || 'Erreur lors de la mise à jour', 'error');
    }
  };

  // Support
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportLoading, setSupportLoading] = useState(false);
  const [tickets, setTickets] = useState<{id:number;subject:string;status:string;priority:string;admin_reply:string|null;created_at:string}[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  useEffect(() => {
    setTicketsLoading(true);
    api.get('/support').then((data) => setTickets(data as typeof tickets)).catch(() => {}).finally(() => setTicketsLoading(false));
  }, []);

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupportLoading(true);
    try {
      await api.post('/support', { subject: supportSubject, message: supportMessage });
      showToast('Ticket envoyé ! Nous vous répondrons rapidement.');
      setSupportSubject(''); setSupportMessage('');
      const data = await api.get('/support');
      setTickets(data as typeof tickets);
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    } finally {
      setSupportLoading(false);
    }
  };

  // Danger zone
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // AI Preferences
  const [aiDuration, setAiDuration] = useState(60);
  const [aiSaving, setAiSaving] = useState(false);

  // Toast
  const [toast, setToast] = useState<Toast | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type });

  // Retour depuis Stripe : rafraîchir le plan et remercier l'utilisateur
  useEffect(() => {
    const billingStatus = searchParams.get('billing');
    if (billingStatus !== 'success' || handledBillingSuccessRef.current) return;
    handledBillingSuccessRef.current = true;

    let cancelled = false;

    const handleBillingSuccess = async () => {
      // Toast immédiat
      showToast('Merci pour votre passage en Premium. Votre soutien aide directement au développement de Galineo.');
      window.history.replaceState({}, '', '/settings');

      // Poll en arrière-plan pour mettre à jour le plan dès que le webhook est traité
      const MAX_ATTEMPTS = 10;
      const DELAY_MS = 2000;
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, DELAY_MS));
        if (cancelled) return;
        try {
          const status = await api.get('/billing/status');
          if (status?.plan === 'premium') {
            await refreshUser();
            return;
          }
        } catch {
          // ignore, on réessaie
        }
      }
    };

    handleBillingSuccess();

    return () => {
      cancelled = true;
    };
  }, [refreshUser, searchParams]);

  const memberSince = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      const updated = await api.patch('/users/me', { name, email, avatar });
      // Update auth context with new name/email/avatar
      updateUser(updated);
      showToast('Profil mis à jour !');
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) { showToast('Les mots de passe ne correspondent pas', 'error'); return; }
    if (newPwd.length < 6)    { showToast('Mot de passe trop court (min. 6 caractères)', 'error'); return; }
    setPwdLoading(true);
    try {
      await api.patch('/users/me/password', { currentPassword: currentPwd, newPassword: newPwd });
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      showToast('Mot de passe modifié !');
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    } finally {
      setPwdLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'SUPPRIMER') { showToast('Tapez exactement « SUPPRIMER » pour confirmer', 'error'); return; }
    setDeleteLoading(true);
    try {
      await api.delete('/users/me');
      logout();
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
      setDeleteLoading(false);
    }
  };

  const handleResetAccount = async () => {
    if (resetConfirm !== 'RESET') { showToast('Tapez exactement « RESET » pour confirmer', 'error'); return; }
    setResetLoading(true);
    try {
      const res = await api.post('/users/me/reset', {});
      showToast(res.message);
      setResetConfirm('');
      // Optionnel: on peut logout ou juste rafraîchir le dashboard après redirection manuelle
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    } finally {
      setResetLoading(false);
    }
  };

  const handleSaveAiSettings = async () => {
    setAiSaving(true);
    try {
      await api.patch('/users/me/ai-settings', { ai_history_duration: aiDuration });
      showToast('Préférences IA mises à jour');
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    } finally {
      setAiSaving(false);
    }
  };

  const colors: { id: AccentColor; label: string; color: string }[] = [
    { id: 'orange', label: 'Orange', color: '#f97316' },
    { id: 'blue',   label: 'Bleu',   color: '#3b82f6' },
    { id: 'violet', label: 'Violet', color: '#8b5cf6' },
    { id: 'emerald',label: 'Vert',   color: '#10b981' },
    { id: 'rose',   label: 'Rose',   color: '#f43f5e' },
  ];

  const handleManageBilling = async () => {
    setBillingLoading(true);
    try {
      const { url } = await api.post('/billing/portal', {});
      if (url) window.location.href = url;
    } catch (err: any) {
      showToast(err.message || "Impossible d'accéder au portail de facturation", 'error');
    } finally {
      setBillingLoading(false);
    }
  };

  const handleTestDowngradePremium = async () => {
    setTestDowngradeLoading(true);
    try {
      const res = await api.post('/billing/test/downgrade', {});
      await refreshUser();
      showToast(res.message || 'Le compte a été repassé en gratuit pour le test.');
    } catch (err: any) {
      showToast(err.message || 'Impossible de retirer Premium pour le test', 'error');
    } finally {
      setTestDowngradeLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-900">Paramètres</h1>
        <p className="text-stone-400 text-sm mt-0.5">Gérez votre compte et vos préférences</p>
      </div>

      {/* ── Avatar + Infos rapides ── */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-xl shadow-sm shrink-0 overflow-hidden">
          {avatar ? (
            <img src={avatar} alt={name} className="w-full h-full object-cover" />
          ) : (
            user ? initials(user.name) : '?'
          )}
        </div>
        <div>
          <p className="font-semibold text-stone-900 text-lg leading-tight">{user?.name}</p>
          <p className="text-stone-400 text-sm">{user?.email}</p>
        </div>
      </div>

      {/* ── Profil ── */}
      <Section title="Profil" description="Modifiez vos informations personnelles">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Nom complet</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Adresse email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Photo de de profil (URL)</label>
            <input type="url" value={avatar} onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://votre-image.jpg"
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all" />
          </div>
          <div className="flex justify-end pt-1">
            <button type="submit" disabled={profileLoading}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60 flex items-center gap-2">
              {profileLoading && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {profileLoading ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </Section>

      {/* ── Sécurité ── */}
      <Section title="Sécurité" description="Changez votre mot de passe">
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Mot de passe actuel</label>
            <input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} required
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all"
              placeholder="••••••••" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Nouveau mot de passe</label>
              <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required minLength={6}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all"
                placeholder="Min. 6 caractères" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Confirmer</label>
              <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required
                className={`w-full px-4 py-2.5 rounded-xl border text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 transition-all ${
                  confirmPwd && confirmPwd !== newPwd
                    ? 'border-red-300 focus:ring-red-400/30 focus:border-red-400'
                    : 'border-stone-200 focus:ring-orange-400/30 focus:border-orange-400'
                }`}
                placeholder="••••••••" />
            </div>
          </div>
          {confirmPwd && confirmPwd !== newPwd && (
            <p className="text-xs text-red-500">Les mots de passe ne correspondent pas</p>
          )}
          <div className="flex justify-end pt-1">
            <button type="submit" disabled={pwdLoading || (!!confirmPwd && confirmPwd !== newPwd)}
              className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60 flex items-center gap-2">
              {pwdLoading && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {pwdLoading ? 'Modification...' : 'Changer le mot de passe'}
            </button>
          </div>
        </form>
      </Section>

      {/* ── Notifications ── */}
      <Section title="Notifications" description="Choisissez ce que vous souhaitez recevoir par email">
        <Toggle 
          checked={notifProject}  
          onChange={(v) => updateNotifSetting('notif_project_updates', v, setNotifProject)}
          label="Activité sur mes projets"
          description="Mises à jour, nouveaux messages et changements" />
        <Toggle 
          checked={notifMember}   
          onChange={(v) => updateNotifSetting('notif_added_to_project', v, setNotifMember)}
          label="Ajout à un projet"
          description="Quand quelqu'un vous ajoute à un projet existant" />
        <Toggle 
          checked={notifDeadline} 
          onChange={(v) => updateNotifSetting('notif_deadlines', v, setNotifDeadline)}
          label="Rappels de deadline"
          description="Alertes sur les échéances de vos projets" />
      </Section>

      {/* ── Abonnement & Facturation ── */}
      <Section title="Abonnement & Facturation" description="Gérez votre forfait et vos factures">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border ${
              user?.plan === 'unlimited' ? 'bg-purple-50 border-purple-100 text-purple-600' :
              user?.plan === 'premium' ? 'bg-orange-50 border-orange-100 text-orange-600' :
              'bg-stone-50 border-stone-100 text-stone-500'
            }`}>
              {user?.plan === 'unlimited' ? (
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
              ) : user?.plan === 'premium' ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              ) : (
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-stone-900 uppercase tracking-tight">Votre forfait actuel :</span>
                {user?.plan === 'unlimited' ? (
                  <span className="text-[10px] font-bold bg-purple-600 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">Admin</span>
                ) : user?.plan === 'premium' ? (
                  <span className="text-[10px] font-bold bg-orange-500 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">Premium</span>
                ) : (
                  <span className="text-[10px] font-bold bg-stone-200 text-stone-600 px-2 py-0.5 rounded-full uppercase tracking-widest">Gratuit</span>
                )}
              </div>
              <p className="text-xs text-stone-400 mt-1">
                {user?.plan === 'unlimited' ? 'Accès administrateur complet et illimité.' :
                 user?.plan === 'premium' ? 'Abonnement actif. Facturation gérée par Stripe.' :
                 'Profitez des fonctions de base ou passez à Premium.'}
              </p>
            </div>
          </div>
          
          <div className="shrink-0 w-full sm:w-auto">
            {user?.plan === 'premium' ? (
              <div className="flex w-full flex-col gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={handleManageBilling}
                  disabled={billingLoading}
                  className="w-full sm:w-auto px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 text-sm flex items-center justify-center gap-2 shadow-lg shadow-stone-200"
                >
                  {billingLoading && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  Gérer l&apos;abonnement
                </button>
                <button
                  type="button"
                  onClick={handleTestDowngradePremium}
                  disabled={testDowngradeLoading}
                  className="w-full sm:w-auto px-5 py-2.5 border border-orange-200 bg-orange-50 text-orange-700 font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                >
                  {testDowngradeLoading && <div className="w-3.5 h-3.5 border-2 border-orange-300/50 border-t-orange-600 rounded-full animate-spin" />}
                  Retirer Premium (expérimental)
                </button>
              </div>
            ) : (!user?.plan || user?.plan === 'free') ? (
              <button
                type="button"
                onClick={() => setShowPricing(true)}
                className="w-full sm:w-auto px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-sm transition-all active:scale-95 text-sm flex items-center gap-2"
              >
                Passer à Premium
              </button>
            ) : null}
          </div>
        </div>
      </Section>

      {/* ── Apparence ── */}
      <Section title="Apparence" description="Personnalisez l'interface">
        <div>
          <p className="text-sm font-medium text-stone-700 mb-3">Couleur d&apos;accent</p>
          <div className="flex gap-2.5">
            {colors.map((c) => (
              <button key={c.id} type="button" title={c.label}
                onClick={() => setAccent(c.id)}
                style={{ backgroundColor: c.color }}
                className={`w-9 h-9 rounded-full transition-all ${accent === c.id ? 'ring-2 ring-offset-2 ring-stone-400 scale-110' : 'hover:scale-105'}`}
              />
            ))}
          </div>
          <p className="text-xs text-stone-400 mt-3">Les thèmes complets seront disponibles dans une prochaine version.</p>
        </div>
      </Section>

      {/* ── AI Preferences ── */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden mb-6">
        <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-stone-900 text-lg">Préférences Assistant IA</h2>
            <p className="text-stone-400 text-sm mt-0.5">Personnalisez votre expérience avec l'IA</p>
          </div>
        </div>
        <div className="p-6">
          <div className="max-w-xs">
            <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wider">Durée de l'historique (minutes)</label>
            <div className="flex gap-3">
              <input
                type="number"
                min="1"
                value={aiDuration}
                onChange={(e) => setAiDuration(parseInt(e.target.value))}
                className="w-32 px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all font-medium"
              />
              <button
                type="button"
                onClick={handleSaveAiSettings}
                disabled={aiSaving}
                className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 text-sm"
              >
                {aiSaving ? "..." : "Enregistrer"}
              </button>
            </div>
            <p className="mt-3 text-xs text-stone-500 leading-relaxed italic">
              L'IA "oubliera" les messages plus vieux que cette durée pour respecter votre vie privée et optimiser les réponses.
            </p>
          </div>
        </div>
      </div>

      {/* ── Support ── */}
      <div id="support">
        <Section title="Support" description="Contactez l'équipe Galineo — les utilisateurs Premium sont traités en priorité">
        <form onSubmit={handleSupportSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Sujet</label>
            <input
              type="text" value={supportSubject} onChange={(e) => setSupportSubject(e.target.value)} required
              placeholder="Ex : Problème avec les tâches"
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Message</label>
            <textarea
              value={supportMessage} onChange={(e) => setSupportMessage(e.target.value)} required rows={4}
              placeholder="Décrivez votre problème ou votre demande..."
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all resize-none"
            />
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            {user?.plan === 'premium' || user?.plan === 'unlimited' ? (
              <span className="text-xs text-orange-600 font-medium flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                Votre ticket sera traité en priorité
              </span>
            ) : (
              <span className="text-xs text-stone-400">Passez à Premium pour un support prioritaire</span>
            )}
            <button type="submit" disabled={supportLoading}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60 flex items-center gap-2">
              {supportLoading && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {supportLoading ? 'Envoi...' : 'Envoyer le ticket'}
            </button>
          </div>
        </form>

        {/* Historique des tickets */}
        {tickets.length > 0 && (
          <div className="mt-6 border-t border-stone-100 pt-5 space-y-3">
            <p className="text-sm font-medium text-stone-700">Mes tickets</p>
            {ticketsLoading ? (
              <p className="text-sm text-stone-400">Chargement...</p>
            ) : tickets.map((t) => (
              <div key={t.id} className="rounded-xl border border-stone-100 bg-stone-50 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-stone-800">{t.subject}</p>
                  <div className="flex items-center gap-2">
                    {t.priority === 'high' && (
                      <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full uppercase tracking-wider">Prioritaire</span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      t.status === 'closed' ? 'bg-stone-200 text-stone-500' :
                      t.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
                      'bg-emerald-100 text-emerald-600'
                    }`}>{t.status === 'closed' ? 'Fermé' : t.status === 'in_progress' ? 'En cours' : 'Ouvert'}</span>
                  </div>
                </div>
                {t.admin_reply && (
                  <div className="bg-white border border-orange-100 rounded-lg p-3">
                    <p className="text-xs font-bold text-orange-600 mb-1">Réponse de l'équipe</p>
                    <p className="text-sm text-stone-600 whitespace-pre-wrap">{t.admin_reply}</p>
                  </div>
                )}
                <p className="text-xs text-stone-400">{new Date(t.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>

      {/* ── Danger zone ── */}
      <div className="bg-white rounded-2xl border border-red-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-red-50">
          <h2 className="font-semibold text-red-600 text-base">Zone de danger</h2>
          <p className="text-stone-400 text-sm mt-0.5">Actions irréversibles sur votre compte</p>
        </div>
        
        <div className="px-6 py-5 border-b border-stone-100 bg-stone-50/30">
          <h3 className="text-sm font-bold text-stone-900 mb-1">Quitter tous les projets</h3>
          <p className="text-xs text-stone-500 mb-4">
            Vous quitterez tous vos projets. Pour ceux dont vous êtes propriétaire, la gestion sera transférée au membre le plus ancien ou le projet sera supprimé si vous êtes seul.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              placeholder="Tapez « RESET » pour confirmer"
              className="flex-1 px-4 py-2.5 rounded-xl border border-orange-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all text-sm font-medium"
            />
            <button
              type="button"
              onClick={handleResetAccount}
              disabled={resetLoading || resetConfirm !== 'RESET'}
              className="w-full sm:w-auto px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-40 flex items-center justify-center gap-2">
              {resetLoading && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Réinitialiser
            </button>
          </div>
        </div>

        <div className="px-6 py-5">
          <h3 className="text-sm font-bold text-red-600 mb-1">Supprimer le compte</h3>
          <p className="text-sm text-stone-600 mb-4">
            La suppression de votre compte est <strong>définitive</strong>. Toutes vos données personnelles seront effacées.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Tapez « SUPPRIMER » pour confirmer"
              className="flex-1 px-4 py-2.5 rounded-xl border border-red-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400 transition-all text-sm"
            />
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={deleteLoading || deleteConfirm !== 'SUPPRIMER'}
              className="w-full sm:w-auto px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-40 flex items-center justify-center gap-2">
              {deleteLoading && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Supprimer
            </button>
          </div>
        </div>
      </div>

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      <style jsx>{`
        @keyframes fadeUp {
          from { transform: translateY(12px); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
      `}</style>

      {showPricing && (
        <PricingModal
          onClose={() => setShowPricing(false)}
          currentPlan={user?.plan ?? 'free'}
        />
      )}
    </div>
  );
}
