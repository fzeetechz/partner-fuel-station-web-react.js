import { useQuery, useQueryClient } from '@tanstack/react-query';
import { portalRepository } from '../services/repositories/portal';
import { useAppStore } from '../store';
import { toast } from 'sonner';
export function usePortal() { const session = useAppStore(s => s.session); const query = useQuery({ queryKey: ['portal', session?.email], queryFn: portalRepository.getSnapshot, enabled: !!session, retry: 1 }); return query; }
export function useAction() { const client = useQueryClient(); return async <T,>(action: () => Promise<T>, message = 'Changes saved') => { try {
    const result = await action();
    await client.invalidateQueries({ queryKey: ['portal'] });
    toast.success(message);
    return result;
}
catch (e) {
    toast.error(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    throw e;
} }; }
