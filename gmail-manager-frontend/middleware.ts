import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const apiUrl = process.env.API_URL || 'http://localhost:8123'
    // Strip /api prefix
    const newPath = request.nextUrl.pathname.replace(/^\/api/, '')
    // Construct the new URL
    // Ensure apiUrl doesn't have a trailing slash if newPath starts with one, or handle it gracefully
    // URL constructor handles this well usually
    const targetUrl = new URL(newPath + request.nextUrl.search, apiUrl)
    
    return NextResponse.rewrite(targetUrl)
  }
}

export const config = {
  matcher: '/api/:path*',
}
