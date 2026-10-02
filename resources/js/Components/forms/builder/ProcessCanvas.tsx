import {
    forwardRef,
    useCallback,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
    useState,
    type PointerEvent,
    type ReactNode,
} from 'react';

export interface ProcessCanvasHandle {
    /** Back to 100%, centred horizontally. */
    reset: () => void;
    /** Pan so an element inside the canvas sits in the middle of the view. */
    bringIntoView: (element: Element) => void;
}

/** Things that keep their own clicks; dragging from them does not pan. */
const INTERACTIVE =
    '.flow-step, .flow-path__card, .flow-branch__head, .flow-add__menu, .process-zoom, button, input, a';

const clampZoom = (z: number) => Math.min(1.5, Math.max(0.4, Math.round(z * 10) / 10));

/** A pannable, zoomable view of the process flow (drag empty space to pan). */
const ProcessCanvas = forwardRef<ProcessCanvasHandle, { children: ReactNode }>(function ProcessCanvas(
    { children },
    ref,
) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const chainRef = useRef<HTMLDivElement>(null);
    const pan = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
    const [view, setView] = useState({ x: 0, y: 0, z: 1 });
    const [panning, setPanning] = useState(false);

    const reset = useCallback(() => {
        const viewport = viewportRef.current;
        const chain = chainRef.current;
        const x =
            viewport && chain && viewport.clientWidth > 0
                ? Math.max(0, (viewport.clientWidth - chain.scrollWidth) / 2)
                : 0;
        setView({ x, y: 0, z: 1 });
    }, []);

    // Centre the flow once it is on screen.
    useLayoutEffect(reset, [reset]);

    useImperativeHandle(
        ref,
        () => ({
            reset,
            bringIntoView: (element: Element) => {
                const viewport = viewportRef.current;
                if (!viewport) return;
                const port = viewport.getBoundingClientRect();
                const box = element.getBoundingClientRect();
                setView((current) => ({
                    ...current,
                    x: current.x + (port.left + port.width / 2) - (box.left + box.width / 2),
                    y: current.y + (port.top + port.height / 2) - (box.top + box.height / 2),
                }));
            },
        }),
        [reset],
    );

    const zoom = (delta: number) => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        setView((current) => {
            const z = clampZoom(current.z + delta);
            if (z === current.z) return current;
            // Zoom about the middle of the view so the flow does not drift away.
            const cx = viewport.clientWidth / 2;
            const cy = viewport.clientHeight / 2;
            return { z, x: cx - (cx - current.x) * (z / current.z), y: cy - (cy - current.y) * (z / current.z) };
        });
    };

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
        pan.current = { startX: event.clientX, startY: event.clientY, originX: view.x, originY: view.y };
        event.currentTarget.setPointerCapture(event.pointerId);
        setPanning(true);
    };

    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const start = pan.current;
        if (!start) return;
        setView((current) => ({
            ...current,
            x: start.originX + (event.clientX - start.startX),
            y: start.originY + (event.clientY - start.startY),
        }));
    };

    const endPan = () => {
        pan.current = null;
        setPanning(false);
    };

    return (
        <div
            ref={viewportRef}
            className={`process-viewport${panning ? ' is-panning' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
        >
            <div
                ref={chainRef}
                className="process-chain"
                style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}
            >
                {children}
            </div>
            <div className="process-zoom">
                <button type="button" className="rd-btn rd-btn--icon" aria-label="Zoom out" onClick={() => zoom(-0.1)}>
                    <i className="mdi mdi-minus" aria-hidden="true" />
                </button>
                <span className="process-zoom__value">{Math.round(view.z * 100)}%</span>
                <button type="button" className="rd-btn rd-btn--icon" aria-label="Zoom in" onClick={() => zoom(0.1)}>
                    <i className="mdi mdi-plus" aria-hidden="true" />
                </button>
                <button type="button" className="rd-btn rd-btn--icon" aria-label="Fit to view" onClick={reset}>
                    <i className="mdi mdi-fit-to-page-outline" aria-hidden="true" />
                </button>
            </div>
            <span className="process-hint">Drag an empty space to move around</span>
        </div>
    );
});

export default ProcessCanvas;
