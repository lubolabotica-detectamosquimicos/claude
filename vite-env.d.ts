/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_ADMIN_EMAILS?: string;
  readonly VITE_ENTITLEMENT_PUBLIC_KEY?: string;
  readonly VITE_SYNC_INTERVAL_MINUTES?: string;
  readonly VITE_DEV_ALLOW_UNVERIFIED_PLANS?: string;
  readonly VITE_PAYMENT_LINK_MONTHLY?: string;
  readonly VITE_PAYMENT_LINK_ANNUAL?: string;
  readonly VITE_PAYMENT_LINK_SUPPORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
