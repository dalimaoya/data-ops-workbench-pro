import request from './request';

export interface NetworkStatus {
  online: boolean;
  checked_at: string;
}

export function getNetworkStatus() {
  return request.get<NetworkStatus>('/api/system/network-status');
}
