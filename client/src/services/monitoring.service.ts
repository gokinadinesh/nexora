import {
  MonitoringMetricsResponse,
  MonitoringEventsResponse,
  MonitoringSecurityResponse,
} from '@nexora/shared';
import { request } from './api';

export const monitoringService = {
  async getMetrics(): Promise<MonitoringMetricsResponse> {
    return request<MonitoringMetricsResponse>('/api/monitoring/metrics');
  },

  async getEvents(limit: number = 100): Promise<MonitoringEventsResponse> {
    return request<MonitoringEventsResponse>(`/api/monitoring/events?limit=${limit}`);
  },

  async getSecurityEvents(limit: number = 100): Promise<MonitoringSecurityResponse> {
    return request<MonitoringSecurityResponse>(`/api/monitoring/security?limit=${limit}`);
  },
};
