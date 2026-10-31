/** The password rule, as App\Support\PasswordPolicy checks it on the server. */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 64;

/** The hint under every new-password box. */
export const PASSWORD_HINT = `At least ${PASSWORD_MIN} characters. A short phrase is easy to remember.`;
