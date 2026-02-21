import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("inhabitants")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(req) {
  const body = await req.json();
  const { name, count, date_added, notes } = body;

  const { data, error } = await supabase
    .from("inhabitants")
    .insert({ name, count, date_added, notes })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
