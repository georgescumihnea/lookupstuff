import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    PLISIO_SECRET_KEY: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_PLISIO_SECRET_KEY: z.string().min(1),
  },
  runtimeEnv: {
    PLISIO_SECRET_KEY: process.env.PLISIO_SECRET_KEY,
    NEXT_PUBLIC_PLISIO_SECRET_KEY: process.env.NEXT_PUBLIC_PLISIO_SECRET_KEY,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
