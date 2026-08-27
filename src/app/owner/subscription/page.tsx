'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageLoading } from '@/components/ui/loading'
import { ArrowLeft, Copy, Share2, CheckCircle, Clock, XCircle, Users, TrendingUp, Link2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { REFERRAL_THRESHOLDS, LEVEL_LABELS, LEVEL_COLORS, LEVEL_BENEFITS } from '@/lib/referral'
import type { OwnerMembershipLevel } from '@/lib/referral'

interface ReferralEntry {
  id: string
  libraryId: string | null
  libraryName: string
  libraryStatus: string | null
  referralStatus: 'PENDING' | 'QUALIFIED' | 'REJECTED' | 'INVALID'
  registeredAt: string
  qualifiedAt: string | null
}

interface ReferralData {
  referralCode: string | null
  referralUrl: string | null
  ownerMembershipLevel: OwnerMembershipLevel
  levelLabel: string
  qualifiedCount: number
  pendingCount: number
  nextLevel: OwnerMembershipLevel | null
  nextLevelLabel: string | null
  nextLevelThreshold: number
  needed: number
  referralHistory: ReferralEntry[]
}

const REFERRAL_STATUS_CONFIG = {
  QUALIFIED: { label: 'Qualified', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  PENDING:   { label: 'Pending',   icon: Clock,        color: 'text-amber-600',   bg: 'bg-amber-50'   },
  REJECTED:  { label: 'Rejected',  icon: XCircle,      color: 'text-red-600',     bg: 'bg-red-50'     },
  INVALID:   { label: 'Invalid',   icon: XCircle,      color: 'text-slate-500',   bg: 'bg-slate-50'   },
}

export default function ReferralMembershipPage() {
  const router = useRouter()
  const [data, setData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/owner/referral')
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [])

  const copyLink = () => {
    if (!data?.referralUrl) return
    navigator.clipboard.writeText(data.referralUrl)
      .then(() => toast.success('Referral link copied!'))
      .catch(() => toast.error('Could not copy — please copy manually'))
  }

  const shareLink = async () => {
    if (!data?.referralUrl) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join StudyLib as a Library Owner',
          text: 'Register your library on StudyLib using my referral link.',
          url: data.referralUrl,
        })
      } catch {
        // User cancelled share — no error needed
      }
    } else {
      copyLink()
    }
  }

  if (loading) return <PageLoading />
  if (!data) return null

  const level = data.ownerMembershipLevel
  const progressPct = data.nextLevel
    ? Math.min(100, (data.qualifiedCount / data.nextLevelThreshold) * 100)
    : 100

  // Level thresholds for the roadmap display
  const levels: Array<{ key: OwnerMembershipLevel; threshold: number }> = [
    { key: 'STANDARD', threshold: REFERRAL_THRESHOLDS.STANDARD },
    { key: 'LEVEL_1',  threshold: REFERRAL_THRESHOLDS.LEVEL_1  },
    { key: 'LEVEL_2',  threshold: REFERRAL_THRESHOLDS.LEVEL_2  },
    // LEVEL_3 removed (P1-8)
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Referral Membership</h1>
          <p className="text-slate-500 text-sm">Grow your network and earn membership levels</p>
        </div>
      </div>

      {/* Current Level Card */}
      <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm text-slate-500 mb-1">Current Membership Level</p>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${LEVEL_COLORS[level]}`}>
                  {LEVEL_LABELS[level]}
                </span>
              </div>
              <div className="flex gap-6 mt-4 text-sm">
                <div>
                  <p className="text-slate-500">Qualified Libraries</p>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">{data.qualifiedCount}</p>
                </div>
                <div>
                  <p className="text-slate-500">Pending</p>
                  <p className="text-2xl font-bold text-amber-600 tabular-nums">{data.pendingCount}</p>
                </div>
              </div>
            </div>
            {data.nextLevel && (
              <div className="rounded-2xl bg-white/80 border border-violet-200 p-4 min-w-[180px]">
                <p className="text-xs text-slate-500 mb-1">Next Level</p>
                <p className="font-bold text-slate-900">{data.nextLevelLabel}</p>
                <p className="text-xs text-slate-600 mt-1">
                  {data.needed} more verified {data.needed === 1 ? 'library' : 'libraries'} needed
                </p>
                <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 text-right">
                  {data.qualifiedCount} / {data.nextLevelThreshold}
                </p>
              </div>
            )}
            {!data.nextLevel && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                <p className="text-xs text-amber-700 font-medium">🏆 Maximum Level Reached</p>
                <p className="text-xs text-amber-600 mt-1">You&apos;re at the top tier!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Level Roadmap */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-violet-500" /> Membership Levels & Benefits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {levels.map(({ key, threshold }) => {
              const isCurrent = level === key
              const isUnlocked = data.qualifiedCount >= threshold
              const benefits = LEVEL_BENEFITS[key]
              return (
                <div
                  key={key}
                  className={`rounded-xl p-4 border-2 transition-all ${
                    isCurrent
                      ? 'border-violet-500 bg-violet-50'
                      : isUnlocked
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-slate-200 bg-slate-50 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className={`text-sm font-bold ${isCurrent ? 'text-violet-700' : isUnlocked ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {LEVEL_LABELS[key]}
                    </p>
                    {isCurrent && <span className="text-[10px] text-violet-600 font-medium bg-violet-100 px-1.5 py-0.5 rounded-full">Current</span>}
                    {!isCurrent && isUnlocked && <span className="text-[10px] text-emerald-600 font-medium bg-emerald-100 px-1.5 py-0.5 rounded-full">✓ Unlocked</span>}
                  </div>
                  <p className="text-[11px] text-slate-500 mb-3">
                    {threshold === 0 ? 'Default' : `${threshold}+ verified libraries`}
                  </p>
                  <ul className="space-y-1.5">
                    {benefits.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                        <span className={`mt-0.5 shrink-0 ${isCurrent ? 'text-violet-500' : isUnlocked ? 'text-emerald-500' : 'text-slate-400'}`}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Referral Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4 text-indigo-500" /> Your Referral Link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            Share this link with other library owners. When their library gets verified and approved,
            it counts as a qualified referral toward your membership level.
          </p>

          {data.referralUrl ? (
            <>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <span className="flex-1 text-sm text-slate-700 font-mono truncate">{data.referralUrl}</span>
              </div>
              <div className="flex gap-3">
                <Button onClick={copyLink} variant="outline" className="flex-1 gap-2">
                  <Copy className="h-4 w-4" /> Copy Link
                </Button>
                <Button onClick={shareLink} className="flex-1 gap-2">
                  <Share2 className="h-4 w-4" /> Share
                </Button>
              </div>
              <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-xs text-indigo-700">
                <span className="font-semibold">Your referral code:</span>{' '}
                <span className="font-mono tracking-wide">{data.referralCode}</span>
              </div>
            </>
          ) : (
            <p className="text-slate-400 text-sm">Referral code not yet assigned. Please contact support.</p>
          )}
        </CardContent>
      </Card>

      {/* Referral History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-emerald-500" /> Referral History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.referralHistory.length === 0 ? (
            <div className="py-10 text-center">
              <Users className="h-8 w-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No referrals yet</p>
              <p className="text-slate-400 text-xs mt-1">Share your link to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {data.referralHistory.map(entry => {
                const cfg = REFERRAL_STATUS_CONFIG[entry.referralStatus]
                const StatusIcon = cfg.icon
                return (
                  <div key={entry.id} className="flex items-center gap-3 py-3">
                    <div className={`rounded-xl ${cfg.bg} p-2 shrink-0`}>
                      <StatusIcon className={`h-4 w-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{entry.libraryName}</p>
                      <p className="text-xs text-slate-400">
                        Registered {new Date(entry.registeredAt).toLocaleDateString('en-IN')}
                        {entry.qualifiedAt && ` · Qualified ${new Date(entry.qualifiedAt).toLocaleDateString('en-IN')}`}
                      </p>
                    </div>
                    <Badge
                      variant={
                        entry.referralStatus === 'QUALIFIED' ? 'active'
                          : entry.referralStatus === 'PENDING' ? 'pending'
                          : 'suspended'
                      }
                      className="shrink-0 text-xs"
                    >
                      {cfg.label}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-4">
          <p className="font-semibold text-slate-800 text-sm mb-3">How referrals work</p>
          <ol className="space-y-2 text-xs text-slate-600 list-decimal list-inside">
            <li>Share your unique referral link with other library owners.</li>
            <li>They register using your link and submit their library for approval.</li>
            <li>Once the admin approves their library, the referral is <span className="text-emerald-700 font-medium">Qualified</span>.</li>
            <li>Every 20 qualified libraries upgrades your membership level.</li>
            <li>Levels are permanent — you never get downgraded for inactivity.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
