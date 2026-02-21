import { supabase } from "@/lib/supabase";

export async function DELETE(req, { params }) {
  const { error } = await supabase
    .from("entries")
    .delete()
    .eq("id", params.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
