'use client'
import { signOut, useSession } from 'next-auth/react'

export default function PendingPage() {
  const { data: session } = useSession()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⏳</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Awaiting Approval</h1>
          <p className="text-gray-500 text-sm mb-4">
            Your account <strong>{session?.user?.email}</strong> is pending admin approval.
          </p>
          <p className="text-gray-400 text-xs mb-6">
            The admin will review your request and grant access shortly.
            <br />Please check back later.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs text-gray-500 font-medium mb-1">Contact Admin</p>
            <p className="text-sm text-gray-700 font-semibold">waqasalee.com</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/signin' })}
            className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Sign Out
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">
          Waqasalee.com · Niche Research Tool
        </p>
      </div>
    </div>
  )
}
