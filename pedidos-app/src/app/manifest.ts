import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pedidos — Bodega Principal',
    short_name: 'Pedidos',
    description: 'Toma de pedidos con soporte offline',
    start_url: '/',
    display: 'standalone',
    background_color: '#efeae2',
    theme_color: '#00a884',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
