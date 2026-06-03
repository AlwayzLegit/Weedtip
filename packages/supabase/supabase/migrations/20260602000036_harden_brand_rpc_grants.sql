-- Match the convention used by approve_ownership_request etc.: these RPCs enforce
-- admin/ownership internally, but the anon role has no business calling them.
revoke all on function public.approve_brand_claim(uuid) from public, anon;
revoke all on function public.reject_brand_claim(uuid) from public, anon;
revoke all on function public.update_owned_brand(uuid, text, text, text) from public, anon;
grant execute on function public.approve_brand_claim(uuid) to authenticated;
grant execute on function public.reject_brand_claim(uuid) to authenticated;
grant execute on function public.update_owned_brand(uuid, text, text, text) to authenticated;
