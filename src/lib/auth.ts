import NextAuth from "next-auth";
import Email from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase();

const baseAdapter = PrismaAdapter(prisma);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: {
    ...baseAdapter,
    // Only allow creating the single admin user, and only once
    createUser: async (data) => {
      if (!adminEmail || data.email?.toLowerCase() !== adminEmail) {
        throw new Error("User creation is disabled");
      }
      const existing = await prisma.user.findFirst();
      if (existing) {
        throw new Error("User already exists");
      }
      const user = await baseAdapter.createUser!(data);
      await prisma.user.update({
        where: { id: user.id },
        data: { systemRole: "SUPER_ADMIN" },
      });
      return { ...user, systemRole: "SUPER_ADMIN" };
    },
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
    async signIn({ user }) {
      // Only allow the single admin email
      if (!adminEmail) return false;
      return user.email?.toLowerCase() === adminEmail;
    },
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
});
