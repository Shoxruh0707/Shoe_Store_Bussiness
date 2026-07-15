const dotenv = require("dotenv");

const envAlreadyPrepared = process.env.APP_ENV_PRELOADED === "true";

dotenv.config({ override: !envAlreadyPrepared });
dotenv.config({ path: ".env.local", override: true });
