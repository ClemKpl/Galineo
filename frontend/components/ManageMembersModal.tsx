'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

type Role = { id: number; name: string };
type UserLite = { id: number; name: string; email: string };
type Member = { id: number; name: string; email: string; role_id: number; role_name: string; last_login_at?: string | null };

export default function ManageMembersModal({
  projectId,
  onClose,
  onChanged,
}: {
  projectId: number;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<UserLite[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserLite | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number>(3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getErrorMessage = (e: unknown) => {
    if (e instanceof Error) return e.message;
    if (e && typeof e === 'object' && 'message' in e) {
      const msg = (e as { message?: unknown }).message;
      if (typeof msg === 'string') return msg;
    }
    return 'Erreur';
  };

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const [project, rolesList] = await Promise.all([api.get(`/projects/${projectId}`), api.get('/roles')]);
        if (cancelled) return;
        setMembers(Array.isArray(project?.members) ? project.members : []);
        setRoles(Array.isArray(rolesList) ? rolesList : []);
      } catch (e: unknown) {
        if (!cancelled) setError(getErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    let active = true;
    async function run() {
      if (!search.trim() || search.trim().length < 1) {
        setSearchResults([]);
        return;
      }
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(search.trim())}`);
        if (!active) return;
        setSearchResults(Array.isArray(res) ? res : []);
      } catch {
        if (active) setSearchResults([]);
      }
    }
    const t = setTimeout(run, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [search]);

  const roleOptions = useMemo(() => {
    const list = roles.length ? roles : [{ id: 1, name: 'Propriétaire' }, { id: 2, name: 'Admin' }, { id: 3, name: 'Membre' }, { id: 4, name: 'Observateur' }];
    return list.filter((r) => r.id !== 1); // pas d'ajout direct en propriétaire
  }, [roles]);

  const formatLastLogin = (value?: string | null) => {
    if (!value) return 'Jamais';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('fr-FR', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  async function refreshMembers() {
    const project = await api.get(`/projects/${projectId}`);
    setMembers(Array.isArray(project?.members) ? project.members : []);
  }

  async function addMember() {
    if (!selectedUser) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/projects/${projectId}/members`, { userId: selectedUser.id, roleId: selectedRoleId });
      setSelectedUser(null);
      setSearch('');
      setSearchResults([]);
      await refreshMembers();
      onChanged?.();
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(userId: number) {
    if (!confirm('Retirer ce membre du projet ?')) return;
    setSaving(true);
    setError(null);
    try {
      await api.delete(`/projects/${projectId}/members/${userId}`);
      await refreshMembers();
      onChanged?.();
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(userId: number, roleId: number) {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/projects/${projectId}/members/${userId}`, { roleId });
      await refreshMembers();
      onChanged?.();
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Gestion des membres</p>
            <h3 className="mt-1 text-lg font-semibold text-stone-900">Projet #{projectId}</h3>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1" aria-label="Fermer">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="p-6 grid gap-6 md:grid-cols-[1fr_1.1fr]">
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-stone-900">Ajouter un membre</h4>
            <div className="space-y-2">
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedUser(null);
                }}
                placeholder="Rechercher (nom ou email)"
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900"
              />

              {selectedUser ? (
                <div className="rounded-xl border border-stone-200 p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900 truncate">{selectedUser.name}</p>
                    <p className="text-xs text-stone-400 truncate">{selectedUser.email}</p>
                  </div>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="text-xs font-semibold text-stone-500 hover:text-stone-800"
                  >
                    Changer
                  </button>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="rounded-xl border border-stone-200 overflow-hidden max-h-56 overflow-y-auto">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUser(u)}
                      className="w-full text-left px-4 py-3 hover:bg-stone-50 border-b border-stone-100 last:border-b-0"
                    >
                      <p className="text-sm font-semibold text-stone-900 truncate">{u.name}</p>
                      <p className="text-xs text-stone-400 truncate">{u.email}</p>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(Number(e.target.value))}
                  className="flex-1 px-3 py-2.5 border border-stone-200 rounded-xl bg-white text-sm"
                >
                  {roleOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addMember}
                  disabled={!selectedUser || saving}
                  className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-stone-300 text-white rounded-xl text-sm font-semibold"
                >
                  {saving ? '...' : 'Ajouter'}
                </button>
              </div>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}
            <p className="text-xs text-stone-400">Rôle Propriétaire non assignable ici.</p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-stone-900">Membres ({members.length})</h4>
              <button onClick={() => refreshMembers()} className="text-xs font-semibold text-stone-500 hover:text-stone-800">
                Rafraîchir
              </button>
            </div>

            {loading ? (
              <div className="space-y-2">
                <div className="h-16 rounded-2xl bg-stone-100 animate-pulse" />
                <div className="h-16 rounded-2xl bg-stone-100 animate-pulse" />
              </div>
            ) : members.length === 0 ? (
              <div className="py-12 text-center text-stone-400 text-sm">Aucun membre.</div>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-stone-900 truncate">{m.name}</p>
                        <p className="text-xs text-stone-400 truncate">{m.email}</p>
                        <p className="text-xs text-stone-500 mt-1">Dernière connexion : {formatLastLogin(m.last_login_at)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={m.role_id}
                          onChange={(e) => changeRole(m.id, Number(e.target.value))}
                          disabled={saving || m.role_id === 1}
                          className="px-2 py-1.5 border border-stone-200 rounded-xl bg-white text-xs"
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeMember(m.id)}
                          disabled={saving || m.role_id === 1}
                          className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:text-stone-300 disabled:border-stone-100"
                        >
                          Retirer
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
