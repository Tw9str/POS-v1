import { SystemRole } from "@/generated/prisma";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      systemRole: SystemRole;
      isActive: boolean;
    };
  }
}
