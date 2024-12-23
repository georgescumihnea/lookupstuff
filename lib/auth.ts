import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { supabase } from "./supabase";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Missing credentials");
        }

        // Get user from database
        const { data: user, error } = await supabase
          .from("users")
          .select("*")
          .eq("username", credentials.username)
          .single();

        if (error || !user) {
          console.error("User not found or error:", error);
          throw new Error("Invalid credentials");
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isValidPassword) {
          throw new Error("Invalid credentials");
        }

        console.log("Authorized user from database:", {
          id: user.id,
          username: user.username,
          role: user.role,
        });

        // Return user object with explicit role
        return {
          id: user.id,
          username: user.username,
          role: user.role || "user", // Ensure role is never undefined
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      console.log("JWT Callback - Trigger:", trigger);
      console.log("JWT Callback - Input:", {
        token: JSON.stringify(token, null, 2),
        user: JSON.stringify(user, null, 2),
      });

      if (user) {
        // When signing in, set all user properties on token
        token.id = user.id;
        token.username = user.username;
        token.role = user.role || "user";
      }

      console.log(
        "JWT Callback - Final token:",
        JSON.stringify(token, null, 2)
      );
      return token;
    },
    async session({ session, token }) {
      console.log("Session Callback - Input:", {
        session: JSON.stringify(session, null, 2),
        token: JSON.stringify(token, null, 2),
      });

      if (token) {
        session.user = {
          ...session.user,
          id: token.id,
          username: token.username,
          role: token.role || "user",
        };
      }

      console.log(
        "Session Callback - Final session:",
        JSON.stringify(session, null, 2)
      );
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  debug: true, // Enable debug mode always for now
  secret: process.env.NEXTAUTH_SECRET,
};
