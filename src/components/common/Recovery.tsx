import { useState } from 'react';
import { Fuel } from 'lucide-react';
import { Button, Modal } from '../ui';
import { useAction } from '../../hooks/usePortal';
import { useAppStore } from '../../store';
import { portalRepository } from '../../services/repositories/portal';
export function Recovery({ message, retry }: {
    message: string;
    retry: () => void;
}) {
    const [confirm, setConfirm] = useState(false);
    const owner = useAppStore(s => s.session?.role === 'FUEL_STATION_OWNER');
    const action = useAction();
    return <div className="error-view"><Fuel size={40}/><h1>We couldn’t load your station.</h1><p>{message}</p><Button onClick={retry}>Try again</Button>{owner && <Button variant="secondary" onClick={() => setConfirm(true)}>Reset local demo data</Button>}{confirm && <Modal title="Restore demo records?" onClose={() => setConfirm(false)}><p>This replaces all local business records with a fresh demo dataset. Your account and preferences are retained.</p><div className="form-footer"><Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="danger" onClick={() => { void action(() => portalRepository.reset(), 'Demo restored').then(() => { setConfirm(false); retry(); }).catch(() => { }); }}>Restore demo</Button></div></Modal>}</div>;
}
