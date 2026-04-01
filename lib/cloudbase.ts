import cloudbase from "@cloudbase/node-sdk";



export const app = cloudbase.init({
  env: process.env.NEXT_PUBLIC_TCB_ENV!,
  secretId: process.env.TCB_SECRET_ID,
  secretKey: process.env.TCB_SECRET_KEY,
});
