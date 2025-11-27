// Deno global types for Supabase Edge Functions
declare namespace Deno {
  export const env: {
    get(key: string): string | undefined;
  };
}

// Web standard APIs available in Deno
declare const Response: typeof globalThis.Response;
declare const console: typeof globalThis.console;

// Module declarations for Deno HTTP imports
declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(handler: (req: Request) => Promise<Response> | Response): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export function createClient(url: string, key: string): any;
}

declare module 'https://esm.sh/@pinecone-database/pinecone@1.1.2' {
  export class Pinecone {
    constructor(options: { apiKey: string });
    index(name: string): any;
  }
}

declare module 'https://esm.sh/@google/generative-ai@0.24.1' {
  export class GoogleGenerativeAI {
    constructor(apiKey: string);
    getGenerativeModel(options: { model: string }): any;
  }
}
