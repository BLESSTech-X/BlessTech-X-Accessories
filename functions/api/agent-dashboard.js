// Retired legacy PY2-360 shared-code endpoint.
// Individual agent authentication now lives at /api/agent-network.
// Administrative reporting is available through /api/agent-network-admin.
export async function onRequest({request}) {
 return new Response(JSON.stringify({ok:false,error:"The shared PY2-360 access-code endpoint has been retired. Use the individual PhoneYa2 Agent Network account."}),{
  status:410,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}
 });
}
