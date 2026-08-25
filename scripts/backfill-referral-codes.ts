/**
 * One-time script: assign unique referral codes to existing LibraryOwners
 * that were created before the referral system was introduced.
 *
 * Run with: npx tsx scripts/backfill-referral-codes.ts
 */
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'
import { generateReferralCode } from '../src/lib/referral'

const connectionString = process.env.DATABASE_URL ?? ''
const adapter = new PrismaPg({ connectionString })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  const owners = await prisma.libraryOwner.findMany({
    where: { referralCode: null },
    select: { id: true },
  })

  console.log(`Found ${owners.length} owner(s) without a referral code.`)

  for (const owner of owners) {
    // Keep generating until unique
    let code = ''
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = generateReferralCode()
      const existing = await prisma.libraryOwner.findUnique({ where: { referralCode: candidate } })
      if (!existing) { code = candidate; break }
    }
    if (!code) {
      console.error(`Could not generate unique code for owner ${owner.id}`)
      continue
    }
    await prisma.libraryOwner.update({
      where: { id: owner.id },
      data: { referralCode: code },
    })
    console.log(`  owner ${owner.id} → ${code}`)
  }

  console.log('Done.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
