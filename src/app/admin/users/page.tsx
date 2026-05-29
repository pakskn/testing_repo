'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'

interface User {
  id: string
  name: string | null
  email: string
  image: string | null
  role: string
  status: string
  createdAt: string
  lastSignIn: string | null
  signInCount: number
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days < 1) return 'Today'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default function AdminUsersPage() {
  const [users, setUsers]   = useState<User[]>([])
  const [total, setTotal]   = useState(0)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'pending' | 'blocked' | 'admin'>('all')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/users`)
      const d = await r.json()
      setUsers(d.users)
      setTotal(d.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const update = async (id: string, data: Partial<User>) => {
    setUpdating(id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u))
    await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setUpdating(null)
    load()
  }

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`Delete user "${name}"?\n\nThis cannot be undone.`)) return
    setUsers(prev => prev.filter(u => u.id !== id))
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    load()
  }

  // Client-side filtering & search for instant, fluid UI updates
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Tab filter
      if (activeTab === 'active' && user.status !== 'active') return false
      if (activeTab === 'pending' && user.status !== 'pending') return false
      if (activeTab === 'blocked' && user.status !== 'blocked') return false
      if (activeTab === 'admin' && user.role !== 'admin') return false

      // Search filter
      if (search) {
        const q = search.toLowerCase()
        const nameMatch = (user.name || '').toLowerCase().includes(q)
        const emailMatch = user.email.toLowerCase().includes(q)
        return nameMatch || emailMatch
      }

      return true
    })
  }, [users, activeTab, search])

  const stats = useMemo(() => {
    const counts = { all: users.length, active: 0, pending: 0, blocked: 0, admin: 0 }
    users.forEach(u => {
      if (u.status === 'active') counts.active++
      if (u.status === 'pending') counts.pending++
      if (u.status === 'blocked') counts.blocked++
      if (u.role === 'admin') counts.admin++
    })
    return counts
  }, [users])

  return (
    <div className="p-8 max-w-[1400px] mx-auto min-h-screen">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">User Accounts</h1>
          <p className="text-zinc-400 text-xs mt-1">Manage platform authorization, approvals, roles, and session activities.</p>
        </div>
        {stats.pending > 0 && (
          <div className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg text-xs font-mono self-start">
            ⚠️ {stats.pending} accounts pending approval
          </div>
        )}
      </div>

      {/* Tabs Row & Search bar */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center mb-6">
        {/* Navigation Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-zinc-800 pb-0 flex-shrink-0">
          {[
            { id: 'all',      label: 'All',     count: stats.all },
            { id: 'active',   label: 'Active',  count: stats.active },
            { id: 'pending',  label: 'Pending', count: stats.pending },
            { id: 'blocked',  label: 'Blocked', count: stats.blocked },
            { id: 'admin',    label: 'Admins',   count: stats.admin },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 border-b-2 text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-400 font-semibold bg-indigo-500/5'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              {tab.label} <span className="text-[10px] text-zinc-500 font-normal ml-1">({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-80">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-zinc-800 rounded-lg bg-[#121214] text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
          <span className="absolute left-3 top-2.5 text-zinc-500 text-xs">🔍</span>
        </div>
      </div>

      {/* SaaS Premium Data Table */}
      <div className="bg-[#121214] border border-zinc-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-zinc-400 text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
            Loading accounts database...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-16 text-center text-zinc-500 text-xs font-mono">
            No matching accounts found
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#09090b] text-[10px] uppercase font-mono tracking-wider text-zinc-400 border-b border-zinc-800">
                  <th className="py-3 px-5 font-semibold">User details</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Role</th>
                  <th className="py-3 px-4 font-semibold">Last Sign In</th>
                  <th className="py-3 px-4 font-semibold">Sign Ins</th>
                  <th className="py-3 px-5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 text-zinc-300 font-sans">
                {filteredUsers.map(user => {
                  const isUserUpdating = updating === user.id

                  return (
                    <tr key={user.id} className="hover:bg-zinc-900/30 transition-colors">
                      {/* User Info */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          {user.image ? (
                            <img src={user.image} alt="avatar" className="w-8 h-8 rounded-full object-cover bg-zinc-800" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold">
                              {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-zinc-100 truncate max-w-[180px]">{user.name || 'Anonymous'}</p>
                            <p className="text-[10px] text-zinc-500 font-mono truncate max-w-[180px]">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Status Badges */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-mono border ${
                          user.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          user.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {user.status.toUpperCase()}
                        </span>
                      </td>

                      {/* Role Badges */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-mono border ${
                          user.role === 'admin' 
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                        }`}>
                          {user.role.toUpperCase()}
                        </span>
                      </td>

                      {/* Last Sign In */}
                      <td className="py-4 px-4 whitespace-nowrap text-zinc-400 font-mono text-[11px]">
                        {timeAgo(user.lastSignIn)}
                      </td>

                      {/* Sign In Count */}
                      <td className="py-4 px-4 whitespace-nowrap text-zinc-400 font-mono text-[11px]">
                        {user.signInCount} hits
                      </td>

                      {/* Operations Actions */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Approve Action */}
                          {user.status === 'pending' && (
                            <button
                              onClick={() => update(user.id, { status: 'active' })}
                              disabled={isUserUpdating}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-semibold transition-colors disabled:opacity-50"
                            >
                              Approve
                            </button>
                          )}

                          {/* Block/Unblock Action */}
                          {user.status === 'blocked' ? (
                            <button
                              onClick={() => update(user.id, { status: 'active' })}
                              disabled={isUserUpdating}
                              className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white rounded text-[10px] font-semibold transition-colors disabled:opacity-50"
                            >
                              Unblock
                            </button>
                          ) : (
                            user.status !== 'pending' && (
                              <button
                                onClick={() => update(user.id, { status: 'blocked' })}
                                disabled={isUserUpdating}
                                className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 text-rose-400 hover:bg-rose-500/10 rounded text-[10px] font-semibold transition-colors disabled:opacity-50"
                              >
                                Block
                              </button>
                            )
                          )}

                          {/* Toggle Admin Role Action */}
                          {user.role === 'admin' ? (
                            <button
                              onClick={() => update(user.id, { role: 'user' })}
                              disabled={isUserUpdating}
                              className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded text-[10px] font-semibold transition-colors disabled:opacity-50"
                            >
                              Remove Admin
                            </button>
                          ) : (
                            <button
                              onClick={() => update(user.id, { role: 'admin' })}
                              disabled={isUserUpdating}
                              className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 text-indigo-400 hover:bg-indigo-500/10 rounded text-[10px] font-semibold transition-colors disabled:opacity-50"
                            >
                              Make Admin
                            </button>
                          )}

                          {/* Delete Action */}
                          <button
                            onClick={() => deleteUser(user.id, user.name || user.email)}
                            className="p-1 hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 rounded transition-colors"
                            title="Delete User"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
