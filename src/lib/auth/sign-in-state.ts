// Sign-in form state, shared by the action and the login form. Kept free of
// zod and supabase-js so the login page does not ship them (./sign-in).

export type SignInFieldErrors = Partial<Record<"email" | "password", string[]>>;

export type SignInState = {
  message?: string;
  fieldErrors?: SignInFieldErrors;
  /** Echoed back so the form keeps the email; the password never is. */
  email?: string;
};

export const initialSignInState: SignInState = {};
