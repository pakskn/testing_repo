import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)

// Only GET and POST are valid Next.js Route exports — authOptions must NOT be exported here
export { handler as GET, handler as POST }
