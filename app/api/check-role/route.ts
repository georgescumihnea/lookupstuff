import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user from database
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", session.user.username)
      .single();

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({
      database_role: user.role,
      session_role: session.user.role,
      user_id: user.id,
      username: user.username,
    });
  } catch (error) {
    console.error("Check role error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
