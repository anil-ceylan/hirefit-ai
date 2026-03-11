// Lightweight placeholder Supabase client for MVP / build stability.
// Replace with a real Supabase client when you configure environment variables.

export const supabase = {
  auth: {
    async signInWithPassword({ email }) {
      // Always return an auth error until Supabase is properly wired.
      return {
        data: null,
        error: {
          message:
            `Supabase auth is not configured yet. Tried to login with: ${email}. ` +
            "Please set up a real Supabase client in supabaseClient.js.",
        },
      };
    },
  },
};
