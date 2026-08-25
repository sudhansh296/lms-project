// GET /api/greet - Simple greeting
export async function GET() {
  return Response.json({
    message: 'Send me your name via POST!',
    example: 'POST { "name": "John" }'
  })
}

// POST /api/greet - Personalized greeting
export async function POST(request: Request) {
  try {
    // Get data from request body
    const body = await request.json()
    const { name } = body

    // Validate
    if (!name) {
      return Response.json(
        { error: 'Name is required!' },
        { status: 400 }
      )
    }

    // Return personalized response
    return Response.json({
      message: `Hello ${name}! Welcome to the API world!`,
      timestamp: new Date().toLocaleTimeString(),
      success: true
    })
  } catch (error) {
    return Response.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}
