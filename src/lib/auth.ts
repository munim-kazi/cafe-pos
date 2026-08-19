import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      name: string | null;
      email: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  basePath: "/api/auth",
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("[auth] authorize called with keys:", Object.keys(credentials || {}));
        if (!credentials?.email || !credentials?.password) {
          console.log("[auth] missing email or password, credentials:", credentials);
          return null;
        }

        console.log("[auth] looking up user:", credentials.email);
        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) {
          console.log("[auth] user not found:", credentials.email);
          return null;
        }
        if (!user.active) {
          console.log("[auth] user inactive:", credentials.email);
          return null;
        }

        console.log("[auth] comparing password for user:", credentials.email);
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!valid) {
          console.log("[auth] password invalid for user:", credentials.email);
          return null;
        }

        console.log("[auth] success for user:", credentials.email);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as Record<string, unknown>).role as Role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      return session;
    },
  },
});
