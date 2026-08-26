import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL ?? ''
const adapter = new PrismaPg({ connectionString })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  console.log('🔧 Removing premium seat pricing...\n')

  const result = await prisma.seat.updateMany({
    data: {
      seatType: 'STANDARD',
      extraPrice: null,
    },
  })

  console.log(`✓ Updated ${result.count} seats to STANDARD with no extra price\n`)
  console.log('✅ All seats are now standard with no additional charges')
}

main()
  .catch((e) => {
    console.error('❌ Update failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
