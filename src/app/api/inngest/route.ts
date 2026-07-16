import { serve } from "inngest/next";
import { functions, inngest } from "@/server/jobs";

export const { GET, POST } = serve({
  client: inngest,
  functions,
});