/**
 * Type declarations for react-native-razorpay.
 * The @types/react-native-razorpay package is out of date — it still expects
 * the legacy API (order_id required, amount as number). The v3 SDK is more
 * flexible and matches the web Razorpay Checkout API surface.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare module 'react-native-razorpay' {
  interface CheckoutOptions {
    key: string;
    amount: string | number; // paise as string or number; string preferred
    currency?: string;
    name?: string;
    description?: string;
    image?: string;
    order_id?: string; // optional in v3
    prefill?: {
      name?: string;
      email?: string;
      contact?: string;
      method?: string;
    };
    notes?: Record<string, string>;
    theme?: {
      color?: string;
      backdrop_color?: string;
    };
    /** Forces specific payment methods to appear on the checkout. */
    method?: {
      upi?: boolean;
      card?: boolean;
      netbanking?: boolean;
      wallet?: boolean;
      paylater?: boolean;
      emi?: boolean;
    };
    callback_url?: string;
    redirect?: boolean;
    customer_id?: string;
    timeout?: number;
    subscription_id?: string;
    subscription_card_change?: boolean;
    recurring?: boolean;
    modal?: {
      backdropclose?: boolean;
      escape?: boolean;
      handleback?: boolean;
      confirm_close?: boolean;
      ondismiss?: () => void;
      animation?: boolean;
    };
    readonly?: {
      contact?: boolean;
      email?: boolean;
    };
  }

  interface PaymentSuccessData {
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
    [key: string]: any;
  }

  interface PaymentErrorData {
    error: {
      code?: number | string;
      description?: string;
      reason?: string;
      step?: string;
      source?: string;
      [key: string]: any;
    };
  }

  const RazorpayCheckout: {
    open(options: CheckoutOptions): Promise<PaymentSuccessData>;
    setDisplayLocale(locale: string): void;
    getSupportedNetworks(): Promise<string[]>;
  };

  export default RazorpayCheckout;
}