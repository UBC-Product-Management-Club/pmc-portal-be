export const supabase = {
    from: () => ({
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    }),
    // supabaseJwtCheck verifies bearer tokens through this, so the middleware
    // tests drive it directly.
    auth: {
      getUser: jest.fn(),
    },
  };
