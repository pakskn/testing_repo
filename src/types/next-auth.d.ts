import NextAuth, { type DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      status: string
      plan: string
      subscriptionStatus: string
      planExpiresAt?: string | Date | null
    } & DefaultSession["user"]
  }

  interface User {
    role?: string
    status?: string
    plan?: string
    subscriptionStatus?: string
    planExpiresAt?: string | Date | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: string
    status?: string
    plan?: string
    subscriptionStatus?: string
    planExpiresAt?: string | Date | null
  }
}
