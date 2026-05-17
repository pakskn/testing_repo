'use client'

import { useEffect, useState, useCallback } from 'react'

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

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  active:  'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  blocked: 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400',
}
const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  user:  'bg-gray-100 text-gray-600 dark:bg-[#252525] dark:text-gray-400',
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
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ search, status: statusFilter })
    const r = await fetch(`/api/admin/users?${p}`)
    const d = await r.json()
    setUsers(d.users)
    setTotal(d.total)
    setLoading(false)
  }, [search, statusFilter])

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

  const pending = users.filter(u => u.status === 'pending').length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
          <p className="text-gray-500 text-sm">
            {total} total
            {pending > 0 && <span className="ml-2 text-yellow-600 font-medium">⏳ {pending} pending approval</span>}
          </p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { value: '',        label: '👥 All Users' },
          { value: 'pending', label: '⏳ Pending'  },
          { value: 'active',  label: '✅ Active'   },
          { value: 'blocked', label: '⛔ Blocked'  },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
              statusFilter === tab.value
                ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-black dark:border-white'
                : 'bg-white dark:bg-[#1a1a1a] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#2a2a2a]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-200 dark:border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-blue-400 max-w-md"
        />
      </div>

      {/* User cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading users...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No users found</div>
      ) : (
        <div className="grid gap-3">
          {users.map(user => (
            <div key={user.id}
              className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-[#2a2a2a] p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Avatar + Info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.image} alt="" className="w-10 h-10 rounded-full flex-shrink-0 object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {user.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{user.name || 'No name'}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[user.role]}`}>
                        {user.role.toUpperCase()}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[user.status]}`}>
                        {user.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
                      Joined {timeAgo(user.createdAt)} · Last seen {timeAgo(user.lastSignIn)} · {user.signInCount} sign-ins
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 flex-shrink-0">
                  {/* Approve */}
                  {user.status === 'pending' && (
                    <button
                      onClick={() => update(user.id, { status: 'active' })}
                      disabled={updating === user.id}
                      className="px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
                    >
                      ✅ Approve
                    </button>
                  )}
                  {/* Block / Unblock */}
                  {user.status === 'blocked' ? (
                    <button
                      onClick={() => update(user.id, { status: 'active' })}
                      disabled={updating === user.id}
                      className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors disabled:opacity-50"
                    >
                      🔓 Unblock
                    </button>
                  ) : user.status !== 'pending' && (
                    <button
                      onClick={() => update(user.id, { status: 'blocked' })}
                      disabled={updating === user.id}
                      className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      ⛔ Block
                    </button>
                  )}
                  {/* Make Admin / Remove Admin */}
                  {user.role === 'admin' ? (
                    <button
                      onClick={() => update(user.id, { role: 'user' })}
                      disabled={updating === user.id}
                      className="px-3 py-1.5 bg-gray-100 dark:bg-[#252525] text-gray-600 dark:text-gray-400 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      👤 Remove Admin
                    </button>
                  ) : (
                    <button
                      onClick={() => update(user.id, { role: 'admin' })}
                      disabled={updating === user.id}
                      className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors disabled:opacity-50"
                    >
                      👑 Make Admin
                    </button>
                  )}
                  {/* Delete */}
                  <button
                    onClick={() => deleteUser(user.id, user.name || user.email)}
                    className="px-3 py-1.5 bg-red-50 dark:bg-red-900/10 text-red-400 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
