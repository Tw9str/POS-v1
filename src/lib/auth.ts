import NextAuth from "next-auth";
import Email from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

const baseAdapter = PrismaAdapter(prisma);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: {
    ...baseAdapter,
    deleteSession: async (sessionToken: string) => {
      await prisma.session.deleteMany({ where: { sessionToken } });
    },
  },
  providers: [
    Email({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
    error: "/login",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { systemRole: true, isActive: true },
        });
        if (dbUser) {
          session.user.systemRole = dbUser.systemRole;
          session.user.isActive = dbUser.isActive;
        }
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Promote to SUPER_ADMIN if email matches the env var, or if first user
      const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
      let shouldPromote = false;

      if (adminEmail) {
        shouldPromote = user.email === adminEmail;
      } else {
        // Fallback: first user becomes admin (use transaction to prevent races)
        const userCount = await prisma.user.count();
        shouldPromote = userCount === 1;
      }

      if (shouldPromote) {
        await prisma.user.update({
          where: { id: user.id! },
          data: { systemRole: "SUPER_ADMIN" },
        });
      }
    },
  },
});
