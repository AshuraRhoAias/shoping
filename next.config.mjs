import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  turbopack: {
    // Establece la raíz al directorio del proyecto para que Turbopack
    // encuentre next/package.json correctamente (Fix: build error).
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
