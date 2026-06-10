/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Dev uniquement : autorise l'acces aux ressources Next quand le navigateur
  // utilise 127.0.0.1 au lieu de localhost.
  allowedDevOrigins: ["127.0.0.1"]
};

export default nextConfig;
