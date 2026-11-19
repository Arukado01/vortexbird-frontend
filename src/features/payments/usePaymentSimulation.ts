import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';

export function usePaymentSimulation(enabled = true) {
  return useQuery({
    queryKey: ['payment-simulation'],
    queryFn: async () => (await api.get<{ simulationEnabled: boolean }>('/auth/config')).data.simulationEnabled === true,
    enabled,
    staleTime: 60_000,
  });
}
