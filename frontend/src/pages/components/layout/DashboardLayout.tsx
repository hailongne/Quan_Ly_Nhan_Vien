import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import HeaderBar from './HeaderBar';

export default function DashboardLayout({
    children,
    roleLabel,
    userName,
    onSignOut,
    activeMenuKey
}: {
    children?: ReactNode;
    roleLabel?: string;
    userName?: string;
    onSignOut?: () => void;
    activeMenuKey?: string;
}) {
    return (
        <div style={{ display: 'flex', width: '100%', height: '100vh' }}>
            <Sidebar activeKey={activeMenuKey} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <HeaderBar roleLabel={roleLabel} userName={userName} onSignOut={onSignOut} />
                <main>
                    <div
                        style={{
                            maxWidth: 1555,
                            margin: '0 auto',
                            height: 'calc(100vh - 80px)',
                            overflowY: 'auto',
                            overflowX: 'hidden'
                        }}
                    >
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
