import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { spawn } from 'child_process'
import path from 'path'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.role !== 'admin') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const scriptId = searchParams.get('script')

  if (!scriptId || !scriptId.endsWith('.py') || scriptId.includes('/') || scriptId.includes('\\')) {
    return new NextResponse('Invalid script name', { status: 400 })
  }

  const scriptPath = path.join(process.cwd(), 'data-collector', scriptId)

  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: Starting script ${scriptId}...\n\n`))

      // Execute Python
      // We use 'python3' since we install that in the Dockerfile
      const pythonProcess = spawn('python3', [scriptPath], {
        cwd: path.join(process.cwd(), 'data-collector'),
        env: process.env // Pass environment variables down to the script
      })

      pythonProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n')
        for (const line of lines) {
          if (line) {
            controller.enqueue(encoder.encode(`data: ${line}\n\n`))
          }
        }
      })

      pythonProcess.stderr.on('data', (data) => {
        const lines = data.toString().split('\n')
        for (const line of lines) {
          if (line) {
            controller.enqueue(encoder.encode(`data: [ERROR] ${line}\n\n`))
          }
        }
      })

      pythonProcess.on('close', (code) => {
        controller.enqueue(encoder.encode(`data: \n\n`))
        controller.enqueue(encoder.encode(`data: --- Script exited with code ${code} ---\n\n`))
        controller.close()
      })

      pythonProcess.on('error', (err) => {
        controller.enqueue(encoder.encode(`data: [SYSTEM ERROR] ${err.message}\n\n`))
        controller.close()
      })
      
      // Cleanup on disconnect
      req.signal.addEventListener('abort', () => {
        pythonProcess.kill()
      })
    }
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}
