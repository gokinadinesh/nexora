import { request } from './api';

export const billingService = {
  async createCheckoutSession(): Promise<string> {
    const response = await request<{ url: string }>('/billing/checkout', {
      method: 'POST',
    });
    return response.url;
  },
};
