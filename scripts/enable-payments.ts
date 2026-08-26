import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL ?? ''
const adapter = new PrismaPg({ connectionString })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  console.log('💳 Enabling payments for test library...\n')

  // Update library owner to enable settlement/payments
  const result = await prisma.libraryOwner.update({
    where: { id: 'test-lib-owner-1' },
    data: {
      settlementReady: true,
      razorpayAccountId: 'acc_TEST123456789',
      razorpayAccountStatus: 'activated',
      razorpayActivationStatus: 'activated',
      settlementActivatedAt: new Date(),
    },
  })

  console.log('✓ Updated library owner:', result.id)
  console.log('  - settlementReady: true')
  console.log('  - razorpayAccountStatus: activated')
  console.log('\n✅ Online payments are now enabled for the test library!')
}

main()
  .catch((e) => {
    console.error('❌ Update failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
