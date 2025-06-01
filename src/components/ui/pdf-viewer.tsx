"use client"

import { cn } from "@/lib/utils";
import React from "react";
import { pdfjs, Document, DocumentProps, Page, PageProps, Thumbnail } from "react-pdf"

import { Slot } from "@radix-ui/react-slot"

import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface CoordProps {
    x: number,
    y: number,
    width: number,
    height: number
}

export interface SelectionProps {
    content: string;
    coords: CoordProps[];
    page: number;
}

interface PdfViewerProps extends DocumentProps {
    mode?: "single" | "multiple"
    scrollOffset?: number
}

interface PdfObjectReference {
    num: number;
    gen: number;
}

interface PdfZoomType {
    name: string;
}

type PdfArrayDestination = [PdfObjectReference, PdfZoomType | { name: 'XYZ' } | number, ...(number | null)[]];

type PdfNamedDestination = string;

export type PdfDestination = PdfArrayDestination | PdfNamedDestination | undefined;

export interface PdfBookmark {
    title: string;
    dest?: PdfDestination;
    items?: PdfBookmark[];
    color?: [number, number, number];
    bold?: boolean;
    italic?: boolean;
    url?: string;
}

interface PdfViewerContextType {
    numPages: number | null;
    selection: SelectionProps | undefined
    setSelection: (value: SelectionProps | undefined) => void
    scale: number;
    setScale: (scale: number) => void;
    page: number;
    setPage: (page: number) => void;
    pageContainerRef: React.RefObject<HTMLDivElement | null>
    mode: "single" | "multiple"
    scrollOffset: number;
    scrollToPage: (pageNumber: number) => void;
    scrollToPosition: (positionTop: number, pageNumber: number) => void
    pdf: pdfjs.PDFDocumentProxy | null;
    bookmarks: PdfBookmark[] | null;
    navigateToDest: (dest?: PdfDestination) => void;
}

const PdfViewerContext = React.createContext<PdfViewerContextType | undefined>(
    undefined
);

const usePdfViewer = () => {
    const context = React.useContext(PdfViewerContext);

    if (context === undefined) {
        throw new Error("usePagesList must be used within a PagesListProvider");
    }

    return context;
};

const PdfViewer: React.FC<PdfViewerProps> = ({ children, mode = "single", scrollOffset = 0, ...props }) => {
    const pageContainerRef = React.useRef<HTMLDivElement>(null);

    const [numPages, setNumPages] = React.useState(1);
    const [page, setPage] = React.useState(1);
    const [scale, setScale] = React.useState(1);
    const [selection, setSelection] = React.useState<SelectionProps | undefined>(undefined);
    const [pdf, setPdf] = React.useState<pdfjs.PDFDocumentProxy | null>(null);
    const [bookmarks, setBookmarks] = React.useState<PdfBookmark[] | null>(null);

    const pageInfo = usePageInfo(pageContainerRef as React.RefObject<HTMLDivElement>, numPages, scale);

    function scrollToPage(pageNumber: number) {
        const container = pageContainerRef.current;

        if (!container || !numPages || pageNumber < 1 || pageNumber > numPages || !pageInfo[pageNumber - 1]) {
            return;
        }

        const scrollTo = calculateTargetScrollOffset({
            targetPageNumber: pageNumber,
            pageInfo: pageInfo,
            numPages: numPages,
            scale: scale,
            scrollOffset: scrollOffset,
        });

        if (scrollTo !== null) {
            setPage(pageNumber);

            container.scrollTo({
                top: scrollTo,
                behavior: 'smooth'
            });
        }
    }

    function scrollToPosition(positionTop: number, pageNumber: number) {
        const container = pageContainerRef.current;

        if (!container || !numPages || pageNumber < 1 || pageNumber > numPages || !pageInfo[pageNumber - 1]) {
            return;
        }

        const scrollTo = calculateTargetScrollOffset({
            targetPageNumber: pageNumber,
            positionTopInPage: positionTop,
            pageInfo: pageInfo,
            numPages: numPages,
            scale: scale,
            scrollOffset: scrollOffset,
        });

        if (scrollTo !== null) {
            setPage(pageNumber);

            container.scrollTo({
                top: scrollTo,
                behavior: 'smooth'
            });
        }
    }

    const navigateToDest = React.useCallback(
        async (dest?: PdfDestination) => {
            const container = pageContainerRef.current;

            if (
                !pdf ||
                !container ||
                !numPages ||
                !pageInfo ||
                pageInfo.length !== numPages
            ) {
                return;
            }

            const resolvePageNumber = async (pageRef: PdfObjectReference) => {
                if (typeof pageRef === "object" && pageRef !== null && "num" in pageRef && "gen" in pageRef) {
                    return (await pdf.getPageIndex(pageRef)) + 1;
                }
                return -1;
            };

            const resolvePositionY = (zoomType: PdfArrayDestination[1], args: (number | null)[]) => {
                if (typeof zoomType === "object" && zoomType !== null && "name" in zoomType) {
                    switch (zoomType.name) {
                        case "XYZ":
                            return args[1] ?? 0;
                        case "Fit":
                        case "FitH":
                        case "FitV":
                        case "FitR":
                            return 0;
                        default:
                            return 0;
                    }
                }
                if (typeof zoomType === "number") {
                    return 0;
                }
                return 0;
            };

            let pageNumber = -1;
            let positionYInPage = 0;

            if (typeof dest === "string") {
                const namedDest = await pdf.getDestination(dest);

                if (namedDest) {
                    await navigateToDest(namedDest as PdfDestination);
                }

                return;
            }

            if (Array.isArray(dest)) {
                const [pageRef, zoomType, ...args] = dest;
                pageNumber = await resolvePageNumber(pageRef);
                positionYInPage = resolvePositionY(zoomType, args);
            } else {
                return;
            }

            if (
                pageNumber < 1 ||
                pageNumber > numPages ||
                !pageInfo[pageNumber - 1]
            ) {
                return;
            }

            const scrollTo = calculateTargetScrollOffset({
                targetPageNumber: pageNumber,
                positionTopInPage: positionYInPage,
                pageInfo,
                numPages,
                scale,
                scrollOffset,
            });

            if (scrollTo !== null) {
                container.scrollTo({
                    top: scrollTo,
                    behavior: "smooth",
                });

                setPage(pageNumber);
            }
        },
        [
            pdf,
            pageContainerRef,
            pageInfo,
            scrollOffset,
            scale,
            setPage,
            numPages,
        ]
    );


    async function onLoadSuccess(event: pdfjs.PDFDocumentProxy) {
        setNumPages(event.numPages);
        setPdf(event);

        event.getOutline().then(response => setBookmarks(response as unknown as PdfBookmark[] | null));

        props.onLoadSuccess?.(event)
    }

    React.useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;

            const clickedInsideIgnoredArea = target.closest('.pdf-interactive-element');

            if (selection && !clickedInsideIgnoredArea) {
                setSelection(undefined);
            }
        };

        document.addEventListener('mousedown', handleClick);

        return () => {
            document.removeEventListener('mousedown', handleClick);
        };
    }, [selection, setSelection]);

    let headerChild: React.ReactNode | null = null;
    let footerChild: React.ReactNode | null = null;
    const otherChildren: React.ReactNode[] = [];

    React.Children.forEach(children, (child) => {
        if (React.isValidElement(child)) {
            if (child.type === PdfViewerHeader && headerChild === null) {
                headerChild = child;
            } else if (child.type === PdfViewerFooter && footerChild === null) {
                footerChild = child;
            } else {
                otherChildren.push(child);
            }
        } else {
            otherChildren.push(child);
        }
    });

    return (
        <PdfViewerContext.Provider value={{
            numPages,
            selection,
            setSelection,
            setScale,
            scale,
            page, setPage,
            pageContainerRef,
            mode,
            scrollOffset,
            scrollToPage,
            scrollToPosition,
            pdf,
            bookmarks,
            navigateToDest
        }}>
            <div className="h-svh flex flex-col overflow-y-hidden">
                {headerChild}
                <Document {...props} className={cn("py-4 grow flex flex-col items-center h-full", props.className)} onLoadSuccess={onLoadSuccess}>
                    <div ref={pageContainerRef} className="space-y-4 overflow-y-auto px-4">
                        {otherChildren}
                    </div>
                </Document>
                {footerChild}
            </div>
        </PdfViewerContext.Provider>
    )
}

const PageNumberContext = React.createContext<number | undefined>(undefined);

const usePageNumber = () => {
    const context = React.useContext(PageNumberContext);

    if (context === undefined) {
        throw new Error("usePageNumber must be used within a PageNumberProvider");
    }
    return context;
};

interface CalculateScrollPositionParams {
    targetPageNumber: number;
    positionTopInPage?: number;
    pageInfo: PageInfo[];
    numPages: number;
    scale: number;
    scrollOffset: number;
}

function calculateTargetScrollOffset({
    targetPageNumber,
    positionTopInPage = 0,
    pageInfo,
    numPages,
    scale,
    scrollOffset,
}: CalculateScrollPositionParams): number | null {
    if (!pageInfo || pageInfo.length === 0 || targetPageNumber < 1 || targetPageNumber > numPages || !pageInfo[targetPageNumber - 1]) {
        return null;
    }

    const targetPageInfo = pageInfo[targetPageNumber - 1];
    const absolutePositionInContainer = targetPageInfo.offsetTop + (positionTopInPage * scale);
    const scrollTo = absolutePositionInContainer - scrollOffset;

    return scrollTo;
}

interface PdfViewerPageListProps extends PageProps {
    onSelectionChange?: (value: SelectionProps | undefined) => void;
}

const PdfViewerPageList: React.FC<PdfViewerPageListProps> = ({ children, onSelectionChange, ...props }) => {
    const { numPages, setSelection, page, scale, mode } = usePdfViewer();

    const handleMouseUp = (event: React.MouseEvent<HTMLDivElement>, pageNumber: number) => {
        const selection = window.getSelection();

        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const content = selection.toString().trim();
        if (!content) return;

        const rects = range.getClientRects();
        const container = event.currentTarget;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();

        const coords = Array.from(rects).map(rect => ({
            x: (rect.left - containerRect.left) / scale,
            y: (rect.top - containerRect.top) / scale,
            width: rect.width / scale,
            height: rect.height / scale,
        }));

        setSelection({
            content,
            coords,
            page: pageNumber,
        });

        onSelectionChange?.({
            content,
            coords,
            page: pageNumber,
        })
    };

    if (!numPages) return null;

    const renderPageContent = (pageNumber: number) => {
        return (
            <PageNumberContext.Provider key={pageNumber} value={pageNumber}>
                <div
                    onMouseUp={e => handleMouseUp(e, pageNumber)}
                    className="pdf-container relative shadow-lg"
                >
                    {children}
                    <Page
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        pageIndex={pageNumber - 1}
                        pageNumber={pageNumber}
                        scale={scale}
                        {...props}
                    />
                </div>
            </PageNumberContext.Provider>
        );
    };

    if (mode === "single") {
        return (
            renderPageContent(page)
        );
    }

    return Array.from({ length: numPages }).map((_, index) => {
        const pageNumber = index + 1;

        return renderPageContent(pageNumber)
    });
};


const PdfViewerSelection = () => {
    const { selection } = usePdfViewer();
    const pageNumber = usePageNumber()

    if (!selection || selection.coords.length === 0 || selection.page !== pageNumber) {
        return null;
    }

    return (
        <>
            {selection.coords.map((coord, index) => (
                <div
                    key={index}
                    className="absolute opacity-20 pointer-events-none bg-yellow-200"
                    style={{
                        left: `${coord.x}px`,
                        top: `${coord.y}px`,
                        width: `${coord.width}px`,
                        height: `${coord.height}px`,
                    }}
                />
            ))}
        </>
    );
};

interface PdfViewerSelectionAreaProps {
    children: React.ReactNode;
    positionRelativeTo?: 'first' | 'last';
    offset?: { x: number; y: number };
}

const PdfViewerSelectionArea: React.FC<PdfViewerSelectionAreaProps> = ({
    children,
    positionRelativeTo = 'last',
    offset = { x: 0, y: 5 },
}) => {
    const { selection, scale } = usePdfViewer();

    const pageNumber = usePageNumber()

    if (!selection || selection.coords.length === 0 || selection.page !== pageNumber) {
        return null;
    }

    let targetRect = selection.coords[0];

    if (positionRelativeTo === 'last') {
        targetRect = selection.coords[selection.coords.length - 1];
    } else if (positionRelativeTo === 'first') {
        targetRect = selection.coords[0];
    }

    const top = (targetRect.y * scale) + (targetRect.height * scale) + offset.y;
    const left = (targetRect.x * scale) + offset.x;

    return (
        <div
            style={{
                top: `${top}px`,
                left: `${left}px`,
            }}
            className="pdf-interactive-element absolute z-10"
        >
            {children}
        </div>
    );
};

interface PdfViewerSelectionClearProps {
    asChild?: boolean;
    onClick?: () => void;
    children?: React.ReactNode;
}

const PdfViewerSelectionClear: React.FC<PdfViewerSelectionClearProps> = ({
    asChild,
    onClick,
    children,
    ...props
}) => {
    const { setSelection } = usePdfViewer();

    const handleClearSelection = () => {
        setSelection(undefined);
        onClick?.();
    };

    const Comp = asChild ? Slot : 'button';

    return (
        <Comp
            onClick={handleClearSelection}
            {...props}
        >
            {children}
        </Comp>
    );
};

interface PdfViewerHighlightProps {
    page: number;
    coords: CoordProps[];
    onHighlightClick?: (coords: CoordProps[]) => void;
    asChild?: boolean;
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

const PdfViewerHighlight: React.FC<PdfViewerHighlightProps> = ({
    page,
    coords,
    asChild,
    children,
    className,
    style,
    ...props
}) => {
    const { scale } = usePdfViewer()
    const pageNumber = usePageNumber()

    if (!coords || coords.length === 0 || page !== pageNumber) {
        return null;
    }

    const Comp = asChild ? Slot : 'div';

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    coords.forEach(coord => {
        const scaledX = coord.x * scale;
        const scaledY = coord.y * scale;
        const scaledWidth = coord.width * scale;
        const scaledHeight = coord.height * scale;

        minX = Math.min(minX, scaledX);
        minY = Math.min(minY, scaledY);
        maxX = Math.max(maxX, scaledX + scaledWidth);
        maxY = Math.max(maxY, scaledY + scaledHeight);
    });

    const totalWidth = maxX - minX;
    const totalHeight = maxY - minY;

    const containerStyle: React.CSSProperties = {
        left: `${minX}px`,
        top: `${minY}px`,
        width: `${totalWidth}px`,
        height: `${totalHeight}px`,
        ...style,
    };

    return (
        <Comp
            className={cn("pdf-interactive-element z-30 absolute", className)}
            style={containerStyle}
            {...props}
        >
            {coords.map((coord, idx) => (
                <div
                    key={idx}
                    style={{
                        left: `${(coord.x * scale) - minX}px`,
                        top: `${(coord.y * scale) - minY}px`,
                        width: `${coord.width * scale}px`,
                        height: `${coord.height * scale}px`,
                    }}
                    className="pointer-events-none absolute bg-blue-500 opacity-20"
                />
            ))}
            {asChild ? children : null}
        </Comp>
    );
};

const PdfViewerInteractiveArea: React.FC<React.ComponentProps<"div">> = ({
    children,
    className,
    ...props
}) => {
    return (
        <div
            className={cn("pdf-interactive-element", className)}
            {...props}
        >
            {children}
        </div>
    );
};

const PdfViewerHeader: React.FC<React.ComponentProps<"header">> = ({ ...props }) => {
    return <header {...props} className={cn("shrink-0 p-4 border-b flex", props.className)} />
}

PdfViewerHeader.displayName = "PdfViewerHeader"

const PdfViewerFooter: React.FC<React.ComponentProps<"footer">> = ({ ...props }) => {
    return <footer {...props} className={cn("shrink-0 p-4 border-t flex", props.className)} />
}

PdfViewerFooter.displayName = "PdfViewerFooter"

const PdfViewerZoom: React.FC<React.ComponentProps<"p">> = ({ ...props }) => {
    const { scale } = usePdfViewer()

    return <p {...props} className={cn("text-sm font-medium", props.className)}>{scale.toFixed(1)}%</p>
}

PdfViewerZoom.displayName = "PdfViewerZoom"

interface PdfViewerZoomProps extends React.HTMLAttributes<HTMLButtonElement> {
    asChild?: boolean;
}

const PdfViewerZoomIn = React.forwardRef<HTMLButtonElement, PdfViewerZoomProps>(
    ({ asChild, onClick, ...props }, ref) => {
        const { scale, setScale } = usePdfViewer();

        const Comp = asChild ? Slot : 'button';

        const handleZoomIn = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            setScale(scale * 1.1);
            if (onClick) {
                onClick(event);
            }
        };

        return (
            <Comp ref={ref} onClick={handleZoomIn} {...props}>
                {props.children}
            </Comp>
        );
    }
);

PdfViewerZoomIn.displayName = 'PdfViewerZoomIn';

const PdfViewerZoomOut = React.forwardRef<HTMLButtonElement, PdfViewerZoomProps>(
    ({ asChild, onClick, ...props }, ref) => {
        const { scale, setScale } = usePdfViewer();

        const Comp = asChild ? Slot : 'button';

        const handleZoomOut = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            setScale(scale * 0.9);
            if (onClick) {
                onClick(event);
            }
        };

        return (
            <Comp ref={ref} onClick={handleZoomOut} {...props}>
                {props.children}
            </Comp>
        );
    }
);

PdfViewerZoomOut.displayName = 'PdfViewerZoomOut';

interface PageInfo {
    element: HTMLDivElement;
    offsetTop: number;
    height: number;
}

const usePageInfo = (containerRef: React.RefObject<HTMLDivElement>, numPages: number | null, scale: number): PageInfo[] => {
    const [pageInfo, setPageInfo] = React.useState<PageInfo[]>([]);

    React.useEffect(() => {
        const container = containerRef.current;

        if (!container || !numPages) {
            return;
        }

        const measureInfo = () => {
            const info: PageInfo[] = [];
            const pageElements = container.querySelectorAll('.pdf-container');

            if (pageElements.length === numPages) {
                pageElements.forEach((el) => {
                    const htmlElement = el as HTMLElement;
                    info.push({
                        element: htmlElement as HTMLDivElement,
                        offsetTop: htmlElement.offsetTop,
                        height: htmlElement.getBoundingClientRect().height,
                    });
                });

                setPageInfo(info);
            }
        };

        measureInfo();

        const mutationObserver = new MutationObserver(measureInfo);
        const resizeObserver = new ResizeObserver(measureInfo);

        if (container) {
            mutationObserver.observe(container, { childList: true, subtree: true });
            resizeObserver.observe(container);
        }

        return () => {
            if (container && mutationObserver) {
                mutationObserver.disconnect();
            }
            if (container && resizeObserver) {
                resizeObserver.unobserve(container);
            }
        };
    }, [containerRef, numPages, scale]);

    return pageInfo;
};

interface PdfViewerPaginationProps extends React.ComponentProps<"button"> {
    asChild?: boolean;
}

const PdfViewerPaginationNext = React.forwardRef<HTMLButtonElement, PdfViewerPaginationProps>(
    ({ asChild, onClick, disabled, ...props }, ref) => {
        const { numPages, page, setPage, pageContainerRef, scrollOffset, mode, scale } = usePdfViewer();

        const pageInfo = usePageInfo(pageContainerRef as React.RefObject<HTMLDivElement>, numPages, scale);

        const Comp = asChild ? Slot : 'button';

        const isDisabled = disabled || !numPages || page >= numPages;

        const handleNextPage = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            const container = pageContainerRef.current;

            if (!container || isDisabled || page >= numPages! || !pageInfo[page]) {
                return;
            }

            if (mode === "multiple") {
                const nextPageInfo = pageInfo[page];
                const scrollTo = nextPageInfo.offsetTop - scrollOffset;

                container.scrollTo({
                    top: scrollTo,
                    behavior: 'smooth'
                });
            }

            setPage(page + 1);

            if (onClick) {
                onClick(event);
            }
        };

        return (
            <Comp ref={ref} onClick={handleNextPage} disabled={isDisabled} {...props}>
                {props.children}
            </Comp>
        );
    }
);

PdfViewerPaginationNext.displayName = 'PdfViewerPaginationNext';

const PdfViewerPaginationBack = React.forwardRef<HTMLButtonElement, PdfViewerPaginationProps>(
    ({ asChild, onClick, disabled, ...props }, ref) => {
        const { numPages, page, setPage, pageContainerRef, scrollOffset, mode, scale } = usePdfViewer();

        const pageInfo = usePageInfo(pageContainerRef as React.RefObject<HTMLDivElement>, numPages, scale);

        const Comp = asChild ? Slot : 'button';

        const isDisabled = disabled || page <= 1;

        const handlePreviousPage = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            const container = pageContainerRef.current;

            if (!container || isDisabled || page <= 1 || !pageInfo[page - 2]) {
                return
            }

            if (mode === "multiple") {
                const previousPageInfo = pageInfo[page - 2];
                const scrollTo = previousPageInfo.offsetTop - scrollOffset;

                container.scrollTo({
                    top: scrollTo,
                    behavior: 'smooth'
                });
            }

            setPage(page - 1);

            if (onClick) {
                onClick(event);
            }
        };

        return (
            <Comp ref={ref} onClick={handlePreviousPage} disabled={isDisabled} {...props}>
                {props.children}
            </Comp>
        );
    }
);

PdfViewerPaginationBack.displayName = 'PdfViewerPaginationBack';

interface PdfViewerNavigateToHighlightProps extends React.HTMLAttributes<HTMLButtonElement> {
    asChild?: boolean;
    page: number;
    coords: CoordProps[];
}

const PdfViewerNavigateToHighlightAction = React.forwardRef<HTMLButtonElement, PdfViewerNavigateToHighlightProps>(
    ({ asChild, onClick, page, coords, ...props }, ref) => {
        const { scrollToPosition } = usePdfViewer();

        const Comp = asChild ? Slot : 'button';

        const handleNavigate = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {

            if (!coords || coords.length === 0) {
                return;
            }

            const targetPositionTop = coords[0].y;

            scrollToPosition(targetPositionTop, page);

            if (onClick) {
                onClick(event);
            }
        };

        const isDisabled = !coords || coords.length === 0;

        return (
            <Comp ref={ref} onClick={handleNavigate} disabled={isDisabled} {...props}>
                {props.children}
            </Comp>
        );
    }
);

PdfViewerNavigateToHighlightAction.displayName = 'PdfViewerNavigateToHighlight';

interface PdfViewerThumbnailItemProps extends React.HTMLAttributes<HTMLButtonElement> {
    asChild?: boolean;
    pageNumber: number;
}

const PdfViewerThumbnailItem = React.forwardRef<HTMLButtonElement, PdfViewerThumbnailItemProps>(
    ({ asChild, onClick, pageNumber, ...props }, ref) => {
        const { scrollToPage, pdf } = usePdfViewer();

        const Comp = asChild ? Slot : 'button';

        const handleThumbnailClick = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            scrollToPage(pageNumber);

            if (onClick) {
                onClick(event);
            }
        };

        if (!pdf) return null

        return (
            <Comp
                ref={ref}
                disabled={!pdf}
                className="shadow-2xl"
                onClick={handleThumbnailClick}
                {...props}
            >
                <Thumbnail
                    width={148}
                    height={148}
                    pdf={pdf}
                    pageNumber={pageNumber}
                    onItemClick={() => ({})}
                />
            </Comp>
        );
    }
);

PdfViewerThumbnailItem.displayName = 'PdfViewerThumbnailItem';

interface PdfViewerThumbnailsListProps extends React.HTMLAttributes<HTMLDivElement> {
    render: (pageNumber: number) => React.ReactNode;
}

const PdfViewerThumbnailsList: React.FC<PdfViewerThumbnailsListProps> = ({ render, ...props }) => {
    const { numPages, pdf } = usePdfViewer();

    if (!pdf || !numPages) {
        return <div {...props}>Carregando miniaturas...</div>;
    }

    const pageNumbers = Array.from({ length: numPages }, (_, i) => i + 1);

    return (
        <div {...props} className={cn("pdf-interactive-element flex flex-col space-y-4 items-center", props.className)}>
            {pageNumbers.map(pageNumber => (
                <React.Fragment key={pageNumber}>
                    {render(pageNumber)}
                </React.Fragment>
            ))}
        </div>
    );
};

PdfViewerThumbnailsList.displayName = 'PdfViewerThumbnailsList';

interface PdfViewerBookmarksListProps extends React.HTMLAttributes<HTMLDivElement> {
    render: (bookmark: PdfBookmark, depth: number) => React.ReactNode;
}

const PdfViewerBookmarksList: React.FC<PdfViewerBookmarksListProps> = ({ render, ...props }) => {
    const { bookmarks } = usePdfViewer();

    const renderBookmarkItems = (items: PdfBookmark[], depth: number = 0) => {
        return items.map((bookmark, index) => (
            <React.Fragment key={index}>
                {render(bookmark, depth)}
                {bookmark.items && bookmark.items.length > 0 && (
                    renderBookmarkItems(bookmark.items, depth + 1)
                )}
            </React.Fragment>
        ));
    };


    if (!bookmarks) {
        return <div {...props}>Carregando bookmarks...</div>;
    }

    if (bookmarks.length === 0) {
        return <div {...props}>Sem bookmarks.</div>;
    }

    return (
        <div className={cn("pdf-interactive-element", props.className)} {...props}>
            {renderBookmarkItems(bookmarks)}
        </div>
    );
};

PdfViewerBookmarksList.displayName = 'PdfViewerBookmarksList';

interface PdfViewerBookmarksListItemProps extends React.HTMLAttributes<HTMLButtonElement> {
    asChild?: boolean;
    bookmark: PdfBookmark;
    depth?: number;
}

const PdfViewerBookmarksListItem = React.forwardRef<HTMLButtonElement, PdfViewerBookmarksListItemProps>(
    ({ asChild, onClick, bookmark, ...props }, ref) => {
        const { navigateToDest } = usePdfViewer();

        const Comp = asChild ? Slot : 'button';

        const handleBookmarkClick = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            console.log(bookmark)
            if (bookmark.dest) {
                navigateToDest(bookmark.dest);
            }

            if (onClick) {
                onClick(event);
            }
        };

        const isDisabled = !bookmark.dest;

        return (
            <Comp
                ref={ref}
                onClick={handleBookmarkClick}
                className={cn("pdf-interactive-element", props.className)}
                disabled={isDisabled}
                {...props}
            >
                {props.children ? props.children : bookmark.title}
            </Comp>
        );
    }
);

PdfViewerBookmarksListItem.displayName = 'PdfViewerBookmarksListItem';

export {
    PdfViewer,
    PdfViewerPageList,
    PdfViewerSelection,
    PdfViewerSelectionArea,
    PdfViewerSelectionClear,
    PdfViewerHighlight,
    PdfViewerInteractiveArea,
    PdfViewerHeader,
    PdfViewerFooter,
    PdfViewerZoom,
    PdfViewerZoomIn,
    PdfViewerZoomOut,
    PdfViewerPaginationNext,
    PdfViewerPaginationBack,
    PdfViewerNavigateToHighlightAction,
    PdfViewerThumbnailsList,
    PdfViewerThumbnailItem,
    PdfViewerBookmarksList,
    PdfViewerBookmarksListItem
}