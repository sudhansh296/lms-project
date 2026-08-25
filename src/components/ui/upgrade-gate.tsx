import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Button } from './button'

interface UpgradeGateProps {
  message: string
}

/**
 * Shown when an owner's membership level doesn't allow access to a feature.
 * Prompts them to refer more libraries to level up.
 */
export function UpgradeGate({ message }: UpgradeGateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="rounded-full bg-violet-100 p-5 mb-5">
        <Lock className="h-8 w-8 text-violet-600" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Feature Locked</h2>
      <p className="text-slate-500 text-sm max-w-sm mb-6">{message}</p>
      <Link href="/owner/subscription">
        <Button className="gap-2 bg-violet-600 hover:bg-violet-700">
          View Referral Membership →
        </Button>
      </Link>
    </div>
  )
}
