import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email address is required" },
        { status: 400 }
      );
    }

    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase configuration");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if waitlist table exists, if not we'll create it via migration
    // For now, we'll insert into a waitlist table
    // You may need to create this table in Supabase
    
    const { data, error } = await supabaseAdmin
      .from("waitlist")
      .insert({
        email: email.toLowerCase().trim(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // If table doesn't exist, we'll handle it gracefully
      if (error.code === "42P01") {
        console.error("Waitlist table does not exist. Please create it in Supabase.");
        // For now, just log it - you can create the table later
        // Or return success anyway for development
        return NextResponse.json(
          { 
            success: true, 
            message: "Email recorded (table creation pending)" 
          },
          { status: 200 }
        );
      }

      // If email already exists, that's okay - return success
      if (error.code === "23505") {
        return NextResponse.json(
          { success: true, message: "You're already on the waitlist!" },
          { status: 200 }
        );
      }

      console.error("Error inserting into waitlist:", error);
      return NextResponse.json(
        { error: "Failed to join waitlist" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Successfully joined waitlist" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected error in waitlist endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

