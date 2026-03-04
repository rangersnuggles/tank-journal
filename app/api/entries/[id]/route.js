import { supabase } from "@/lib/supabase";

export async function PATCH(req, { params }) {
  const body = await req.json();
  const { error, data } = await supabase
    .from("entries")
    .update(body)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function DELETE(req, { params }) {
  const { error } = await supabase
    .from("entries")
    .delete()
    .eq("id", params.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
