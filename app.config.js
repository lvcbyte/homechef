// Try to load .env.local if it exists (for local development)
// On Vercel, environment variables are available via process.env
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // .env.local doesn't exist, that's fine - use process.env (Vercel)
}

module.exports = {
  expo: {
    name: 'Stockpit',
    slug: 'stockpit',
    scheme: 'stockpit',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/logo.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#050915',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#050915',
      },
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/favicon.png',
      name: 'Stockpit',
      shortName: 'Stockpit',
      lang: 'nl',
      scope: '/',
      themeColor: '#047857',
      backgroundColor: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      startUrl: '/',
      description: 'Slimme keukenassistent met AI-powered recepten en voorraadbeheer',
      icons: [
        {
          src: './assets/logo.png',
          sizes: [180, 192, 512],
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
      apple: {
        appleMobileWebAppCapable: 'yes',
        appleMobileWebAppStatusBarStyle: 'black-translucent',
        appleTouchIcon: './assets/logo.png',
      },
      meta: {
        viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover',
        'mobile-web-app-capable': 'yes',
        'apple-mobile-web-app-capable': 'yes',
        'apple-mobile-web-app-status-bar-style': 'default',
        'apple-mobile-web-app-title': 'Stockpit',
        'application-name': 'Stockpit',
        'theme-color': '#047857',
      },
    },
    plugins: ['expo-router', 'expo-barcode-scanner'],
    extra: {
      supabaseUrl:
        process.env.EXPO_PUBLIC_SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.SUPABASE_URL,
      supabaseAnonKey:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY,
      openaiKey: process.env.EXPO_PUBLIC_OPENAI_KEY || process.env.OPENAI_KEY,
      openrouterKey: process.env.EXPO_PUBLIC_OPENROUTER_KEY || process.env.OPENROUTER_KEY,
    },
  },
};

