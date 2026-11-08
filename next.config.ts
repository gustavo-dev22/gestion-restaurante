import type { NextConfig } from "next";

// Lista de orígenes de imágenes permitidos. Se puede sobrescribir con
// IMAGE_ALLOWED_HOSTS="host1,host2" en el entorno de despliegue.
const DEFAULT_IMAGE_HOSTS = [
  "encrypted-tbn0.gstatic.com",
  "www.gourmet.cl",
  "metroio.vtexassets.com",
  "img-global.cpcdn.com",
  "gourmet.iprospect.cl",
  "i.ytimg.com",
  "polleriaslagranja.com",
  "santossabores.com.pe",
  "express.donangelo.pe",
  "vegaperu.vtexassets.com",
  "oechsle.vteximg.com.br",
  "www.recetasjudias.com",
  "www.recetasnestlecam.com",
];

const allowedImageHosts = Array.from(
  new Set(
    (process.env.IMAGE_ALLOWED_HOSTS ?? DEFAULT_IMAGE_HOSTS.join(","))
      .split(",")
      .map((host) => host.trim())
      .filter(Boolean)
  )
);

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    remotePatterns: allowedImageHosts.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
    formats: ["image/avif", "image/webp"],
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/login',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
