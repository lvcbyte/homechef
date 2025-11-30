// Try to load .env.local if it exists (for local development)
// On Vercel, environment variables are available via process.env
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // .env.local doesn't exist, that's fine - use process.env (Vercel)
}

module.exports = {
  expo: {
    name: 'STOCKPIT',
    slug: 'stockpit',
    scheme: 'stockpit',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#050915',
    },
    assetBundlePatterns: ['assets/**/*'],
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
      favicon: './assets/icon.png',
      name: 'STOCKPIT',
      shortName: 'STOCKPIT',
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
          src: './assets/icon.png',
          sizes: '180x180',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: './assets/icon.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: './assets/icon.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
      apple: {
        appleMobileWebAppCapable: 'yes',
        appleMobileWebAppStatusBarStyle: 'black-translucent',
        appleTouchIcon: './assets/apple-touch-icon.png',
      },
      meta: {
        viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover',
        'mobile-web-app-capable': 'yes',
        'apple-mobile-web-app-capable': 'yes',
        'apple-mobile-web-app-status-bar-style': 'black-translucent',
        'apple-mobile-web-app-title': 'STOCKPIT',
        'application-name': 'STOCKPIT',
        'theme-color': '#047857',
        'format-detection': 'telephone=no',
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

