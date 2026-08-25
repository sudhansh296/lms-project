# Complete Guide: Building & Using APIs in Next.js

## Overview
Next.js has built-in API routes. Any file in `src/app/api/` becomes an API endpoint automatically!

---

## Part 1: Create an API Route

### Example 1: Simple GET API

**File**: `src/app/api/hello/route.ts`

```typescript
// This creates: http://localhost:3000/api/hello

export async function GET() {
  return Response.json({ 
    message: 'Hello World!',
    timestamp: new Date().toISOString()
  })
}
```

**Test it**: Open browser → `http://localhost:3000/api/hello`

---

### Example 2: GET with Database (Real Example)

**File**: `src/app/api/libraries/route.ts`

```typescript
import prisma from '@/lib/prisma'

// GET /api/libraries - Get all libraries
export async function GET() {
  try {
    const libraries = await prisma.library.findMany({
      where: { status: 'ACTIVE' },
      include: {
        owner: {
          include: { user: true }
        },
        seats: true,
      },
    })

    return Response.json({ 
      libraries,
      count: libraries.length 
    })
  } catch (error) {
    console.error('Error fetching libraries:', error)
    return Response.json({ 
      error: 'Failed to fetch libraries' 
    }, { status: 500 })
  }
}
```

---

### Example 3: POST API (Create Data)

**File**: `src/app/api/libraries/route.ts` (add POST)

```typescript
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'

// POST /api/libraries - Create new library
export async function POST(request: Request) {
  try {
    // 1. Check authentication
    const session = await requireAuth(['LIBRARY_OWNER'])
    
    // 2. Get data from request body
    const body = await request.json()
    const { name, city, description } = body

    // 3. Validate data
    if (!name || !city) {
      return Response.json({ 
        error: 'Name and city are required' 
      }, { status: 400 })
    }

    // 4. Create in database
    const library = await prisma.library.create({
      data: {
        ownerId: session.id,
        name,
        city,
        description,
        status: 'PENDING_VERIFICATION'
      }
    })

    // 5. Return success response
    return Response.json({ 
      library,
      message: 'Library created successfully' 
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating library:', error)
    return Response.json({ 
      error: 'Failed to create library' 
    }, { status: 500 })
  }
}
```

---

### Example 4: Dynamic Route (With ID)

**File**: `src/app/api/libraries/[id]/route.ts`

The `[id]` creates a dynamic route: `/api/libraries/123`, `/api/libraries/abc`, etc.

```typescript
import prisma from '@/lib/prisma'

// Define context type for params
interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/libraries/[id] - Get single library
export async function GET(request: Request, context: RouteContext) {
  try {
    // Extract ID from URL
    const { id } = await context.params

    // Fetch from database
    const library = await prisma.library.findUnique({
      where: { id },
      include: {
        owner: true,
        seats: true,
        membershipPlans: true,
      }
    })

    if (!library) {
      return Response.json({ 
        error: 'Library not found' 
      }, { status: 404 })
    }

    return Response.json({ library })
  } catch (error) {
    console.error('Error:', error)
    return Response.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// PATCH /api/libraries/[id] - Update library
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireAuth(['LIBRARY_OWNER'])
    const { id } = await context.params
    const body = await request.json()

    // Update in database
    const library = await prisma.library.update({
      where: { id },
      data: body
    })

    return Response.json({ 
      library,
      message: 'Library updated' 
    })
  } catch (error) {
    return Response.json({ 
      error: 'Update failed' 
    }, { status: 500 })
  }
}

// DELETE /api/libraries/[id] - Delete library
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await requireAuth(['LIBRARY_OWNER'])
    const { id } = await context.params

    await prisma.library.delete({ where: { id } })

    return Response.json({ 
      message: 'Library deleted' 
    })
  } catch (error) {
    return Response.json({ 
      error: 'Delete failed' 
    }, { status: 500 })
  }
}
```

---

## Part 2: Use the API in Your Frontend

### Method 1: Simple Fetch (Basic)

```typescript
'use client'

import { useEffect, useState } from 'react'

export default function LibrariesPage() {
  const [libraries, setLibraries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Call your API
    fetch('/api/libraries')
      .then(response => response.json())
      .then(data => {
        setLibraries(data.libraries)
        setLoading(false)
      })
      .catch(error => {
        console.error('Error:', error)
        setLoading(false)
      })
  }, [])

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <h1>Libraries</h1>
      {libraries.map(lib => (
        <div key={lib.id}>{lib.name}</div>
      ))}
    </div>
  )
}
```

---

### Method 2: POST Request (Create Data)

```typescript
'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

export default function CreateLibraryPage() {
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    description: ''
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      // POST to your API
      const response = await fetch('/api/libraries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Failed to create')
        return
      }

      toast.success('Library created!')
      // Redirect or reset form
    } catch (error) {
      toast.error('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Library Name"
        value={formData.name}
        onChange={e => setFormData({ ...formData, name: e.target.value })}
      />
      <input
        type="text"
        placeholder="City"
        value={formData.city}
        onChange={e => setFormData({ ...formData, city: e.target.value })}
      />
      <textarea
        placeholder="Description"
        value={formData.description}
        onChange={e => setFormData({ ...formData, description: e.target.value })}
      />
      <button type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Create Library'}
      </button>
    </form>
  )
}
```

---

### Method 3: Update Request (PATCH)

```typescript
const updateLibrary = async (id: string, updates: any) => {
  try {
    const response = await fetch(`/api/libraries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error)
    }

    return data.library
  } catch (error) {
    console.error('Update failed:', error)
    throw error
  }
}

// Usage
await updateLibrary('lib-123', { 
  name: 'Updated Name',
  city: 'New City'
})
```

---

### Method 4: Delete Request

```typescript
const deleteLibrary = async (id: string) => {
  if (!confirm('Are you sure?')) return

  try {
    const response = await fetch(`/api/libraries/${id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error('Delete failed')
    }

    toast.success('Library deleted')
    // Refresh list or redirect
  } catch (error) {
    toast.error('Failed to delete')
  }
}
```

---

## Part 3: Advanced Patterns

### Pattern 1: Query Parameters

**API Side**:
```typescript
// GET /api/libraries?city=Delhi&status=ACTIVE

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const city = searchParams.get('city')
  const status = searchParams.get('status')

  const libraries = await prisma.library.findMany({
    where: {
      ...(city && { city }),
      ...(status && { status })
    }
  })

  return Response.json({ libraries })
}
```

**Frontend Side**:
```typescript
// Call with query params
fetch('/api/libraries?city=Delhi&status=ACTIVE')
  .then(r => r.json())
  .then(data => console.log(data.libraries))
```

---

### Pattern 2: Pagination

**API Side**:
```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '10')
  const skip = (page - 1) * limit

  const [libraries, total] = await Promise.all([
    prisma.library.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.library.count()
  ])

  return Response.json({
    libraries,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  })
}
```

**Frontend Side**:
```typescript
const [page, setPage] = useState(1)

useEffect(() => {
  fetch(`/api/libraries?page=${page}&limit=10`)
    .then(r => r.json())
    .then(data => {
      setLibraries(data.libraries)
      setPagination(data.pagination)
    })
}, [page])
```

---

### Pattern 3: Error Handling

**API Side**:
```typescript
export async function GET() {
  try {
    const data = await prisma.library.findMany()
    return Response.json({ data })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('API Error:', error)
    
    return Response.json({ 
      error: msg,
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 })
  }
}
```

**Frontend Side**:
```typescript
const fetchData = async () => {
  try {
    const response = await fetch('/api/libraries')
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Request failed')
    }

    return data
  } catch (error) {
    if (error instanceof Error) {
      toast.error(error.message)
    } else {
      toast.error('Something went wrong')
    }
    throw error
  }
}
```

---

## Part 4: Real-World Example (Your Project)

### Example: Seat Booking API

**API**: `src/app/api/student/bookings/route.ts`

```typescript
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/student/bookings - Get student's bookings
export async function GET(request: Request) {
  try {
    const session = await requireAuth(['STUDENT'])
    
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    const bookings = await prisma.booking.findMany({
      where: { studentId: session.id },
      include: {
        library: { select: { name: true, city: true } },
        seat: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return Response.json({ bookings, count: bookings.length })
  } catch (error) {
    return Response.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }
}

// POST /api/student/bookings - Create new booking
export async function POST(request: Request) {
  try {
    const session = await requireAuth(['STUDENT'])
    const body = await request.json()
    const { libraryId, seatId, startTime, endTime } = body

    // Validation
    if (!libraryId || !seatId || !startTime || !endTime) {
      return Response.json({ 
        error: 'Missing required fields' 
      }, { status: 400 })
    }

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        studentId: session.id,
        libraryId,
        seatId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status: 'PENDING',
      },
      include: {
        library: true,
        seat: true,
      }
    })

    return Response.json({ 
      booking,
      message: 'Booking created successfully' 
    }, { status: 201 })
  } catch (error) {
    return Response.json({ 
      error: 'Failed to create booking' 
    }, { status: 500 })
  }
}
```

**Frontend Usage**:

```typescript
'use client'

import { useEffect, useState } from 'react'

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch bookings
  useEffect(() => {
    fetch('/api/student/bookings?limit=20')
      .then(r => r.json())
      .then(data => {
        setBookings(data.bookings)
        setLoading(false)
      })
  }, [])

  // Create new booking
  const createBooking = async (bookingData) => {
    try {
      const response = await fetch('/api/student/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error)
        return
      }

      alert('Booking created!')
      // Refresh bookings list
      window.location.reload()
    } catch (error) {
      alert('Failed to create booking')
    }
  }

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <h1>My Bookings</h1>
      {bookings.map(booking => (
        <div key={booking.id}>
          <h3>{booking.library.name}</h3>
          <p>Seat: {booking.seat.label}</p>
          <p>Status: {booking.status}</p>
        </div>
      ))}
    </div>
  )
}
```

---

## Quick Reference

### API HTTP Methods:
- `GET` - Read/fetch data
- `POST` - Create new data
- `PATCH` - Update existing data (partial)
- `PUT` - Replace existing data (full)
- `DELETE` - Delete data

### Status Codes:
- `200` - OK (success)
- `201` - Created (new resource)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (no permission)
- `404` - Not Found
- `500` - Server Error

### File Structure:
```
src/app/api/
├── hello/
│   └── route.ts          → /api/hello
├── libraries/
│   ├── route.ts          → /api/libraries (GET, POST)
│   └── [id]/
│       └── route.ts      → /api/libraries/123 (GET, PATCH, DELETE)
└── student/
    └── bookings/
        ├── route.ts      → /api/student/bookings
        └── [id]/
            └── route.ts  → /api/student/bookings/123
```

---

## Summary

1. **Create API**: Make `route.ts` file in `src/app/api/your-route/`
2. **Export Functions**: `GET`, `POST`, `PATCH`, `DELETE`
3. **Call from Frontend**: Use `fetch()` with proper method and body
4. **Handle Responses**: Check `response.ok` and parse JSON
5. **Error Handling**: Try-catch blocks on both sides

That's it! You now know how to build and use APIs in Next.js! 🚀
