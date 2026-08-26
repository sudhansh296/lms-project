# Multi-Branch Support - Current State & Requirements

## Current Limitation

All owner API routes use `findFirst()` which **silently picks one library** when an owner has multiple branches:

```typescript
// ❌ Current: Picks arbitrary library
async function getOwnerLibrary(userId: string) {
  return prisma.library.findFirst({ where: { owner: { userId } } })
}
```

**Problem**: If owner has 2+ libraries, API returns whichever the database finds first (undefined order).

---

## Required Changes for Multi-Branch Support

### 1. Add Explicit Library Selection

**Frontend**: Add library selector in owner dashboard
```tsx
// Owner header component
<select value={selectedLibraryId} onChange={handleLibraryChange}>
  {ownerLibraries.map(lib => (
    <option key={lib.id} value={lib.id}>{lib.name}</option>
  ))}
</select>
```

**Store**: Save selected library in localStorage/session
```typescript
localStorage.setItem('selectedLibraryId', libraryId)
```

### 2. Update All API Routes to Require libraryId

**All owner routes** must accept explicit `libraryId` parameter:

```typescript
// ✅ Multi-branch ready
export async function GET(request: NextRequest) {
  const session = await requireAuth(['LIBRARY_OWNER'])
  const { searchParams } = new URL(request.url)
  const libraryId = searchParams.get('libraryId')
  
  if (!libraryId) {
    return Response.json({ 
      error: 'libraryId required for multi-branch support' 
    }, { status: 400 })
  }
  
  // Verify ownership
  const library = await prisma.library.findFirst({
    where: { 
      id: libraryId,
      owner: { userId: session.userId }
    }
  })
  
  if (!library) {
    return Response.json({ 
      error: 'Library not found or access denied' 
    }, { status: 404 })
  }
  
  // Continue with libraryId
}
```

### 3. Routes That Need Updating

All owner API routes (18 files):
- `/api/owner/analytics` ⚠️
- `/api/owner/attendance` ⚠️
- `/api/owner/bookings` ⚠️
- `/api/owner/layout` ⚠️
- `/api/owner/library` ⚠️
- `/api/owner/memberships` ⚠️
- `/api/owner/memberships/[id]` ⚠️
- `/api/owner/revenue` ⚠️
- `/api/owner/seats` ⚠️
- `/api/owner/seats/[id]` ⚠️
- `/api/owner/stats` ⚠️
- `/api/owner/students` ⚠️
- Plus settlement, subscription, razorpay routes

---

## Migration Strategy

### Phase 1: Add Optional libraryId Parameter (Backward Compatible)

```typescript
// Accept libraryId but fall back to findFirst if not provided
const libraryId = searchParams.get('libraryId')
const library = libraryId
  ? await prisma.library.findFirst({ 
      where: { id: libraryId, owner: { userId } } 
    })
  : await prisma.library.findFirst({ 
      where: { owner: { userId } } 
    })
```

**Benefits**:
- Backward compatible
- Existing single-branch owners unaffected
- Multi-branch owners can start using libraryId

### Phase 2: Make libraryId Required (Breaking Change)

After UI is updated, make libraryId required:
```typescript
if (!libraryId) {
  return Response.json({ 
    error: 'libraryId is required' 
  }, { status: 400 })
}
```

### Phase 3: Remove findFirst Fallback

```typescript
// ✅ Final: Explicit library only
const library = await prisma.library.findUnique({
  where: { id: libraryId }
})

// Verify ownership
if (!library || library.ownerId !== ownerId) {
  return Response.json({ error: 'Access denied' }, { status: 403 })
}
```

---

## Frontend Changes Required

### 1. Library Selector Component

```tsx
// components/owner/LibrarySelector.tsx
'use client'

export function LibrarySelector() {
  const [libraries, setLibraries] = useState([])
  const [selected, setSelected] = useState(null)
  
  useEffect(() => {
    fetch('/api/owner/libraries') // New endpoint
      .then(r => r.json())
      .then(data => {
        setLibraries(data.libraries)
        setSelected(data.libraries[0]?.id)
      })
  }, [])
  
  return (
    <select value={selected} onChange={e => {
      setSelected(e.target.value)
      localStorage.setItem('selectedLibraryId', e.target.value)
      window.location.reload() // Refresh to load new library data
    }}>
      {libraries.map(lib => (
        <option key={lib.id} value={lib.id}>{lib.name}</option>
      ))}
    </select>
  )
}
```

### 2. Add to All API Calls

```typescript
// Before
const res = await fetch('/api/owner/stats')

// After
const libraryId = localStorage.getItem('selectedLibraryId')
const res = await fetch(`/api/owner/stats?libraryId=${libraryId}`)
```

### 3. Context Provider (Better Approach)

```tsx
// contexts/LibraryContext.tsx
export const LibraryContext = createContext()

export function LibraryProvider({ children }) {
  const [selectedLibraryId, setSelectedLibraryId] = useState(null)
  
  return (
    <LibraryContext.Provider value={{ selectedLibraryId, setSelectedLibraryId }}>
      {children}
    </LibraryContext.Provider>
  )
}

// Use in components
const { selectedLibraryId } = useContext(LibraryContext)
```

---

## Database Considerations

### Check for Multi-Branch Owners

```sql
-- Find owners with multiple libraries
SELECT "userId", COUNT(*) as library_count
FROM libraries
INNER JOIN library_owners ON libraries."ownerId" = library_owners.id
GROUP BY library_owners."userId"
HAVING COUNT(*) > 1;
```

### Current State

If query returns 0 rows → **No multi-branch owners yet**  
If query returns rows → **Multi-branch support needed now**

---

## Temporary Workaround (Current)

For owners with multiple branches:
1. APIs will use whichever library `findFirst()` returns (undefined order)
2. Owner sees data from arbitrary library
3. No way to switch between branches

**Not production-ready for multi-branch scenarios.**

---

## Recommended Implementation Order

1. **Check database** for multi-branch owners
2. **If none exist** → Defer multi-branch support (low priority)
3. **If exist** → Implement urgently:
   - Add `/api/owner/libraries` endpoint (list owner's libraries)
   - Add library selector to owner dashboard
   - Update all routes to accept optional `libraryId`
   - Update frontend to pass `libraryId` on all API calls

---

## Alternative: Single-Branch Enforcement

If multi-branch support is not needed:

### Schema Constraint
```prisma
model LibraryOwner {
  id String @id @default(cuid())
  userId String @unique // ✅ One owner = one library max
  library Library? // Singular relation
}
```

### Validation on Registration
```typescript
const existingLibrary = await prisma.library.findFirst({
  where: { owner: { userId } }
})

if (existingLibrary) {
  throw new Error('You already own a library. Multiple branches not supported.')
}
```

---

**Status**: ⚠️ **Partially Implemented**  
**Current**: Single-branch assumed via `findFirst()`  
**Required**: Explicit `libraryId` parameter + frontend selector  
**Affected Routes**: 18+ owner API endpoints

**Created**: 2026-08-26  
**Priority**: Low (if no multi-branch owners), High (if multi-branch owners exist)
