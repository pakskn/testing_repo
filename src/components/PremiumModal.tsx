'use client'

import { useState } from 'react'

interface PremiumModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function PremiumModal({ isOpen, onClose }: PremiumModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleUpgrade = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Failed to initiate checkout')
      }

      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with elegant blur */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Container with beautiful glassmorphism gradients */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-gradient-to-b from-[#1c1c1e] to-[#0f0f10] border border-[#2c2c2e] p-6 shadow-2xl transition-all duration-300 dark:text-white">
        
        {/* Animated ambient top glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-purple-600/20 blur-3xl pointer-events-none" />

        {/* Header Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/5"
          aria-label="Close modal"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Modal Content */}
        <div className="relative text-center mt-3">
          {/* Badge / Premium Icon */}
          <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4 animate-bounce duration-1000">
            <span className="text-2xl">💎</span>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-purple-300">
            Upgrade to Premium Tiers
          </h2>
          <p className="text-sm text-gray-400 mt-2 max-w-sm mx-auto">
            Supercharge your YouTube growth strategy and unlock advanced data exploration features today.
          </p>

          {/* Features Checklist */}
          <div className="mt-6 text-left space-y-3 bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-indigo-400 mt-0.5">✓</span>
              <div>
                <p className="text-sm font-semibold text-gray-200">Unlimited CSV Exporting</p>
                <p className="text-xs text-gray-400">Download massive lists of long-form & short-form channels instantly.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-indigo-400 mt-0.5">✓</span>
              <div>
                <p className="text-sm font-semibold text-gray-200">Advanced Outlier Analysis</p>
                <p className="text-xs text-gray-400">Uncover hidden video performers and copy proven content formulas.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-indigo-400 mt-0.5">✓</span>
              <div>
                <p className="text-sm font-semibold text-gray-200">Ad-Free Experience & API Access</p>
                <p className="text-xs text-gray-400">Fast, distraction-free analysis and future API querying capability.</p>
              </div>
            </div>
          </div>

          {/* Pricing Box */}
          <div className="mt-6 p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 relative overflow-hidden">
            <div className="absolute right-0 top-0 bg-gradient-to-l from-purple-600 to-indigo-600 text-[10px] font-extrabold px-2.5 py-1 rounded-bl-lg uppercase tracking-wider text-white">
              Popular Plan
            </div>
            <div className="text-left">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Premium Monthly</span>
              <div className="flex items-baseline mt-1 gap-1">
                <span className="text-3xl font-extrabold text-white">$19</span>
                <span className="text-sm text-gray-400">/ month</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Cancel anytime. 100% secure Stripe checkout.</p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 py-2.5 px-3 rounded-lg text-left">
              ⚠️ {error}
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-3 font-semibold text-sm shadow-xl shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Connecting to Stripe...
                </>
              ) : (
                <>
                  Upgrade to Premium Tiers 💎
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="w-full text-xs font-semibold text-gray-400 hover:text-white py-2.5 transition-colors disabled:opacity-50"
            >
              No thanks, keep Free Tier
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
