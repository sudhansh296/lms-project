export async function GET() {
  return Response.json({
    message: 'Hello World!',
    success: true,
    time: new Date().toLocaleTimeString()
  })
}
