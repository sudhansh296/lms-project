import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
dotenv.config()

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  const library = await prisma.library.findFirst({
    select: { id: true, name: true },
  })
  console.log('Library:', JSON.stringify(library))

  const seats = await prisma.seat.findMany({
    where: { libraryId: library!.id },
    select: { id: true, label: true, status: true, extraPrice: true },
  })
  console.log('Seats:', JSON.stringify(seats, null, 2))
}

main().finally(() => prisma.$disconnect())
