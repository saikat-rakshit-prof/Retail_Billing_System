import NextAuth, { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials) return null;
        
        const validUser = credentials.username === process.env.ADMIN_USERNAME
          && credentials.password === process.env.ADMIN_PASSWORD;
          
        if (validUser) {
          return { id: '1', name: 'Owner', role: 'admin' }
        }
        return null;
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 365 * 24 * 60 * 60, // 1 YEAR — stays logged in
  },
  jwt: {
    maxAge: 365 * 24 * 60 * 60, // 1 YEAR
  },
  pages: {
    signIn: '/login', // custom login page
    error: '/login', // redirect errors to login
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
