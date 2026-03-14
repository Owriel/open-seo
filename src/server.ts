import handler from "@tanstack/react-start/server-entry";
import { handleAuth, getAuthUser } from "./server/auth/simple-auth";

// Export Workflow classes as named exports
export { SiteAuditWorkflow } from "./server/workflows/SiteAuditWorkflow";

export default {
  fetch: async (request: Request, env: never): Promise<Response> => {
    // Simple auth gate — login page / cookie check
    const authResponse = await handleAuth(request);
    if (authResponse) return authResponse;

    // Authenticated — inject X-Auth-User header so middleware can read it
    const username = await getAuthUser(request);
    const augmentedRequest = new Request(request, {
      headers: new Headers(request.headers),
    });
    if (username) {
      augmentedRequest.headers.set("X-Auth-User", username);
    }

    return handler.fetch(augmentedRequest, env);
  },
};
