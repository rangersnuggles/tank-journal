import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(req) {
  const body = await req.json();
  const { type, date, time, data, note } = body;

  const { data: row, error } = await supabase
    .from("entries")
    .insert({ type, date, time, data, note })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(row, { status: 201 });
}
