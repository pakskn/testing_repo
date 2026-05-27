import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_HOSTNAMES = [
  'i.ytimg.com',
  'yt3.ggpht.com',
  'yt3.googleusercontent.com',
  'lh3.googleusercontent.com'
]

// 1x1 transparent pixel fallback PNG buffer
const TRANSPARENT_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const imageUrl = searchParams.get('url')

  if (!imageUrl) {
    return new NextResponse('Missing url parameter', { status: 400 })
  }

  try {
    const parsedUrl = new URL(imageUrl)
    
    // Security: Whitelist hostname to prevent SSRF vulnerabilities
    if (!ALLOWED_HOSTNAMES.includes(parsedUrl.hostname)) {
      return new NextResponse('Forbidden hostname', { status: 403 })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout

    const res = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    })
    
    clearTimeout(timeoutId)

    if (!res.ok) {
      throw new Error(`Fetch failed with status ${res.status}`)
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // Permanent cache
      }
    })
  } catch (error) {
    console.error('Image proxy error:', error)
    // Silently fallback to transparent pixel so layouts never break visually
    return new NextResponse(TRANSPARENT_PIXEL, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400', // Cache fallback for 1 day
      }
    })
  }
}
