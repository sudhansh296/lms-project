import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { calculatePaymentBreakdown, toPaise } from '@/lib/payment-calc'

// ── helpers ────────────────────────────────────────────────────────────────────

function withEnv(vars: Record<string, string>, fn: () => void) {
  const originals: Record<string, string | undefined> = {}
  for (const k of Object.keys(vars)) originals[k] = process.env[k]
  Object.assign(process.env, vars)
  fn()
  for (const [k, v] of Object.entries(originals)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
}

// ── calculatePaymentBreakdown ──────────────────────────────────────────────────

describe('calculatePaymentBreakdown – 5 % commission', () => {
  it('owner gets 95 % of libraryBaseAmount', () => {
    withEnv({
      PLATFORM_COMMISSION_PERCENT: '5',
      CUSTOMER_PAYS_GATEWAY_FEE: 'false',
    }, () => {
      const bd = calculatePaymentBreakdown(1000, 0)
      expect(bd.platformCommission).toBe(50)
      expect(bd.ownerAmount).toBe(950)
    })
  })

  it('platformCommission + ownerAmount === libraryBaseAmount', () => {
    withEnv({ PLATFORM_COMMISSION_PERCENT: '5', CUSTOMER_PAYS_GATEWAY_FEE: 'false' }, () => {
      const bd = calculatePaymentBreakdown(450, 0)
      expect(bd.platformCommission + bd.ownerAmount).toBeCloseTo(bd.libraryBaseAmount, 2)
    })
  })

  it('libraryBaseAmount = planPrice + seatExtraAmount', () => {
    withEnv({ PLATFORM_COMMISSION_PERCENT: '5', CUSTOMER_PAYS_GATEWAY_FEE: 'false' }, () => {
      const bd = calculatePaymentBreakdown(400, 50)
      expect(bd.libraryBaseAmount).toBe(450)
    })
  })
})

describe('calculatePaymentBreakdown – monthly pricing', () => {
  it('planPrice reflects months × monthlyPrice', () => {
    withEnv({ PLATFORM_COMMISSION_PERCENT: '5', CUSTOMER_PAYS_GATEWAY_FEE: 'false' }, () => {
      // 3 months at ₹450/month = ₹1350 plan price
      const bd = calculatePaymentBreakdown(1350, 0, { months: 3, monthlyPrice: 450 })
      expect(bd.months).toBe(3)
      expect(bd.monthlyPrice).toBe(450)
      expect(bd.planPrice).toBe(1350)
    })
  })

  it('does NOT change the 5% commission rate', () => {
    withEnv({ PLATFORM_COMMISSION_PERCENT: '5', CUSTOMER_PAYS_GATEWAY_FEE: 'false' }, () => {
      const bd = calculatePaymentBreakdown(1350, 0, { months: 3, monthlyPrice: 450 })
      expect(bd.platformCommission).toBeCloseTo(67.5, 2)
      expect(bd.ownerAmount).toBeCloseTo(1282.5, 2)
    })
  })
})

describe('calculatePaymentBreakdown – gateway fee gross-up', () => {
  it('studentTotal >= libraryBaseAmount when customer pays gateway fee', () => {
    withEnv({
      PLATFORM_COMMISSION_PERCENT: '5',
      CUSTOMER_PAYS_GATEWAY_FEE: 'true',
      RAZORPAY_PG_FEE_PERCENT: '2',
      RAZORPAY_PG_FEE_GST_PERCENT: '18',
    }, () => {
      const bd = calculatePaymentBreakdown(1000, 0)
      expect(bd.studentTotal).toBeGreaterThanOrEqual(bd.libraryBaseAmount)
    })
  })

  it('studentTotal = libraryBaseAmount + gatewayFee + gatewayFeeGst', () => {
    withEnv({
      PLATFORM_COMMISSION_PERCENT: '5',
      CUSTOMER_PAYS_GATEWAY_FEE: 'true',
      RAZORPAY_PG_FEE_PERCENT: '2',
      RAZORPAY_PG_FEE_GST_PERCENT: '18',
    }, () => {
      const bd = calculatePaymentBreakdown(450, 0)
      expect(bd.studentTotal).toBeCloseTo(
        bd.libraryBaseAmount + bd.gatewayFee + bd.gatewayFeeGst, 1
      )
    })
  })

  it('gatewayFee = 0 when CUSTOMER_PAYS_GATEWAY_FEE=false', () => {
    withEnv({ CUSTOMER_PAYS_GATEWAY_FEE: 'false' }, () => {
      const bd = calculatePaymentBreakdown(500, 0)
      expect(bd.gatewayFee).toBe(0)
      expect(bd.gatewayFeeGst).toBe(0)
      expect(bd.studentTotal).toBe(500)
    })
  })
})

describe('calculatePaymentBreakdown – legacy compatibility aliases', () => {
  it('baseAmount === libraryBaseAmount', () => {
    withEnv({ CUSTOMER_PAYS_GATEWAY_FEE: 'false' }, () => {
      const bd = calculatePaymentBreakdown(800, 0)
      expect(bd.baseAmount).toBe(bd.libraryBaseAmount)
    })
  })

  it('platformFee === platformCommission', () => {
    withEnv({ PLATFORM_COMMISSION_PERCENT: '5', CUSTOMER_PAYS_GATEWAY_FEE: 'false' }, () => {
      const bd = calculatePaymentBreakdown(800, 0)
      expect(bd.platformFee).toBe(bd.platformCommission)
    })
  })

  it('totalAmount === studentTotal', () => {
    withEnv({ CUSTOMER_PAYS_GATEWAY_FEE: 'false' }, () => {
      const bd = calculatePaymentBreakdown(800, 0)
      expect(bd.totalAmount).toBe(bd.studentTotal)
    })
  })
})

// ── toPaise ────────────────────────────────────────────────────────────────────

describe('toPaise', () => {
  it('whole rupees', () => {
    expect(toPaise(100)).toBe(10000)
  })

  it('paise already exact', () => {
    expect(toPaise(10.5)).toBe(1050)
  })

  it('rounds floating point noise', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS
    expect(toPaise(0.1 + 0.2)).toBe(30)
  })

  it('zero', () => {
    expect(toPaise(0)).toBe(0)
  })
})
