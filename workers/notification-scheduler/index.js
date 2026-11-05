const SYNC_URL="https://phoneya2.pages.dev/api/store-notifications?limit=1";
async function runSync(){
 const response=await fetch(SYNC_URL,{headers:{"cache-control":"no-store","user-agent":"PhoneYa2-Notification-Scheduler/1.0"}});
 if(!response.ok)throw new Error("Store notification sync returned HTTP "+response.status);
 const result=await response.json();
 if(!result||result.ok!==true)throw new Error("Store notification sync did not confirm success");
 return {ok:true,generated_at:result.generated_at,notifications:result.notifications?.length||0};
}
export default {
 async scheduled(controller,env,ctx){ctx.waitUntil(runSync().catch(error=>console.error("PhoneYa2 scheduled notification sync failed:",String(error).slice(0,300))));},
 async fetch(){return new Response("PhoneYa2 notification scheduler is active. Scheduled sync runs every 15 minutes.",{headers:{"content-type":"text/plain; charset=utf-8","cache-control":"no-store"}});}
};
