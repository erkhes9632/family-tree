import baseConfig from "../../eslint.config.mjs";

export default [
    ...baseConfig,
    {
        ignores: [".wrangler/**", ".seed/**", "worker-configuration.d.ts", "migrations/**"]
    }
];
