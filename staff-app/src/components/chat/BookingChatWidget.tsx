import { useCallback, useEffect, useRef, useState } from 'react';
import { getBookingChatToken } from '../../api/bookings';
import type { BookingChatTokenResponse } from '../../api/bookings';

type Props = {
    bookingId: string;
    /** 'vendor' | 'customer' | 'admin' — used for display only */
    userRole?: 'vendor' | 'customer' | 'admin';
    defaultOpen?: boolean;
    className?: string;
};

type Status = 'loading' | 'ready' | 'error';

/**
 * BookingChatWidget
 *
 * Embeds the Rocket.Chat private room for a specific booking via an iframe.
 * The widget obtains a one-time auth token from the backend (/bookings/:id/chat-token)
 * and authenticates the current user in the embedded frame via postMessage.
 *
 * Rocket.Chat requirements (handled via docker-compose env vars):
 *   - Iframe Integration: Send + Receive enabled
 *   - X-Frame-Options: empty (allow framing from any origin)
 *   - Public registration: Disabled
 */
export default function BookingChatWidget({
    bookingId,
    userRole = 'vendor',
    defaultOpen = false,
    className = '',
}: Props) {
    const [chatToken, setChatToken] = useState<BookingChatTokenResponse | null>(null);
    const [status, setStatus] = useState<Status>('loading');
    const [open, setOpen] = useState(defaultOpen);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const loginRetryTimeoutsRef = useRef<number[]>([]);

    const clearLoginRetryTimeouts = useCallback(() => {
        loginRetryTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
        loginRetryTimeoutsRef.current = [];
    }, []);

    useEffect(() => {
        let cancelled = false;
        setStatus('loading');
        setChatToken(null);

        getBookingChatToken(bookingId)
            .then((data) => {
                if (!cancelled) {
                    setChatToken(data);
                    setStatus('ready');
                }
            })
            .catch(() => {
                if (!cancelled) setStatus('error');
            });

        return () => { cancelled = true; };
    }, [bookingId]);

    useEffect(() => clearLoginRetryTimeouts, [clearLoginRetryTimeouts]);

    const postIframeCommand = useCallback((payload: Record<string, unknown>) => {
        if (!chatToken || !iframeRef.current?.contentWindow) return;

        iframeRef.current.contentWindow.postMessage(payload, chatToken.rocketchatUrl);
    }, [chatToken]);

    const postLogoutCommand = useCallback(() => {
        postIframeCommand({ externalCommand: 'logout' });
    }, [postIframeCommand]);

    const postLoginCommand = useCallback(() => {
        if (!chatToken) return;

        postIframeCommand({ externalCommand: 'login-with-token', token: chatToken.authToken });
    }, [chatToken, postIframeCommand]);

    const postGoToRoomCommand = useCallback(() => {
        if (!chatToken) return;

        postIframeCommand({
            externalCommand: 'go',
            path: `/group/${chatToken.roomName}?layout=embedded`,
        });
    }, [chatToken, postIframeCommand]);

    /**
     * Once the iframe has loaded, authenticate the user by sending the
     * Rocket.Chat auth token via the Iframe Integration postMessage API.
     * RC will log the user in and the channel will become visible.
     */
    const handleIframeLoad = useCallback(() => {
        clearLoginRetryTimeouts();
        postLogoutCommand();

        const retryPlan = [
            { delay: 120, action: postLoginCommand },
            { delay: 420, action: postGoToRoomCommand },
            { delay: 1200, action: postLoginCommand },
            { delay: 1500, action: postGoToRoomCommand },
            { delay: 2500, action: postLoginCommand },
            { delay: 2800, action: postGoToRoomCommand },
        ];

        loginRetryTimeoutsRef.current = retryPlan.map(({ delay, action }) =>
            window.setTimeout(action, delay),
        );
    }, [clearLoginRetryTimeouts, postGoToRoomCommand, postLoginCommand, postLogoutCommand]);

    const iframeSrc = chatToken
        ? `${chatToken.rocketchatUrl}/group/${chatToken.roomName}?layout=embedded`
        : undefined;
    const roomLabel = chatToken?.roomName || `booking-${bookingId}`;

    const resolvedLabel =
        userRole === 'vendor' ? 'Chat with Customer' : userRole === 'customer' ? 'Chat with Rental Partner' : 'Chat (Admin View)';

    return (
        <div className={`rounded border border-slate-200 bg-white shadow-sm ${className}`}>
            {/* ── Header / toggle ──────────────────────────────────────────────── */}
            <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
            >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-blue-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                        />
                    </svg>
                    {resolvedLabel}
                    <span
                        className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-500"
                        title={`Booking ID: ${bookingId}`}
                    >
                        {bookingId.slice(0, 8)}
                    </span>
                    {userRole === 'admin' && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                            Admin View
                        </span>
                    )}
                </span>
                <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                    {open ? 'Hide chat' : 'Show chat'}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </span>
            </button>

            {/* ── Chat panel ───────────────────────────────────────────────────── */}
            {open && (
                <div className="border-t border-slate-100">
                    <div className="border-b border-slate-100 bg-slate-50 px-4 py-1.5 font-mono text-[11px] text-slate-500">
                        Room: {roomLabel}
                    </div>
                    {status === 'loading' && (
                        <div className="flex h-20 items-center justify-center text-sm text-slate-400">
                            Connecting to chat…
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="px-4 py-6 text-center text-sm text-slate-500">
                            Chat is currently unavailable. Please try again later.
                        </div>
                    )}

                    {status === 'ready' && iframeSrc && (
                        <iframe
                            ref={iframeRef}
                            src={iframeSrc}
                            onLoad={handleIframeLoad}
                            title="Booking Chat"
                            className="h-[500px] w-full border-0"
                            allow="microphone; camera"
                        />
                    )}
                </div>
            )}
        </div>
    );
}
