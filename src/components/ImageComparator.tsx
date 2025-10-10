import { html } from 'htm/preact';
import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import { formatBytes } from '../utils/formatters';

interface ImageComparatorProps {
    originalUrl: string;
    compressedUrl: string | null;
    originalFile: File;
    compressedSize: number | null;
    isLoading: boolean;
}

const CompareIcon = () => html`
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M13 18l6-6-6-6M5 18l6-6-6-6" />
    </svg>
`;

export const ImageComparator = ({ originalUrl, compressedUrl, originalFile, compressedSize, isLoading }: ImageComparatorProps) => {
    const [sliderPosition, setSliderPosition] = useState(50);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleInteractionMove = useCallback((clientX: number) => {
        if (!isDragging || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        let newPosition = (x / rect.width) * 100;
        if (newPosition < 0) newPosition = 0;
        if (newPosition > 100) newPosition = 100;
        setSliderPosition(newPosition);
    }, [isDragging]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        handleInteractionMove(e.clientX);
    }, [handleInteractionMove]);
    
    const handleTouchMove = useCallback((e: TouchEvent) => {
        if(e.touches[0]) handleInteractionMove(e.touches[0].clientX);
    }, [handleInteractionMove]);

    const stopDragging = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            document.body.style.cursor = 'ew-resize';
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', stopDragging);
            window.addEventListener('touchmove', handleTouchMove);
            window.addEventListener('touchend', stopDragging);
        }

        return () => {
            document.body.style.cursor = '';
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', stopDragging);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', stopDragging);
        };
    }, [isDragging, handleMouseMove, stopDragging, handleTouchMove]);

    const startDragging = (e: MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };
    
    const startTouchDragging = () => {
        setIsDragging(true);
    };
    
    const reduction = compressedSize !== null ? Math.round(100 - (compressedSize / originalFile.size) * 100) : 0;

    return html`
        <div class="comparator-wrapper">
            <div class="file-details">
                <p><strong>File:</strong> ${originalFile.name}</p>
                 <div class="comparator-stats">
                    <span><strong>Original:</strong> ${formatBytes(originalFile.size)}</span>
                    ${compressedSize !== null && html`
                        <span><strong>Compressed:</strong> ${formatBytes(compressedSize)}</span>
                        <span class="size-reduction"><strong>Reduction:</strong> ${reduction}%</span>
                    `}
                </div>
            </div>

            <div ref=${containerRef} class="comparator-container">
                <div class="comparator-image-wrapper">
                    <img src=${originalUrl} alt="Original" class="comparator-image-under" draggable="false" />
                    ${compressedUrl && html`
                        <div class="comparator-image-over-wrapper" style=${{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}>
                            <img src=${compressedUrl} alt="Compressed" class="comparator-image-over" draggable="false" />
                        </div>
                        <div class="comparator-handle" style=${{ left: `${sliderPosition}%` }} onMouseDown=${startDragging} onTouchStart=${startTouchDragging}>
                            <div class="comparator-handle-bar"><${CompareIcon}/></div>
                        </div>
                    `}
                </div>
                ${isLoading && !compressedUrl && html`
                    <div class="comparator-loading-overlay">
                        <div class="loader"></div>
                        <p>Preparing preview...</p>
                    </div>
                `}
            </div>
        </div>
    `;
};