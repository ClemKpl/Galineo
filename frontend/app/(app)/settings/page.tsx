'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, type AccentColor } from '@/components/ThemeProvider';

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
  const { user, login, logout, token } = useAuth();

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

  // Notifications (UI seulement pour V1)
  const [notifProject, setNotifProject]     = useState(true);
  const [notifMember, setNotifMember]       = useState(true);
  const [notifDeadline, setNotifDeadline]   = useState(false);

  // Danger zone
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<Toast | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type });

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
      if (token) login(token, { id: user!.id, name: updated.name, email: updated.email, avatar: updated.avatar });
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

  const colors: { id: AccentColor; label: string; color: string }[] = [
    { id: 'orange', label: 'Orange', color: '#f97316' },
    { id: 'blue',   label: 'Bleu',   color: '#3b82f6' },
    { id: 'violet', label: 'Violet', color: '#8b5cf6' },
    { id: 'emerald',label: 'Vert',   color: '#10b981' },
    { id: 'rose',   label: 'Rose',   color: '#f43f5e' },
  ];

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
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
          <div className="grid grid-cols-2 gap-4">
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
      <Section title="Notifications" description="Choisissez ce que vous souhaitez recevoir">
        <Toggle checked={notifProject}  onChange={setNotifProject}
          label="Activité sur mes projets"
          description="Mises à jour, nouveaux membres, changements" />
        <Toggle checked={notifMember}   onChange={setNotifMember}
          label="Ajout à un projet"
          description="Quand quelqu'un vous ajoute à un projet" />
        <Toggle checked={notifDeadline} onChange={setNotifDeadline}
          label="Rappels de deadline"
          description="3 jours avant l'échéance d'un projet" />
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

      {/* ── Danger zone ── */}
      <div className="bg-white rounded-2xl border border-red-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-red-50">
          <h2 className="font-semibold text-red-600 text-base">Zone de danger</h2>
          <p className="text-stone-400 text-sm mt-0.5">Actions irréversibles sur votre compte</p>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-stone-600 mb-4">
            La suppression de votre compte est <strong>définitive</strong>. Toutes vos données seront effacées et vous serez retiré de tous les projets.
          </p>
          <div className="flex gap-3 items-center">
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
              className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-40 flex items-center gap-2 shrink-0">
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
    </div>
  );
}
