import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, ShieldCheck, BarChart3, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { DataForm, type Field } from '../../components/ui';
import { useAppStore } from '../../store';
import { authenticationService } from '../../services/api/auth';
export function Brand({ withName = false }: { withName?: boolean }) { return <div className="brand"><img className="brand-logo" src={`${import.meta.env.BASE_URL}logo/logo.png`} alt="NeyFuel" width={1254} height={1254} />{withName && <span className="brand-name">Ney<span>Fuel</span></span>}</div>; }
export function Auth() {
    const { mode = 'login' } = useParams();
    const navigate = useNavigate();
    const setSession = useAppStore(s => s.setSession);
    const isLogin = mode === 'login';
    const titles: Record<string, string> = { login: 'Welcome back.', register: 'Start your partnership.', forgot: 'Let’s get you back in.', reset: 'A fresh start.', otp: 'Check your inbox.' };
    const fields: Field[] = mode === 'otp' ? [{ name: 'code', label: 'Demo verification code (123456)' }] : mode === 'forgot' ? [{ name: 'email', label: 'Email address', type: 'email' }] : mode === 'reset' ? [{ name: 'password', label: 'New password', type: 'password' }, { name: 'confirm', label: 'Confirm password', type: 'password' }] : [...(!isLogin ? [{ name: 'name', label: 'Full name' }, { name: 'station', label: 'Station name' }, { name: 'phone', label: 'Phone number' }] : []), { name: 'email', label: 'Email address', type: 'email', defaultValue: isLogin ? 'owner@neyfuel.com' : '' }, { name: 'password', label: 'Password', type: 'password', defaultValue: isLogin ? 'NeyFuel@2026' : '' }];
    return <div className="auth-page"><aside className="auth-art"><Brand withName /><div className="auth-story"><span className="auth-tag">THE PARTNER ADVANTAGE</span><h1>Your station.<br />Connected.<br /><em>In control.</em></h1><p>Less complexity. More possibility.<br />The smarter way to move your fuel business forward.</p><div className="auth-benefits"><span><BarChart3 /> Real-time insights</span><span><Zap /> Seamless operations</span><span><ShieldCheck /> One connected platform</span></div></div><div className="auth-art-footer">Powering the next mile, together. <span>© {new Date().getFullYear()} NeyFuel</span></div></aside><main className="auth-form"><div className="auth-form-inner"><div className="eyebrow">NEYFUEL PARTNER PORTAL</div><h1>{titles[mode] || titles.login}</h1><p>{mode === 'login' ? 'Sign in to keep your station moving.' : mode === 'otp' ? 'Frontend simulation: enter 123456 to verify.' : 'Manage your station with confidence.'}</p><DataForm key={mode} fields={fields} label={isLogin ? 'Sign in to your account' : mode === 'register' ? 'Create partner account' : mode === 'otp' ? 'Verify demo code' : mode === 'forgot' ? 'Continue to demo reset' : 'Update demo password'} onSubmit={async (v) => {
            if (mode === 'forgot') {
                await authenticationService.requestReset(String(v.email));
                toast.info('Demo reset flow. No email has been sent.');
                navigate('/auth/reset');
                return;
            }
            if (mode === 'reset') {
                if (v.password !== v.confirm)
                    throw new Error('Passwords do not match.');
                await authenticationService.resetPassword(String(v.password));
                toast.success('Demo password updated');
                navigate('/auth/login');
                return;
            }
            if (mode === 'register') {
                await authenticationService.register({ email: String(v.email), name: String(v.name), password: String(v.password), station: String(v.station), phone: String(v.phone) });
                navigate('/auth/otp');
                return;
            }
            if (mode === 'otp') {
                await authenticationService.verify(String(v.code));
                toast.success('Demo account created');
                navigate('/auth/login');
                return;
            }
            setSession(await authenticationService.login(String(v.email), String(v.password)));
            navigate('/dashboard');
        }}/>{isLogin ? <><Link className="forgot-link" to="/auth/forgot">Forgot password? <ArrowRight size={14}/></Link><div className="auth-separator"/><p className="auth-register">New to NeyFuel? <Link to="/auth/register">Become a partner</Link></p><div className="demo-credentials"><ShieldCheck size={18}/><div><strong>Explore the demo</strong><p>Owner: owner@neyfuel.com<br />Operator: operator@neyfuel.com<br />Password: NeyFuel@2026</p></div></div></> : <Link className="forgot-link" to="/auth/login">Back to sign in <ArrowRight size={14}/></Link>}<small className="auth-disclaimer">Demo environment · Data is stored in this browser.<br />Use fictional details only. No emails or payments are sent.</small></div></main></div>;
}
